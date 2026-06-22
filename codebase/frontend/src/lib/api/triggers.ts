import { apiClient } from "./client";
import { normalizePagedResponse, type PagedResult } from "./paginated";

/**
 * 트리거 도메인 typed API 카탈로그 (refactor M-8 / m-2).
 *
 * `spec/2-navigation/2-trigger-list.md §3` API 표를 함수 카탈로그 SoT 로 옮겨,
 * `triggers/page.tsx` · `trigger-detail-drawer.tsx` 의 `apiClient` 직접 호출을
 * 한 곳으로 모은다. 단일 PATCH 경로(R-4)·rotate/revoke 전용 엔드포인트(R-CC-10
 * 등)의 호출 형태를 그대로 보존한다. (`lib/api/executions.ts` 관례 답습.)
 */

/** Spec Chat Channel §4.1 + §5.4.2 — config.chatChannel (응답 sanitize 후 형태). */
export interface ChatChannelConfigView {
  provider?: string;
  /** Spec §5.4.2 — derived 필드 (`botTokenRef IS NOT NULL → true`). */
  hasBotToken?: boolean;
  botIdentity?: { botId?: number; username?: string };
  uiMapping?: {
    formMode?: "multi_step" | "native_modal" | "auto";
    /** Spec R-CC-11 — text/photo/auto, default auto. legacy text_only 는 backend normalize. */
    visualNode?: "text" | "photo" | "auto";
    buttonLayout?: "auto" | "vertical" | "horizontal";
  };
  rateLimitPerMinute?: number;
  languageHints?: Record<string, string>;
  /** Spec §4.1 — languageHints 미설정 키의 default 문구 언어 (default ko). */
  languageLocale?: "ko" | "en";
}

/** Spec §2.3.1 — 트리거 상세(drawer) 엔티티. `GET /triggers/:id` 응답 정규화 후 형태. */
export interface TriggerDetail {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  /** Webhook 인증 — 연결된 AuthConfig (없으면 인증 없음). 인증 자료는 Authentication 메뉴에서 관리. */
  authConfigId?: string | null;
  config?: {
    /** Spec EIA §4 — notification webhook 설정 (외부 인터랙션 채널 메타). */
    notification?: {
      url?: string;
      events?: string[];
      signing?: { algorithm?: string };
      retry?: { maxAttempts?: number };
    };
    /** Spec EIA §4 — inbound interaction (REST + SSE) 설정. */
    interaction?: {
      enabled?: boolean;
      tokenStrategy?: "per_execution" | "per_trigger";
    };
    /** Spec Chat Channel §4.1 — chatChannel adapter 설정 (sanitize 후). */
    chatChannel?: ChatChannelConfigView;
    [key: string]: unknown;
  };
  /** Spec EIA §7.1 — outbound notification 발송 건강도. */
  notificationHealth?: "unknown" | "healthy" | "degraded";
  /** Spec Chat Channel §3.4 CCH-SE-01 — chat channel 외부 호출 건강도. */
  chatChannelHealth?: "unknown" | "healthy" | "degraded";
  chatChannelLastError?: string | null;
  chatChannelSetupAt?: string | null;
  chatChannelRotatedAt?: string | null;
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: string;
}

/** 목록 행(raw) — `GET /triggers` 페이지 응답 항목. 표시용 매핑 전 backend shape. */
export interface TriggerListItem {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId?: string;
  workflow?: { id?: string; name?: string };
  endpointPath?: string;
  lastTriggeredAt?: string;
  cronExpression?: string;
  nextRunAt?: string;
  authConfigId?: string | null;
  config?: { chatChannel?: { provider?: string } };
  chatChannelHealth?: "unknown" | "healthy" | "degraded";
}

export interface TriggerListParams {
  page: number;
  limit: number;
  type?: string;
  status?: string;
}

