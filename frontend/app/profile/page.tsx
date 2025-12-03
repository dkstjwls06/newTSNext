"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
    changeMyPassword,
    type ChangeMyPasswordResponse,
} from "@/app/api/profile";
export default function ProfilePage() {
  const router = useRouter();
  const { profile, isLoading, error, refresh, updateProfile } = useUserProfile();

  // 폼 상태: 닉네임(표시 이름), 아바타 URL
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // UI용 메시지/상태
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

  // 프로필 로딩 완료 시 폼 초기값 세팅
  useEffect(() => {
    if (!profile) return;

    // 현재 서버 프로필의 username을 표시용 닉네임 초기값으로 사용
    setDisplayName(profile.username ?? "");
    setAvatarUrl(profile.avatarUrl ?? "");
  }, [profile]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedDisplayName = displayName.trim();
    const trimmedAvatarUrl = avatarUrl.trim();

    if (!trimmedDisplayName) {
      setFormError("닉네임을 비워 둘 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateProfile({
        // 서버 요청 타입(UpdateMyProfileRequest)에 맞춰 displayName / avatarUrl 사용
        username: trimmedDisplayName,
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
            setFormError("이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해 주세요.");
            break;
          case "NO_CHANGES":
            setFormError("변경된 내용이 없습니다.");
            break;
          case "INVALID_PAYLOAD":
            setFormError("요청 형식이 올바르지 않습니다. 다시 시도해 주세요.");
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
      setPasswordErrorMessage("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
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
              setPasswordErrorMessage("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
              return;
            case "INVALID_PAYLOAD":
              setPasswordErrorMessage("잘못된 요청입니다. 입력 값을 다시 확인해 주세요.");
              return;
            case "INVALID_PASSWORD":
              setPasswordErrorMessage("현재 비밀번호가 올바르지 않습니다.");
              return;
            case "WEAK_PASSWORD":
              setPasswordErrorMessage("새 비밀번호가 너무 짧습니다. 8자 이상으로 설정해 주세요.");
              return;
            case "INTERNAL_SERVER_ERROR":
              setPasswordErrorMessage("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
              return;
            default:
              setPasswordErrorMessage("비밀번호 변경 중 알 수 없는 오류가 발생했습니다.");
              return;
          }
      }
    } catch (err) {
      console.error("changeMyPassword error:", err);
      setPasswordErrorMessage(
        "비밀번호를 변경하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
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
              <p className="text-sm text-gray-600">프로필을 불러오는 중입니다...</p>
            ) : !profile ? (
              <p className="text-sm text-gray-600">
                프로필 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.
              </p>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                {/* 닉네임(표시 이름) */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="displayName"
                    className="text-sm font-medium text-gray-900"
                  >
                    닉네임
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="게임에서 표시될 닉네임을 입력해 주세요"
                  />
                  <p className="text-xs text-gray-500">
                    게임 및 친구 목록 등에서 보여지는 이름입니다.
                  </p>
                </div>

                {/* 아바타 이미지 URL */}
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="avatarUrl"
                    className="text-sm font-medium text-gray-900"
                  >
                    아바타 이미지 URL
                  </label>
                  <input
                    id="avatarUrl"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="https://example.com/avatar.png"
                  />
                  <p className="text-xs text-gray-500">
                    비워 두면 기본 아바타가 사용됩니다.
                  </p>
                </div>

                {/* 아바타 미리보기 (URL 입력 시) */}
                {avatarUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-200 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl}
                        alt="아바타 미리보기"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      입력한 URL을 기준으로 렌더링한 아바타 미리보기입니다.
                    </p>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* 비밀번호 변경 카드 */}
        <Card className="p-6">
          <CardTitle>비밀번호 변경</CardTitle>
          <CardDescription>
            비밀번호를 변경할 수 있습니다.
          </CardDescription>
          <CardContent>
            {passwordSuccessMessage && (
              <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {passwordSuccessMessage}
              </div>
            )}

            {passwordErrorMessage && (
              <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {passwordErrorMessage}
              </div>
            )}

            <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">현재 비밀번호</label>
                <input
                  type="password"
                  className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">새 비밀번호</label>
                <input
                  type="password"
                  className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">새 비밀번호 확인</label>
                <input
                  type="password"
                  className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="mt-2 flex justify-end">
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </div>
            </form>
          </CardContent>
          
        </Card>

        {/* 읽기 전용 계정 정보 카드 */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle>계정 정보</CardTitle>
              <CardDescription>읽기 전용 기본 계정 정보입니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">이메일: </span>
                <span>{profile.email}</span>
              </div>
              <div>
                <span className="font-medium">이메일 인증: </span>
                <span>{profile.emailVerified ? "완료" : "미완료"}</span>
              </div>
              <div>
                <span className="font-medium">레이팅: </span>
                <span>
                  rapid {profile.rating?.rapid ?? "-"} / blitz{" "}
                  {profile.rating?.blitz ?? "-"} / bullet{" "}
                  {profile.rating?.bullet ?? "-"}
                </span>
              </div>
              <div>
                <span className="font-medium">친구 수: </span>
                <span>{profile.social?.friendCount ?? 0}</span>
              </div>
              <div>
                <span className="font-medium">차단한 유저 수: </span>
                <span>{profile.social?.blockedCount ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
