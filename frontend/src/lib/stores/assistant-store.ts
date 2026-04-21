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
}

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
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content ?? "",
    toolCalls,
    plan,
    streaming: false,
    createdAt: msg.createdAt,
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
      await assistantApi.streamMessage(
        sessionId,
        {
          content,
          currentWorkflow: snapshot,
          llmConfigId: state.llmConfigId ?? undefined,
        },
        (event) => handleSseEvent(set, get, assistantId, event),
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
    // Finalize streaming flag on final assistant message
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === assistantId ? { ...m, streaming: false } : m,
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
 * Handle a single SSE event during an in-flight assistant turn.
 * Also calls into `applyAssistantOperation` on the editor store when an
 * edit tool succeeds.
 */
function handleSseEvent(
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
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === assistantId
          ? { ...m, streaming: false, content: m.content }
          : m,
      ),
      error: event.data.code,
    }));
    toast.error(event.data.message || "Assistant error");
  } else if (event.event === "done") {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === assistantId ? { ...m, streaming: false } : m,
      ),
    }));
  }
}
