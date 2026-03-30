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

export const authApi = {
  register: (data: RegisterData) =>
    apiClient.post<{ message: string }>("/auth/register", data),

  verifyEmail: (token: string) =>
    apiClient.post<{ data: { accessToken: string } }>("/auth/verify-email", { token }),

  login: (data: LoginData) =>
    apiClient.post<{ data: { accessToken: string } }>("/auth/login", data),

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
