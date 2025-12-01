import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import next from 'next';
import { ENV } from './config/env';
import { connectMongo, getDb } from './db/mongo';
import { initDb } from './db/init';

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

    socket.on("disconnect", (reason) => {
      console.log("❌ disconnected:", socket.id, reason);
    });
  });

  // ✅ JSON 요청 처리
  app.use(express.json());

  // ✅ DB 헬스체크 라우트 (GET /api/health/db)
  app.get("/api/health/db", async (_req, res) => {
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