import crypto from "crypto";
import { ENV } from "../config/env";

const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

function sign(payload: string): string {
  return crypto.createHmac("sha256", ENV.AUTH_SECRET).update(payload).digest("hex");
}

/**
 * userId 기반 세션 토큰 생성
 * 내부 포맷: base64url("userId.issuedAt.signatureHex")
 */
export function createSessionToken(userId: string): string {
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}`;
  const signature = sign(payload);
  const raw = `${userId}.${issuedAt}.${signature}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export function verifySessionToken(
  token: string,
): { userId: string; issuedAt: number } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const parts = decoded.split(".");
  if (parts.length !== 3) return null;

  const [userId, issuedAtStr, signature] = parts;
  const payload = `${userId}.${issuedAtStr}`;
  const expectedSig = sign(payload);

  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;

  if (Date.now() - issuedAt > MAX_SESSION_AGE_MS) {
    return null;
  }

  return { userId, issuedAt };
}