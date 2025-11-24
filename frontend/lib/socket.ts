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

export const socket = io(baseURL, {
  transports: ["websocket"],
});