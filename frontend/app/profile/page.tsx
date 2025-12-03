"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  changeMyPassword,
  type ChangeMyPasswordResponse,
} from "@/app/api/profile";
import {
  ProfileForm,
  type ProfileFormValues,
} from "@/components/settings/ProfileForm";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, isLoading, error, updateProfile } = useUserProfile();

  // 프로필 폼 메시지 & 상태
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 비밀번호 변경용 상태
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<
    string | null
  >(null);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<
    string | null
  >(null);

  // --- 프로필 수정 핸들러 ---
  const handleProfileSubmit = async (values: ProfileFormValues) => {
    if (!profile) {
      setFormError(
        "프로필 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }

    setFormError(null);
    setFormSuccess(null);

    const trimmedUsername = values.username.trim();
    const trimmedAvatarUrl = values.avatarUrl.trim();

    if (!trimmedUsername) {
      setFormError("닉네임을 비워 둘 수 없습니다.");
      return;
    }

    // 아바타 URL은 http:// 또는 https:// 로 시작하는 것만 허용
    if (
      trimmedAvatarUrl &&
      !/^https?:\/\//i.test(trimmedAvatarUrl)
    ) {
      setFormError("아바타 URL은 http:// 또는 https://로 시작해야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateProfile({
        username: trimmedUsername,
        avatarUrl: trimmedAvatarUrl || null,
      });

      if (res.ok) {
        setFormSuccess("프로필이 성공적으로 저장되었습니다.");
        // 서버에서 최신 프로필을 다시 내려주므로, 훅 내부 상태도 자동 갱신됨
      } else {
        // 서버에서 내려준 에러 코드 문자열 기반 메시지
        switch (res.error) {
          case "UNAUTHENTICATED":
            setFormError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
            break;
          case "USERNAME_ALREADY_TAKEN":
            setFormError(
              "이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해 주세요.",
            );
            break;
          case "NO_CHANGES":
            setFormError("변경된 내용이 없습니다.");
            break;
          case "INVALID_PAYLOAD":
            setFormError(
              "요청 형식이 올바르지 않습니다. 다시 시도해 주세요.",
            );
            break;
          default:
            setFormError(
              "프로필 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            );
            break;
        }
      }
    } catch (err) {
      console.error("updateProfile failed:", err);
      setFormError(
        "네트워크 오류가 발생했습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 비밀번호 변경 핸들러 ---
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMessage(null);
    setPasswordErrorMessage(null);

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setPasswordErrorMessage("모든 비밀번호 입력란을 채워 주세요.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordErrorMessage(
        "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.",
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordErrorMessage("새 비밀번호는 8자 이상으로 설정해 주세요.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result: ChangeMyPasswordResponse = await changeMyPassword({
        currentPassword,
        newPassword,
      });

      if (result.ok) {
        setPasswordSuccessMessage("비밀번호가 성공적으로 변경되었습니다.");
        setCurrentPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
      } else {
        switch (result.error) {
          case "UNAUTHENTICATED":
            setPasswordErrorMessage(
              "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
            );
            return;
          case "INVALID_PAYLOAD":
            setPasswordErrorMessage(
              "잘못된 요청입니다. 입력 값을 다시 확인해 주세요.",
            );
            return;
          case "INVALID_PASSWORD":
            setPasswordErrorMessage("현재 비밀번호가 올바르지 않습니다.");
            return;
          case "WEAK_PASSWORD":
            setPasswordErrorMessage(
              "새 비밀번호가 너무 짧습니다. 8자 이상으로 설정해 주세요.",
            );
            return;
          case "INTERNAL_SERVER_ERROR":
            setPasswordErrorMessage(
              "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            );
            return;
          default:
            setPasswordErrorMessage(
              "비밀번호 변경 중 알 수 없는 오류가 발생했습니다.",
            );
            return;
        }
      }
    } catch (err) {
      console.error("changeMyPassword error:", err);
      setPasswordErrorMessage(
        "비밀번호를 변경하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const isUnauthenticated = error === "UNAUTHENTICATED";

  // 비로그인 상태: 안내 카드 + 로그인 버튼
  if (isUnauthenticated && !profile && !isLoading) {
    return (
      <PageContainer layout="center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>내 프로필</CardTitle>
            <CardDescription>
              프로필 설정은 로그인 후에만 이용할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                로그인한 뒤에 다시 이 페이지로 돌아오면 프로필을 수정할 수 있습니다.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => router.push("/login")}>
                  로그인 하러 가기
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer layout="top">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        {/* 계정 정보 읽기 전용 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>계정 정보</CardTitle>
            <CardDescription>
              로그인 이메일, 레이팅, 계정 생성 일시 등 읽기 전용 정보입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !profile ? (
              <p className="text-sm text-gray-600">
                계정 정보를 불러오는 중입니다...
              </p>
            ) : !profile ? (
              <p className="text-sm text-gray-600">
                계정 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">이메일</dt>
                  <dd className="font-medium text-white-900">
                    {profile.email ?? "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">이메일 인증 여부</dt>
                  <dd className="font-medium text-white-900">
                    {profile.emailVerified ? "인증됨" : "미인증"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">현재 레이팅</dt>
                  <dd className="font-medium text-white-900">
                    {/* rating 구조에 맞게 표시 (문서 기준) */}
                    {profile.rating
                      ? `Rapid ${profile.rating.rapid ?? "-"}, Blitz ${
                          profile.rating.blitz ?? "-"
                        }, Bullet ${profile.rating.bullet ?? "-"}`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">계정 생성일</dt>
                  <dd className="font-medium text-white-900">
                    {profile.createdAt
                      ? new Date(profile.createdAt).toLocaleString()
                      : "-"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* 프로필 수정 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>내 프로필</CardTitle>
            <CardDescription>
              닉네임과 아바타 이미지를 수정할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 상단 공통 에러 / 성공 메시지 */}
            {(formError || (error && error !== "UNAUTHENTICATED")) && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError ?? error}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {formSuccess}
              </div>
            )}

            {isLoading && !profile ? (
              <p className="text-sm text-gray-600">
                프로필을 불러오는 중입니다...
              </p>
            ) : !profile ? (
              <p className="text-sm text-gray-600">
                프로필 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.
              </p>
            ) : (
              <ProfileForm
                initialUsername={profile.username ?? ""}
                initialAvatarUrl={profile.avatarUrl ?? ""}
                isSubmitting={isSubmitting}
                onSubmit={handleProfileSubmit}
              />
            )}
          </CardContent>
        </Card>

        {/* 비밀번호 변경 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>비밀번호 변경</CardTitle>
            <CardDescription>
              현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passwordErrorMessage && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {passwordErrorMessage}
              </div>
            )}

            {passwordSuccessMessage && (
              <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {passwordSuccessMessage}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="currentPassword"
                  className="text-sm font-medium text-white-900"
                >
                  현재 비밀번호
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="newPassword"
                  className="text-sm font-medium text-white-900"
                >
                  새 비밀번호
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="newPasswordConfirm"
                  className="text-sm font-medium text-white-900"
                >
                  새 비밀번호 확인
                </label>
                <input
                  id="newPasswordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        
      </div>
    </PageContainer>
  );
}
