"use client";

import { create } from "zustand";
import { toast } from "sonner";
import {
  assistantApi,
  type AssistantMessageData,
  type AssistantPlanStep,
  type AssistantSessionData,
  type AssistantSseEvent,
  type AssistantToolCallRecord,
  type AssistantWorkflowSnapshot,
} from "@/lib/api/assistant";
import { translate } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { dispatchAssistantEditorOperation } from "@/lib/stores/assistant-editor-bridge";

export interface AssistantPlanCard {
  messageId: string;
  planId: string;
  title: string;
  summary: string;
  steps: Array<
    AssistantPlanStep & { status: "pending" | "done" | "failed" }
  >;
  openQuestions?: string[];
  approved: boolean;
}

export interface AssistantDisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolCalls: AssistantToolCallRecord[];
  plan: AssistantPlanCard | null;
  streaming: boolean;
  createdAt: string;
  /**
   * 해당 턴에서 서버가 발행한 error 이벤트. toast 가 아니라 메시지 bubble
   * 아래 빨간 박스로 렌더해 채팅 맥락에서 "왜 중단됐는지" 가 보이도록 한다.
   */
  error?: { code: string; message: string };
  /**
   * 서버·프론트가 자동 주입하는 안내 문구. `kind` 는 렌더 박스 색을
   * 결정한다. 대표 사례:
   *  - `info`    : "이어서 진행해줘" (stalled plan)
   *  - `success` : "작업을 완료했어요 — N개 단계 실행 성공"
   */
  systemHint?: { kind: "info" | "success"; text: string };
  /**
   * 이 row 가 서버의 stall 자동 복구로 인해 새로 시작된 row 인 경우의
   * 메타. 렌더 시 버블 위에 "🔄 자동으로 이어서 진행했어요 (attempt/max)"
   * divider 를 그리는 트리거. 서버 `auto_resume` SSE 이벤트로 실시간
   * 주입되거나, rehydrate 시 persist 된 `autoResumed=true` row 에 맞춰
   * 복원된다.
   */
  autoResume?: {
    reason: "stall_pending_steps";
    attempt: number;
    max: number;
  };
}

/**
 * `MAX_STALL_ROUNDS` 와 동일한 값. rehydrate 시 서버가 persist 한
 * `autoResumeAttempt` 만 가지고 divider 의 "N/M" 포맷을 만들 수 있도록
 * 프론트 상수로 복제. 백엔드에서 변경되면 같이 업데이트.
 */
const STALL_MAX_ATTEMPTS = 2;

interface AssistantState {
  isOpen: boolean;
  currentWorkflowId: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  llmConfigId: string | null;
  sessions: AssistantSessionData[];
  messages: AssistantDisplayMessage[];
  isLoadingSession: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;
  abortController: AbortController | null;

  toggle: () => void;
  open: () => void;
  close: () => void;

