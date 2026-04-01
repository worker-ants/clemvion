"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usersApi } from "@/lib/api/users";
import {
  refreshAccessToken,
  setSessionRestoreInProgress,
} from "@/lib/api/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setLoading = useAuthStore((s) => s.setLoading);
  const logout = useAuthStore((s) => s.logout);
  // Prevent duplicate initialization across re-renders
  const initAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated || initAttempted.current) return;
    initAttempted.current = true;

    async function restoreSession() {
      setLoading(true);
      setSessionRestoreInProgress(true);
      try {
        // Restore session via HttpOnly cookie refresh (deduplicated)
        const accessToken = await refreshAccessToken();
        if (!accessToken) {
          throw new Error("No access token");
        }

        const userRes = await usersApi.getMe();
        const user = userRes.data.data;
        if (!user) {
          throw new Error("No user data");
        }

        setAuthenticated(accessToken, user);
      } catch {
        logout();
        // Only redirect if current path is not already a public auth route
        if (!pathname.startsWith("/login")) {
          const redirect =
            pathname.startsWith("/") && !pathname.startsWith("//")
              ? pathname
              : "/dashboard";
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
        }
      } finally {
        setSessionRestoreInProgress(false);
        setLoading(false);
      }
    }

    restoreSession();
  }, [isAuthenticated, setAuthenticated, setLoading, logout, router, pathname]);

  // Show loading spinner while restoring session
  if (isLoading && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
