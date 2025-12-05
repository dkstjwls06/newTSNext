// frontend/lib/socket.ts
import { io } from "socket.io-client";

function getSocketBaseUrl() {
  // 1. 환경 변수 우선 (빌드 시점)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // 2. 브라우저 환경에서는 현재 origin 사용
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 3. 서버 사이드 렌더링 시에는 개발 기본값 사용
  return "http://localhost:3000";
}

const baseURL = getSocketBaseUrl();

// 기존 코드와의 호환성을 위해 socket 인스턴스 export는 그대로 유지
export const socket = io(baseURL, {
  transports: ["websocket"],
});

// 공통 타입: onXXX 호출 시 반환되는 구독 해제 함수 타입
export type SocketUnsubscribe = () => void;

/**
 * room:state 이벤트 구독 유틸
 * 서버에서 { roomId, room } 형태로 내려주므로 payload 전체를 그대로 넘겨준다.
 */
export function onRoomState(handler: (payload: any) => void): SocketUnsubscribe {
  socket.on("room:state", handler);
  return () => {
    socket.off("room:state", handler);
  };
}

/**
 * room:user-joined 이벤트 구독 유틸
 */
export function onRoomUserJoined(handler: (payload: any) => void): SocketUnsubscribe {
  socket.on("room:user-joined", handler);
  return () => {
    socket.off("room:user-joined", handler);
  };
}

/**
 * room:user-left 이벤트 구독 유틸
 */
export function onRoomUserLeft(handler: (payload: any) => void): SocketUnsubscribe {
  socket.on("room:user-left", handler);
  return () => {
    socket.off("room:user-left", handler);
  };
}

/**
 * room:chat:new 이벤트 구독 유틸
 */
export function onRoomChatNew(handler: (payload: any) => void): SocketUnsubscribe {
  socket.on("room:chat:new", handler);
  return () => {
    socket.off("room:chat:new", handler);
  };
}
