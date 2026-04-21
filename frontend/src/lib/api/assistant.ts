import { apiClient, getAccessToken } from "./client";
import { getCurrentWorkspaceId } from "@/lib/stores/workspace-store";

export interface AssistantSessionData {
  id: string;
  workflowId: string;
  workspaceId: string;
  userId: string;
  title: string | null;
  llmConfigId: string | null;
  status: "active" | "archived";
  messageCount: number;
  lastInteractionAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessageData {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  toolCalls: AssistantToolCallRecord[] | null;
  toolCallId: string | null;
  plan: AssistantPlanRecord | null;
  usage: AssistantUsageRecord | null;
  finishReason: string | null;
  createdAt: string;
}

export interface AssistantToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  kind: "explore" | "plan" | "edit";
  result?: unknown;
  planStepId?: string;
}

export interface AssistantPlanStep {
  id: string;
  action:
    | "add_node"
    | "update_node"
    | "remove_node"
    | "add_edge"
    | "remove_edge"
    | "note";
  description: string;
  rationale?: string;
}

export interface AssistantPlanRecord {
  title: string;
  summary: string;
  steps: AssistantPlanStep[];
  openQuestions?: string[];
  approvedAt?: string;
}

export interface AssistantUsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  model: string;
}

export interface AssistantWorkflowSnapshot {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    category: string;
    positionX: number;
    positionY: number;
    config?: Record<string, unknown>;
    containerId?: string | null;
    toolOwnerId?: string | null;
  }>;
  edges: Array<{
    id?: string;
    sourceNodeId: string;
    sourcePort?: string;
    targetNodeId: string;
    targetPort?: string;
    type?: "data" | "error";
  }>;
}

export type AssistantSseEvent =
  | { event: "text"; data: { delta: string } }
  | {
      event: "tool_call";
      data: {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
        result: unknown;
        kind: "explore" | "edit";
        planStepId?: string;
      };
    }
  | {
      event: "plan";
      data: {
        id: string;
        planId: string;
        title: string;
        summary: string;
        steps: AssistantPlanStep[];
        openQuestions?: string[];
      };
    }
  | {
      event: "usage";
      data: AssistantUsageRecord;
    }
  | { event: "done"; data: { finishReason: string } }
  | { event: "error"; data: { code: string; message: string } };

export const assistantApi = {
  async listSessions(workflowId: string): Promise<AssistantSessionData[]> {
    const { data } = await apiClient.get<{ data: AssistantSessionData[] }>(
      "/workflow-assistant/sessions",
      { params: { workflowId } },
    );
    return data.data ?? [];
  },

  async getLatestSession(
    workflowId: string,
  ): Promise<AssistantSessionData | null> {
    const { data } = await apiClient.get<{ data: AssistantSessionData | null }>(
      "/workflow-assistant/sessions/latest",
      { params: { workflowId } },
    );
    return data.data ?? null;
  },

  async getSessionDetail(id: string): Promise<{
    session: AssistantSessionData;
    messages: AssistantMessageData[];
  }> {
    const { data } = await apiClient.get<{
      data: {
        session: AssistantSessionData;
        messages: AssistantMessageData[];
      };
    }>(`/workflow-assistant/sessions/${id}`);
    return data.data;
  },

  async createSession(payload: {
    workflowId: string;
    llmConfigId?: string;
    title?: string;
  }): Promise<AssistantSessionData> {
    const { data } = await apiClient.post<{ data: AssistantSessionData }>(
      "/workflow-assistant/sessions",
      payload,
    );
    return data.data;
  },

  async updateSession(
    id: string,
    payload: { title?: string; llmConfigId?: string; status?: "active" | "archived" },
  ): Promise<AssistantSessionData> {
    const { data } = await apiClient.patch<{ data: AssistantSessionData }>(
      `/workflow-assistant/sessions/${id}`,
      payload,
    );
    return data.data;
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/workflow-assistant/sessions/${id}`);
  },

  /**
   * Open an SSE stream for a user message. Uses `fetch` + ReadableStream
   * because EventSource can only GET — we need POST with a JSON body.
   * `onEvent` is invoked for each parsed event; the returned promise resolves
   * when the stream closes (done or error).
   */
  async streamMessage(
    sessionId: string,
    payload: {
      content: string;
      currentWorkflow: AssistantWorkflowSnapshot;
      llmConfigId?: string;
    },
    onEvent: (event: AssistantSseEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const token = getAccessToken();
    const workspaceId = getCurrentWorkspaceId();

    const response = await fetch(
      `${baseUrl}/workflow-assistant/sessions/${sessionId}/messages`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      },
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `Assistant stream failed: ${response.status} ${response.statusText}`,
      );
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        // SSE records are separated by a blank line (\n\n).
        let splitAt: number;
        while ((splitAt = buffer.indexOf("\n\n")) !== -1) {
          const record = buffer.slice(0, splitAt);
          buffer = buffer.slice(splitAt + 2);
          const parsed = parseSseRecord(record);
          if (parsed) onEvent(parsed);
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

function parseSseRecord(record: string): AssistantSseEvent | null {
  const lines = record.split("\n").map((l) => l.trimEnd());
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      // SSE spec: multiple `data:` lines within a single record must be
      // rejoined with \n, not concatenated without a separator. Our payloads
      // are single-line JSON today, but the correct join preserves that
      // should any event ever include a newline inside `data`.
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (!event) return null;
  try {
    const parsed = JSON.parse(dataLines.join("\n") || "{}");
    return { event, data: parsed } as AssistantSseEvent;
  } catch {
    return null;
  }
}
