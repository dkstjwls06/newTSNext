import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { ObjectId } from 'mongodb';
import next from 'next';
import { ENV } from './config/env';
import { connectMongo, getDb } from './db/mongo';
import { initDb } from './db/init';
import { authRouter } from "./routes/auth";
import { usersRouter } from './routes/users';
import { roomsRouter } from './routes/rooms';
import { matchQueueRouter } from './routes/matchQueue';
import { verifySessionToken } from './auth/session';
import { match } from 'assert';

// 개발 모드 여부
const dev = process.env.NODE_ENV !== "production";

const nextApp = next({
    dev,
    dir: path.resolve(__dirname, "..", "..", "frontend"), // Next.js 프로젝트 경로
});
const handle = nextApp.getRequestHandler();

async function startServer() {
  const { client, db }=await connectMongo();

  await initDb(db);

  await nextApp.prepare();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: [ENV.CORS_ORIGIN],
      methods: ["GET", "POST"],
    },
  });

  const PORT = ENV.PORT;

  // ✅ Socket.IO 연결 처리
  io.on("connection", (socket) => {
    // 1) 핸드셰이크 쿠키에서 세션 토큰 추출
    const cookieHeader = socket.request.headers.cookie || "";
    const cookies: Record<string, string> = {};

    for (const part of cookieHeader.split(";")) {
      const [rawKey, ...rawValParts] = part.split("=");
      if (!rawKey) continue;
      const key = rawKey.trim();
      if (!key) continue;
      const value = rawValParts.join("=").trim();
      cookies[key] = value;
    }

    const token = cookies[ENV.AUTH_COOKIE_NAME];
    const session = token ? verifySessionToken(token) : null;

    if (session && session.userId) {
      // 이후 이벤트에서 재사용할 수 있도록 userId를 socket.data에 넣어 둔다.
      (socket.data as any).userId = session.userId;
    }

    console.log(
      "✅ a user connected:",
      socket.id,
      "userId=",
      (socket.data as any).userId ?? null,
    );

    socket.emit("hello", { msg: "welcome" });
    
    // ✅ 방 입장 이벤트: room:join
    // payload: { roomId: string }
    // 클라이언트 예시: socket.emit("room:join", { roomId }, (res) => { ... });
    socket.on(
      "room:join",
      async (
        payload: { roomId?: string },
        ack?: (res: any) => void,
      ) => {
        try {
          const userId = (socket.data as any).userId;
          if (!userId) {
            if (ack) {
              ack({ ok: false, error: "UNAUTHENTICATED" });
            }
            return;
          }

          const roomId = payload?.roomId;
          if (!roomId) {
            if (ack) {
              ack({ ok: false, error: "INVALID_PAYLOAD" });
            }
            return;
          }

          let roomObjectId: ObjectId;
          try {
            roomObjectId = new ObjectId(roomId);
          } catch {
            if (ack) {
              ack({ ok: false, error: "INVALID_ROOM_ID" });
            }
            return;
          }

          const db = getDb();
          const rooms = db.collection("rooms");

          const room = await rooms.findOne({ _id: roomObjectId });
          if (!room) {
            if (ack) {
              ack({ ok: false, error: "ROOM_NOT_FOUND" });
            }
            return;
          }

          const socketRoomKey = roomObjectId.toHexString();

          // Socket.IO 내부 room에 참가
          socket.join(socketRoomKey);

          // 다른 클라이언트에게 "누가 들어왔다"를 알려주는 단순 broadcast
          socket.to(socketRoomKey).emit("room:user-joined", {
            roomId: socketRoomKey,
            userId,
          });

          // 입장한 클라이언트에게 현재 방 상태(rooms 컬렉션 도큐먼트)를 내려준다.
          socket.emit("room:state", room);

          if (ack) {
            ack({
              ok: true,
              roomId: socketRoomKey,
            });
          }
        } catch (err) {
          console.error("room:join error:", err);
          if (ack) {
            ack({ ok: false, error: "INTERNAL_SERVER_ERROR" });
          }
        }
      },
    );

    // ✅ 방 퇴장 이벤트: room:leave
    // payload: { roomId: string }
    // 클라이언트 예시: socket.emit("room:leave", { roomId }, (res) => { ... });
    socket.on(
      "room:leave",
      (payload: { roomId?: string }, ack?: (res: any) => void) => {
        try {
          const roomId = payload?.roomId;
          if (!roomId) {
            if (ack) {
              ack({ ok: false, error: "INVALID_PAYLOAD" });
            }
            return;
          }

          socket.leave(roomId);

          const userId = (socket.data as any).userId ?? null;

          // 다른 클라이언트에게 "누가 나갔다"를 알려주는 단순 broadcast
          socket.to(roomId).emit("room:user-left", {
            roomId,
            userId,
          });

          if (ack) {
            ack({ ok: true });
          }
        } catch (err) {
          console.error("room:leave error:", err);
          if (ack) {
            ack({ ok: false, error: "INTERNAL_SERVER_ERROR" });
          }
        }
      },
    );

    // ✅ 방 내 수(움직임) 적용 이벤트: room:move
    // payload 예시:
    // {
    //   roomId: string;
    //   from: string;            // 예: "e2"
    //   to: string;              // 예: "e4"
    //   san: string;             // 예: "e4"
    //   clientMoveNumber: number; // 클라이언트에서 생각하는 이번 수 번호 (1,2,...)
    //   nextFEN?: string;        // (옵션) 이 수 이후의 FEN – 1차 단계에서는 클라이언트 FEN 신뢰
    // }
    socket.on(
      "room:move",
      async (
        payload: {
          roomId?: string;
          from?: string;
          to?: string;
          san?: string;
          clientMoveNumber?: number;
          nextFEN?: string;
        },
        ack?: (res: any) => void,
      ) => {
        try {
          const userId = (socket.data as any).userId;
          if (!userId) {
            if (ack) {
              ack({ ok: false, error: "UNAUTHENTICATED" });
            }
            return;
          }

          const {
            roomId,
            from,
            to,
            san,
            clientMoveNumber,
            nextFEN,
          } = payload || {};

          // 기본 payload 검증
          if (
            !roomId ||
            !from ||
            !to ||
            !san ||
            typeof clientMoveNumber !== "number"
          ) {
            if (ack) {
              ack({ ok: false, error: "INVALID_PAYLOAD" });
            }
            return;
          }

          // roomId → ObjectId 변환
          let roomObjectId: ObjectId;
          try {
            roomObjectId = new ObjectId(roomId);
          } catch {
            if (ack) {
              ack({ ok: false, error: "INVALID_ROOM_ID" });
            }
            return;
          }

          const db = getDb();
          const rooms = db.collection("rooms");

          // 현재 방 도큐먼트 조회
          const room = await rooms.findOne({ _id: roomObjectId });
          if (!room) {
            if (ack) {
              ack({ ok: false, error: "ROOM_NOT_FOUND" });
            }
            return;
          }

          const socketRoomKey = roomObjectId.toHexString();

          const gameState = room.gameState;
          if (!gameState) {
            if (ack) {
              ack({ ok: false, error: "GAME_STATE_NOT_INITIALIZED" });
            }
            return;
          }

          // 현재 턴 / 수 번호
          const currentMoveCount =
            typeof gameState.moveCount === "number"
              ? gameState.moveCount
              : Array.isArray(gameState.moves)
              ? gameState.moves.length
              : 0;

          // 동시 입력 방지용 – clientMoveNumber는 currentMoveCount + 1 이어야 함
          if (clientMoveNumber !== currentMoveCount + 1) {
            if (ack) {
              ack({
                ok: false,
                error: "MOVE_CONFLICT",
                expectedMoveNumber: currentMoveCount + 1,
                actualMoveNumber: clientMoveNumber,
              });
            }
            return;
          }

          // 이 방에서의 white/black userId 추출
          const whiteUserId =
            room.whiteUserId instanceof ObjectId
              ? room.whiteUserId.toHexString()
              : room.whiteUserId
              ? String(room.whiteUserId)
              : null;
          const blackUserId =
            room.blackUserId instanceof ObjectId
              ? room.blackUserId.toHexString()
              : room.blackUserId
              ? String(room.blackUserId)
              : null;

          let playerColor: "white" | "black" | null = null;
          if (whiteUserId && whiteUserId === userId) {
            playerColor = "white";
          } else if (blackUserId && blackUserId === userId) {
            playerColor = "black";
          }

          if (!playerColor) {
            if (ack) {
              ack({ ok: false, error: "NOT_A_PLAYER" });
            }
            return;
          }

          // 현재 gameState.turn과 유저 색상 일치 여부 체크
          const movingSide =
            gameState.turn === "white" || gameState.turn === "black"
              ? gameState.turn
              : "white";

          if (playerColor !== movingSide) {
            if (ack) {
              ack({ ok: false, error: "NOT_YOUR_TURN" });
            }
            return;
          }

          const now = new Date();

          // 클럭 정보 기존 값
          const prevClocks = gameState.clocks || {};
          const prevWhiteRemainingMs =
            typeof prevClocks.whiteRemainingMs === "number"
              ? prevClocks.whiteRemainingMs
              : 0;
          const prevBlackRemainingMs =
            typeof prevClocks.blackRemainingMs === "number"
              ? prevClocks.blackRemainingMs
              : 0;

          const prevLastMoveAt =
            prevClocks.lastMoveAt instanceof Date
              ? prevClocks.lastMoveAt
              : now;

          const elapsedMs = Math.max(
            0,
            now.getTime() - prevLastMoveAt.getTime(),
          );

          // 증분(초읽기) – rooms.timeControl.incrementSeconds 기준
          const timeControl = room.timeControl || {};
          const incrementMs =
            typeof timeControl.incrementSeconds === "number"
              ? timeControl.incrementSeconds * 1000
              : 0;

          let newWhiteRemainingMs = prevWhiteRemainingMs;
          let newBlackRemainingMs = prevBlackRemainingMs;

          if (movingSide === "white") {
            newWhiteRemainingMs = Math.max(
              0,
              prevWhiteRemainingMs - elapsedMs + incrementMs,
            );
          } else {
            newBlackRemainingMs = Math.max(
              0,
              prevBlackRemainingMs - elapsedMs + incrementMs,
            );
          }

          const nextTurn = movingSide === "white" ? "black" : "white";

          // moves 배열에 이번 수 append
          const prevMoves = Array.isArray(gameState.moves)
            ? gameState.moves
            : [];

          const newMove = {
            moveNumber: clientMoveNumber,
            from,
            to,
            san,
            by: movingSide,
            createdAt: now,
          };

          const updatedMoves = [...prevMoves, newMove];

          // FEN 업데이트 – 클라이언트가 보내준 nextFEN이 있으면 사용
          const nextBoardFEN =
            typeof nextFEN === "string" && nextFEN.length > 0
              ? nextFEN
              : gameState.boardFEN;

          const updatedGameState = {
            ...gameState,
            boardFEN: nextBoardFEN,
            moveCount: clientMoveNumber,
            turn: nextTurn,
            clocks: {
              whiteRemainingMs: newWhiteRemainingMs,
              blackRemainingMs: newBlackRemainingMs,
              lastMoveAt: now,
            },
            moves: updatedMoves,
          };

          // 동시성 보호를 위해 gameState.moveCount 조건 포함
          const updateResult = await rooms.updateOne(
            {
              _id: roomObjectId,
              "gameState.moveCount": currentMoveCount,
            },
            {
              $set: {
                gameState: updatedGameState,
                updatedAt: now,
              },
            },
          );

          if (!updateResult.matchedCount) {
            if (ack) {
              ack({
                ok: false,
                error: "MOVE_CONFLICT_DB",
              });
            }
            return;
          }

          // 메모리 상 room 객체도 최신 gameState로 덮어씀
          const updatedRoom = {
            ...room,
            gameState: updatedGameState,
            updatedAt: now,
          };

          // 같은 방에 붙어 있는 모든 소켓에 broadcast
          io.to(socketRoomKey).emit("room:state", updatedRoom);

          if (ack) {
            ack({
              ok: true,
              gameState: updatedGameState,
            });
          }
        } catch (err) {
          console.error("room:move error:", err);
          if (ack) {
            ack({ ok: false, error: "INTERNAL_SERVER_ERROR" });
          }
        }
      },
    );

     // ✅ 방 채팅 전송 이벤트: room:chat:send
    // payload: { roomId: string; message: string }
    socket.on(
      "room:chat:send",
      async (
        payload: { roomId?: string; message?: string },
        ack?: (res: any) => void,
      ) => {
        try {
          const userId = (socket.data as any).userId;
          if (!userId) {
            if (ack) {
              ack({ ok: false, error: "UNAUTHENTICATED" });
            }
            return;
          }

          const roomId = payload?.roomId;
          const message = payload?.message;

          // roomId, message 기본 검증
          if (
            !roomId ||
            typeof message !== "string" ||
            message.trim().length === 0
          ) {
            if (ack) {
              ack({ ok: false, error: "INVALID_PAYLOAD" });
            }
            return;
          }

          let roomObjectId: ObjectId;
          try {
            roomObjectId = new ObjectId(roomId);
          } catch {
            if (ack) {
              ack({ ok: false, error: "INVALID_ROOM_ID" });
            }
            return;
          }

          const db = getDb();
          const roomsCol = db.collection("rooms");
          const chatMessagesCol = db.collection("chatMessages");
          const usersCol = db.collection("users");

          // 방 존재 여부 확인
          const room = await roomsCol.findOne({ _id: roomObjectId });
          if (!room) {
            if (ack) {
              ack({ ok: false, error: "ROOM_NOT_FOUND" });
            }
            return;
          }

          // 유저 정보 조회 (username 용)
          const userObjectId = new ObjectId(userId);
          const user = await usersCol.findOne({ _id: userObjectId });

          const now = new Date();

          // DB에 채팅 메시지 insert
          const insertResult = await chatMessagesCol.insertOne({
            channelType: "room",
            roomId: roomObjectId,
            gameId: room.gameId ?? null,
            conversationId: null,
            userId: userObjectId,
            username: user?.username ?? null,
            type: "text",
            message,
            createdAt: now,
          });

          const savedMessage = {
            _id: insertResult.insertedId,
            channelType: "room",
            roomId: roomObjectId,
            gameId: room.gameId ?? null,
            conversationId: null,
            userId: userObjectId,
            username: user?.username ?? null,
            type: "text",
            message,
            createdAt: now,
          };

          const socketRoomKey = roomObjectId.toHexString();

          // 같은 방에 접속한 모든 유저에게 브로드캐스트
          io.to(socketRoomKey).emit("room:chat:new", savedMessage);

          if (ack) {
            ack({ ok: true, message: savedMessage });
          }
        } catch (err) {
          console.error("room:chat:send error:", err);
          if (ack) {
            ack({ ok: false, error: "INTERNAL_SERVER_ERROR" });
          }
        }
      },
    );


    socket.on("disconnect", (reason) => {
      console.log("❌ disconnected:", socket.id, reason);
    });
  });

  // ✅ JSON 요청 처리
  app.use(express.json());

  // ✅ 쿠키 파싱 처리
  app.use(cookieParser());

  // ✅ DB 헬스체크 라우트 (GET /api/health/db)
  app.get("/api/health/db", async (req, res) => {
    try {
      const db = getDb();
      await db.command({ ping: 1 });
      res.json({
        ok: true,
        env: ENV.NODE_ENV,
        dbName: db.databaseName,
      });
    } catch (err) {
      console.error("DB health check failed:", err);
      res.status(500).json({ ok: false });
    }
  });

  // ✅ 간단한 DB 테스트 라우트 (POST /api/db-test)
  app.post("/api/db-test", async (req, res) => {
    try {
      const db = getDb();

      const now = Date.now();
      const doc = {
        username: `test_${now}`,
        email: `test_${now}@example.com`,
        passwordHash: "dummy", // 실제 로그인과는 무관한 더미 값
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection("users").insertOne(doc);

      const recent = await db
        .collection("users")
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      res.json({
        ok: true,
        insertedId: result.insertedId,
        recentUsers: recent.map((u) => ({
          _id: u._id,
          username: u.username,
          email: u.email,
          createdAt: u.createdAt,
        })),
      });
    } catch (err) {
      console.error("DB test failed:", err);
      res.status(500).json({ ok: false, error: "db-test failed" });
    }
  });

  // 인증 API
  app.use("/api/auth", authRouter);

  app.use("/api/users",usersRouter);

  app.use("/api/rooms", roomsRouter);

  app.use("/api/match-queue",matchQueueRouter);

  // ✅ Next.js가 모든 페이지 및 API 요청을 처리하도록 위임
  app.use((req,res)=>handle(req,res));

  // ✅ 서버 실행
  server.listen(PORT, () => {
    console.log(`🚀 Server ready at ${[ENV.CORS_ORIGIN]}`);
  });
}

startServer().catch((err) => {
  console.error("❌ Server start failed:", err);
});