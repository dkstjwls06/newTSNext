"use client";

import React, { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";

type LoginErrorCode = 
  | "INVALID_PAYLOAD"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN";

interface LoginSuccessResponse {
  ok: true;
  user: {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
  };
}

interface LoginErrorResponse {
  ok: false;
  error: LoginErrorCode | string;
}

const AUTH_COOKIE_NAME = "chess_auth";
const LOGIN_AUTO_REDIRECT_KEY = "chess_login_auto_redirect_attempted";
export default function LoginPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 아직 AuthProvider가 /api/auth/me를 확인 중이면 아무 것도 하지 않음
    if (loading) return;
  
    // 이미 로그인된 상태라면 로그인 페이지에 머물 이유가 없으므로 메인으로 보냄
    if (user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 간단한 프론트 쪽 유효성 검사
    if (!email || !password) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // 서버 스펙: { email, password }
        body: JSON.stringify({ email, password }),
      });

      // 공통적으로 JSON 파싱 시도
      let body: LoginSuccessResponse | LoginErrorResponse | null = null;
      try {
        body = (await res.json()) as
          | LoginSuccessResponse
          | LoginErrorResponse;
      } catch {
        // JSON 파싱 실패 시 body는 null로 남김
      }

      if (res.ok && body && "ok" in body && body.ok === true) {
        // 성공: 쿠키는 서버에서 설정됨
        await refresh(); 
        router.push("/");
        return;
      }

      // 에러 처리
      const errorCode: string | undefined =
        body && "error" in body ? body.error : undefined;

      if (res.status === 400 && errorCode === "INVALID_PAYLOAD") {
        setErrorMessage("요청 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      } else if (res.status === 401 && errorCode === "INVALID_CREDENTIALS") {
        setErrorMessage("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (res.status === 403 && errorCode === "EMAIL_NOT_VERIFIED") {
        setErrorMessage(
          "이메일 인증이 완료되지 않았습니다. 메일함에서 인증 메일을 확인해 주세요."
        );
      } else if (res.status === 429) {
        setErrorMessage(
          "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        );
      } else {
        // 그 외 (500 포함)
        setErrorMessage(
          "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
    } catch (err) {
      console.error("Login request failed:", err);
      setErrorMessage(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer layout="center">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-6 text-center">체스게임 로그인</h1>

        {errorMessage && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="비밀번호"
            />
          </div>

          <div className="mt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center"
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </Button>
          </div>
        </form>

        {/* 향후 회원가입 / 비밀번호 찾기 링크 자리 */}
        <div className="mt-4 flex justify-between text-xs text-gray-600">
          <button
            type="button"
            className="underline underline-offset-2 hover:cursor-pointer"
            onClick={() => {
              router.push("/register");
            }}
          >
            회원가입
          </button>
          <button
            type="button"
            className="underline underline-offset-2 hover:cursor-pointer"
            onClick={() => {
              router.push("/reset-password");
            }}
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>
      </Card>
    </PageContainer>
  );

}