  setWorkflow: (workflowId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  newSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setLlmConfigId: (id: string | null) => void;

  sendMessage: (
    content: string,
    snapshot: AssistantWorkflowSnapshot,
  ) => Promise<void>;
  approveActivePlan: (snapshot: AssistantWorkflowSnapshot) => Promise<void>;
  /**
   * `ASSISTANT_TOO_MANY_TOOL_CALLS` 같은 "추가 turn 한 번으로 이어갈 수 있는"
   * 에러에서 사용자가 버튼 한 번으로 resume 하게 하는 진입점. "이어서 진행해줘"
   * 메시지를 새 user turn 으로 전송하며, 서버의 active-plan-context 가 남은
   * step 을 이어 실행한다.
   */
  continueAfterBudget: (snapshot: AssistantWorkflowSnapshot) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * Convert a persisted message from the server into the in-memory shape the
 * panel renders. Plan cards are reconstructed from the `plan` JSON snapshot,
 * and step statuses are re-derived from tool_calls that reference the plan
 * step ids.
 */
function hydrateMessage(msg: AssistantMessageData): AssistantDisplayMessage {
  const toolCalls = msg.toolCalls ?? [];
  let plan: AssistantPlanCard | null = null;
  if (msg.plan) {
    const doneSteps = new Set<string>();
    // For historical turns we cannot know which edits succeeded later, so we
    // optimistically mark a step 'done' if any tool call references it.
    // Both planStepId (legacy single) and planStepIds (array) are aggregated.
    for (const tc of toolCalls) {
      if (tc.planStepId) doneSteps.add(tc.planStepId);
      if (tc.planStepIds) {
        for (const id of tc.planStepIds) doneSteps.add(id);
      }
    }
    plan = {
      messageId: msg.id,
      planId: msg.id,
      title: msg.plan.title,
      summary: msg.plan.summary,
      steps: msg.plan.steps.map((s) => ({
        ...s,
        status: doneSteps.has(s.id) ? "done" : "pending",
      })),
      openQuestions: msg.plan.openQuestions,
      approved: !!msg.plan.approvedAt,
    };
  }
  // 서버가 persist 한 autoResumed 메타를 divider 렌더용 autoResume 로 복원.
  // 마이그레이션 이전 row 는 autoResumed 가 undefined/false 라 divider 없이
  // 그대로 렌더된다 (호환성).
  const autoResume =
    msg.autoResumed && msg.autoResumeReason
      ? {
          reason: msg.autoResumeReason as "stall_pending_steps",
          attempt: msg.autoResumeAttempt ?? 1,
          max: STALL_MAX_ATTEMPTS,
        }
      : undefined;
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content ?? "",
    toolCalls,
    plan,
    streaming: false,
    createdAt: msg.createdAt,
    ...(autoResume ? { autoResume } : {}),
  };
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  isOpen: false,
  currentWorkflowId: null,
  sessionId: null,
  sessionTitle: null,
  llmConfigId: null,
  sessions: [],
  messages: [],
  isLoadingSession: false,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  abortController: null,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setWorkflow: async (workflowId: string) => {
    const state = get();
    if (state.currentWorkflowId === workflowId) return;
    set({
      currentWorkflowId: workflowId,
      sessionId: null,
      sessionTitle: null,
      messages: [],
      error: null,
    });
    try {
      const latest = await assistantApi.getLatestSession(workflowId);
      if (latest) {
        await get().loadSession(latest.id);
      }
      const list = await assistantApi.listSessions(workflowId);
      set({ sessions: list });
    } catch (error) {
      console.error("Failed to load assistant session", error);
    }
  },

  refreshSessions: async () => {
    const { currentWorkflowId } = get();
    if (!currentWorkflowId) return;
    const list = await assistantApi.listSessions(currentWorkflowId);
    set({ sessions: list });
  },

  loadSession: async (sessionId: string) => {
    set({ isLoadingSession: true, error: null });
    try {
      const { session, messages } = await assistantApi.getSessionDetail(
        sessionId,
      );
      set({
        sessionId: session.id,
        sessionTitle: session.title,
        llmConfigId: session.llmConfigId,
        messages: messages.map(hydrateMessage),
        isLoadingSession: false,
      });
    } catch (error) {
      console.error("Failed to load assistant session detail", error);
      set({ isLoadingSession: false, error: "SESSION_LOAD_FAILED" });
    }
  },

  newSession: async () => {
    const { currentWorkflowId, llmConfigId } = get();
    if (!currentWorkflowId) return;
    try {
      const session = await assistantApi.createSession({
        workflowId: currentWorkflowId,
        llmConfigId: llmConfigId ?? undefined,
      });
      set({
        sessionId: session.id,
        sessionTitle: session.title,
        messages: [],
        error: null,
      });
      await get().refreshSessions();
    } catch (error) {
      console.error("Failed to create assistant session", error);
      toast.error("Failed to start a new assistant session.");
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await assistantApi.deleteSession(sessionId);
      const state = get();
      if (state.sessionId === sessionId) {
        set({ sessionId: null, messages: [], sessionTitle: null });
      }
      await get().refreshSessions();
    } catch (error) {
      console.error("Failed to delete assistant session", error);
    }
  },

  setLlmConfigId: (id) => set({ llmConfigId: id }),

  sendMessage: async (content, snapshot) => {
    const state = get();
    if (state.isStreaming) return;
    // Pre-empt the streaming flag synchronously so a rapid second call from
    // the same render cycle (double-click, race between panel + keyboard)
    // can't slip past the guard and create a duplicate session or stream.
    set({ isStreaming: true, error: null });

    let sessionId = state.sessionId;
    if (!sessionId) {
      if (!state.currentWorkflowId) {
        set({ isStreaming: false });
        return;
      }
      try {
        const session = await assistantApi.createSession({
          workflowId: state.currentWorkflowId,
          llmConfigId: state.llmConfigId ?? undefined,
        });
        sessionId = session.id;
        set({
          sessionId: session.id,
          sessionTitle: session.title,
        });
      } catch (error) {
        console.error("Failed to create assistant session", error);
        set({ isStreaming: false, error: "ASSISTANT_NO_SESSION" });
        return;
      }
    }

    // Optimistically append user + placeholder assistant messages
    const userMessage: AssistantDisplayMessage = {
      id: `local-${crypto.randomUUID().slice(0, 8)}`,
      role: "user",
      content,
      toolCalls: [],
      plan: null,
      streaming: false,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `local-${crypto.randomUUID().slice(0, 8)}`;
    const assistantMessage: AssistantDisplayMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      toolCalls: [],
      plan: null,
      streaming: true,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      messages: [...s.messages, userMessage, assistantMessage],
      streamingMessageId: assistantId,
    }));

