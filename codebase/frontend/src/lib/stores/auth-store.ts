"use client";

import { create } from "zustand";
import { setAccessToken } from "../api/client";
import { clearSessionHint, setSessionHint } from "../auth/session-hint";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  locale: string;
  theme: string;
  /** TOTP 2단계 인증이 켜져 있는지. Passkey 등록 여부는 담지 않는다. */
  twoFactorEnabled: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (token: string, user: User) => void;
  /**
   * 토큰은 받았지만 사용자 정보는 아직 없다. 액세스 토큰과 로그인 힌트 쿠키만 둔다.
   * 로그인 상태(`isAuthenticated`)는 `setAuthenticated` 가 표시한다. `lib/auth/establish-session.ts` 가 쓴다.
   */
  markSessionIssued: (token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user }),

  setAuthenticated: (token, user) => {
    setAccessToken(token);
    // Set session hint cookie for middleware (non-httpOnly, visible to server)
    setSessionHint();
    set({ user, isAuthenticated: true, isLoading: false });
  },

  markSessionIssued: (token) => {
    setAccessToken(token);
    setSessionHint();
  },

  logout: () => {
    setAccessToken(null);
    // Clear session hint cookie
    clearSessionHint();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
