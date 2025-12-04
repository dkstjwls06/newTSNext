// frontend/app/rooms/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RequireAuth } from "@/components/auth/RequireAuth";
type RoomType = "public" | "friendly";
type GameMode = "rapid" | "blitz" | "bullet";



// 서버 응답에 맞춰 최소 필드만 정의
interface RoomListItem {
  id: string;
  type: RoomType;
  mode: GameMode | null;
  status: "waiting" | "in_progress" | "finished";
  rated: boolean;
  hostUserId: string;
  whiteUserId: string | null;
  blackUserId: string | null;
  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  createdAt: string;
}

interface RoomsListResponse {
  ok: boolean;
  rooms: RoomListItem[];
  error?: string;
}
export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/rooms?type=friendly", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.error || `Failed to fetch rooms (status ${res.status})`
          );
        }

        const data = (await res.json()) as RoomsListResponse;
        // data.rooms 형태라고 가정 (server/src/routes/rooms.ts 응답 구조 따라 조정)
        setRooms(data.rooms ?? []);
      } catch (e: any) {
        setError(e.message ?? "친선 방 목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <RequireAuth>
      <PageContainer layout="top">
        <Card>
          <CardHeader>
            <CardTitle>친선 방 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p>로딩 중...</p>}
            {error && (
              <p className="text-red-500 text-sm mb-2">
                {error}
              </p>
            )}
            {!loading && !error && (!rooms || rooms.length === 0) && (
              <p className="text-sm text-muted-foreground">
                대기 중인 친선 방이 없습니다.
              </p>
            )}

            {!loading && !error && rooms && rooms.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left">유형</th>
                      <th className="py-2 pr-4 text-left">모드</th>
                      <th className="py-2 pr-4 text-left">상태</th>
                      <th className="py-2 pr-4 text-left">레이팅</th>
                      <th className="py-2 pr-4 text-left">시간제</th>
                      <th className="py-2 pr-4 text-left">호스트</th>
                      <th className="py-2 pr-4 text-left">백</th>
                      <th className="py-2 pr-4 text-left">흑</th>
                      <th className="py-2 pr-4 text-left">생성 시각</th>
                      <th className="py-2 pr-4 text-right">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">
                          {room.type}
                        </td>
                        <td className="py-2 pr-4">
                          {room.mode ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {room.status}
                        </td>
                        <td className="py-2 pr-4">
                          {room.rated ? "랭크" : "친선"}
                        </td>
                        <td className="py-2 pr-4">
                          {room.timeControl.initialSeconds}s +{" "}
                          {room.timeControl.incrementSeconds}
                        </td>
                        <td className="py-2 pr-4">
                          {room.whiteUserId ? room.whiteUserId : '-'}
                        </td>
                        <td className="py-2 pr-4">
                          {room.blackUserId ? room.blackUserId : '-'}
                        </td>
                        <td className="py-2 pr-4">
                          {new Date(room.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-0 text-right">
                          <Link href={`/rooms/${room.id}`}>
                            <Button variant="primary">
                              입장
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </RequireAuth>
  );
}
