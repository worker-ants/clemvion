import { apiClient } from "./client";

export type AlertRuleType = "failure_rate" | "duration" | "llm_cost";
export type AlertChannel = "in_app" | "email";

export interface AlertRule {
  id: string;
  workspaceId: string;
  workflowId: string | null;
  type: AlertRuleType;
  threshold: string;
  window: string;
  channel: AlertChannel;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface CreateAlertRulePayload {
  type: AlertRuleType;
  threshold: number;
  window?: string;
  channel?: AlertChannel;
  workflowId?: string;
  enabled?: boolean;
}

export const alertsApi = {
  list: async (): Promise<AlertRule[]> => {
    const { data } = await apiClient.get("/alerts");
    return data.data ?? [];
  },
  create: async (payload: CreateAlertRulePayload): Promise<AlertRule> => {
    const { data } = await apiClient.post("/alerts", payload);
    return data.data;
  },
  update: async (
    id: string,
    payload: Partial<CreateAlertRulePayload>,
  ): Promise<AlertRule> => {
    const { data } = await apiClient.patch(`/alerts/${id}`, payload);
    return data.data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/alerts/${id}`);
  },
};
