import React from "react";

interface PageContainerProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * 모든 페이지에서 공통으로 사용하는 기본 레이아웃 컨테이너.
 * - 화면 중앙 정렬
 * - 적당한 padding
 * - 배경은 globals.css / body 설정을 그대로 사용
 */
export function PageContainer({ className, children }: PageContainerProps) {
  return (
    <main
      className={
        "min-h-screen flex items-center justify-center p-6 " +
        (className ?? "")
      }
    >
      {children}
    </main>
  );
}
