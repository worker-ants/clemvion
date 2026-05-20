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

/**
 * /auth/login 응답 — discriminated union.
 *
 * spec/5-system/1-auth.md §1.4.2 — WebAuthn 우선, TOTP fallback 자동 금지.
 *   methods 가 'webauthn' 포함 → WebAuthn 화면만 노출 (TOTP 입력란 비노출)
 *   methods 가 'totp' 만        → TOTP 입력 화면
 *
 * Swagger 측은 `oneOf: [AccessTokenDto, LoginChallengeDto]` 로 분리 표기.
 */
export interface AccessTokenResponse {
  accessToken: string;
}

export interface TwoFactorChallengeResponse {
  requires2fa: true;
  methods: Array<"webauthn" | "totp">;
  challengeToken: string;
}

export type LoginResponseData =
  | AccessTokenResponse
  | TwoFactorChallengeResponse;

/**
 * 타입 가드: `LoginResponseData` 가 2FA challenge 인지 판별.
 * `if (isTwoFactorChallenge(payload)) { payload.challengeToken ... }` 형태로 사용.
 */
export function isTwoFactorChallenge(
  payload: LoginResponseData,
): payload is TwoFactorChallengeResponse {
  return "requires2fa" in payload && payload.requires2fa === true;
}

/** 타입 가드: 2FA 없이 즉시 발급된 access token 응답인지 판별. */
export function isAccessTokenResponse(
  payload: LoginResponseData,
): payload is AccessTokenResponse {
  return !isTwoFactorChallenge(payload);
}

export interface WebAuthnCredentialSummary {
  id: string;
  deviceName: string | null;
  transports: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export interface WebAuthnRegisterOptionsResult {
  publicKey: unknown;
  optionsToken: string;
}

export interface WebAuthnRegisterVerifyResult {
  verified: boolean;
  credentialUuid: string;
  webauthnRecoveryCodes: string[];
}

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
    apiClient.post<{ data: { message: string } }>(
      "/auth/forgot-password",
      { email },
    ),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post<{ data: { message: string } }>(
      "/auth/reset-password",
      { token, newPassword },
    ),

  checkEmail: (email: string) =>
    apiClient.post<{ data: { available: boolean } }>(
      "/auth/check-email",
      { email },
    ),

  // ========== WebAuthn 2FA ==========

  webauthnAvailability: () =>
    apiClient.get<{ data: { enabled: boolean } }>(
      "/auth/2fa/webauthn/availability",
    ),

  webauthnRegisterOptions: () =>
    apiClient.post<{ data: WebAuthnRegisterOptionsResult }>(
      "/auth/2fa/webauthn/register/options",
    ),

  webauthnRegisterVerify: (
    optionsToken: string,
    response: unknown,
    deviceName?: string,
  ) =>
    apiClient.post<{ data: WebAuthnRegisterVerifyResult }>(
      "/auth/2fa/webauthn/register/verify",
      { optionsToken, response, deviceName },
    ),

  webauthnAuthenticateOptions: (challengeToken: string) =>
    apiClient.post<{
      data: { publicKey: unknown; optionsToken: string };
    }>("/auth/2fa/webauthn/authenticate/options", { challengeToken }),

  webauthnAuthenticateVerify: (
    challengeToken: string,
    optionsToken: string,
    response: unknown,
  ) =>
    apiClient.post<{ data: { accessToken: string } }>(
      "/auth/2fa/webauthn/authenticate/verify",
      { challengeToken, optionsToken, response },
    ),

  webauthnRecovery: (challengeToken: string, code: string) =>
    apiClient.post<{ data: { accessToken: string } }>(
      "/auth/2fa/webauthn/recovery",
      { challengeToken, code },
    ),

  webauthnListCredentials: () =>
    apiClient.get<{ data: { items: WebAuthnCredentialSummary[] } }>(
      "/auth/2fa/webauthn/credentials",
    ),

  webauthnRenameCredential: (id: string, deviceName: string) =>
    apiClient.patch<{ data: WebAuthnCredentialSummary }>(
      `/auth/2fa/webauthn/credentials/${id}`,
      { deviceName },
    ),

  webauthnDeleteCredential: (id: string) =>
    apiClient.delete(`/auth/2fa/webauthn/credentials/${id}`),

  webauthnRegenerateRecoveryCodes: (password: string) =>
    apiClient.post<{ data: { webauthnRecoveryCodes: string[] } }>(
      "/auth/2fa/webauthn/recovery-codes/regenerate",
      { password },
    ),
};
