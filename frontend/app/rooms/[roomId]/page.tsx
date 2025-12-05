// frontend/app/rooms/[roomId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import RoomGameView from "@/components/game/RoomGameView";

type RoomType = "public" | "friendly";
type GameMode = "rapid" | "blitz" | "bullet";
type RoomStatus = "waiting" | "in_progress" | "finished";

export interface RoomGameMove {
  moveNumber: number;
  from: string;
  to: string;
  san: string;
  by: "white" | "black";
  createdAt: string;
}

interface RoomGameState {
  boardFEN: string;
  moveCount: number;
  turn: "white" | "black";

  clocks: {
    whiteRemainingMs: number;
    blackRemainingMs: number;
    lastMoveAt: string;
  };

  moves: RoomGameMove[];

  result: {
    status: "ongoing" | "white_win" | "black_win" | "draw";
    reason: string | null;
  };
}

interface RoomDetail {
  id: string;
  type: RoomType;
  mode: GameMode | null;
  status: RoomStatus;
  rated: boolean;
  hostUserId: string;
  whiteUserId: string | null;
  blackUserId: string | null;
  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  gameId: string | null;
  gameState: RoomGameState;
  createdAt: string;
  updatedAt: string;
}

interface RoomDetailResponse {
  ok: boolean;
  room?: RoomDetail;
  error?: string;
}

export default function RoomDetailPage() {
  const params = useParams();
  const { roomId } = params as { roomId: string };

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    let aborted = false;

    const fetchRoom = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError("해당 방을 찾을 수 없습니다.");
          } else {
            setError(
              `방 정보를 불러오는 중 오류가 발생했습니다. (status ${res.status})`
            );
          }
          setLoading(false);
          return;
        }

        const data = (await res.json()) as RoomDetailResponse;

        if (!data.ok || !data.room) {
          setError(
            data.error && typeof data.error === "string"
              ? data.error
              : "방 정보 응답 형식이 올바르지 않습니다."
          );
          setLoading(false);
          return;
        }

        if (!aborted) {
          setRoom({
            ...data.room,
            createdAt: data.room.createdAt,
          });
          setLoading(false);
        }
      } catch (err) {
        if (!aborted) {
          console.error(`Failed to fetch /api/rooms/${roomId}`, err);
          setError("방 정보를 불러오는 중 오류가 발생했습니다.");
          setLoading(false);
        }
      }
    };

    void fetchRoom();

    return () => {
      aborted = true;
    };
  }, [roomId]);

  const formatModeLabel = (mode: GameMode | null) => {
    if (!mode) return "모드 미지정";
    if (mode === "rapid") return "래피드";
    if (mode === "blitz") return "블리츠";
    return "불릿";
  };

  const formatStatus = (status: RoomStatus) => {
    switch (status) {
      case "waiting":
        return "대기 중";
      case "in_progress":
        return "진행 중";
      case "finished":
        return "종료";
      default:
        return status;
    }
  };

  const formatTimeControl = (tc: RoomDetail["timeControl"]) =>
    `${tc.initialSeconds}s + ${tc.incrementSeconds}`;

  return (
    <RequireAuth>
      <PageContainer layout="top">
        <div className="w-full max-w-2xl">
          <Card>
          <CardHeader>
            <CardTitle>방 상세</CardTitle>
              <CardDescription>
                방 기본 정보를 확인하고, 아래에서 실제 체스보드 / 실시간 동기화 / 채팅 UI까지 함께 사용할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && (
                <p className="text-sm text-muted-foreground">로딩 중...</p>
              )}

              {!loading && error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {!loading && !error && room && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">방 ID: </span>
                    <span className="font-mono text-xs break-all">
                      {room.id}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">타입: </span>
                    <span>
                      {room.type === "friendly" ? "친선" : "공개(랭크)"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">모드: </span>
                    <span>{formatModeLabel(room.mode)}</span>
                  </div>
                  <div>
                    <span className="font-medium">상태: </span>
                    <span>{formatStatus(room.status)}</span>
                  </div>
                  <div>
                    <span className="font-medium">레이팅: </span>
                    <span>
                      {room.rated ? "랭크" : "친선 (레이팅 변동 없음)"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">시간제: </span>
                    <span>{formatTimeControl(room.timeControl)}</span>
                  </div>
                  <div>
                    <span className="font-medium">생성 시각: </span>
                    <span>
                      {new Date(room.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* 실제 입장/게임 화면으로 넘어가는 버튼은 6.3-8에서 라우팅 결정 */}
                  <div className="pt-4 border-t mt-4">
                    <RoomGameView roomId={room.id} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </RequireAuth>
  );
}
