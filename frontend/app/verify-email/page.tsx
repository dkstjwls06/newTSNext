"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type VerifyEmailErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "INTERNAL_SERVER_ERROR"
  | "UNKNOWN";

interface VerifyEmailSuccessResponse {
  ok: true;
}

interface VerifyEmailErrorResponse {
  ok?: false;
  error: VerifyEmailErrorCode | string;
}

type Status = "idle" | "verifying" | "success" | "error";


export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const verify = async (t: string) => {
    setStatus("verifying");
    setMessage("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // 서버 스펙: { token }
        body: JSON.stringify({ token: t }),
      });

      let body: VerifyEmailSuccessResponse | VerifyEmailErrorResponse | null =
        null;
      try {
        body = (await res.json()) as
          | VerifyEmailSuccessResponse
          | VerifyEmailErrorResponse;
      } catch {
        // JSON 파싱 실패
      }

      if (res.ok && body && "ok" in body && body.ok === true) {
        setStatus("success");
        setMessage("이메일 인증이 완료되었습니다. 이제 로그인하실 수 있습니다. 10초 후 로그인 페이지로 돌아갑니다.");
        setTimeout(() => {
          router.push("/login");
        }, 10000);

        return;
      }

      const errorCode: string | undefined =
        body && "error" in body ? body.error : undefined;

      if (res.status === 400 && errorCode === "INVALID_TOKEN") {
        setStatus("error");
        setMessage("유효하지 않은 인증 링크입니다.");
      } else if (res.status === 400 && errorCode === "TOKEN_EXPIRED") {
        setStatus("error");
        setMessage(
          "인증 링크의 유효기간이 만료되었습니다. 다시 회원가입을 진행하거나, 새 인증 메일을 요청해 주세요."
        );
      } else if (res.status === 400 && errorCode === "INVALID_PAYLOAD") {
        setStatus("error");
        setMessage("요청 형식이 올바르지 않습니다.");
      } else if (res.status >= 500) {
        setStatus("error");
        setMessage("서버 오류로 인해 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setStatus("error");
        setMessage("알 수 없는 오류로 인해 인증에 실패했습니다.");
      }
    } catch (err) {
      console.error("Verify email request failed:", err);
      setStatus("error");
      setMessage(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요."
      );
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("유효하지 않은 인증 링크입니다. (토큰이 없습니다.)");
      router.push("/"); // 추후 쿠키 없으면 로그인으로 한번 더 리다이렉트됨
      return;
    }

    // 페이지 진입 시 자동으로 검증 시작
    verify(token);
  }, [token, router]);

  const isVerifying = status === "verifying";

  return (
    <PageContainer layout="center">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          이메일 인증
        </h1>

        <div className="space-y-4 text-sm">
          {status === "verifying" && (
            <p className="text-gray-700">
              이메일 인증을 진행 중입니다. 잠시만 기다려 주세요...
            </p>
          )}

          {status === "success" && (
            <p className="text-emerald-700">{message}</p>
          )}

          {status === "error" && (
            <p className="text-red-700">{message}</p>
          )}

          {status !== "verifying" && (
            <div className="pt-2 space-y-2">
              <Button
                type="button"
                className="w-full justify-center"
                onClick={() => router.push("/login")}
              >
                로그인 페이지로 이동
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => router.push("/")}
              >
                메인 페이지로 이동
              </Button>
            </div>
          )}

          {status === "error" && token && (
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isVerifying}
                onClick={() => verify(token)}
              >
                다시 시도하기
              </Button>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}