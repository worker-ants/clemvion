import { apiClient } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  locale: string;
  theme: string;
}

export const usersApi = {
  getMe: () => apiClient.get<{ data: UserProfile }>("/users/me"),
};
