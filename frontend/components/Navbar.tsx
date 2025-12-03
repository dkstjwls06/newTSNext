// frontend/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useAuth, useCurrentUser } from "@/components/auth/AuthProvider";

/**
 * 상단 네비게이션 바
 * - 좌측: 로고/홈, (로그인 시) 게임, 프로필
 * - 우측: (비로그인) 로그인/회원가입, (로그인) 유저명 + 로그아웃
 */
export function Navbar() {
  const { logout, loading } = useAuth();
  const { user } = useCurrentUser();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      // TODO: 필요하면 토스트/알람으로 노출
      console.error("Failed to logout", err);
    }
  };

  return (
    <nav className="flex h-12 items-center justify-between border-b bg-gray-900 px-4 text-sm text-gray-50">
      {/* 좌측 영역: 로고 + 주요 메뉴 */}
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold hover:text-sky-300">
          Chess App
        </Link>

        {user && (
          <>
            <Link href="/game" className="hover:text-sky-300">
              Game
            </Link>
            <Link href="/profile" className="hover:text-sky-300">
              Profile
            </Link>
          </>
        )}
      </div>

      {/* 우측 영역: 로그인/회원가입 또는 유저 정보 + 로그아웃 */}
      <div className="flex items-center gap-3">
        {loading ? null : user ? (
          <>
            <span className="text-xs text-slate-200">
              {user.username ?? user.email ?? "User"}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md bg-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-600"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-sky-300">
              로그인
            </Link>
            <Link href="/register" className="hover:text-sky-300">
              회원가입
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
