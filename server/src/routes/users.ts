// server/src/routes/users.ts
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { ENV } from "../config/env";
import { verifySessionToken } from "../auth/session";
import { getDb } from "../db/mongo";
import type { UserDoc } from "../db/types";

const router = Router();

// 이 라우터 전용 users 컬렉션 헬퍼
function usersCollection() {
  return getDb().collection<UserDoc>("users");
}

// auth.ts 에 있는 것과 동일한 쿠키 삭제 헬퍼:contentReference[oaicite:2]{index=2}
function clearAuthCookie(res: Response) {
  res.clearCookie(ENV.AUTH_COOKIE_NAME, { path: "/" });
}

/**
 * GET /api/users/me/profile
 * - 현재 세션(쿠키)을 기준으로 로그인한 유저의 전체 프로필/설정 정보 반환
 */
router.get("/me/profile", async (req: Request, res: Response) => {
  try {
    const cookieName = ENV.AUTH_COOKIE_NAME;
    const token = req.cookies?.[cookieName];

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      // 토큰이 만료/위조된 경우 쿠키도 정리 (auth.ts /me 와 동일 패턴):contentReference[oaicite:3]{index=3}
      clearAuthCookie(res);
      return res.status(401).json({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }

    const users = usersCollection();
    const user = await users.findOne(
      { _id: new ObjectId(payload.userId) },
      {
        projection: {
          username: 1,
          email: 1,
          avatarUrl: 1,
          rating: 1,
          social: 1,
          "auth.emailVerified": 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );

    if (!user) {
      // 세션에는 유저가 있는데 실제 DB에는 없으면 세션 쿠키 정리
      clearAuthCookie(res);
      return res.status(401).json({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }

    return res.json({
      ok: true,
      profile: {
        id: user._id.toHexString(),
        username: user.username,
        email: user.email,
        emailVerified: !!user.auth?.emailVerified,
        avatarUrl: user.avatarUrl ?? null,
        rating: user.rating,   // { rapid, blitz, bullet } 그대로 반환:contentReference[oaicite:4]{index=4}
        social: user.social,   // { friendCount, blockedCount } 그대로 반환:contentReference[oaicite:5]{index=5}
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /api/users/me/profile error:", err);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

export { router as usersRouter };
