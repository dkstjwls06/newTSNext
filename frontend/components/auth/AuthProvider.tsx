"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
}

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

type AuthMeSuccessResponse = {
  ok: true;
  user: CurrentUser;
};

type AuthMeErrorResponse = {
  ok: false;
  error: string;
};

type AuthMeResponse = AuthMeSuccessResponse | AuthMeErrorResponse;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        // 로그인 안 된 상태(401 등) → user 비움
        setUser(null);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as AuthMeResponse;

      if (data.ok) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch /api/auth/me", err);
      setUser(null);
      setError("세션 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to call /api/auth/logout", err);
    } finally {
      // 서버 쿠키 삭제 여부와 관계 없이 프론트 상태는 비움
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}

/**
 * 현재 사용자 정보만 간단히 가져오는 훅
 * - user, loading, error 만 노출
 */
export function useCurrentUser() {
  const { user, loading, error } = useAuth();
  return { user, loading, error };
}
