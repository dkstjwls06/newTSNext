import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import next from 'next';
import { ENV } from './config/env';
import { connectMongo, getDb } from './db/mongo';
import { initDb } from './db/init';
import { authRouter } from "./routes/auth";

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
    console.log("✅ a user connected:", socket.id);

    socket.emit("hello", { msg: "welcome" });

    socket.on("ping", (data) => {
      console.log("ping:", data);
      socket.emit("pong", { at: Date.now() });
    });
    // ✅ DB 테스트용 소켓 이벤트
    // 클라이언트에서: socket.emit("db-test", (res) => { ... });
    socket.on("db-test", async (ack?: (res: any) => void) => {
      try {
        const db = getDb();

        const now = Date.now();
        const doc = {
          username: `socket_test_${now}`,
          email: `socket_test_${now}@example.com`,
          passwordHash: "dummy",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await db.collection("users").insertOne(doc);
        const totalUsers = await db.collection("users").countDocuments();

        console.log(
          `✅ db-test via socket: inserted ${result.insertedId}, totalUsers=${totalUsers}`
        );

        if (ack) {
          ack({
            ok: true,
            insertedId: result.insertedId,
            username: doc.username,
            totalUsers,
          });
        }
      } catch (err) {
        console.error("db-test socket error:", err);
        if (ack) {
          ack({ ok: false });
        }
      }
    });

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