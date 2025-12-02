"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SocketPingTest from "@/components/SocketPingTest";

interface MeSuccessResponse {
  ok: true;
  user: {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
  };
}

interface MeErrorResponse {
  ok: false;
  error: string;
}

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });

        // res.ok 가 false 이면 (401, 500 등) 바로 로그인 페이지로 보냄
        if (!res.ok) {
          if (!cancelled) {
            router.replace("/login");
          }
          return;
        }

        let body: MeSuccessResponse | MeErrorResponse | null = null;
        try {
          body = (await res.json()) as MeSuccessResponse | MeErrorResponse;
        } catch {
          // JSON 파싱에 실패하면 비정상 응답 → 비로그인으로 간주
          if (!cancelled) {
            router.replace("/login");
          }
          return;
        }

        if (cancelled) return;

        // ok: true 이면 로그인 상태로 간주하고 현재 페이지 유지
        if ("ok" in body && body.ok === true) {
          setCheckingAuth(false);
        } else {
          // ok: false 이거나 구조가 다르면 비로그인으로 간주
          router.replace("/login");
        }
      } catch (err) {
        console.error("Failed to check auth on home page:", err);
        if (!cancelled) {
          // 네트워크 에러 등도 비로그인으로 간주하고 로그인 페이지로 보냄
          router.replace("/login");
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // 인증 상태 확인이 끝나기 전까지는 아무것도 렌더링하지 않음
  if (checkingAuth) {
    return null;
  }

  // 로그인 된 상태에서만 도달
  return (
    <main className="">
      <SocketPingTest />
      {/* <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
              <Image
                className="dark:invert"
                src="/next.svg"
                alt="Next.js logo"
                width={100}
                height={20}
                priority
              />
              <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
                <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
                  To get started, edit the page.tsx file.
                </h1>
                <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                  Looking for a starting point or more instructions? Head over to{" "}
                  <a
                    href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                    className="font-medium text-zinc-950 dark:text-zinc-50"
                  >
                    Templates
                  </a>{" "}
                  or the{" "}
                  <a
                    href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                    className="font-medium text-zinc-950 dark:text-zinc-50"
                  >
                    Learning
                  </a>{" "}
                  center.
                </p>
              </div>
              <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
                <a
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
                  href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    className="dark:invert"
                    src="/vercel.svg"
                    alt="Vercel logomark"
                    width={16}
                    height={16}
                  />
                  Deploy Now
                </a>
                <a
                  className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
                  href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Documentation
                </a>
              </div>
            </main>
          </div> */}
    </main>
  );
}
