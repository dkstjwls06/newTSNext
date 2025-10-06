import { io } from "socket.io-client"

const socket = io();
socket.on("connect", () => {
    console.log("connected", socket.id);
});

socket.on("hello", (p) => {
    const el = document.getElementById("app");
    if (el) el.textContent = `서버 인사: ${p.msg}`;
});
  
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("ping");
    btn?.addEventListener("click", () => socket.emit("ping", { at: Date.now() }));
    socket.on("pong", (v) => {
        const log = document.getElementById("log");
        if (log) log.textContent = `PONG at ${new Date(v.at).toLocaleString()}`;
    });
});