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

/**
 * PATCH /api/users/me/profile
 * - 로그인한 유저의 프로필(닉네임, 아바타) 수정
 *
 * body:
 * {
 *   username?: string;
 *   avatarUrl?: string | null; // null 또는 공백 문자열이면 avatar 제거
 * }
 */
router.patch("/me/profile", async (req: Request, res: Response) => {
  try {
    const cookieName = ENV.AUTH_COOKIE_NAME;
    const token = req.cookies?.[cookieName];

    // 1) 인증 체크
    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      clearAuthCookie(res);
      return res.status(401).json({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }

    const { username, avatarUrl } = req.body ?? {};

    // 2) 최소한 하나는 있어야 함
    if (typeof username === "undefined" && typeof avatarUrl === "undefined") {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PAYLOAD",
      });
    }

    // 3) 타입 검증
    if (typeof username !== "undefined" && typeof username !== "string") {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PAYLOAD",
      });
    }

    if (
      typeof avatarUrl !== "undefined" &&
      avatarUrl !== null &&
      typeof avatarUrl !== "string"
    ) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_PAYLOAD",
      });
    }

    const users = usersCollection();
    const userId = new ObjectId(payload.userId);

    // 실제 업데이트에 사용할 문서
    const updateSet: Partial<UserDoc> & { updatedAt?: Date } = {};
    const updateUnset: Record<string, "" | 1> = {};

    // 4) username 변경 처리
    if (typeof username === "string") {
      const trimmedUsername = username.trim();

      if (!trimmedUsername) {
        return res.status(400).json({
          ok: false,
          error: "VALIDATION_FAILED",
        });
      }

      // 본인을 제외하고 username 중복 여부 체크
      const existing = await users.findOne({
        _id: { $ne: userId },
        username: trimmedUsername,
      });

      if (existing) {
        return res.status(409).json({
          ok: false,
          error: "USERNAME_ALREADY_TAKEN",
        });
      }

      updateSet.username = trimmedUsername;
    }

    // 5) avatarUrl 변경 처리
    if (typeof avatarUrl !== "undefined") {
      if (avatarUrl === null) {
        // null → 필드 제거
        updateUnset.avatarUrl = "";
      } else {
        const trimmedAvatar = avatarUrl.trim();
        if (!trimmedAvatar) {
          // 공백 문자열 → 제거
          updateUnset.avatarUrl = "";
        } else {
          updateSet.avatarUrl = trimmedAvatar;
        }
      }
    }

    // 변경되는 필드가 실제로 하나도 없으면 에러
    if (
      Object.keys(updateSet).length === 0 &&
      Object.keys(updateUnset).length === 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "NO_CHANGES",
      });
    }

    // updatedAt 갱신
    updateSet.updatedAt = new Date();

    const updateDoc: {
      $set: typeof updateSet;
      $unset?: Record<string, "" | 1>;
    } = {
      $set: updateSet,
    };

    if (Object.keys(updateUnset).length > 0) {
      updateDoc.$unset = updateUnset;
    }

    // 6) 업데이트 수행
    await users.updateOne(
      { _id: userId },
      updateDoc,
    );

    // 7) 업데이트 후 최종 프로필 재조회 (GET /me/profile 과 동일한 projection)
    const updatedUser = await users.findOne(
      { _id: userId },
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

    if (!updatedUser) {
      // 이 경우는 거의 없겠지만, 안전하게 세션 정리
      clearAuthCookie(res);
      return res.status(401).json({
        ok: false,
        error: "UNAUTHENTICATED",
      });
    }

    return res.json({
      ok: true,
      profile: {
        id: updatedUser._id.toHexString(),
        username: updatedUser.username,
        email: updatedUser.email,
        emailVerified: !!updatedUser.auth?.emailVerified,
        avatarUrl: updatedUser.avatarUrl ?? null,
        rating: updatedUser.rating,
        social: updatedUser.social,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (err) {
    console.error("PATCH /api/users/me/profile error:", err);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

export { router as usersRouter };