    const abort = new AbortController();
    set({ abortController: abort });

    try {
      // stall 자동 복구(§10)로 서버가 `auto_resume` 이벤트를 발행할 때마다
      // 이 `currentAssistantId` 가 새 row id 로 교체된다. 이후 delta/tool_call
      // 은 새 row 로 누적되어 한 턴이 여러 버블로 분리 렌더된다. 반복 문구가
      // 한 버블에 몰리는 UX 문제의 구조적 해소 지점.
      let currentAssistantId = assistantId;
      await assistantApi.streamMessage(
        sessionId,
        {
          content,
          currentWorkflow: snapshot,
          llmConfigId: state.llmConfigId ?? undefined,
        },
        (event) => {
          if (event.event === "auto_resume") {
            currentAssistantId = applyAutoResumeEvent(
              set,
              currentAssistantId,
              event,
            );
            return;
          }
          handleSseEvent(set, get, currentAssistantId, event);
        },
        abort.signal,
      );
    } catch (error) {
      if (abort.signal.aborted) {
        set({ isStreaming: false, streamingMessageId: null, abortController: null });
        return;
      }
      console.error("Assistant stream failed", error);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
        isStreaming: false,
        streamingMessageId: null,
        abortController: null,
        error: "ASSISTANT_STREAM_FAILED",
      }));
      toast.error("Assistant response failed. Please retry.");
    }

    set({
      isStreaming: false,
      streamingMessageId: null,
      abortController: null,
    });
    await get().refreshSessions();
    // Finalize streaming flag on any assistant message left streaming. 정상
    // 흐름에서는 done 이벤트 / applyAutoResumeEvent 가 이미 처리했지만, 에러
    // 경로에서 auto_resume 으로 새로 push 된 row 가 남아있을 수 있어 안전
    // 장치로 일괄 스캔. (원래 `assistantId` 한 건만 찍던 경로를 확장)
    set((s) => ({
      messages: s.messages.map((m) =>
        m.streaming ? { ...m, streaming: false } : m,
      ),
    }));
  },

  approveActivePlan: async (snapshot) => {
    const state = get();
    const latest = [...state.messages]
      .reverse()
      .find((m) => m.plan && !m.plan.approved);
    if (!latest?.plan) return;
    const targetId = latest.id;
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === targetId && m.plan
          ? { ...m, plan: { ...m.plan, approved: true } }
          : m,
      ),
    }));
    const locale = useLocaleStore.getState().locale;
    await get().sendMessage(
      translate(locale, "assistant.planApproveConfirm"),
      snapshot,
    );
  },

  continueAfterBudget: async (snapshot) => {
    // `ASSISTANT_TOO_MANY_TOOL_CALLS` 복구 버튼의 한 줄 구현 — approveActivePlan
    // 과 동일 패턴. 서버는 history 의 active plan 을 읽어 남은 step 을 이어간다.
    const locale = useLocaleStore.getState().locale;
    await get().sendMessage(
      translate(locale, "assistant.continueAfterBudget"),
      snapshot,
    );
  },

  stop: () => {
    const { abortController } = get();
    abortController?.abort();
    set({
      isStreaming: false,
      streamingMessageId: null,
      abortController: null,
    });
  },

  reset: () =>
    set({
      currentWorkflowId: null,
      sessionId: null,
      sessionTitle: null,
      messages: [],
      sessions: [],
      isStreaming: false,
      streamingMessageId: null,
      error: null,
      abortController: null,
    }),
}));

