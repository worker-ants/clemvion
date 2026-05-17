import { apiClient } from "./client";

export type IntegrationStatus = "connected" | "expired" | "error" | "pending_install";
export type IntegrationScope = "personal" | "organization";
// `expiring` and `attention` are virtual filter values — spec
// /2-navigation/4-integration.md §2.3, §9.1, Rationale "Attention 가상
// 필터값". The DB Integration.status enum holds only `connected`/`expired`/
// `error`/`pending_install`; the backend rewrites these two virtual values
// into union WHERE clauses.
export type ListStatusFilter =
  | "all"
  | "attention"
  | "connected"
  | "expiring"
  | "expired"
  | "error";

export type CredentialsStatus = "ok" | "needs_reauth";

export interface Cafe24PrivatePendingBase {
  mode: "cafe24_private_pending";
  integrationId: string;
  appUrl: string;
  callbackUrl: string;
}

export type OAuthBeginResult =
  | { authUrl: string; state: string }
  | Cafe24PrivatePendingBase;

export type RequestScopesResult =
  | { authUrl: string; state: string }
  | (Cafe24PrivatePendingBase & { scopesAdded: string[] });

export interface IntegrationMeta {
  appType: "public" | "private" | null;
}

export interface IntegrationDto {
  id: string;
  workspaceId: string;
  serviceType: string;
  name: string;
  authType: string;
  credentials: Record<string, unknown>;
  scope: IntegrationScope;
  status: IntegrationStatus;
  statusReason: string | null;
  credentialsStatus: CredentialsStatus;
  tokenExpiresAt: string | null;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
  lastError:
    | {
        code?: string;
        message?: string;
        at?: string;
        /**
         * Per-status_reason structured context. Backend may populate
         * `requiresCafe24Approval: string[]` when a Cafe24 scope failure
         * overlaps the partner-approval list. Other known keys are
         * provider-defined extensions — readers MUST runtime-check the
         * fields they consume (the index signature on this type only
         * promises "JSON-shaped" not "schema-validated").
         * SoT: `spec/conventions/cafe24-restricted-scopes.md` §4.3.
         */
        details?: {
          requiresCafe24Approval?: string[];
        } & Record<string, unknown>;
      }
    | Record<string, unknown>
    | null;
  meta: IntegrationMeta;
  /**
   * Cafe24 Private 통합 한정의 actionable URL. Cafe24 Developers Console
   * 의 "앱 URL" 갱신용으로 상세 페이지 App URL 카드가 노출.
   * `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 형식이며, 그 외
   * 통합은 항상 `null`. `installToken` 은 본 URL 의 path segment 안에만
   * 존재하며 별도 필드로 노출되지 않는다 — 식별자 분산 방지.
   * spec/2-navigation/4-integration.md §9.1 + Rationale "Cafe24 App URL
   * 상세 페이지 표시".
   */
  appUrl: string | null;
  /**
   * 자동 갱신 가능 통합 식별자 (derived 가상 필드 — 백엔드
   * `ServiceDefinition.supportsTokenAutoRefresh` 에서 매 응답 시점에 계산.
   * DB 컬럼 아님). 현재 cafe24·google 만 true, github 포함 그 외는 false.
   * UI 의 attention/expiring 술어 제외, 상세 페이지 헤더의 "Auto-renews"
   * 보조 라벨, Reauthorize hover 안내의 분기 신호.
   * spec/2-navigation/4-integration.md §9.1 + Rationale "자동 갱신 통합을
   * attention 술어에서 제외 (2026-05-17)".
   */
  autoRefresh: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialField {
  key: string;
  label: string;
  type: "string" | "number" | "enum" | "record";
  required: boolean;
  secret?: boolean;
  enum?: string[];
  default?: string | number;
  placeholder?: string;
  description?: string;
}

export interface AuthVariant {
  authType: string;
  label: string;
  fields: CredentialField[];
}

export interface ScopeOption {
  value: string;
  label: string;
  recommended?: boolean;
  /**
   * Cafe24 partner-approval marker — true when this scope requires explicit
   * approval from Cafe24 before consent succeeds. Frontend renders a ⚠
   * badge + tooltip. SoT: `spec/conventions/cafe24-restricted-scopes.md` §1.
   */
  requiresApproval?: boolean;
}

export interface ServiceDefinition {
  type: string;
  name: string;
  oauthProvider: "google" | "github" | null;
  authTypes: string[];
  authVariants: AuthVariant[];
  scopes: ScopeOption[];
  /**
   * Service-specific availability hints derived server-side from env / runtime
   * config. Currently populated only for cafe24 — `publicAppAvailable` reflects
   * whether the deployment has `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` set
   * (i.e. whether the app-store public-app OAuth flow is usable). Private apps
   * are always available because the user supplies their own client_id/secret.
   */
  meta?: { publicAppAvailable?: boolean };
}

export interface UsageWorkflow {
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  nodes: { id: string; label: string; type: string }[];
}

export interface ActivityItem {
  id: string;
  integrationId: string;
  nodeExecutionId: string;
  workflowId: string;
  status: "success" | "failed";
  error: Record<string, unknown> | null;
  durationMs: number;
  at: string;
}

export interface ActivityResponse {
  items: ActivityItem[];
  summary: {
    totalCalls: number;
    successRate: number;
    dailyCounts: { date: string; count: number; failed: number }[];
  };
}

export interface ListParams {
  page?: number;
  limit?: number;
  q?: string;
  scope?: "personal" | "organization" | "all";
  serviceType?: string[];
  status?: ListStatusFilter;
}

function unwrap<T>(raw: { data?: T } | T): T {
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const d = (raw as { data?: T }).data;
    if (d !== undefined) return d;
  }
  return raw as T;
}

