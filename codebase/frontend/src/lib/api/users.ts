import { apiClient } from "./client";

export type ServerTheme = "light" | "dark" | "system";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  locale: string;
  theme: string;
  /** 진행 중인 이메일 변경의 확인 대기 신규 이메일 (없으면 null). */
  pendingEmail?: string | null;
}

/** 부모-자식 컴포넌트가 동일한 react-query 캐시 키를 공유하기 위한 단일 진실 상수. */
export const USER_PROFILE_QUERY_KEY = ["user-profile"] as const;

export interface EmailChangeRequestBody {
  newEmail: string;
  password?: string;
  totpCode?: string;
}

export const usersApi = {
  getMe: () => apiClient.get<{ data: UserProfile }>("/users/me"),
  // 이메일 변경 (spec/5-system/1-auth.md §1.1.B)
  requestEmailChange: (body: EmailChangeRequestBody) =>
    apiClient.post<{ data: { message: string } }>(
      "/users/me/email-change/request",
      body,
    ),
  verifyEmailChange: (token: string) =>
    apiClient.post<{ data: { accessToken: string } }>(
      "/users/me/email-change/verify",
      { token },
    ),
  resendEmailChange: () =>
    apiClient.post<{ data: { message: string } }>(
      "/users/me/email-change/resend",
      {},
    ),
  cancelEmailChange: () =>
    apiClient.post<{ data: { message: string } }>(
      "/users/me/email-change/cancel",
      {},
    ),
};
