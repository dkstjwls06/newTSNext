import { MongoClient, Db } from "mongodb";
import { ENV } from "../config/env";

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * MongoDB에 연결하고, 이미 연결되어 있으면 재사용한다.
 */
export async function connectMongo(): Promise<{ client: MongoClient; db: Db }> {
  if (client && db) {
    return { client, db };
  }

  // ENV에서 URI, DB 이름을 가져옴
  const uri = ENV.MONGODB_URI;
  const dbName = ENV.MONGODB_DB_NAME;

  // MongoClient 인스턴스 생성
  client = new MongoClient(uri);

  // 실제 연결
  await client.connect();

  // DB 핸들 얻기
  db = client.db(dbName);

  // 연결 확인용 ping (선택이지만 있으면 좋음)
  await db.command({ ping: 1 });

  console.log(`✅ MongoDB connected: ${uri}/${dbName}`);

  return { client, db };
}

/**
 * 이미 연결된 Db 핸들을 가져온다.
 * (connectMongo()가 먼저 호출되지 않았다면 에러)
 */
export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB is not initialized. Call connectMongo() first.");
  }
  return db;
}

/**
 * (옵션) 종료 시 커넥션 정리용
 */
export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    console.log("🛑 MongoDB connection closed.");
    client = null;
    db = null;
  }
}