/** Spec §2.5 — webhook 트리거 생성 바디 (chatChannel 은 top-level — setupChannel 진입 조건). */
export interface CreateTriggerBody {
  workflowId: string;
  type: "webhook";
  name: string;
  endpointPath: string;
  authConfigId?: string;
  /** provider/botToken/uiMapping/(inboundSigningPlaintext) — backend CreateTriggerDto 형태. */
  chatChannel?: Record<string, unknown>;
}

/**
 * Spec §3 / R-4 — 단일 PATCH 경로의 부분 바디. 모든 카드 편집(name/isActive/
 * endpointPath/authConfigId/notification/interaction/chatChannel)이 이 한 엔드포인트로
 * 모인다. nested 객체는 backend 로 그대로 전달되므로 호출부가 만든 형태를 보존한다.
 *
 * 금지 키(`chatChannel.botTokenRef`·`inboundSigningPlaintext`)는 backend 가 400 으로
 * 거부 — bot token 변경은 `rotateBotToken`, notification secret 은 별도 rotate 전용.
 */
export interface TriggerUpdateBody {
  name?: string;
  isActive?: boolean;
  endpointPath?: string;
  authConfigId?: string | null;
  notification?: Record<string, unknown>;
  interaction?: Record<string, unknown>;
  chatChannel?: Record<string, unknown>;
}

export const triggersApi = {
  /** `GET /triggers` — 필터·페이지네이션. 페이지 응답을 표준 `PagedResult` 로 정규화. */
  list: async (
    params: TriggerListParams,
  ): Promise<PagedResult<TriggerListItem>> => {
    const res = await apiClient.get("/triggers", { params });
    return normalizePagedResponse<TriggerListItem>(res.data, params.page);
  },

  /** `GET /triggers/:id` — 상세. workflow 중첩 필드를 평탄화(backend shape 편차 흡수). */
  getById: async (id: string): Promise<TriggerDetail> => {
    const res = await apiClient.get(`/triggers/${id}`);
    const body = res.data as { data?: unknown };
    const raw = (body?.data ?? body) as TriggerDetail & {
      workflow?: { id?: string; name?: string };
    };
    return {
      ...raw,
      workflowName: raw.workflow?.name ?? raw.workflowName ?? "",
      workflowId: raw.workflowId ?? raw.workflow?.id ?? "",
    };
  },

  /** `POST /triggers` — webhook 트리거 생성 (Spec §2.5). */
  create: async (body: CreateTriggerBody): Promise<void> => {
    await apiClient.post("/triggers", body);
  },

  /** `PATCH /triggers/:id` — 단일 편집 경로(R-4). 부분 바디 전달. */
  update: async (id: string, body: TriggerUpdateBody): Promise<void> => {
    await apiClient.patch(`/triggers/${id}`, body);
  },

  /** `POST /triggers/:id/notification/rotate-secret` — outbound HMAC secret 회전 (Spec EIA §7.1). */
  rotateNotificationSecret: async (
    id: string,
  ): Promise<{ secret: string; rotatedAt: string }> => {
    const res = await apiClient.post<{
      data: { secret: string; rotatedAt: string };
    }>(`/triggers/${id}/notification/rotate-secret`, {});
    return res.data.data;
  },

  /** `POST /triggers/:id/interaction/revoke-token` — inbound interaction 토큰 폐기 (Spec EIA §7.3). */
  revokeInteractionToken: async (id: string): Promise<{ token: string }> => {
    const res = await apiClient.post<{ data: { token: string } }>(
      `/triggers/${id}/interaction/revoke-token`,
      {},
    );
    return res.data.data;
  },

  /** `POST /triggers/:id/chat-channel/rotate-bot-token` — bot token 회전 단일 경로(R-CC-10, 24h grace). */
  rotateBotToken: async (id: string, newBotToken: string): Promise<void> => {
    await apiClient.post(`/triggers/${id}/chat-channel/rotate-bot-token`, {
      newBotToken,
    });
  },
};
