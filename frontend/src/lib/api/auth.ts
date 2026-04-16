import { apiClient } from "./client";

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
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
    apiClient.post<{ message: string }>("/auth/register", data),

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
