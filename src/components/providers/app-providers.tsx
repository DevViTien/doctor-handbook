"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { PwaSetup } from "@/components/providers/service-worker";
import { Toaster } from "@/components/ui/sonner";

/** Client-side providers mounted once in the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <PwaSetup />
      <Toaster position="top-center" richColors closeButton />
    </ThemeProvider>
  );
}
