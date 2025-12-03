// frontend/components/settings/ProfileForm.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import type {
  UserProfile,
  UpdateMyProfileRequest,
} from "@/app/api/profile";
import { Button } from "@/components/ui/Button";

interface ProfileFormProps {
  profile: UserProfile;
  isSubmitting: boolean;
  onSubmit: (payload: UpdateMyProfileRequest) => Promise<void> | void;
  serverError?: string | null;
  onReset?: () => void;
}

export function ProfileForm({
  profile,
  isSubmitting,
  onSubmit,
  serverError,
  onReset,
}: ProfileFormProps) {
  const [username, setUsername] = useState(profile.username);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");

  useEffect(() => {
    // 프로필이 바뀌면 폼도 다시 초기화
    setUsername(profile.username);
    setAvatarUrl(profile.avatarUrl ?? "");
  }, [profile.id, profile.username, profile.avatarUrl]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const payload: UpdateMyProfileRequest = {
      username: username.trim() || undefined,
      avatarUrl: avatarUrl.trim() === "" ? null : avatarUrl.trim(),
    };

    await onSubmit(payload);
  };

  const handleReset = () => {
    setUsername(profile.username);
    setAvatarUrl(profile.avatarUrl ?? "");
    onReset?.();
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* 읽기 전용 정보 섹션 */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <div>
          <span className="font-semibold">이메일: </span>
          <span>{profile.email}</span>
        </div>
        <div>
          <span className="font-semibold">이메일 인증: </span>
          <span>{profile.emailVerified ? "완료" : "미완료"}</span>
        </div>
        {profile.social && (
          <div className="flex gap-4">
            <span>
              친구 수:{" "}
              <span className="font-mono">
                {profile.social.friendCount}
              </span>
            </span>
            <span>
              차단 수:{" "}
              <span className="font-mono">
                {profile.social.blockedCount}
              </span>
            </span>
          </div>
        )}
        {profile.rating && (
          <div className="flex flex-wrap gap-3">
            <span className="font-semibold">레이팅</span>
            <span className="font-mono text-xs">
              rapid: {profile.rating.rapid}
            </span>
            <span className="font-mono text-xs">
              blitz: {profile.rating.blitz}
            </span>
            <span className="font-mono text-xs">
              bullet: {profile.rating.bullet}
            </span>
            <span className="font-mono text-xs">
              puzzle: {profile.rating.puzzle}
            </span>
          </div>
        )}
      </div>

      {/* 수정 가능한 필드 섹션 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="username">
            닉네임 (username)
          </label>
          <input
            id="username"
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="표시할 닉네임을 입력하세요"
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1"
            htmlFor="avatarUrl"
          >
            아바타 이미지 URL
          </label>
          <input
            id="avatarUrl"
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
          />
          {avatarUrl.trim() !== "" && (
            <div className="mt-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border">
                {/* 단순 preview, 에러 핸들링은 추후 개선 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt="avatar preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                위 URL을 기반으로 아바타가 표시됩니다.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 에러 및 버튼 영역 */}
      {serverError && (
        <p className="text-sm text-red-500 whitespace-pre-line">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={handleReset}
        >
          초기화
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
