"use client";

import { create } from "zustand";
import { setAccessToken } from "../api/client";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  locale: string;
  theme: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (token: string, user: User) => void;
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
    if (typeof document !== "undefined") {
      document.cookie = "has_session=1; path=/; max-age=2592000; SameSite=Lax";
    }
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    setAccessToken(null);
    // Clear session hint cookie
    if (typeof document !== "undefined") {
      document.cookie = "has_session=; path=/; max-age=0";
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
