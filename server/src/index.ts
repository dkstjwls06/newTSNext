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
import { verifySessionToken } from './auth/session';

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