// server/src/routes/matchQueue.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo";
import type { MatchQueueDoc, GameMode, UserDoc } from "../db/types";
import { verifySessionToken } from "../auth/session";
import { ENV } from "../config/env";

export const matchQueueRouter = Router();

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

  try {
    const payload = await verifySessionToken(token);
    if (!payload || !payload.userId) {
      res.status(401).json({
        ok: false,
        status: 401,
        error: "UNAUTHORIZED",
      });
      return null;
    }
    return new ObjectId(payload.userId);
  } catch (err) {
    console.error("Internal Server Error:", err);
    res.status(500).json({
      ok: false,
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
    });
    return null;
  }
}

interface JoinQueueRequestBody {
  mode: GameMode;
  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };
}

// POST /api/match-queue/join
matchQueueRouter.post("/join", async (req: Request, res: Response) => {
  const userId = await getSessionUserId(req, res);
  if (!userId) return;

  const { mode, timeControl } = req.body as JoinQueueRequestBody;

  // mode 검증
  if (mode !== "rapid" && mode !== "blitz" && mode !== "bullet") {
    res.status(400).json({
      ok: false,
      status: 400,
      error: "INVALID_MODE",
    });
    return;
  }

  // timeControl 검증
  if (
    !timeControl ||
    typeof timeControl.initialSeconds !== "number" ||
    typeof timeControl.incrementSeconds !== "number"
  ) {
    res.status(400).json({
      ok: false,
      status: 400,
      error: "INVALID_TIME_CONTROL",
    });
    return;
  }

  try {
    const db = getDb();
    const matchQueues = db.collection<MatchQueueDoc>("matchQueues");
    const users = db.collection<UserDoc>("users");

    // 이미 waiting 상태의 큐에 있는지 확인
    const existing = await matchQueues.findOne({
      userId,
      status: "waiting",
    });

    if (existing) {
      res.status(400).json({
        ok: false,
        status: 400,
        error: "ALREADY_IN_QUEUE",
      });
      return;
    }

    // 유저 레이팅 조회
    const user = await users.findOne({ _id: userId });

    if (!user) {
      res.status(404).json({
        ok: false,
        status: 404,
        error: "USER_NOT_FOUND",
      });
      return;
    }

    const ratingValue =
      mode === "rapid"
        ? user.rating.rapid
        : mode === "blitz"
        ? user.rating.blitz
        : user.rating.bullet;

    const now = new Date();

    const insertResult = await matchQueues.insertOne({
      userId,
      ratingSnapshot: {
        mode,
        value: ratingValue,
      },
      timeControl: {
        initialSeconds: timeControl.initialSeconds,
        incrementSeconds: timeControl.incrementSeconds,
      },
      region: "asia",
      status: "waiting",
      roomId: null,
      createdAt: now,
      matchedAt: null,
    } as MatchQueueDoc);

    res.json({
      ok: true,
      status: 200,
      data: {
        queueId: insertResult.insertedId,
      },
    });
  } catch (err) {
    console.error("Failed to join match queue:", err);
    res.status(500).json({
      ok: false,
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

// POST /api/match-queue/cancel
matchQueueRouter.post("/cancel", async (req: Request, res: Response) => {
  const userId = await getSessionUserId(req, res);
  if (!userId) return;

  try {
    const db = getDb();
    const matchQueues = db.collection<MatchQueueDoc>("matchQueues");

    const result = await matchQueues.updateOne(
      { userId, status: "waiting" },
      { $set: { status: "cancelled" } }
    );

    if (result.matchedCount === 0) {
      res.status(400).json({
        ok: false,
        status: 400,
        error: "NOT_IN_QUEUE",
      });
      return;
    }

    res.json({
      ok: true,
      status: 200,
    });
  } catch (err) {
    console.error("Failed to cancel match queue:", err);
    res.status(500).json({
      ok: false,
      status: 500,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});
