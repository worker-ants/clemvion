import { apiClient, getAccessToken, refreshAccessToken } from "./client";
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
  /**
   * 이 row 가 서버의 stall 자동 복구로 인해 "새로 시작된" row 인지 여부.
   * 한 턴이 복구로 여러 row 로 쪼개진 경우 복구 이후의 row 들이 true.
   * 마이그레이션 이전에 쌓인 row 는 false 로 해석되어 호환성 유지.
   * rehydrate 시 true row 앞에 "🔄 자동으로 이어서 진행했어요" divider 렌더.
   */
  autoResumed?: boolean;
  /** `autoResumed=true` row 에서만 세팅. 현재 `'stall_pending_steps'` 한 종류. */
  autoResumeReason?: string | null;
  /** 같은 턴 내 복구 시도 순번 (1부터). autoResumed=false row 에서는 null. */
  autoResumeAttempt?: number | null;
  createdAt: string;
}

/**
 * ED-AI-40 (§4.3.2) — `add_node` / `update_node` 성공 tool_result 에 동봉되는
 * 단일 port descriptor. `AssistantToolCallRecord.result` 는 `unknown` 이라
 * 직접 강제할 수 없지만, 소비자 (tool-call-badge 의 recovery 매칭 등) 가
 * narrow cast 할 때 기준 타입으로 참조한다.
 */
export interface RuntimePortDescriptor {
  id: string;
  /** `'data'` (기본) / `'error'`. 내부 다른 타입은 서버가 'data' 로 정규화. */
  type?: "data" | "error";
  /** dynamic-ports 노드의 사용자 설정 label. 서버 sanitize 를 거쳐 실림. */
  label?: string;
}

/**
 * `add_node` / `update_node` 성공 응답의 `result.ports`. outputs/inputs 의
 * 각 항목은 `add_edge` 의 `source_port` / `target_port` 에 그대로 쓸 수 있는
 * id 를 포함. 운영 경로에서는 항상 present, legacy/test fixture 에서는
 * 생략될 수 있다. 상한에 걸려 잘린 경우 `result.portsTruncated: true` 동반.
 */
export interface RuntimePorts {
  outputs: RuntimePortDescriptor[];
  inputs: RuntimePortDescriptor[];
}

export interface AssistantToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  kind: "explore" | "plan" | "edit" | "finish";
  result?: unknown;
  /** 단일 step id (legacy 단축형). */
  planStepId?: string;
  /** 한 tool call 이 여러 plan step 을 cover 할 때 사용. */
  planStepIds?: string[];
}

/**
 * Spec ED-AI-39 (§4.3.1) — `add_node`/`update_node` 성공 응답에 딸려오는
 * "사용자 선택 필요" 필드 엔트리. 프런트는 해당 edit 메시지 버블에
 * candidate picker 를 렌더해 사용자 확인을 받은 뒤 editor-store 로 주입한다.
 */
export type UserActionWidget =
  | "integration-selector"
  | "llm-config-selector"
  | "kb-selector"
  | "workflow-selector";

export interface CandidateEntry {
  id: string;
  label: string;
  sublabel?: string;
}

export interface PendingUserConfigField {
  field: string;
  widget: UserActionWidget;
  label: string;
  /** 서버가 채운 워크스페이스 후보 목록. 빈 배열은 "조회했으나 없음". */
  candidates: CandidateEntry[];
  /** schema meta 의 hint. frontend 가 해석할 일은 거의 없으나 debug 용으로 유지. */
  integrationServiceType?: string;
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
    /**
     * React Flow 가 렌더 후 측정한 px 단위 크기. 초기 렌더 중이거나 새로
     * 추가된 노드는 아직 측정 전이라 undefined 일 수 있다. 서버 측 layout
     * guidance 는 이 값이 있으면 실제 폭 기준으로 배치하고, 없으면 250×80
     * 폴백을 사용한다.
     */
    width?: number;
    height?: number;
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
        /** 한 tool call 이 여러 plan step 을 cover 할 때 사용. */
        planStepIds?: string[];
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
  | {
      /**
       * 서버가 stall 자동 복구(spec §10) 로 다음 라운드를 시작함을 통지.
       * 프론트는 현재 스트리밍 중인 assistant 버블을 확정하고 새 버블을
       * push 해 이후 delta/tool_call 을 분리된 row 로 렌더한다.
       * 반복 confirmation 문구가 한 박스에 쌓이는 UX 문제를 구조적으로
       * 제거 (특히 gpt-oss-120b 임의 중단 quirk).
       */
      event: "auto_resume";
      data: {
        reason: "stall_pending_steps";
        /** 이번 턴 내 자동 복구 시도 순번 (1부터). */
        attempt: number;
        /** 허용되는 최대 시도 횟수 (백엔드 `MAX_STALL_ROUNDS`). */
        max: number;
      };
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
   *
   * `fetch` bypasses the axios response interceptor, so access-token refresh
   * on 401 is handled explicitly here: the initial request is retried once
   * after `refreshAccessToken()` succeeds. Without this, a long conversation
   * would surface an "already disconnected" state at the next user message
   * whenever the in-memory access token had expired since the previous turn.
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
    const url = `${baseUrl}/workflow-assistant/sessions/${sessionId}/messages`;
    const body = JSON.stringify(payload);

    const openStream = async (): Promise<Response> => {
      const token = getAccessToken();
      const workspaceId = getCurrentWorkspaceId();
      return fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
        },
        body,
        signal,
      });
    };

    let response = await openStream();

    // 401 → refresh once → retry. Subsequent 401 is treated as a hard
    // auth failure (user needs to sign in again).
    if (response.status === 401 && !signal?.aborted) {
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          response = await openStream();
        }
      } catch (error) {
        // Fall through — the throw below will surface the original status.
        console.warn("[assistant] access token refresh failed", error);
      }
    }

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
