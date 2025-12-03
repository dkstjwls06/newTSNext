// frontend/components/ClientProviders.tsx
"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Navbar } from "@/components/Navbar";

interface ClientProvidersProps {
  children: ReactNode;
}

/**
 * 클라이언트 전역 Provider 모음
 * - AuthProvider
 * - 전역 Navbar
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col dark:bg-black">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </AuthProvider>
  );
}
