"use client";

import { create } from "zustand";
import { setAccessToken } from "../api/client";
import { clearSessionHint, setSessionHint } from "../auth/session-hint";

interface User {
  id: string;
  email: string;
  name: string;
  /** 서버 프로필(`UserProfile`)과 같다. 아바타가 없으면 null 이 온다. */
  avatarUrl?: string | null;
  locale: string;
  theme: string;
  /** TOTP 2단계 인증이 켜져 있는지. Passkey 등록 여부는 담지 않는다. */
  twoFactorEnabled: boolean;
}

/** 내 프로필 화면이 다시 받은 사용자 정보 가운데 로그인 사용자에 맞출 값. */
type ProfileSnapshot = Pick<User, "id" | "name" | "avatarUrl" | "locale" | "theme">;

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  /**
   * 내 프로필 화면이 저장 뒤 다시 받은 이름 · 아바타 · 언어 · 테마를 로그인 사용자에 맞춘다.
   * 그래서 사이드바 사용자 영역과 앱 전체 테마가 새로 고치지 않아도 저장한 값을 쓴다.
   * 다른 사용자의 정보거나 값이 같으면 상태를 바꾸지 않는다.
   */
  syncProfile: (profile: ProfileSnapshot) => void;
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

  syncProfile: (profile) =>
    set((state) => {
      const current = state.user;
      if (!current || current.id !== profile.id) return state;
      const avatarUrl = profile.avatarUrl ?? null;
      if (
        current.name === profile.name &&
        (current.avatarUrl ?? null) === avatarUrl &&
        current.locale === profile.locale &&
        current.theme === profile.theme
      ) {
        return state;
      }
      return {
        user: {
          ...current,
          name: profile.name,
          avatarUrl,
          locale: profile.locale,
          theme: profile.theme,
        },
      };
    }),

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
