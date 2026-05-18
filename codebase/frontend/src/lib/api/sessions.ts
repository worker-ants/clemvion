import { apiClient } from "./client";

export type LoginHistoryEvent =
  | "login_success"
  | "login_failed"
  | "totp_failed"
  | "logout"
  | "session_revoked"
  | "token_reuse_detected";

export interface SessionDto {
  familyId: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface LoginHistoryItemDto {
  id: string;
  event: LoginHistoryEvent;
  ipAddress: string | null;
  deviceLabel: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface LoginHistoryPageDto {
  items: LoginHistoryItemDto[];
  nextCursor: string | null;
}

export interface SessionListDto {
  items: SessionDto[];
}

export interface RevokeSessionPayload {
  password?: string;
  totpCode?: string;
  emailOtp?: string;
}

/**
 * Backend wraps every successful response in `{ data: T }` (TransformInterceptor).
 * We unwrap once here so consumers work with the typed payload directly.
 */
export const sessionsApi = {
  listSessions: async (): Promise<SessionDto[]> => {
    const res = await apiClient.get<{ data: SessionListDto }>(
      "/users/me/sessions",
    );
    return res.data.data.items;
  },

  revokeSession: async (
    familyId: string,
    payload: RevokeSessionPayload,
  ): Promise<SessionDto[]> => {
    // POST 사용 — 일부 CDN/프록시가 DELETE 의 request body 를 제거할 수 있어
    // 자격증명을 안전하게 전달할 수 없다.
    const res = await apiClient.post<{ data: SessionListDto }>(
      `/users/me/sessions/${encodeURIComponent(familyId)}/revoke`,
      payload,
    );
    return res.data.data.items;
  },

  revokeOtherSessions: async (
    payload: RevokeSessionPayload,
  ): Promise<SessionDto[]> => {
    const res = await apiClient.post<{ data: SessionListDto }>(
      "/users/me/sessions/revoke-others",
      payload,
    );
    return res.data.data.items;
  },

  getLoginHistory: async (params?: {
    cursor?: string;
    limit?: number;
  }): Promise<LoginHistoryPageDto> => {
    const res = await apiClient.get<{ data: LoginHistoryPageDto }>(
      "/users/me/login-history",
      { params },
    );
    return res.data.data;
  },
};
