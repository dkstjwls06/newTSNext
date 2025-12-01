"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
type LogItem = {
  ts: string;
  message: string;
};

export default function SocketPingTest() {
  const [connected, setConnected] = useState(false);
  const [helloMsg, setHelloMsg] = useState<string | null>(null);
  const [lastPong, setLastPong] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);

  // 로그 한 줄 추가하는 헬퍼
  const pushLog = (message: string) => {
    setLogs((prev) => [
      { ts: new Date().toLocaleTimeString(), message },
      ...prev,
    ]);
  };

  useEffect(() => {
    // 연결 상태
    const onConnect = () => {
      setConnected(true);
      pushLog("connected to server");
    };

    const onDisconnect = (reason: string) => {
      setConnected(false);
      pushLog(`disconnected: ${reason}`);
    };

    // 서버에서 보내는 hello 이벤트
    const onHello = (data: { msg: string }) => {
      setHelloMsg(data.msg);
      pushLog(`hello from server: ${data.msg}`);
    };

    // 서버에서 pong 응답
    const onPong = (data: { at: number }) => {
      const date = new Date(data.at);
      setLastPong(date.toLocaleTimeString());
      pushLog(`pong at ${date.toISOString()}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("hello", onHello);
    socket.on("pong", onPong);

    
    if (socket.connected){
      setConnected(true);
      pushLog("already connected");
    } else {
      // 이미 연결 시도 중이 아닐 경우 연결 시도
      socket.connect();
    }

    // cleanup
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("hello", onHello);
      socket.off("pong", onPong);
    };
  }, []);

  // ping 보내기 버튼 핸들러
  const sendPing = () => {
    socket.emit("ping", { at: Date.now() });
    pushLog("sent ping");
  };

  return (
    <PageContainer layout="top">
      <div className="flex w-full max-w-3xl flex-col gap-4">
        {/* 상태/버튼 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>Socket.IO Ping/Pong Test</CardTitle>
            <CardDescription>
              서버와의 연결 상태를 확인하고 ping/pong 왕복을 테스트합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-semibold">Status: </span>
              <span
                className={connected ? "text-emerald-400" : "text-rose-400"}
              >
                {connected ? "Connected" : "Disconnected"}
              </span>

              <div className="text-sm">
                <span className="font-semibold">Hello: </span>
                <span>{helloMsg ?? "(no message received yet)"}</span>
              </div>

              <div className="text-sm">
                <span className="font-semibold">Last Pong: </span>
                <span>{lastPong ?? "(no pong yet)"}</span>
              </div>
            </div>
          </CardContent>

          <div className="mt-3 mb-3">
            <Button onClick={sendPing} disabled={!connected}>
              Send Ping
            </Button>
          </div>

          {/* 로그 카드 */}
          <Card className="flex-1">
            <CardHeader className="mb-2">
              <CardTitle className="text-base">Log</CardTitle>
            </CardHeader>

            <CardContent className="max-h-80 overflow-y-auto text-xs">
              {logs.length === 0 ? (
                <div className="text-zinc-500">No events yet...</div>
              ) : (
                <ul className="space-y-1">
                  {logs.map((item, idx) => (
                    <li key={idx}>
                      <span className="text-zinc-500">[{item.ts}] </span>
                      <span>{item.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </Card>
      </div>
    </PageContainer>
  );
}
