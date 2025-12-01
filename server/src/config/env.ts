// server/src/config/env.ts
import dotenv from "dotenv";
import path from "path";

// 1) 현재 NODE_ENV 기준
const nodeEnv = process.env.NODE_ENV || "development";

// 2) NODE_ENV별 .env.{env}.local 먼저 로딩
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${nodeEnv}`),
});

// 3) 공통 .env도 있으면 추가로 로딩 (이미 설정된 값은 유지)
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

// 4) 타입 안전한 ENV 래퍼
export const ENV = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT ?? 3000),

  MONGODB_URI:
    process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
  MONGODB_DB_NAME:
    process.env.MONGODB_DB_NAME ?? "chess-app-dev",

  CORS_ORIGIN:
    process.env.CORS_ORIGIN ??
    (nodeEnv === "production"
      ? "http://chess0924.iptime.org"
      : "http://localhost:3000"),
} as const;