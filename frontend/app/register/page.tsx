"use client"

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RegisterErrorCode =
  | "INVALID_PAYLOAD"
  | "VALIDATION_FAILED"
  | "USER_ALREADY_EXISTS"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN";

interface RegisterSuccessResponse {
  ok: true;
  userId: string;
}

interface RegisterErrorResponse {
  ok?: false;
  error: RegisterErrorCode | string;
}

export default function RegisterPage() {
  const router = useRouter();
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 프론트 기본 유효성 검사
    if (!username.trim() || !email.trim() || !password) {
      setErrorMessage("사용자명, 이메일, 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method:"POST",
        headers: {
          "Content-Type": "application/json",
        },
        // 서버 스펙: { username, email, password }
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        })
      });

      let body: RegisterSuccessResponse | RegisterErrorResponse | null = null;
      try {
        body = (await res.json()) as
          | RegisterSuccessResponse
          | RegisterErrorResponse;
      } catch {
        // JSON 파싱 실패 시 body는 null 유지
      }

      if (res.ok && body && "ok" in body && body.ok === true) {
        // 회원가입은 바로 로그인시키지 않고, 이메일 인증 유도
        setSuccessMessage(
          "회원가입이 완료되었습니다. 입력하신 이메일로 전송된 인증 메일을 30분 이내에 확인해 주세요."
        );
        // 폼은 잠깐 유지
        // 성공 시 메시지 출력 후 회원가입 버튼 비활성화
        setSuccess(true);
        return;
      }

      const errorCode: string | undefined =
        body && "error" in body ? body.error : undefined;

      if (res.status === 400 && errorCode === "INVALID_PAYLOAD") {
        setErrorMessage("요청 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      } else if (res.status === 400 && errorCode === "VALIDATION_FAILED") {
        setErrorMessage(
          "입력값이 올바르지 않습니다. 사용자명/이메일/비밀번호를 다시 확인해 주세요."
        );
      } else if (res.status === 409 && errorCode === "USER_ALREADY_EXISTS") {
        setErrorMessage(
          "이미 존재하는 사용자명 또는 이메일입니다. 다른 값을 사용해 주세요."
        );
      } else if (res.status >= 500) {
        setErrorMessage(
          "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      } else {
        setErrorMessage(
          "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
    } catch (err) {
      console.error("Register request failed:", err);
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
        <h1 className="text-2xl font-semibold mb-6 text-center">회원가입</h1>

        {errorMessage && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm font-medium">
              사용자명
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="닉네임을 입력해 주세요"
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="비밀번호 (최소 8자)"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="passwordConfirm" className="text-sm font-medium">
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="비밀번호를 한 번 더 입력해 주세요"
            />
          </div>

          <div className="mt-2 space-y-2">
            <Button
              type="submit"
              disabled={isSubmitting || success}
              className="w-full justify-center"
            >
              {isSubmitting && !success ? "가입 처리 중..." : "회원가입"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() => router.push("/login")}
            >
              로그인 페이지로 돌아가기
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}