/**
 * 서버의 `auto_resume` SSE 이벤트를 받아 **현재 스트리밍 중인 assistant
 * 버블을 확정**하고 **새 버블**을 push 한다. 새 버블에는 `autoResume`
 * 메타가 실려 렌더 시 divider("🔄 자동으로 이어서 진행했어요") 를 그리는
 * 트리거가 된다. `streamingMessageId` 도 새 id 로 갱신되어 이후 이벤트가
 * 새 버블로 흘러가도록 한다.
 *
 * 반환값은 새로 만든 row id — caller(`sendMessage`) 가 `currentAssistantId`
 * 를 업데이트할 때 사용한다. 테스트 편의를 위해 별도 export.
 */
export function applyAutoResumeEvent(
  set: (updater: (s: AssistantState) => Partial<AssistantState>) => void,
  currentAssistantId: string,
  event: Extract<AssistantSseEvent, { event: "auto_resume" }>,
): string {
  const nextId = `local-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  set((s) => ({
    messages: [
      ...s.messages.map((m) =>
        m.id === currentAssistantId ? { ...m, streaming: false } : m,
      ),
      {
        id: nextId,
        role: "assistant" as const,
        content: "",
        toolCalls: [],
        plan: null,
        streaming: true,
        createdAt: now,
        autoResume: {
          reason: event.data.reason,
          attempt: event.data.attempt,
          max: event.data.max,
        },
      },
    ],
    streamingMessageId: nextId,
  }));
  return nextId;
}

/**
 * Handle a single SSE event during an in-flight assistant turn.
 * Also calls into `applyAssistantOperation` on the editor store when an
 * edit tool succeeds.
 *
 * Exported for unit testing — production callers go through `sendMessage`.
 */
export function handleSseEvent(
  set: (updater: (s: AssistantState) => Partial<AssistantState>) => void,
  get: () => AssistantState,
  assistantId: string,
  event: AssistantSseEvent,
): void {
  const state = get();
  const msg = state.messages.find((m) => m.id === assistantId);
  if (!msg) return;

  if (event.event === "text") {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === assistantId
          ? { ...m, content: m.content + event.data.delta }
          : m,
      ),
    }));
  } else if (event.event === "tool_call") {
    const record: AssistantToolCallRecord = {
      id: event.data.id,
      name: event.data.name,
      arguments: event.data.arguments,
      kind: event.data.kind,
      result: event.data.result,
      planStepId: event.data.planStepId,
      planStepIds: event.data.planStepIds,
    };
    // Apply edit tools to the editor store via the shared bridge. Using a
    // registry (not a direct import) keeps the two stores decoupled.
    if (event.data.kind === "edit") {
      dispatchAssistantEditorOperation(
        event.data.name,
        event.data.arguments,
        event.data.result,
      );
    }
    set((s) => {
      // 단일 planStepId (legacy) + planStepIds (array) 모두 수용해 한 edit
      // 이 여러 step 을 동시에 체크할 수 있게 한다.
      const stepIds = new Set<string>();
      if (event.data.planStepId) stepIds.add(event.data.planStepId);
      if (event.data.planStepIds) {
        for (const id of event.data.planStepIds) stepIds.add(id);
      }
      const isEditSuccess =
        event.data.kind === "edit" &&
        ((event.data.result as { ok?: boolean } | null)?.ok ?? false);
      // Find the most recent plan-bearing message to tick off step progress.
      let mostRecentPlanIdx = -1;
      if (stepIds.size > 0 && isEditSuccess) {
        for (let i = s.messages.length - 1; i >= 0; i--) {
          if (s.messages[i].plan) {
            mostRecentPlanIdx = i;
            break;
          }
        }
      }
      return {
        messages: s.messages.map((m, idx) => {
          if (m.id === assistantId) {
            return { ...m, toolCalls: [...m.toolCalls, record] };
          }
          if (idx === mostRecentPlanIdx && m.plan) {
            return {
              ...m,
              plan: {
                ...m.plan,
                steps: m.plan.steps.map((step) =>
                  stepIds.has(step.id) && step.status === "pending"
                    ? { ...step, status: "done" }
                    : step,
                ),
              },
            };
          }
          return m;
        }),
      };
    });
  } else if (event.event === "plan") {
    const plan: AssistantPlanCard = {
      messageId: assistantId,
      planId: event.data.planId,
      title: event.data.title,
      summary: event.data.summary,
      steps: event.data.steps.map((s) => ({
        ...s,
        status: "pending" as const,
      })),
      openQuestions: event.data.openQuestions,
      approved: false,
    };
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === assistantId ? { ...m, plan } : m,
      ),
    }));
  } else if (event.event === "error") {
    // toast 대신 assistant bubble 에 에러를 주입해 채팅 맥락에서 "왜 중단
    // 됐는지" 가 보이도록 한다. 스토어의 `error` 필드는 상단 배너/배지 등
    // 전역 표시 용도로 계속 유지.
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              streaming: false,
              error: {
                code: event.data.code,
                message: event.data.message || "Assistant error",
              },
            }
          : m,
      ),
      error: event.data.code,
    }));
  } else if (event.event === "done") {
    set((s) => {
      const locale = useLocaleStore.getState().locale;
      const messages = s.messages.map((m) => {
        if (m.id !== assistantId) return m;
        const updated: AssistantDisplayMessage = { ...m, streaming: false };
        // 힌트 우선순위: error > stalled > planApprove > completed.
        // error 가 이미 있으면 그대로 둔다 (에러 bubble 이 렌더됨). 그렇지
        // 않으면 plan 진행도와 이번 턴 형태를 보고 분기한다:
        //   - 시작된 plan 에 pending step 이 남고 prose 도 비었음
        //     → "이어서 진행해줘" 안내 (드물게 발생: 서버가 stuck 으로 판정)
        //   - 모두 완료 (+openQuestions 없음) → 완료 알림
        //
        // plan-only 턴 (propose_plan 만, 미승인) 에서는 plan card 자체에
        // "계획대로 진행" 버튼이 이미 표시되므로 별도 안내 hint 를 띄우지 않는다.
        // 동일 메시지가 버튼 + info 박스로 두 번 나오는 duplication 방지
        // (2026-04-23 UX 피드백 반영).
        if (!updated.error) {
          const completion = summarizePlanState(updated, s.messages);
          if (completion.status === "pending" && !updated.content.trim()) {
            updated.systemHint = {
              kind: "info",
              text: translate(locale, "assistant.turnStalledHint"),
            };
          } else if (completion.status === "completed") {
            updated.systemHint = {
              kind: "success",
              text: translate(locale, "assistant.turnCompletedHint", {
                count: completion.completedActionable,
              }),
            };
          }
        }
        return updated;
      });
      return { messages };
    });
  }
}

/**
 * Turn 종료 시점에 활성 plan 진행 상태를 요약한다.
 *
 *   - `none`      : 활성 plan 이 없거나, plan 이 아직 실행 시작 전(approve
 *                    대기) — hint 불필요.
 *   - `pending`   : plan 이 실행 중이고 actionable(!= note) step 이 남음.
 *                    Turn 이 조용히 멈추면 "이어서 진행해줘" 힌트.
 *   - `completed` : plan 의 모든 actionable step 이 done 이고 openQuestions
 *                    도 없음. 이번 턴에 진행이 있었는지와 무관하게 완료
 *                    알림을 띄워 사용자가 작업 종료를 즉시 인지하도록.
 *
 * plan 이 **시작되었는지(started)** 는 approve 버튼 클릭 또는 최소 1개 step
 * 이 이미 done 인지로 판정한다 — 자연어 승인으로 LLM 이 진행 중인 경우를
 * 포함.
 */
export function summarizePlanState(
  msg: AssistantDisplayMessage,
  all: AssistantDisplayMessage[],
): {
  status: "none" | "pending" | "completed";
  completedActionable: number;
} {
  let plan: AssistantPlanCard | null = msg.plan;
  if (!plan) {
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].plan) {
        plan = all[i].plan;
        break;
      }
    }
  }
  if (!plan) return { status: "none", completedActionable: 0 };
  const actionable = plan.steps.filter((s) => s.action !== "note");
  const completedActionable = actionable.filter(
    (s) => s.status === "done",
  ).length;
  const hasStarted = plan.approved || completedActionable > 0;
  if (!hasStarted) return { status: "none", completedActionable: 0 };
  const hasPending = actionable.some((s) => s.status === "pending");
  const openQuestions = plan.openQuestions ?? [];
  if (!hasPending && openQuestions.length === 0) {
    return { status: "completed", completedActionable };
  }
  return { status: "pending", completedActionable };
}
