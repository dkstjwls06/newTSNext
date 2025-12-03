"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface ProfileFormValues {
  username: string;
  avatarUrl: string;
}

interface ProfileFormProps {
  /**
   * 서버에서 내려온 초기 닉네임
   */
  initialUsername: string;
  /**
   * 서버에서 내려온 초기 아바타 URL (없으면 빈 문자열)
   */
  initialAvatarUrl: string;
  /**
   * 상위에서 관리하는 저장 중 상태
   */
  isSubmitting: boolean;
  /**
   * 폼 submit 시 호출되는 상위 콜백
   */
  onSubmit: (values: ProfileFormValues) => Promise<void> | void;
}

export function ProfileForm({
  initialUsername,
  initialAvatarUrl,
  isSubmitting,
  onSubmit,
}: ProfileFormProps) {
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarPreviewError, setAvatarPreviewError] = useState<string | null>(
    null,
  );

  // 프로필이 갱신되었을 때(초기값 변경) 폼 값도 동기화
  useEffect(() => {
    setUsername(initialUsername);
    setAvatarUrl(initialAvatarUrl);
    setAvatarPreviewError(null);
  }, [initialUsername, initialAvatarUrl]);

  // 아바타 이미지 로딩 실패 시 프리뷰 에러 메시지 표시
  const handleAvatarError = () => {
    setAvatarPreviewError(
      "이미지를 불러오지 못했습니다. URL을 다시 확인해 주세요.",
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    await onSubmit({
      username,
      avatarUrl,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* 닉네임 입력 */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="profile-username"
          className="text-sm font-medium text-gray-900"
        >
          닉네임
        </label>
        <input
          id="profile-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="게임에서 표시될 닉네임을 입력해 주세요"
        />
        <p className="text-xs text-gray-500">
          게임 및 친구 목록 등에서 보여지는 이름입니다.
        </p>
      </div>

      {/* 아바타 URL 입력 */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="profile-avatar-url"
          className="text-sm font-medium text-gray-900"
        >
          아바타 이미지 URL
        </label>
        <input
          id="profile-avatar-url"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="https://example.com/avatar.png"
        />
        <p className="text-xs text-gray-500">
          http:// 또는 https:// 로 시작하는 이미지 주소만 입력할 수 있으며,
          비워 두면 기본 아바타가 사용됩니다.
        </p>

        {/* 아바타 미리보기 */}
        {avatarUrl && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt="아바타 미리보기"
                className="h-full w-full object-cover"
                onError={handleAvatarError}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">
                입력한 URL을 기준으로 렌더링한 아바타 미리보기입니다.
              </span>
              {avatarPreviewError && (
                <span className="mt-1 text-xs text-red-600">
                  {avatarPreviewError}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 영역 */}
      <div className="flex items-center justify-end pt-2">
        
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
