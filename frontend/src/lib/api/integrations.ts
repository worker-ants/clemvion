import { apiClient } from "./client";

export type IntegrationStatus = "connected" | "expired" | "error" | "pending_install";
export type IntegrationScope = "personal" | "organization";
export type ListStatusFilter =
  | "all"
  | "connected"
  | "expiring"
  | "expired"
  | "error";

export type CredentialsStatus = "ok" | "needs_reauth";

export type OAuthBeginResult =
  | { authUrl: string; state: string }
  | { mode: "cafe24_private_pending"; integrationId: string; appUrl: string; callbackUrl: string };

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
  lastError: { code?: string; message?: string; at?: string } | Record<string, unknown> | null;
  meta: IntegrationMeta;
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
  ): Promise<OAuthBeginResult> {
    const { data } = await apiClient.post(
      `/integrations/${id}/request-scopes`,
      { scopes },
    );
    return unwrap<OAuthBeginResult>(data);
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
};