export const integrationsApi = {
  async list(params: ListParams = {}) {
    const { data } = await apiClient.get("/integrations", { params });
    // Paginated response: { data: IntegrationDto[], pagination }
    return data as {
      data: IntegrationDto[];
      pagination: { page: number; limit: number; totalItems: number; totalPages: number };
    };
  },

  async services(): Promise<ServiceDefinition[]> {
    const { data } = await apiClient.get("/integrations/services");
    return unwrap<ServiceDefinition[]>(data);
  },

  async get(id: string): Promise<IntegrationDto> {
    const { data } = await apiClient.get(`/integrations/${id}`);
    return unwrap<IntegrationDto>(data);
  },

  async usages(id: string): Promise<UsageWorkflow[]> {
    const { data } = await apiClient.get(`/integrations/${id}/usages`);
    return unwrap<UsageWorkflow[]>(data);
  },

  async activity(id: string, params: { limit?: number; days?: number } = {}) {
    const { data } = await apiClient.get(`/integrations/${id}/activity`, {
      params,
    });
    return unwrap<ActivityResponse>(data);
  },

  async create(body: {
    serviceType: string;
    name: string;
    authType: string;
    credentials?: Record<string, unknown>;
    scope?: IntegrationScope;
    previewToken?: string;
  }): Promise<IntegrationDto> {
    const { data } = await apiClient.post("/integrations", body);
    return unwrap<IntegrationDto>(data);
  },

  async previewTest(body: {
    serviceType: string;
    authType: string;
    credentials: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post("/integrations/preview-test", body);
    return unwrap<{ success: boolean; message: string }>(data);
  },

  async oauthBegin(body: {
    service: string;
    scopes: string[];
    mode: "new" | "reauthorize" | "request_scopes";
    integrationId?: string;
    integrationName?: string;
    scope?: IntegrationScope;
    // Cafe24-only fields — backend ignores them for other services.
    // mall_id is part of the base URL, so it must be supplied before the
    // authorize popup opens. Public apps read client_id/secret from server
    // env; private apps pass them in here for the state-row TTL.
    mallId?: string;
    appType?: "public" | "private";
    clientId?: string;
    clientSecret?: string;
  }): Promise<OAuthBeginResult> {
    const { data } = await apiClient.post("/integrations/oauth/begin", body);
    return unwrap<OAuthBeginResult>(data);
  },

  async update(
    id: string,
    body: { name?: string },
  ): Promise<IntegrationDto> {
    const { data } = await apiClient.patch(`/integrations/${id}`, body);
    return unwrap<IntegrationDto>(data);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/integrations/${id}`);
  },

  async test(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post(`/integrations/${id}/test`);
    return unwrap<{ success: boolean; message: string }>(data);
  },

  async rotate(
    id: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationDto> {
    const { data } = await apiClient.post(`/integrations/${id}/rotate`, {
      credentials,
    });
    return unwrap<IntegrationDto>(data);
  },

  async reauthorize(id: string): Promise<OAuthBeginResult> {
    const { data } = await apiClient.post(`/integrations/${id}/reauthorize`);
    return unwrap<OAuthBeginResult>(data);
  },

  async requestScopes(
    id: string,
    scopes: string[],
  ): Promise<RequestScopesResult> {
    const { data } = await apiClient.post(
      `/integrations/${id}/request-scopes`,
      { scopes },
    );
    return unwrap<RequestScopesResult>(data);
  },

  async updateScope(
    id: string,
    scope: IntegrationScope,
  ): Promise<IntegrationDto> {
    const { data } = await apiClient.patch(`/integrations/${id}/scope`, {
      scope,
    });
    return unwrap<IntegrationDto>(data);
  },

  /**
   * Cafe24 mall_id 사전 중복 감지.
   *
   * `/integrations/new` 의 cafe24 step 에서 mall_id 입력 시점에 debounce 로
   * 호출. 같은 워크스페이스에 같은 mall_id 의 cafe24 통합이 이미 존재하면
   * inline 경고 배너를 띄워 OAuth 진입 자체를 사전 차단한다.
   *
   * 응답에는 자격 증명·토큰·timestamps 가 포함되지 않으며, 가장 제한적인
   * 상태 (`connected > pending_install > error > expired`) 만 반환된다.
   *
   * `signal` 인자로 AbortController.signal 을 받으면 호출자가 unmount /
   * 사용자 입력 변경 시 in-flight 요청을 cancel 할 수 있다 (backend 호출
   * 자체를 차단해 부하·throttle 카운터 절약). spec/2-navigation/4-integration.md §9.2.
   */
  async cafe24Precheck(
    mallId: string,
    signal?: AbortSignal,
  ): Promise<Cafe24PrecheckResult> {
    const { data } = await apiClient.get("/integrations/cafe24/precheck", {
      params: { mallId },
      signal,
    });
    return unwrap<Cafe24PrecheckResult>(data);
  },
};

export interface Cafe24PrecheckResult {
  conflict: boolean;
  existingIntegrationId?: string;
  existingName?: string;
  status?: "connected" | "pending_install" | "expired" | "error";
}
