// server/src/routes/rooms.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo";
import type { RoomDoc, GameMode, RoomType } from "../db/types";
import { verifySessionToken } from "../auth/session";
import { ENV } from "../config/env";

export const roomsRouter = Router();

interface CreateRoomRequestBody {
  mode?: GameMode | null;
  type: RoomType;
  rated: boolean;
  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };
}

// 공통: 세션에서 userId(ObjectId) 가져오기
async function getSessionUserId(
  req: Request,
  res: Response
): Promise<ObjectId | null> {
  const token = req.cookies[ENV.AUTH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
    });
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    res.status(401).json({
      ok: false,
      status: 401,
      error: "INVALID_SESSION",
    });
    return null;
  }

  return new ObjectId(session.userId);
}

/**
 * POST /api/rooms
 * 방 생성 (public / friendly / ai 공통 뼈대)
 */
roomsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const hostUserId = await getSessionUserId(req, res);
    if (!hostUserId) {
      // getSessionUserId 내부에서 이미 응답을 보냄
      return;
    }

    const db = getDb();
    const roomsCol = db.collection<RoomDoc>("rooms");

    const body = req.body as CreateRoomRequestBody;
    const { type, mode = null, rated, timeControl } = body;

    if (!type || !timeControl) {
      return res.status(400).json({
        ok: false,
        status: 400,
        error: "INVALID_BODY",
        message: "type, timeControl은 필수입니다.",
      });
    }

    if (
      typeof timeControl.initialSeconds !== "number" ||
      timeControl.initialSeconds <= 0 ||
      typeof timeControl.incrementSeconds !== "number" ||
      timeControl.incrementSeconds < 0
    ) {
      return res.status(400).json({
        ok: false,
        status: 400,
        error: "INVALID_TIME_CONTROL",
        message:
          "timeControl.initialSeconds > 0, timeControl.incrementSeconds >= 0 이어야 합니다.",
      });
    }

    // 설계서 상 일관성 규칙:
    // - public 방은 무조건 rated: true
    // - friendly 방은 무조건 rated: false
    let finalRated = rated;
    if (type === "public") {
      if (rated !== true) {
        return res.status(400).json({
          ok: false,
          status: 400,
          error: "INVALID_RATED_FOR_PUBLIC",
          message: "public 방은 rated=true 여야 합니다.",
        });
      }
      finalRated = true;
    } else if (type === "friendly") {
      if (rated !== false) {
        return res.status(400).json({
          ok: false,
          status: 400,
          error: "INVALID_RATED_FOR_FRIENDLY",
          message: "friendly 방은 rated=false 여야 합니다.",
        });
      }
      finalRated = false;
    }

    const now = new Date();
    const initialRemainingMs = timeControl.initialSeconds * 1000;
    // 최소한의 gameState만 채워두고, 상세 로직은 이후 6.3-3, 6.3-4에서 확장
    const insertResult = await roomsCol.insertOne({
      code: null,
      mode: mode ?? null,
      type,
      status: "waiting",
      rated: finalRated,
      timeControl: {
        initialSeconds: timeControl.initialSeconds,
        incrementSeconds: timeControl.incrementSeconds,
      },
      hostUserId,
      whiteUserId: null,
      blackUserId: null,
      // spectators는 RoomDoc에서 필수 배열이므로 빈 배열로 초기화
      spectators: [],
      gameId: null,
      gameState: {
        boardFEN:
          "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moveCount: 0,
        turn: "white",
        clocks: {
          whiteRemainingMs: initialRemainingMs,
          blackRemainingMs: initialRemainingMs,
          lastMoveAt: now,
        },
        moves: [],
        result: {
          status: "ongoing",
          reason: null,
        },
      },
      createdAt: now,
      updatedAt: now,
    } as any);

    const room = await roomsCol.findOne({ _id: insertResult.insertedId });

    return res.status(201).json({
      ok: true,
      room: room && {
        id: room._id.toHexString(),
        type: room.type,
        mode: room.mode,
        status: room.status,
        rated: room.rated,
        timeControl: room.timeControl,
        hostUserId: room.hostUserId.toHexString(),
        whiteUserId: room.whiteUserId
          ? room.whiteUserId.toHexString()
          : null,
        blackUserId: room.blackUserId
          ? room.blackUserId.toHexString()
          : null,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (err) {
    console.error("POST /api/rooms error:", err);
    return res.status(500).json({
      ok: false,
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

/**
 * GET /api/rooms
 * 공개 대기방 목록 조회 (기본: type=public, status=waiting)
 * 쿼리로 type, mode 정도는 필터 가능하게 열어둠.
 */
roomsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const roomsCol = db.collection<RoomDoc>("rooms");

    const { type, mode } = req.query;

    const filter: any = {
      status: "waiting",
    };

    if (typeof type === "string") {
      filter.type = type as RoomType;
    } else {
      // 기본값: public 대기방
      filter.type = "public";
    }

    if (typeof mode === "string") {
      filter.mode = mode as GameMode;
    }

    const rooms = await roomsCol
      .find(filter, {
        projection: {
          code: 1,
          mode: 1,
          type: 1,
          status: 1,
          rated: 1,
          timeControl: 1,
          hostUserId: 1,
          whiteUserId: 1,
          blackUserId: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return res.json({
      ok: true,
      rooms: rooms.map((room) => ({
        id: room._id.toHexString(),
        type: room.type,
        mode: room.mode,
        rated: room.rated,
        status: room.status,
        timeControl: room.timeControl,
        hostUserId: room.hostUserId.toHexString(),
        whiteUserId: room.whiteUserId
          ? room.whiteUserId.toHexString()
          : null,
        blackUserId: room.blackUserId
          ? room.blackUserId.toHexString()
          : null,
        createdAt: room.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/rooms error:", err);
    return res.status(500).json({
      ok: false,
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

/**
 * GET /api/rooms/:id
 * 단일 방 상세 조회
 */
roomsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        status: 400,
        error: "INVALID_ID",
      });
    }

    const db = getDb();
    const roomsCol = db.collection<RoomDoc>("rooms");

    const room = await roomsCol.findOne({
      _id: new ObjectId(id),
    });

    if (!room) {
      return res.status(404).json({
        ok: false,
        status: 404,
        error: "ROOM_NOT_FOUND",
      });
    }

    return res.json({
      ok: true,
      room: {
        id: room._id.toHexString(),
        type: room.type,
        mode: room.mode,
        rated: room.rated,
        status: room.status,
        timeControl: room.timeControl,
        hostUserId: room.hostUserId.toHexString(),
        whiteUserId: room.whiteUserId
          ? room.whiteUserId.toHexString()
          : null,
        blackUserId: room.blackUserId
          ? room.blackUserId.toHexString()
          : null,
        gameId: room.gameId ? room.gameId.toHexString() : null,
        code: room.code,
        gameState: room.gameState,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /api/rooms/:id error:", err);
    return res.status(500).json({
      ok: false,
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});
