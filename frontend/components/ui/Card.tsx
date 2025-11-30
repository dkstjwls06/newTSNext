import type { ReactNode } from "react";

type CardProps = {
  className?: string;
  children: ReactNode;
};

type CardSectionProps = {
  className?: string;
  children: ReactNode;
};

type CardTitleProps = {
  className?: string;
  children: ReactNode;
};

type CardDescriptionProps = {
  className?: string;
  children: ReactNode;
};

/**
 * 기본 카드 래퍼
 *
 * - 어두운 배경에서도 읽기 쉬운 semi-transparent 박스
 * - 기본 패딩/둥근 모서리/얕은 그림자
 */
export function Card({ className, children }: CardProps) {
  const base =
    "rounded-xl border border-black/5 bg-white/80 p-4 shadow-sm backdrop-blur " +
    "dark:border-white/10 dark:bg-zinc-900/80";

  return <section className={className ? `${base} ${className}` : base}>{children}</section>;
}

/** 상단 영역(제목/요약 등)을 위한 섹션 */
export function CardHeader({ className, children }: CardSectionProps) {
  const base = "mb-3";
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}

/** 카드 제목 */
export function CardTitle({ className, children }: CardTitleProps) {
  const base = "text-lg font-semibold tracking-tight";
  return <h2 className={className ? `${base} ${className}` : base}>{children}</h2>;
}

/** 카드 설명(부제) */
export function CardDescription({ className, children }: CardDescriptionProps) {
  const base = "mt-1 text-sm text-zinc-600 dark:text-zinc-400";
  return <p className={className ? `${base} ${className}` : base}>{children}</p>;
}

/** 본문 컨텐츠 영역 */
export function CardContent({ className, children }: CardSectionProps) {
  const base = "text-sm";
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}

/** 하단 영역(버튼/푸터 텍스트 등)을 위한 섹션 */
export function CardFooter({ className, children }: CardSectionProps) {
  const base = "mt-3 flex items-center gap-2";
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}
