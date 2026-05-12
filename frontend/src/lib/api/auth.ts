import { apiClient } from "./client";

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  /**
   * 미가입자 초대 토큰. 동봉 시 서버는 이메일 일치 강제 + 즉시 가입·자동 로그인.
   * spec/5-system/1-auth.md §1.5.2
   */
  invitationToken?: string;
}

export interface RegisterResultData {
  message: string;
  /** 초대 토큰 가입 시에만 동봉 — 일반 가입은 누락. */
  accessToken?: string;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type LoginResponseData =
  | { accessToken: string }
  | { requiresTotp: true; challengeToken: string };

export const authApi = {
  register: (data: RegisterData) =>
    apiClient.post<{ data: RegisterResultData }>("/auth/register", data),

  verifyEmail: (token: string) =>
    apiClient.post<{ data: { accessToken: string } }>("/auth/verify-email", { token }),

  login: (data: LoginData) =>
    apiClient.post<{ data: LoginResponseData }>("/auth/login", data),

  loginTotp: (challengeToken: string, code: string) =>
    apiClient.post<{ data: { accessToken: string } }>("/auth/login/totp", {
      challengeToken,
      code,
    }),

  setup2fa: () =>
    apiClient.post<{
      data: { otpauthUrl: string; qrCodeDataUrl: string };
    }>("/auth/2fa/setup"),

  verify2fa: (code: string) =>
    apiClient.post<{ data: { recoveryCodes: string[] } }>("/auth/2fa/verify", {
      code,
    }),

  disable2fa: (password: string) =>
    apiClient.post<{ data: { ok: boolean } }>("/auth/2fa/disable", { password }),

  logout: () => apiClient.post("/auth/logout"),

  refresh: () =>
    apiClient.post<{ data: { accessToken: string } }>("/auth/refresh", {}),

  forgotPassword: (email: string) =>
    apiClient.post("/auth/forgot-password", { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post("/auth/reset-password", { token, newPassword }),

  checkEmail: (email: string) =>
    apiClient.post<{ available: boolean }>("/auth/check-email", { email }),
};
