import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // 이 파일이 있는 frontend 디렉토리를 절대 경로로 지정
    root: __dirname,
  },
  reactStrictMode: true,
  env:{
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME || "chess_auth",
  }
};

export default nextConfig;