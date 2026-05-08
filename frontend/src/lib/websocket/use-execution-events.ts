"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getWsClient } from "./ws-client";
import {
  useExecutionStore,
  NodeExecutionStatus,
  type ConversationItem,
} from "../stores/execution-store";
import { getAccessToken } from "../api/client";
import { ExecutionData, NodeExecutionData } from "../api/executions";
import { getNodeDefinition } from "../node-definitions";
import {
  messagesToConversationItems,
  toolStatusMapFromItems,
} from "@/lib/conversation/conversation-utils";
import { tryParseJson } from "@/lib/utils/parse-json";

interface UseExecutionEventsOptions {
  executionId: string | null;
}

interface UseExecutionEventsReturn {
  isConnected: boolean;
}

function mapNodeStatus(
  status: NodeExecutionData["status"],
): NodeExecutionStatus {
  switch (status) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "waiting_for_input":
      return "waiting_for_input";
    default:
      return "pending";
  }
}

function getCategoryForType(nodeType: string): string {
  return getNodeDefinition(nodeType)?.category ?? "unknown";
}

/**
 * snapshot reconcile 의 마지막 안전망 — backend 가 envelope `meta.interactionType`
 * 을 빠뜨려도 nodeType 으로 분기를 유추해 store 의 waitingInteractionType 을
 * 정확히 set 한다. 누락 시 page.tsx 의 `isWaitingButtons` 가 false 로 떨어져
 * Preview 탭의 버튼이 콜백 없이 disabled 로 그려지는 회귀가 발생한다.
 */
function inferInteractionTypeFromNodeType(
  nodeType: string | undefined,
): "form" | "buttons" | "ai_conversation" | undefined {
  if (!nodeType) return undefined;
  if (nodeType === "form") return "form";
  if (
    nodeType === "carousel" ||
    nodeType === "chart" ||
    nodeType === "table" ||
    nodeType === "template"
  ) {
    return "buttons";
  }
  if (nodeType === "ai_agent" || nodeType === "information_extractor") {
    return "ai_conversation";
  }
  return undefined;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept only well-formed UUIDs. Timeline IDs (`nodeExecutionId`,
 * `parentNodeExecutionId`) flow directly into React keys and selection
 * state; a malformed/over-long value from an upstream bug or a malicious
 * payload would otherwise be persisted verbatim.
 */
function sanitizeUuid(v: unknown): string | undefined {
  return typeof v === "string" && UUID_REGEX.test(v) ? v : undefined;
}

// Higher priority = more terminal. Prevents stale WS events from overwriting.
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  running: 1,
  waiting_for_input: 2,
  completed: 3,
  failed: 3,
  skipped: 3,
};

function shouldUpdateStatus(
  current: NodeExecutionStatus | undefined,
  incoming: NodeExecutionStatus,
): boolean {
  if (!current) return true;
  return (STATUS_PRIORITY[incoming] ?? 0) >= (STATUS_PRIORITY[current] ?? 0);
}

