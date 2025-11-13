import { io } from "socket.io-client";

// 배포 시에는 환경 변수로 변경 가능
export const socket = io("http://chess0924.iptime.org:80", {
  transports: ["websocket"],
});