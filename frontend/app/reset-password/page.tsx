"use client";

import React, { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RequestResetErrorCode = "INVALID_PAYLOAD" | "INTERNAL_SERVER_ERROR" | "UNKNOWN";

type ResetPasswordErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN";

interface RequestResetSuccessResponse {
  ok: true;
}

interface RequestResetErrorResponse {
  error: RequestResetErrorCode | string;
}

interface ResetPasswordSuccessResponse {
  ok: true;
}

interface ResetPasswordErrorResponse {
  error: ResetPasswordErrorCode | string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isResetMode = !!token; // true면 "새 비밀번호 설정" 모드

  // 공통 에러/상태
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1) 이메일 입력 → reset 링크 요청 모드
  const [email, setEmail] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestDone, setRequestDone] = useState(false);

  // 2) 토큰 + 새 비밀번호 설정 모드
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // 비밀번호 재설정 링크 요청 핸들러
  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) {
      setErrorMessage("이메일을 입력해 주세요.");
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      let body: RequestResetSuccessResponse | RequestResetErrorResponse | null = null;
      try {
        body = (await res.json()) as RequestResetSuccessResponse | RequestResetErrorResponse;
      } catch {
        // body 파싱 실패 시에는 null로 둔다.
      }

      if (res.ok && body && "ok" in body && body.ok === true) {
        // 존재하는 이메일인지 여부와 관계없이 항상 ok:true를 돌려줌
        setRequestDone(true);
        return;
      }

      const errorCode: string | undefined =
        body && "error" in body ? (body.error as string) : undefined;

      if (res.status === 400 && errorCode === "INVALID_PAYLOAD") {
        setErrorMessage("요청 형식이 올바르지 않습니다. 이메일 주소를 다시 확인해 주세요.");
      } else if (res.status >= 500) {
        setErrorMessage(
          "서버 오류로 인해 비밀번호 재설정 메일 요청에 실패했습니다. 잠시 후 다시 시도해 주세요."
        );
      } else {
        setErrorMessage(
          "비밀번호 재설정 메일 요청 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
    } catch (err) {
      console.error("request-password-reset failed:", err);
      setErrorMessage(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요."
      );
    } finally {
      setIsRequesting(false);
    }
  };

  // 실제 비밀번호 재설정 핸들러
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrorMessage("유효하지 않은 비밀번호 재설정 링크입니다.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage("새 비밀번호와 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 8) {
      // 서버도 별도 정책이 있겠지만, 최소 길이 정도는 프론트에서 선제 체크
      setErrorMessage("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // auth.ts 기준 body: { token, newPassword }
        body: JSON.stringify({ token, newPassword }),
      });

      let body: ResetPasswordSuccessResponse | ResetPasswordErrorResponse | null = null;
      try {
        body = (await res.json()) as ResetPasswordSuccessResponse | ResetPasswordErrorResponse;
      } catch {
        // body 파싱 실패 시에는 null
      }

      if (res.ok && body && "ok" in body && body.ok === true) {
        setResetDone(true);
        // 비밀번호 변경 성공 → 몇 초 후 로그인 페이지로 이동
        setTimeout(() => {
          router.replace("/login");
        }, 5000);
        return;
      }

      const errorCode: string | undefined =
        body && "error" in body ? (body.error as string) : undefined;

      if (res.status === 400 && errorCode === "INVALID_PAYLOAD") {
        setErrorMessage("요청 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      } else if (res.status === 400 && errorCode === "INVALID_TOKEN") {
        setErrorMessage("유효하지 않은 비밀번호 재설정 링크입니다.");
      } else if (res.status === 400 && errorCode === "TOKEN_EXPIRED") {
        setErrorMessage(
          "비밀번호 재설정 링크의 유효기간이 만료되었습니다. 다시 비밀번호 재설정을 요청해 주세요."
        );
      } else if (res.status >= 500) {
        setErrorMessage(
          "서버 오류로 인해 비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해 주세요."
        );
      } else {
        setErrorMessage(
          "비밀번호 재설정 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
    } catch (err) {
      console.error("reset-password failed:", err);
      setErrorMessage(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요."
      );
    } finally {
      setIsResetting(false);
    }
  };

  // ----- 렌더링 -----

  // 1) 이메일로 재설정 링크 요청 UI
  const renderRequestForm = () => (
    <>
      <h1 className="text-2xl font-semibold mb-2 text-center">비밀번호 재설정</h1>
      <p className="mb-4 text-sm text-gray-600">
        가입하신 이메일 주소를 입력하시면, 비밀번호를 재설정할 수 있는 링크를 보내드립니다.
      </p>

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {requestDone ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          비밀번호 재설정 링크(또는 안내)가 이메일로 전송되었습니다.
          <br />
          만약 해당 이메일로 가입된 계정이 없다면, 아무 일도 일어나지 않을 수 있습니다.
        </div>
      ) : (
        <form onSubmit={handleRequestReset} className="space-y-4">
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

          <Button type="submit" disabled={isRequesting} className="w-full justify-center">
            {isRequesting ? "요청 중..." : "비밀번호 재설정 링크 보내기"}
          </Button>
        </form>
      )}

      <div className="mt-4 flex justify-between text-xs text-gray-600">
        <button
          type="button"
          className="underline underline-offset-2 hover:cursor-pointer"
          onClick={() => router.push("/login")}
        >
          로그인으로 돌아가기
        </button>
        <button
          type="button"
          className="underline underline-offset-2 hover:cursor-pointer"
          onClick={() => router.push("/register")}
        >
          회원가입
        </button>
      </div>
    </>
  );

  // 2) 토큰 기반 새 비밀번호 설정 UI
  const renderResetForm = () => (
    <>
      <h1 className="text-2xl font-semibold mb-2 text-center">새 비밀번호 설정</h1>
      <p className="mb-4 text-sm text-gray-600">
        새 비밀번호를 입력해 주세요. 이 링크는 일정 시간 후 만료될 수 있습니다.
      </p>

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {resetDone ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          비밀번호가 성공적으로 변경되었습니다.
          <br />
          잠시 후 로그인 페이지로 이동합니다.
        </div>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="newPassword" className="text-sm font-medium">
              새 비밀번호
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="새 비밀번호"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              새 비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="새 비밀번호 확인"
            />
          </div>

          <Button type="submit" disabled={isResetting} className="w-full justify-center">
            {isResetting ? "변경 중..." : "비밀번호 변경하기"}
          </Button>
        </form>
      )}

      <div className="mt-4 flex justify-between text-xs text-gray-600">
        <button
          type="button"
          className="underline underline-offset-2 hover:cursor-pointer"
          onClick={() => router.push("/login")}
        >
          로그인으로 돌아가기
        </button>
      </div>
    </>
  );

  return (
    <PageContainer layout="center">
      <Card className="w-full max-w-md">
        {isResetMode ? renderResetForm() : renderRequestForm()}
      </Card>
    </PageContainer>
  );
}
