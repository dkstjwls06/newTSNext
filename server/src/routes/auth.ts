import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { sendEmail } from "../email/mailer";
import { getDb } from "../db/mongo";
import type { UserDoc } from "../db/types";
import { ENV } from "../config/env";
import { createSessionToken } from "../auth/session";
import { generateRandomToken, tokenExpiresInMinutes } from "../auth/tokens";

const router = Router();

// 공통: users 컬렉션 핸들
function usersCollection() {
  return getDb().collection<UserDoc>("users");
}

// 공통: 쿠키 설정 헬퍼
function setAuthCookie(res: Response, token: string) {
  res.cookie(ENV.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: ENV.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(ENV.AUTH_COOKIE_NAME, { path: "/" });
}


/**
 * POST /api/auth/register
 * body: { username, email, password }
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body ?? {};

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    const trimmedUsername = username.trim();
    const lowercaseEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !lowercaseEmail || password.length < 8) {
      return res.status(400).json({ error: "VALIDATION_FAILED" });
    }

    const users = usersCollection();

    // username 또는 email 중복 체크
    const existing = await users.findOne({
      $or: [{ username: trimmedUsername }, { email: lowercaseEmail }],
    });
    if (existing) {
      return res.status(409).json({ error: "USER_ALREADY_EXISTS" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const emailToken = generateRandomToken(32);
    const emailTokenExpiresAt = tokenExpiresInMinutes(30);

    const now = new Date();

    const insertResult = await users.insertOne({
      _id: new ObjectId(),
      username: trimmedUsername,
      email: lowercaseEmail,
      passwordHash,
      rating: {
        rapid: 1500,
        blitz: 1500,
        bullet: 1500,
      },
      social: {
        friendCount: 0,
        blockedCount: 0,
      },
      auth: {
        emailVerified: false,
        emailVerification: {
          token: emailToken,
          expiresAt: emailTokenExpiresAt,
        },
        resetPassword: null,
      },
      createdAt: now,
      updatedAt: now,
    });

    const verificationUrl = `${ENV.APP_ORIGIN}/verify-email?token=${encodeURIComponent(
      emailToken,
    )}`;

    await sendEmail({
      to:lowercaseEmail,
      subject:"[chess0924.iptime.org] 이메일 인증을 완료해 주세요",
      text:`다음 링크를 30분 이내에 클릭해서 이메일을 인증해 주세요:\n\n${verificationUrl}`
    });

    return res.status(201).json({
      ok: true,
      userId: insertResult.insertedId.toHexString(),
    });
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    const lowercaseEmail = email.trim().toLowerCase();
    const users = usersCollection();

    const user = await users.findOne({ email: lowercaseEmail });
    if (!user) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "INVALID_CREDENTIALS" });
    }


    // 이메일 인증 여부 체크
    if (!user.auth?.emailVerified) {
      // 프런트에서 이 코드를 보고 "이메일 인증을 먼저 해 주세요" 메시지를 띄우게 하기
      return res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });
    }

    const token = createSessionToken(user._id.toHexString());
    setAuthCookie(res, token);

    return res.json({
      ok: true,
      user: {
        id: user._id.toHexString(),
        username: user.username,
        email: user.email,
        emailVerified: user.auth.emailVerified,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", (req: Request, res: Response) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

/**
 * POST /api/auth/verify-email
 * body: { token }
 */
router.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    const users = usersCollection();
    const now = new Date();

    const user = await users.findOne({
      "auth.emailVerification.token": token,
    });

    if (!user || !user.auth?.emailVerification) {
      return res.status(400).json({ error: "INVALID_TOKEN" });
    }

    if (user.auth.emailVerification.expiresAt < now) {
      return res.status(400).json({ error: "TOKEN_EXPIRED" });
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          "auth.emailVerified": true,
          updatedAt: now,
        },
        $unset: {
          "auth.emailVerification": "",
        },
      },
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/verify-email error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

/**
 * POST /api/auth/request-password-reset
 * body: { email }
 */
router.post("/request-password-reset", async (req: Request, res: Response) => {
  try {
    const { email } = req.body ?? {};
    if (typeof email !== "string") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    const lowercaseEmail = email.trim().toLowerCase();
    const users = usersCollection();
    const user = await users.findOne({ email: lowercaseEmail });

    // 존재하지 않는 이메일이어도 timing 정보 노출 방지를 위해 동일 응답
    if (!user) {
      return res.json({ ok: true });
    }

    const resetToken = generateRandomToken(32);
    const expiresAt = tokenExpiresInMinutes(30);
    const now = new Date();

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          "auth.resetPassword": {
            token: resetToken,
            expiresAt,
          },
          updatedAt: now,
        },
      },
    );

    const resetUrl = `${ENV.APP_ORIGIN}/reset-password?token=${encodeURIComponent(
      resetToken,
    )}`;

    await sendEmail({
      to: lowercaseEmail,
      subject: "[chess0924.iptime.org] 비밀번호 재설정 링크",
      text: `다음 링크를 30분 이내에 열어 비밀번호를 재설정해 주세요:\n\n${resetUrl}`,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/request-password-reset error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

/**
 * POST /api/auth/reset-password
 * body: { token, newPassword }
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body ?? {};
    if (typeof token !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ error: "INVALID_PAYLOAD" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "PASSWORD_TOO_SHORT" });
    }

    const users = usersCollection();
    const now = new Date();

    const user = await users.findOne({
      "auth.resetPassword.token": token,
    });

    if (!user || !user.auth?.resetPassword) {
      return res.status(400).json({ error: "INVALID_TOKEN" });
    }

    if (user.auth.resetPassword.expiresAt < now) {
      return res.status(400).json({ error: "TOKEN_EXPIRED" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          updatedAt: now,
        },
        $unset: {
          "auth.resetPassword": "",
        },
      },
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/reset-password error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

export { router as authRouter };