export function useExecutionEvents({
  executionId,
}: UseExecutionEventsOptions): UseExecutionEventsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const cancelledRef = useRef(false);

  const {
    startExecution,
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
    resumeFromForm,
    pauseForButtons,
    resumeFromButtons,
    pauseForConversation,
    resumeFromConversation,
    setConversationMessages,
    upsertToolItem,
    updateToolItem,
    flushPendingToolItemsAsError,
    updateConversationConfig,
  } = useExecutionStore();

  const handleExecutionStarted = useCallback(
    (data: unknown) => {
      const payload = data as { executionId?: string };
      if (!payload.executionId) return;

      // Backward compat guard: older backends may emit execution.started
      // instead of execution.resumed when resuming from a form submission.
      // Avoid resetting nodeResults when we're just resuming.
      const { status: currentStatus } = useExecutionStore.getState();
      if (currentStatus === "waiting_for_input") {
        resumeFromForm();
        return;
      }

      startExecution(payload.executionId);
    },
    [startExecution, resumeFromForm],
  );

  const handleExecutionResumed = useCallback(() => {
    const { waitingInteractionType } = useExecutionStore.getState();
    if (waitingInteractionType === "ai_conversation") {
      resumeFromConversation();
    } else if (waitingInteractionType === "buttons") {
      resumeFromButtons();
    } else {
      resumeFromForm();
    }
  }, [resumeFromForm, resumeFromButtons, resumeFromConversation]);

  const handleExecutionCompleted = useCallback(() => {
    completeExecution();
  }, [completeExecution]);

  const handleExecutionFailed = useCallback(
    (data: unknown) => {
      const payload = data as { error?: string };
      // Flip dangling pending tool items so a backend crash mid-call doesn't
      // leave the timeline with a forever-spinner.
      flushPendingToolItemsAsError(
        payload.error ?? "Execution failed before the tool completed",
      );
      failExecution(payload.error);
    },
    [failExecution, flushPendingToolItemsAsError],
  );

  const handleExecutionCancelled = useCallback(() => {
    flushPendingToolItemsAsError("Execution cancelled");
    failExecution("Execution cancelled");
  }, [failExecution, flushPendingToolItemsAsError]);

  const handleWaitingForInput = useCallback(
    (data: unknown) => {
      const payload = data as {
        waitingNodeId?: string;
        waitingNodeType?: string;
        waitingNodeLabel?: string;
        nodeExecutionId?: string;
        // ISO 8601 — backend 가 NodeExecution.startedAt 을 동봉. NODE_STARTED
        // race miss 시에도 store 가 row 정렬 키를 잃지 않도록 한다.
        startedAt?: string;
        interactionType?: "form" | "buttons" | "ai_conversation";
        nodeOutput?: unknown;
        buttonConfig?: unknown;
      };
      if (!payload.waitingNodeId) return;

      const nodeType = payload.waitingNodeType ?? "unknown";
      const nodeCategory = getCategoryForType(nodeType);

      // Update node status
      updateNodeStatus(payload.waitingNodeId, {
        status: "waiting_for_input",
      });
      // nodeOutput may be at top-level (form) or nested inside buttonConfig (buttons)
      const resolvedOutput =
        payload.nodeOutput ??
        (payload.buttonConfig as Record<string, unknown> | undefined)?.nodeOutput ??
        null;
      addNodeResult({
        // Propagate the DB row id so this update maps to the same timeline
        // entry created by NODE_STARTED — otherwise a second phantom row
        // appears when execution resumes (carousel button flow etc.).
        nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
        nodeId: payload.waitingNodeId,
        // Backend now includes waitingNodeLabel; older payloads fall back to
        // the id and the store's addNodeResult preserves the label that
        // NODE_STARTED already filled in.
        nodeLabel: payload.waitingNodeLabel ?? payload.waitingNodeId,
        nodeType,
        nodeCategory,
        status: "waiting_for_input",
        // 워크플로 첫 노드는 `Run` 직후 도달해 ws subscribe 완료 전 NODE_STARTED
        // 를 놓칠 race window 가 있다. backend 가 동봉한 startedAt 으로 store
        // row 를 채워 sortByStartedAt 이 첫 노드를 timeline 마지막으로 보내는
        // 회귀를 차단한다.
        startedAt: payload.startedAt,
        outputData: resolvedOutput,
      });

      // Resolve interactionType from top-level or inside nodeOutput
      const nodeOutputObj = resolvedOutput as Record<string, unknown> | null;
      const interactionType =
        payload.interactionType ??
        (nodeOutputObj?.interactionType as string | undefined);

      if (interactionType === "ai_conversation") {
        const convConfig = nodeOutputObj?.conversationConfig as {
          message?: string;
          messages?: Array<{
            role: string;
            content?: string;
            toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
            toolCallId?: string;
          }>;
          turnCount?: number;
          maxTurns?: number;
        } | undefined;
        pauseForConversation(payload.waitingNodeId, convConfig ?? null);

        // Seed conversationMessages from the snapshot using the shared
        // converter so user / assistant / tool items all flow through one
        // path. Skip when the store already has messages (re-emit on
        // reconnect would otherwise duplicate).
        if (convConfig?.messages) {
          const { conversationMessages } = useExecutionStore.getState();
          if (conversationMessages.length === 0) {
            const turnDebug = (payload as Record<string, unknown>).turnDebug as
              | {
                  llmCalls?: {
                    llmCalls?: Array<{
                      requestPayload?: unknown;
                      responsePayload?: unknown;
                      durationMs?: number;
                    }>;
                  };
                  metadata?: { model?: string };
                }
              | undefined;
            // Legacy quirk: backend nests llmCalls under another `llmCalls`
            // key here. Flatten to a Map<turn, entry> the converter expects.
            const debugByTurn = turnDebug?.llmCalls?.llmCalls
              ? new Map([
                  [
                    convConfig.turnCount ?? 1,
                    {
                      turnIndex: convConfig.turnCount ?? 1,
                      llmCalls: turnDebug.llmCalls.llmCalls,
                    },
                  ],
                ])
              : undefined;
            const items = messagesToConversationItems(convConfig.messages, {
              debugByTurn,
              metaModel: turnDebug?.metadata?.model,
            });
            if (items.length > 0) {
              setConversationMessages(items);
            }
          }
        }
      } else if (interactionType === "buttons") {
        const btnConfig =
          payload.buttonConfig ??
          nodeOutputObj?.buttonConfig;
        pauseForButtons(payload.waitingNodeId, btnConfig ?? null);
      } else {
        // Form interaction (default for backward compat).
        // New shape: `{ config: formDeclaration, output: null, status: 'waiting_for_input' }`
        // Legacy:    `{ type: 'form', formConfig: {...}, status: 'waiting_for_input' }`
        const output = nodeOutputObj as
          | { formConfig?: unknown; config?: unknown; output?: unknown }
          | null;
        const isStructured =
          output != null &&
          typeof output === "object" &&
          "config" in output &&
          "output" in output;
        const formConfig = isStructured
          ? output.config
          : (output?.formConfig ?? null);
        pauseForForm(payload.waitingNodeId, formConfig ?? null);
      }
    },
    [
      pauseForForm,
      pauseForButtons,
      pauseForConversation,
      setConversationMessages,
      updateNodeStatus,
      addNodeResult,
    ],
  );

  const handleAiMessage = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        message?: string;
        turnCount?: number;
        messages?: Array<{
          role: string;
          content?: string;
          toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
          toolCallId?: string;
        }>;
        metadata?: {
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          toolCalls?: number;
          ragChunks?: number;
        };
        // The legacy flat fields requestPayload / responsePayload were
        // removed from this payload — per-call traces now live inside
        // llmCalls[]. See spec/5-system/6-websocket-protocol.md §4.4.
        llmCalls?: Array<{
          requestPayload?: unknown;
          responsePayload?: unknown;
          durationMs?: number;
        }>;
        durationMs?: number;
      };
      if (payload.message == null) return;
      // spec/5-system/6-websocket-protocol.md §4.4 — backend always emits
      // a messages snapshot. A payload without one is an invariant
      // violation; drop it (with a dev-only warning) so we don't fall back
      // to a stale shape that hides the real bug.
      if (
        !Array.isArray(payload.messages) ||
        payload.messages.length === 0
      ) {
        if (process.env.NODE_ENV !== "production") {
          // Log only non-sensitive identifiers — payload.llmCalls would
          // otherwise dump raw LLM request/response bodies into the console.
          console.warn(
            "[ws] execution.ai_message without messages snapshot — ignoring",
            { nodeId: payload.nodeId, turnCount: payload.turnCount },
          );
        }
        return;
      }

      const turn = payload.turnCount ?? 1;
      const debugByTurn = payload.llmCalls?.length
        ? new Map([
            [turn, { turnIndex: turn, llmCalls: payload.llmCalls }],
          ])
        : undefined;
      // Preserve in-flight tool status from `tool_call_completed` events —
      // without this, the snapshot replacement would briefly drop the
      // success/error badge until backend's meta.turnDebug.toolCalls shape
      // is wired into AI_MESSAGE payloads (only `messages` + `llmCalls`
      // arrive today).
      const previousItems =
        useExecutionStore.getState().conversationMessages;
      const toolStatusByCallId = toolStatusMapFromItems(previousItems);
      const items = messagesToConversationItems(payload.messages, {
        debugByTurn,
        toolStatusByCallId,
        metaModel: payload.metadata?.model,
      });
      setConversationMessages(items);
      updateConversationConfig(payload);
    },
    [setConversationMessages, updateConversationConfig],
  );

  const handleToolCallStarted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        turnIndex?: number;
        toolCallId?: string;
        name?: string;
        arguments?: string;
      };
      if (!payload.toolCallId || !payload.name) return;
      upsertToolItem({
        type: "tool",
        content: payload.name,
        turnIndex: payload.turnIndex ?? 1,
        toolCallId: payload.toolCallId,
        toolArgs: tryParseJson(payload.arguments),
        toolStatus: "pending",
        timestamp: new Date().toISOString(),
      });
    },
    [upsertToolItem],
  );

  const handleToolCallCompleted = useCallback(
    (data: unknown) => {
      const payload = data as {
        toolCallId?: string;
        turnIndex?: number;
        content?: string;
        status?: "success" | "error";
        error?: string;
        durationMs?: number;
      };
      if (!payload.toolCallId) return;
      const patch: Partial<ConversationItem> = {
        toolStatus: payload.status ?? "success",
        toolResult: tryParseJson(payload.content),
      };
      if (payload.durationMs !== undefined) {
        patch.durationMs = payload.durationMs;
      }
      if (payload.error !== undefined) {
        patch.error = payload.error;
      }

      // Defensive: when `tool_call_completed` arrives before the matching
      // `tool_call_started` (re-ordered delivery, slow first emit), upsert
      // a fresh item so we never leave a dangling pending elsewhere — but
      // only when the store has no item with that toolCallId yet.
      const existing = useExecutionStore
        .getState()
        .conversationMessages.find(
          (i) => i.toolCallId === payload.toolCallId,
        );
      if (!existing) {
        upsertToolItem({
          type: "tool",
          content: "(unknown tool)",
          turnIndex: payload.turnIndex ?? 1,
          toolCallId: payload.toolCallId,
          toolStatus: payload.status ?? "success",
          toolResult: tryParseJson(payload.content),
          ...(payload.durationMs !== undefined
            ? { durationMs: payload.durationMs }
            : {}),
          ...(payload.error !== undefined ? { error: payload.error } : {}),
          timestamp: new Date().toISOString(),
        });
        return;
      }
      updateToolItem(payload.toolCallId, patch);
    },
    [updateToolItem, upsertToolItem],
  );

  const handleNodeStarted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        nodeType?: string;
        nodeLabel?: string;
        timestamp?: string;
        input?: unknown;
        startedAt?: string;
      };
      if (payload.nodeId) {
        // Guard against out-of-order events (e.g., completed arriving before started)
        const existing =
          useExecutionStore.getState().nodeStatuses.get(payload.nodeId);
        if (!shouldUpdateStatus(existing?.status, "running")) return;

        updateNodeStatus(payload.nodeId, { status: "running" });
        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId: sanitizeUuid(payload.parentNodeExecutionId),
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "running",
          outputData: null,
          inputData: payload.input,
          startedAt:
            payload.startedAt ?? payload.timestamp ?? new Date().toISOString(),
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeCompleted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        duration?: number;
        nodeType?: string;
        nodeLabel?: string;
        output?: Record<string, unknown>;
        input?: unknown;
        interactionData?: unknown;
        finishedAt?: string;
        timestamp?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "completed",
          duration: payload.duration,
        });

        // Preserve startedAt/inputData from the matching prior entry if
        // available. Match by nodeExecutionId when present so iterations
        // stay distinct.
        const existing = useExecutionStore.getState().nodeResults.find((r) =>
          payload.nodeExecutionId
            ? r.nodeExecutionId === payload.nodeExecutionId
            : !r.nodeExecutionId && r.nodeId === payload.nodeId,
        );

        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId:
            sanitizeUuid(payload.parentNodeExecutionId) ??
            existing?.parentNodeExecutionId,
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "completed",
          duration: payload.duration,
          outputData: payload.output ?? null,
          inputData: payload.input ?? existing?.inputData,
          startedAt: existing?.startedAt,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeFailed = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        error?: string;
        nodeType?: string;
        nodeLabel?: string;
        input?: unknown;
        finishedAt?: string;
        timestamp?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "failed",
          error: payload.error,
        });

        const existing = useExecutionStore.getState().nodeResults.find((r) =>
          payload.nodeExecutionId
            ? r.nodeExecutionId === payload.nodeExecutionId
            : !r.nodeExecutionId && r.nodeId === payload.nodeId,
        );

        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId:
            sanitizeUuid(payload.parentNodeExecutionId) ??
            existing?.parentNodeExecutionId,
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "failed",
          error: payload.error,
          outputData: null,
          inputData: payload.input ?? existing?.inputData,
          startedAt: existing?.startedAt,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeSkipped = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        nodeType?: string;
        nodeLabel?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, { status: "skipped" });
        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId: sanitizeUuid(payload.parentNodeExecutionId),
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "skipped",
          outputData: null,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  useEffect(() => {
    if (!executionId) return;

    const token = getAccessToken();
    if (!token) return;

    cancelledRef.current = false;

    const client = getWsClient();

    // Connect if not already connected
    client.connect(token);

    // Track connection state
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);

    // Bind execution events BEFORE subscribing
    client.on("execution.started", handleExecutionStarted);
    client.on("execution.resumed", handleExecutionResumed);
    client.on("execution.completed", handleExecutionCompleted);
    client.on("execution.failed", handleExecutionFailed);
    client.on("execution.cancelled", handleExecutionCancelled);
    client.on("execution.waiting_for_input", handleWaitingForInput);
    client.on("execution.ai_message", handleAiMessage);
    client.on("execution.tool_call_started", handleToolCallStarted);
    client.on("execution.tool_call_completed", handleToolCallCompleted);

    // Bind node events
    client.on("execution.node.started", handleNodeStarted);
    client.on("execution.node.completed", handleNodeCompleted);
    client.on("execution.node.failed", handleNodeFailed);
    client.on("execution.node.skipped", handleNodeSkipped);

    const channel = `execution:${executionId}`;

    // One-shot snapshot, delivered by the backend right after we subscribe
    // (and again on reconnect). Carries the full Execution + NodeExecution
    // graph — same shape as the old REST `GET /executions/:id` response —
    // so timeline/detail state can be rebuilt from WS alone.
    const handleSnapshot = (data: unknown) => {
      const payload = data as { execution?: ExecutionData } | null;
      const execution = payload?.execution;
      if (!execution || cancelledRef.current) return;

      if (execution.nodeExecutions) {
        const sorted = [...execution.nodeExecutions].sort((a, b) => {
          const aStarted = a.startedAt ?? "";
          const bStarted = b.startedAt ?? "";
          return aStarted < bStarted ? -1 : aStarted > bStarted ? 1 : 0;
        });
        for (const ne of sorted) {
          const nodeType = ne.node?.type ?? "unknown";
          const nodeLabel = ne.node?.label ?? ne.nodeId;
          const incomingStatus = mapNodeStatus(ne.status);

          // When a node.completed event arrives before the snapshot (the
          // snapshot can race the subscribe→incremental path), the store
          // already holds a terminal status for this node. Don't let the
          // snapshot's older row overwrite it back to "running".
          const currentStatus = useExecutionStore
            .getState()
            .nodeStatuses.get(ne.nodeId)?.status;
          if (!shouldUpdateStatus(currentStatus, incomingStatus)) continue;

          updateNodeStatus(ne.nodeId, {
            status: incomingStatus,
            duration: ne.durationMs ?? undefined,
            error: ne.error?.message,
          });

          addNodeResult({
            nodeExecutionId: ne.id,
            parentNodeExecutionId: ne.parentNodeExecutionId ?? undefined,
            nodeId: ne.nodeId,
            nodeLabel,
            nodeType,
            nodeCategory: getCategoryForType(nodeType),
            status: incomingStatus,
            duration: ne.durationMs ?? undefined,
            error: ne.error?.message,
            outputData: ne.outputData,
            inputData: ne.inputData,
            startedAt: ne.startedAt,
          });
        }
      }

      const { status: prevStatus } = useExecutionStore.getState();

      if (execution.status === "completed") {
        completeExecution();
        return;
      }
      if (execution.status === "failed") {
        failExecution(execution.error?.message);
        return;
      }
      if (execution.status === "cancelled") {
        failExecution("Execution cancelled");
        return;
      }
      if (
        execution.status === "running" &&
        prevStatus === "waiting_for_input"
      ) {
        // Execution already resumed before we joined — reconcile local state.
        const { waitingInteractionType: wit } = useExecutionStore.getState();
        if (wit === "ai_conversation") {
          resumeFromConversation();
        } else if (wit === "buttons") {
          resumeFromButtons();
        } else {
          resumeFromForm();
        }
        return;
      }
      if (execution.status === "running" && prevStatus === "idle") {
        // Page opened mid-execution: store still shows idle because the
        // execution.started event fired before we were listening. Promote
        // to running without clearing the just-populated timeline.
        useExecutionStore.setState({
          executionId: execution.id,
          status: "running",
          startedAt: execution.startedAt ?? new Date().toISOString(),
        });
        return;
      }
      if (execution.status === "waiting_for_input") {
        const { waitingNodeId: currentWaiting } =
          useExecutionStore.getState();
        const waitingNode = execution.nodeExecutions?.find(
          (ne) => ne.status === "waiting_for_input",
        );
        if (currentWaiting && currentWaiting === waitingNode?.nodeId) return;
        if (waitingNode?.outputData) {
          const raw = waitingNode.outputData as Record<string, unknown>;

          // Structured shape: `{ config, output, status, meta: { interactionType } }`
          // Legacy flat:      `{ type: 'form', formConfig, interactionType, buttonConfig, conversationConfig, ... }`
          const isStructured =
            raw != null &&
            typeof raw === "object" &&
            "config" in raw &&
            "output" in raw;

          const meta = isStructured
            ? (raw.meta as Record<string, unknown> | undefined)
            : undefined;

          // 추출 우선 순위: envelope.meta.interactionType (정식) → envelope
          // .output.interactionType (legacy nested) → top-level (legacy flat)
          // → raw.type==='form' → nodeType 기반 fallback. 마지막 fallback 은
          // backend 가 meta 를 빠뜨려도 카테고리/AI/Form 노드 타입으로
          // 정확히 hydrate 되도록 보장 (page.tsx 의 isWaitingButtons 등이
          // 정확히 true 가 되어 Preview 탭 버튼이 콜백을 받음).
          const envelopeOutput = isStructured
            ? (raw.output as Record<string, unknown> | undefined)
            : undefined;
          const interactionType =
            (meta?.interactionType as string | undefined) ??
            (envelopeOutput?.interactionType as string | undefined) ??
            (raw.interactionType as string | undefined) ??
            (raw.type === "form" ? "form" : undefined) ??
            inferInteractionTypeFromNodeType(waitingNode.node?.type);

          if (interactionType === "ai_conversation") {
            const convConfig = isStructured
              ? (raw.config as Record<string, unknown> | undefined)
              : (raw.conversationConfig as Record<string, unknown> | undefined);
            pauseForConversation(waitingNode.nodeId, convConfig ?? null);
          } else if (interactionType === "buttons") {
            const btnConfig = isStructured
              ? (raw.config as Record<string, unknown> | undefined)
              : (raw.buttonConfig as Record<string, unknown> | undefined);
            pauseForButtons(waitingNode.nodeId, btnConfig ?? null);
          } else if (interactionType === "form") {
            const formConfig = isStructured
              ? (raw.config as Record<string, unknown> | undefined)
              : (raw.formConfig as Record<string, unknown> | undefined);
            pauseForForm(waitingNode.nodeId, formConfig ?? null);
          }
        }
      }
    };

    client.on("execution.snapshot", handleSnapshot);

    const trySubscribe = async () => {
      try {
        await client.waitForConnect();
        if (!cancelledRef.current) {
          client.subscribe(channel);
        }
      } catch {
        // Connection still pending — reconnect handler will retry.
      }
    };

    const onReconnect = () => {
      if (!cancelledRef.current) {
        void trySubscribe();
      }
    };
    client.on("connect", onReconnect);

    void trySubscribe();

    return () => {
      cancelledRef.current = true;
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
      client.off("connect", onReconnect);
      client.off("execution.started", handleExecutionStarted);
      client.off("execution.resumed", handleExecutionResumed);
      client.off("execution.completed", handleExecutionCompleted);
      client.off("execution.failed", handleExecutionFailed);
      client.off("execution.cancelled", handleExecutionCancelled);
      client.off("execution.waiting_for_input", handleWaitingForInput);
      client.off("execution.ai_message", handleAiMessage);
      client.off("execution.tool_call_started", handleToolCallStarted);
      client.off("execution.tool_call_completed", handleToolCallCompleted);
      client.off("execution.node.started", handleNodeStarted);
      client.off("execution.node.completed", handleNodeCompleted);
      client.off("execution.node.failed", handleNodeFailed);
      client.off("execution.node.skipped", handleNodeSkipped);
      client.off("execution.snapshot", handleSnapshot);
      client.unsubscribe(channel);
      // Do NOT disconnect - singleton stays alive
    };
  }, [
    executionId,
    handleExecutionStarted,
    handleExecutionResumed,
    handleExecutionCompleted,
    handleExecutionFailed,
    handleExecutionCancelled,
    handleWaitingForInput,
    handleAiMessage,
    handleToolCallStarted,
    handleToolCallCompleted,
    handleNodeStarted,
    handleNodeCompleted,
    handleNodeFailed,
    handleNodeSkipped,
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
    resumeFromForm,
    pauseForButtons,
    resumeFromButtons,
    pauseForConversation,
    resumeFromConversation,
    updateConversationConfig,
  ]);

  return { isConnected };
}
