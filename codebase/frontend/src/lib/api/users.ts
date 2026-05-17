import { apiClient } from "./client";

export type ServerTheme = "light" | "dark";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  locale: string;
  theme: string;
}

/** 부모-자식 컴포넌트가 동일한 react-query 캐시 키를 공유하기 위한 단일 진실 상수. */
export const USER_PROFILE_QUERY_KEY = ["user-profile"] as const;

export const usersApi = {
  getMe: () => apiClient.get<{ data: UserProfile }>("/users/me"),
};
