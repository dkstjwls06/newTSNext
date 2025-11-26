"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

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
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        backgroundColor: "#0a0a0a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1>Socket.IO Ping/Pong Test</h1>

      <section
        style={{
          padding: "16px",
          borderRadius: "12px",
          backgroundColor: "#111827",
        }}
      >
        <div>
          <strong>Status:</strong>{" "}
          <span style={{ color: connected ? "#4ade80" : "#f97373" }}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div style={{ marginTop: "8px" }}>
          <strong>Hello:</strong>{" "}
          <span>{helloMsg ?? "(no message received yet)"}</span>
        </div>

        <div style={{ marginTop: "8px" }}>
          <strong>Last Pong:</strong>{" "}
          <span>{lastPong ?? "(no pong yet)"}</span>
        </div>

        <button
          onClick={sendPing}
          disabled={!connected}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: connected ? "#3b82f6" : "#6b7280",
            color: "white",
            cursor: connected ? "pointer" : "not-allowed",
          }}
        >
          Send Ping
        </button>
      </section>

      <section
        style={{
          padding: "16px",
          borderRadius: "12px",
          backgroundColor: "#020617",
          flex: 1,
          minHeight: "120px",
          overflowY: "auto",
        }}
      >
        <h2 style={{ marginBottom: "8px" }}>Log</h2>
        {logs.length === 0 ? (
          <div style={{ color: "#9ca3af" }}>No events yet...</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {logs.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "4px", fontSize: "14px" }}>
                <span style={{ color: "#6b7280" }}>[{item.ts}] </span>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
