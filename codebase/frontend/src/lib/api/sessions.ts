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
 *
 * 세션 관리 API 는 `/auth/sessions` 아래에 있다. refresh 쿠키의 Path 가 `/api/auth` 라서
 * 브라우저는 그 아래 경로에만 쿠키를 보내고, 서버는 그 쿠키로 현재 세션을 가려낸다.
 * 로그인 이력은 쿠키가 필요 없어 `/users/me/login-history` 에 그대로 둔다
 * (NERV CLE-ACCT-SESSION, CLE-T-ERAJ7P).
 */
export const sessionsApi = {
  listSessions: async (): Promise<SessionDto[]> => {
    const res = await apiClient.get<{ data: SessionListDto }>(
      "/auth/sessions",
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
      `/auth/sessions/${encodeURIComponent(familyId)}/revoke`,
      payload,
    );
    return res.data.data.items;
  },

  revokeOtherSessions: async (
    payload: RevokeSessionPayload,
  ): Promise<SessionDto[]> => {
    const res = await apiClient.post<{ data: SessionListDto }>(
      "/auth/sessions/revoke-others",
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
