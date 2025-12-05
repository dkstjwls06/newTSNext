// frontend/components/game/RoomGameView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  socket,
  onRoomState,
  onRoomUserJoined,
  onRoomUserLeft,
  onRoomChatNew,
  type SocketUnsubscribe,
} from "@/lib/socket";
import { Button } from "@/components/ui/Button";

// 서버에서 내려오는 RoomGameState(JSON 직렬화 버전)에 맞춘 타입
type RoomTurn = "w" | "b";

interface RoomGameMove {
  moveNumber: number;
  san: string;
  from: string;
  to: string;
  fenAfter: string;
  createdAt: string;
}

interface RoomGameState {
  boardFEN: string;
  moveCount: number;
  turn: RoomTurn;
  status: "ongoing" | "white_won" | "black_won" | "draw";
  statusReason: string | null;
  moves: RoomGameMove[];
  whiteTimeSeconds: number;
  blackTimeSeconds: number;
}

// 채팅 메시지 표시용 타입 (REST + Socket 이벤트를 모두 수용)
interface RoomChatMessage {
  id: string;
  username: string | null;
  message: string;
  createdAt: string;
  system?: boolean;
}

interface RoomGameViewProps {
  roomId: string;
}

export default function RoomGameView({ roomId }: RoomGameViewProps) {
  const [connecting, setConnecting] = useState<boolean>(true);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [gameState, setGameState] = useState<RoomGameState | null>(null);

  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribes: SocketUnsubscribe[] = [];

    async function init() {
      setConnecting(true);
      setJoinError(null);

      // 1) 방 참가
      socket.emit(
        "room:join",
        { roomId },
        (ack?: { ok: boolean; error?: string }) => {
          if (cancelled) return;
          if (!ack) {
            setJoinError("방 입장 응답이 올바르지 않습니다.");
            setConnecting(false);
            return;
          }
          if (!ack.ok) {
            setJoinError(ack.error ?? "방 입장에 실패했습니다.");
          }
          setConnecting(false);
        }
      );

      // 2) room:state 실시간 상태 구독
      const offState = onRoomState((payload: any) => {
        if (cancelled) return;

        // 서버 코드 상 payload는 { roomId, room } 형태로 내려간다.
        const room = (payload && (payload.room ?? payload)) as any;
        if (room && room.gameState) {
          setGameState({
            boardFEN: String(room.gameState.boardFEN),
            moveCount: Number(room.gameState.moveCount ?? 0),
            turn: (room.gameState.turn ?? "w") as RoomTurn,
            status: room.gameState.status ?? "ongoing",
            statusReason:
              room.gameState.statusReason === null ||
              room.gameState.statusReason === undefined
                ? null
                : String(room.gameState.statusReason),
            moves: Array.isArray(room.gameState.moves)
              ? room.gameState.moves.map((m: any) => ({
                  moveNumber: Number(m.moveNumber ?? 0),
                  san: String(m.san ?? ""),
                  from: String(m.from ?? ""),
                  to: String(m.to ?? ""),
                  fenAfter: String(m.fenAfter ?? ""),
                  createdAt:
                    typeof m.createdAt === "string"
                      ? m.createdAt
                      : new Date(m.createdAt).toISOString(),
                }))
              : [],
            whiteTimeSeconds: Number(room.gameState.whiteTimeSeconds ?? 0),
            blackTimeSeconds: Number(room.gameState.blackTimeSeconds ?? 0),
          });
        }
      });
      unsubscribes.push(offState);

      // 3) room:user-joined / room:user-left → 시스템 메시지로 채팅 패널에 반영
      const offJoined = onRoomUserJoined((payload: any) => {
        if (cancelled) return;
        setChatMessages((prev) => [
          ...prev,
          {
            id: `joined-${payload.userId ?? Math.random().toString(36).slice(2)}`,
            username:
              payload.username === undefined
                ? null
                : String(payload.username),
            message: "방에 입장했습니다.",
            createdAt: new Date().toISOString(),
            system: true,
          },
        ]);
      });
      unsubscribes.push(offJoined);

      const offLeft = onRoomUserLeft((payload: any) => {
        if (cancelled) return;
        setChatMessages((prev) => [
          ...prev,
          {
            id: `left-${payload.userId ?? Math.random().toString(36).slice(2)}`,
            username:
              payload.username === undefined
                ? null
                : String(payload.username),
            message: "방에서 나갔습니다.",
            createdAt: new Date().toISOString(),
            system: true,
          },
        ]);
      });
      unsubscribes.push(offLeft);

      // 4) room:chat:new → 실시간 채팅 메시지
      const offChatNew = onRoomChatNew((payload: any) => {
        if (cancelled) return;
        setChatMessages((prev) => [
          ...prev,
          {
            id:
              (typeof payload.id === "string" && payload.id) ||
              (typeof payload._id === "string" && payload._id) ||
              Math.random().toString(36).slice(2),
            username:
              payload.username === undefined
                ? null
                : String(payload.username),
            message: String(payload.message ?? ""),
            createdAt:
              typeof payload.createdAt === "string"
                ? payload.createdAt
                : new Date(payload.createdAt).toISOString(),
          },
        ]);
      });
      unsubscribes.push(offChatNew);

      // 5) 초기 채팅 히스토리 로드 (6.3-6에서 정의한 REST API 사용)
      try {
        const res = await fetch(`/api/rooms/${roomId}/messages`);
        if (res.ok) {
          const data: any = await res.json();
          if (data && Array.isArray(data.messages)) {
            const initialMessages: RoomChatMessage[] = data.messages.map(
              (m: any) => ({
                id:
                  (typeof m.id === "string" && m.id) ||
                  (typeof m._id === "string" && m._id) ||
                  Math.random().toString(36).slice(2),
                username:
                  m.username === undefined ? null : String(m.username),
                message: String(m.message ?? ""),
                createdAt:
                  typeof m.createdAt === "string"
                    ? m.createdAt
                    : new Date(m.createdAt).toISOString(),
              })
            );
            if (!cancelled) {
              setChatMessages(initialMessages);
            }
          }
        }
      } catch {
        // 채팅 히스토리는 실패해도 치명적이지 않으므로 조용히 무시
      }
    }

    void init();

    return () => {
      cancelled = true;
      socket.emit("room:leave", { roomId });
      unsubscribes.forEach((off) => off());
    };
  }, [roomId]);

  const boardRows = useMemo(() => {
    if (!gameState?.boardFEN) return null;
    return parseFENBoard(gameState.boardFEN);
  }, [gameState?.boardFEN]);

  const formattedWhiteClock = formatSeconds(gameState?.whiteTimeSeconds);
  const formattedBlackClock = formatSeconds(gameState?.blackTimeSeconds);

  const statusLabel = (() => {
    if (!gameState) return "대기 중";
    switch (gameState.status) {
      case "ongoing":
        return "진행 중";
      case "white_won":
        return "백 승리";
      case "black_won":
        return "흑 승리";
      case "draw":
        return "무승부";
      default:
        return gameState.status;
    }
  })();

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatSending(true);

    socket.emit(
      "room:chat:send",
      { roomId, message: text },
      (ack?: { ok: boolean; error?: string }) => {
        setChatSending(false);
        if (!ack) return;
        if (!ack.ok && ack.error) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              username: null,
              message: `메시지 전송 실패: ${ack.error}`,
              createdAt: new Date().toISOString(),
              system: true,
            },
          ]);
        } else {
          setChatInput("");
        }
      }
    );
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)]">
      {/* 좌측: 체스보드 + 게임 상태 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">게임 상태: </span>
            <span>{statusLabel}</span>
            {gameState?.statusReason && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({gameState.statusReason})
              </span>
            )}
          </div>
          {gameState && (
            <div>
              <span className="font-medium text-foreground">턴: </span>
              <span>{gameState.turn === "w" ? "백" : "흑"}</span>
            </div>
          )}
        </div>

        {/* 체스보드 */}
        <div className="rounded-md border bg-background p-2">
          {boardRows ? (
            <div className="aspect-square w-full max-w-[480px] mx-auto">
              <div className="grid h-full w-full grid-cols-8 grid-rows-8">
                {boardRows.map((row, rowIdx) =>
                  row.map((cell, colIdx) => {
                    const isDark = (rowIdx + colIdx) % 2 === 1;
                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`flex items-center justify-center text-2xl ${
                          isDark ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-900"
                        }`}
                      >
                        {cell}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              아직 게임 상태가 없습니다. 상대가 입장하거나 게임이 시작되면 체스판이 표시됩니다.
            </p>
          )}
        </div>

        {/* 시간 + 수순 목록 */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="font-medium mb-2">남은 시간</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span>백</span>
                <span className="font-mono">{formattedWhiteClock}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>흑</span>
                <span className="font-mono">{formattedBlackClock}</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">수순 목록</span>
              <span className="text-xs text-muted-foreground">
                총 {gameState?.moves.length ?? 0}수
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto pr-1">
              {gameState && gameState.moves.length > 0 ? (
                <ol className="space-y-1 text-xs">
                  {gameState.moves.map((m) => (
                    <li key={`${m.moveNumber}-${m.from}-${m.to}`}>
                      <span className="font-mono mr-1">{m.moveNumber}.</span>
                      <span className="font-mono mr-1">{m.san}</span>
                      <span className="text-muted-foreground">
                        ({m.from}→{m.to})
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">
                  아직 기록된 수순이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 우측: 채팅 패널 */}
      <div className="flex flex-col rounded-md border bg-background p-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">방 채팅</span>
        </div>

        <div className="flex-1 min-h-40 max-h-72 overflow-y-auto border rounded-md bg-muted/40 p-2 mb-2">
          {chatMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              아직 채팅 메시지가 없습니다. 아래에서 첫 메시지를 보내 보세요.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {chatMessages.map((msg) => (
                <li key={msg.id}>
                  <span className="font-semibold">
                    {msg.system
                      ? "[시스템]"
                      : msg.username ?? "익명"}
                  </span>
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span>{msg.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <textarea
            className="min-h-[60px] resize-none rounded-md border bg-background p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="메시지를 입력하고 Enter를 눌러 전송하세요."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={chatSending || !chatInput.trim()}
              onClick={handleSendChat}
            >
              {chatSending ? "전송 중..." : "전송"}
            </Button>
          </div>
        </div>
      </div>

      {/* 연결 상태 / 오류 표시 */}
      {connecting && (
        <p className="col-span-full text-xs text-muted-foreground">
          소켓 서버와 연결 중입니다...
        </p>
      )}
      {joinError && (
        <p className="col-span-full text-xs text-red-500">
          방 입장 중 오류: {joinError}
        </p>
      )}
    </div>
  );
}

/**
 * FEN 문자열(보드 부분) -> [8][8] 유니코드 말 표시 배열
 */
function parseFENBoard(fen: string): string[][] {
  const [boardPart] = fen.split(" ");
  const rows = boardPart.split("/");
  const pieceMap: Record<string, string> = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
    P: "♙",
    R: "♖",
    N: "♘",
    B: "♗",
    Q: "♕",
    K: "♔",
  };

  const result: string[][] = [];

  for (const row of rows) {
    const cells: string[] = [];
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        const count = Number(ch);
        for (let i = 0; i < count; i++) {
          cells.push("");
        }
      } else {
        cells.push(pieceMap[ch] ?? "");
      }
    }
    result.push(cells);
  }

  // 혹시라도 8행이 안 나오면 보정
  while (result.length < 8) {
    result.push(new Array(8).fill(""));
  }

  return result;
}

/**
 * 초 단위를 "MM:SS" 문자열로 포매팅
 */
function formatSeconds(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--:--";
  }
  const total = Math.max(0, Math.floor(value));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
