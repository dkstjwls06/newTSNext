// frontend/app/play/ranked/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { socket } from "@/lib/socket";

type GameMode = "rapid" | "blitz" | "bullet";

interface JoinQueueResponse {
  ok: boolean;
  status: number;
  data?: {
    queueId: string;
  };
  error?: string;
}

interface CancelQueueResponse {
  ok: boolean;
  status: number;
  error?: string;
}

const PRESETS: Record<
  GameMode,
  { label: string; initialSeconds: number; incrementSeconds: number }
> = {
  rapid: {
    label: "15 | 10 (Rapid)",
    initialSeconds: 15 * 60,
    incrementSeconds: 10,
  },
  blitz: {
    label: "5 | 5 (Blitz)",
    initialSeconds: 5 * 60,
    incrementSeconds: 5,
  },
  bullet: {
    label: "2 | 1 (Bullet)",
    initialSeconds: 2 * 60,
    incrementSeconds: 1,
  },
};

export default function RankedMatchPage() {
  const router = useRouter();
  const [mode, setMode] = useState<GameMode>("rapid");
  const [isJoining, setIsJoining] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 서버에서 "match:found" 이벤트가 오면 해당 room 으로 이동
  useEffect(() => {
    const handleMatchFound = (payload: { roomId: string }) => {
      router.push(`/rooms/${payload.roomId}`);
    };

    socket.on("match:found", handleMatchFound);

    return () => {
      socket.off("match:found", handleMatchFound);
    };
  }, [router]);

  const handleJoin = async () => {
    const preset = PRESETS[mode];

    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch("/api/match-queue/join", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          timeControl: {
            initialSeconds: preset.initialSeconds,
            incrementSeconds: preset.incrementSeconds,
          },
        }),
      });

      const data: JoinQueueResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error || `Failed to join queue (${res.status})`
        );
      }

      setIsWaiting(true);
    } catch (err: any) {
      console.error("Failed to join ranked queue:", err);
      setError(err.message || "랭크 큐 참가에 실패했습니다.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancel = async () => {
    setError(null);

    try {
      const res = await fetch("/api/match-queue/cancel", {
        method: "POST",
        credentials: "include",
      });

      const data: CancelQueueResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error || `Failed to cancel queue (${res.status})`
        );
      }

      setIsWaiting(false);
    } catch (err: any) {
      console.error("Failed to cancel ranked queue:", err);
      setError(err.message || "랭크 큐 취소에 실패했습니다.");
    }
  };

  return (
    <RequireAuth>
      <PageContainer layout="top">
        <Card>
          <CardHeader>
            <CardTitle>랭크 게임 빠른 매칭</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                랭크 게임은 항상 매치메이킹 큐를 통해 자동으로 매칭됩니다.
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium">게임 모드</p>
                <div className="flex gap-2">
                  {(Object.keys(PRESETS) as GameMode[]).map((m) => {
                    const selected = m === mode;
                    return (
                      <Button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        disabled={isJoining || isWaiting}
                        className={
                          selected
                            ? "font-semibold"
                            : "opacity-70"
                        }
                        {...(selected ? { variant: "primary" } : {})}
                      >
                        {PRESETS[m].label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">현재 선택된 시간제</p>
                <p className="text-sm">
                  {PRESETS[mode].initialSeconds / 60}분 +{" "}
                  {PRESETS[mode].incrementSeconds}초
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-500">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                {!isWaiting && (
                  <Button
                    type="button"
                    onClick={handleJoin}
                    disabled={isJoining}
                  >
                    {isJoining ? "대기열 참가 중..." : "빠른 매칭 시작"}
                  </Button>
                )}

                {isWaiting && (
                  <>
                    <Button type="button" disabled>
                      매칭 대기 중...
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCancel}
                    >
                      대기 취소
                    </Button>
                  </>
                )}
              </div>

              {isWaiting && (
                <p className="text-xs text-muted-foreground">
                  매칭이 성사되면 자동으로 게임 방으로 이동합니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </RequireAuth>
  );
}
