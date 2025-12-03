// frontend/hooks/useUserProfile.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getMyProfile,
  updateMyProfile,
  type UserProfile,
  type GetMyProfileResponse,
  type UpdateMyProfileRequest,
  type UpdateMyProfileResponse,
} from "@/app/api/profile";

export interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  /**
   * 서버에서 내려준 에러 코드(문자열)을 그대로 넣거나,
   * 네트워크 에러 등 클라이언트 단에서 생성한 에러 코드를 넣는다.
   * - 예: "UNAUTHENTICATED" / "USERNAME_ALREADY_TAKEN" / "NO_CHANGES" / "NETWORK_ERROR" 등
   */
  error: string | null;
  /**
   * 서버에서 최신 프로필을 다시 가져온다.
   * - 반환값은 원시 GetMyProfileResponse 그대로
   */
  refresh: () => Promise<GetMyProfileResponse>;
  /**
   * 프로필을 수정하고, 성공 시 profile 상태를 최신값으로 갱신한다.
   * - 반환값은 원시 UpdateMyProfileResponse 그대로
   */
  updateProfile: (
    payload: UpdateMyProfileRequest,
  ) => Promise<UpdateMyProfileResponse>;
}

/**
 * 로그인한 유저의 /api/users/me/profile 을 조회/갱신하는 클라이언트 훅
 *
 * - AuthProvider(useAuth) 위에서 동작한다.
 *   - AuthProvider가 쿠키 기반 세션을 먼저 검증한 뒤 user 를 제공
 *   - user 가 없으면 프로필 요청은 시도하지 않고 profile 을 null 로 둔다.
 * - getMyProfile / updateMyProfile 헬퍼는 기존 작업 3에서 정의한 것을 그대로 사용.
 */
export function useUserProfile(): UseUserProfileResult {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 내부 공용 로더
   * - 로그인 상태(user 존재)일 때만 실제로 서버 호출
   * - 비로그인 상태에서는 profile 을 null 로 만들고 에러는 띄우지 않는다.
   */
  const loadProfile = useCallback(async (): Promise<GetMyProfileResponse> => {
    if (!user) {
      // 로그인 안 된 상태 → 프로필은 null, 훅 레벨에서 error 로 취급하지 않음
      setProfile(null);
      setError(null);

      return {
        ok: false,
        status: 401,
        error: "UNAUTHENTICATED",
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await getMyProfile();

      if (res.ok) {
        setProfile(res.profile);
      } else {
        // 서버에서 내려준 error 문자열을 그대로 보존
        setError(res.error);
      }

      return res;
    } catch (err) {
      console.error("Failed to load profile", err);
      const fallback: GetMyProfileResponse = {
        ok: false,
        status: 0,
        error: "NETWORK_ERROR",
      };
      setError(fallback.error);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * 마운트 시 & Auth 상태가 바뀔 때 프로필 자동 로딩
   *
   * - AuthProvider 가 아직 세션을 확인 중일 때(authLoading=true)는 기다렸다가,
   *   확인이 끝난 뒤(refreshUser 완료 후) loadProfile 을 호출한다.
   */
  useEffect(() => {
    if (authLoading) {
      // 세션 확인 중에는 프로필 호출을 미룬다.
      return;
    }

    void loadProfile();
  }, [authLoading, loadProfile]);

  /**
   * 외부에서 수동으로 프로필을 다시 불러올 때 사용.
   * - settings 페이지에서 "새로고침" 버튼 등에 매핑 가능.
   */
  const refresh = useCallback(async (): Promise<GetMyProfileResponse> => {
    return loadProfile();
  }, [loadProfile]);

  /**
   * 프로필 수정
   *
   * - 로그인 안 된 상태면 곧바로 UNAUTHENTICATED 처리
   * - 성공 시 profile 상태를 서버 응답으로 갱신
   * - 실패 시 error 에 서버 에러 코드(문자열) 또는 NETWORK_ERROR 를 저장
   */
  const updateProfile = useCallback(
    async (
      payload: UpdateMyProfileRequest,
    ): Promise<UpdateMyProfileResponse> => {
      if (!user) {
        const unauth: UpdateMyProfileResponse = {
          ok: false,
          status: 401,
          error: "UNAUTHENTICATED",
        };
        setError(unauth.error);
        return unauth;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await updateMyProfile(payload);

        if (res.ok) {
          // 서버에서 갱신 후 조회해서 내려준 최종 profile 로 교체
          setProfile(res.profile);
        } else {
          setError(res.error);
        }

        return res;
      } catch (err) {
        console.error("Failed to update profile", err);
        const fallback: UpdateMyProfileResponse = {
          ok: false,
          status: 0,
          error: "NETWORK_ERROR",
        };
        setError(fallback.error);
        return fallback;
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  return {
    profile,
    isLoading,
    error,
    refresh,
    updateProfile,
  };
}
