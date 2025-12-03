// frontend/components/auth/RequireAuth.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * 로그인된 사용자만 children 을 볼 수 있게 하는 보호 래퍼.
 * - AuthProvider 의 user/loading 상태를 사용
 * - user 가 없고 loading 이 끝나면 /login 으로 redirect
 * - redirect 중/로딩 중에는 아무것도 렌더링하지 않음
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // 나중에 "로그인 후 돌아오기"를 지원하고 싶으면 next 파라미터를 함께 넘길 수 있음
      const searchParams = new URLSearchParams();
      if (pathname && pathname !== "/login") {
        searchParams.set("next", pathname);
      }

      const target =
        searchParams.toString().length > 0
          ? `/login?${searchParams.toString()}`
          : "/login";

      router.replace(target);
    }
  }, [loading, user, router, pathname]);

  // 1) 아직 로딩 중이거나
  // 2) user 가 없어서 리다이렉트 예정인 상태에서는 보호 페이지 내용을 보여주지 않는다.
  if (loading || !user) {
    return null;
  }

  // 로그인된 상태에서만 children 렌더링
  return <>{children}</>;
}
