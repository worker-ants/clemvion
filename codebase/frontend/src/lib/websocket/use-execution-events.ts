"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { getWsClient } from "./ws-client";
import {
  useExecutionStore,
  type ConversationItem,
} from "../stores/execution-store";
import { ensureFreshAccessToken, getAccessToken } from "../api/client";
import { ExecutionData } from "../api/executions";
import {
  applyExecutionSnapshot,
  getCategoryForType,
  inferInteractionTypeFromNodeType,
  shouldUpdateStatus,
} from "./apply-execution-snapshot";
import {
  messagesToConversationItems,
  mergeOrphanToolItems,
  toolStatusMapFromItems,
  threadTurnsToConversationItems,
  type RawMessage,
  type ConversationTurn,
} from "@/lib/conversation/conversation-utils";
import { tryParseJson } from "@/lib/utils/parse-json";
import { assertNever } from "@/lib/utils/exhaustive";
import { useT } from "@/lib/i18n";

interface UseExecutionEventsOptions {
  executionId: string | null;
}

interface UseExecutionEventsReturn {
  isConnected: boolean;
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

/**
 * Extract a structured `output.error` payload from a node lifecycle event,
 * regardless of whether it arrived on the `error` (failed) or `output.error`
 * (completed-with-error) field. Returns `null` when no structured error
 * shape is present — including the legacy `error: string` case which we
 * keep as a plain status update without an inline conversation marker.
 *
 * SoT: spec/conventions/node-output.md Principle 3.2 / 3.2.1 + Spec
 * WebSocket Protocol §4.1 error payload shape.
 */
function extractNodeErrorPayload(
  rawError: unknown,
  rawOutput: unknown,
): {
  code: string;
  message: string;
  details?: { retryable?: boolean; retryAfterSec?: number; [k: string]: unknown };
} | null {
  // §4.1 갱신 — `execution.node.failed.error` 는 `output.error` 전체 구조
  const direct =
    rawError && typeof rawError === "object" && !Array.isArray(rawError)
      ? (rawError as Record<string, unknown>)
      : null;
  // multi-turn `port: 'error'` 의 `node.completed` 분기
  const nested =
    rawOutput &&
    typeof rawOutput === "object" &&
    "error" in (rawOutput as Record<string, unknown>) &&
    (rawOutput as Record<string, unknown>).error &&
    typeof (rawOutput as Record<string, unknown>).error === "object"
      ? ((rawOutput as Record<string, unknown>).error as Record<string, unknown>)
      : null;
  const source = direct ?? nested;
  if (!source) return null;
  const code = typeof source.code === "string" ? source.code : null;
  const message = typeof source.message === "string" ? source.message : null;
  if (!code || !message) return null;
  const details =
    source.details && typeof source.details === "object"
      ? (source.details as Record<string, unknown>)
      : undefined;
  return { code, message, details };
}

/**
 * Build a `system_error` ConversationItem from a node lifecycle event's
 * error payload. Applied to the conversation thread when the host node is a
 * multi-turn AI Agent that already accumulated turns (live conversation
 * context — spec §9.7 WS event → store mutation contract).
 *
 * `retryable` defaults to `false` when the LLM provider adapter hasn't
 * classified the error yet — the UI then suppresses the `[다시 시도]`
 * button (CT-S10) so users don't trigger a hopeless retry.
 */
function makeSystemErrorItem(args: {
  code: string;
  message: string;
  retryable?: boolean;
  retryAfterSec?: number;
  nodeId: string;
  nodeLabel: string;
  nodeExecutionId?: string;
  timestamp?: string;
}): ConversationItem {
  return {
    type: "system_error",
    content: args.message,
    turnIndex: 0,
    systemError: {
      code: args.code,
      message: args.message,
      retryable: args.retryable ?? false,
      retryAfterSec: args.retryAfterSec,
      nodeId: args.nodeId,
      nodeLabel: args.nodeLabel,
      nodeExecutionId: args.nodeExecutionId,
    },
    timestamp: args.timestamp,
  };
}

/**
 * Decide whether the node event's host node is currently running an AI
 * Agent multi-turn conversation that needs an inline `system_error` item
 * appended to the timeline (spec §9.7 contract). Heuristic:
 *
 * - Host node is an `ai_agent` (single-turn AI Agent never accumulates a
 *   thread of its own so a system_error in the thread is meaningless).
 * - The store already holds conversation messages — i.e. at least one turn
 *   was emitted before the failure. Without prior turns there's no thread
 *   to mark, and the standalone Error tab handles plain failures.
 */
function isMultiTurnAiContext(nodeType?: string): boolean {
  if (nodeType !== "ai_agent") return false;
  return useExecutionStore.getState().conversationMessages.length > 0;
}

export function useExecutionEvents({
  executionId,
}: UseExecutionEventsOptions): UseExecutionEventsReturn {
  const t = useT();
  const [isConnected, setIsConnected] = useState(false);
  // snapshotReceived: WS `execution.snapshot` 이 처음 도착했는지. WS handshake
  // 완료 (isConnected) 보다 더 정확한 "real-time data 수신" 신호 — backend 가
  // subscribe 즉시 발송하는 snapshot 이 도착해야 비로소 진짜 events 흐름이
  // 보장된다. Fix D toast 의 false positive 차단을 위해 isConnected 대신 본
  // 신호를 사용. executionId 변경 / disconnect 시 reset.
  const [snapshotReceived, setSnapshotReceived] = useState(false);
  // React 19 권장 패턴 — render-time prop-change reset (useEffect+setState 대신).
  // executionId 가 새 값으로 바뀌면 snapshotReceived 를 즉시 false 로 reset
  // 해 새 execution 의 snapshot 을 기다린다. set-state-in-effect lint rule 충돌
  // 회피.
  const [prevExecutionId, setPrevExecutionId] = useState(executionId);
  const cancelledRef = useRef(false);
  // 마지막으로 적용한 `conversationThread.nextSeq`. 동일 nextSeq 재emit
  // (WS reconnect) 만 skip 하고, message snapshot 으로 thread 가 덮어써진
  // 뒤 새 waiting tick 이 오면 nextSeq 가 advance 했다면 재적용해 source
  // 별 시각 분기 (spec §9.1) 를 복원한다 — store 의 item 수 비교 (기존
  // 가드) 는 message-derived 결과가 마침 같은 길이가 되면 항상 skip 돼
  // presentation_user 가 다시 plain user 로 박혀버리는 회귀를 만들었다.
  const lastAppliedThreadSeqRef = useRef<number | null>(null);
  if (prevExecutionId !== executionId) {
    setPrevExecutionId(executionId);
    setSnapshotReceived(false);
  }

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
    // Exhaustive switch on WaitingInteractionType — adding a new value to
    // execution-store without handling it here triggers a TS compile error
    // (assertNever sentinel). spec/conventions/interaction-type-registry.md §1.2.
    switch (waitingInteractionType) {
      case "ai_conversation":
        resumeFromConversation();
        return;
      case "buttons":
        resumeFromButtons();
        return;
      case "form":
        resumeFromForm();
        return;
      case "ai_form_render":
        // render_form blocking shares the form-submit dispatch path —
        // waitForAiConversation 의 form_submitted 분기가 다음 turn 을 enqueue.
        resumeFromForm();
        return;
      case null:
        // Reconnect race: snapshot hydration may not yet have set the type.
        // Default to form path which is the most permissive (re-emit safe).
        resumeFromForm();
        return;
      default:
        assertNever(
          waitingInteractionType,
          "WaitingInteractionType@handleExecutionResumed",
        );
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
        interactionType?:
          | "form"
          | "buttons"
          | "ai_conversation"
          | "ai_form_render";
        nodeOutput?: unknown;
        buttonConfig?: unknown;
        // spec/5-system/6-websocket-protocol.md §4.4.5 — backend 가 항상
        // 동봉하는 ConversationThread snapshot. spec/conventions/conversation
        // -thread.md §9.3 에 의해 conversation Preview 의 1차 데이터 소스.
        // emit messages (`convConfig.messages`) 는 LLM debug 패널 전용.
        conversationThread?: {
          /** v1 fixed: `"default"` */
          id?: string;
          /** == turns.length; used for idempotent re-application. */
          nextSeq?: number;
          turns?: ConversationTurn[];
          /** Cumulative char budget (cap fast-path); ignored by UI. */
          totalChars?: number;
        };
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

      // Resolve interactionType from top-level or inside nodeOutput.
      //
      // Defense-in-depth (Carousel buttons-disabled bug fix):
      //  1. payload.interactionType — backend top-level emit (canonical)
      //  2. nodeOutput.interactionType — legacy nested (AI multi-turn 등)
      //  3. inferInteractionTypeFromNodeType(payload.waitingNodeType) — nodeType
      //     기반 fallback (carousel/chart/table/template → 'buttons',
      //     ai_agent/information_extractor → 'ai_conversation', form → 'form').
      //     backend 가 (1)/(2) 모두 빠뜨려도 안전하게 분기하도록 보장.
      const nodeOutputObj = resolvedOutput as Record<string, unknown> | null;
      const interactionType =
        payload.interactionType ??
        (nodeOutputObj?.interactionType as string | undefined) ??
        inferInteractionTypeFromNodeType(payload.waitingNodeType);

      // 진단용: 위 3 fallback 모두 실패한 경우 production 에서도 noticeable
      // 하게 warn — root cause 신속 격리. 사용자 환경에 부담 없는 log only.
      if (!interactionType) {
        console.warn(
          "[handleWaitingForInput] interactionType extraction failed — buttons may render disabled",
          {
            waitingNodeId: payload.waitingNodeId,
            waitingNodeType: payload.waitingNodeType,
            payloadInteractionType: payload.interactionType,
            nodeOutputInteractionType: nodeOutputObj?.interactionType,
          },
        );
      }

      if (
        interactionType === "ai_conversation" ||
        interactionType === "ai_form_render"
      ) {
        // ai_form_render shares the conversation timeline hydration path —
        // the form's preview rides as the last `ai_assistant` turn's
        // `presentations[type:'form']` and AssistantPresentationsBlock
        // renders it inline. The interactionType differentiator only steers
        // which `execution.submit_*` command the user input box dispatches
        // (resumeFromForm vs resumeFromConversation).
        const convConfig = nodeOutputObj?.conversationConfig as {
          message?: string;
          // RawMessage carries `source` (spec/5-system/6-websocket-protocol.md
          // §4.4.6). Single source of truth shared with messagesToConversationItems.
          messages?: RawMessage[];
          turnCount?: number;
          maxTurns?: number;
          /** ai_form_render only — backend 가 동봉. spec §6.1.d.ii. */
          pendingFormToolCall?: {
            toolCallId: string;
            formConfig: Record<string, unknown>;
          };
        } | undefined;
        pauseForConversation(payload.waitingNodeId, convConfig ?? null);
        // Override the interactionType the store inferred from pauseFor* —
        // ai_form_render needs `submit_form` dispatch on resume.
        if (interactionType === "ai_form_render") {
          useExecutionStore.setState({ waitingInteractionType: "ai_form_render" });
        }

        // spec/conventions/conversation-thread.md §9.3 — conversation Preview
        // 의 1차 데이터 소스는 `conversationThread.turns` snapshot. backend 가
        // 항상 동봉 (§4.4.5). source/nodeLabel/data 메타가 살아있어 raw 텍스트
        // 파싱 없이 source 별 시각 분기가 자연스럽다. emit messages
        // (`convConfig.messages`) 는 LLM debug 패널 전용으로 격리 (§9.4).
        //
        // Fallback: thread snapshot 이 비어있거나 옛 backend 가 동봉하지 않는
        // 경우 (백워드 호환), emit messages → ConversationItem 변환을 1회 사용.
        //
        // **Idempotency**: `EXECUTION_WAITING_FOR_INPUT` 는 WS reconnect 와
        // multi-turn cycle 마다 재emit 된다. snapshot 은 authoritative 이지만
        // 동일 `nextSeq` 가 재도착했을 때 다시 적용하면 그 사이 store 에
        // 누적된 in-flight live turn (`addConversationMessage`) 을 잃는다.
        // `lastAppliedThreadSeqRef` 로 마지막 적용 `nextSeq` 만 추적해
        // 동일 revision 재emit 만 skip 한다. **주의**: 기존 가드는
        // `conversationMessages.length` 와 비교했으나, multi-turn 완료 직후
        // `handleAiMessage` 가 thread items 를 message snapshot 으로 덮어쓰면
        // length 가 nextSeq 와 마침 같아져 후속 thread snapshot 이 영구
        // skip — presentation_user / system turn 의 시각 분기 (spec §9.1)
        // 가 plain user bubble 로 회귀하는 결과를 낳았다.
        const threadTurns = payload.conversationThread?.turns;
        if (threadTurns?.length) {
          const nextSeq = payload.conversationThread?.nextSeq ?? threadTurns.length;
          if (lastAppliedThreadSeqRef.current !== nextSeq) {
            const threadItems = threadTurnsToConversationItems(threadTurns);
            if (threadItems.length > 0) {
              // spec/conventions/conversation-thread.md §1.1 — `includeToolTurns:
              // false` (default) 인 워크플로의 thread snapshot 은 `ai_tool` 과
              // tool 호출만 있는 intermediate `ai_assistant` 를 누락한다. 직전
              // `ai_message` 가 messages-base snapshot 으로 채워둔 🔧 tool row
              // 와 🤖+ToolCallBadge intermediate assistant row 가 그대로 사라지지
              // 않도록 prev store 의 orphan 항목들을 같은 turn 안에서 보존한다
              // (PR #206 이후 발견된 회귀).
              const prev = useExecutionStore.getState().conversationMessages;
              const merged = mergeOrphanToolItems(threadItems, prev);
              setConversationMessages(merged);
              lastAppliedThreadSeqRef.current = nextSeq;
            }
          }
        } else if (convConfig?.messages) {
          // Legacy / fallback path — same behaviour as before this change.
          // Skip when the store already has messages (re-emit on reconnect
          // would otherwise duplicate).
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
        // Sub-Workflow nesting 에서 같은 nodeId 의 AI Agent 가 여러 row 일
        // 수 있으므로 nodeExecutionId 로 명시 라우팅 (backend 가 동봉).
        // 옛 payload 와의 호환을 위해 optional.
        nodeExecutionId?: string;
        nodeId?: string;
        message?: string;
        turnCount?: number;
        // RawMessage carries `source` (spec/5-system/6-websocket-protocol.md
        // §4.4.6). Shared with messagesToConversationItems converter.
        messages?: RawMessage[];
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
        // out-of-order guard 는 nodeStatuses 의 status 다운그레이드만 차단한다.
        // Loop body 의 후속 iter / 재시도는 같은 nodeId 의 새 NodeExecution
        // row (별개 nodeExecutionId) 이므로 store row add 는 guard 와 무관하게
        // 항상 진행되어야 한다. 그렇지 않으면 후속 iter row 의 startedAt 이
        // 누락되어 sortByStartedAt 이 timeline 끝으로 sink 시킨다 — Loop
        // 결과의 timeline 순서가 깨지는 회귀 (iter 1 → done → iter 2 → iter 3).
        const existing =
          useExecutionStore.getState().nodeStatuses.get(payload.nodeId);
        if (shouldUpdateStatus(existing?.status, "running")) {
          updateNodeStatus(payload.nodeId, { status: "running" });
        }
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
        startedAt?: string;
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
          // backend 가 payload.startedAt 을 동봉. NODE_STARTED race miss 시
          // existing 매칭 실패해도 timeline 정렬에 정확한 startedAt 사용.
          startedAt: payload.startedAt ?? existing?.startedAt,
        });

        // spec/conventions/conversation-thread.md §9.7 — multi-turn AI Agent
        // 가 `port: 'error'` 로 종결되면 `output.error` 를 운반한다 (AI Agent
        // §7.9). 이 케이스에서 conversation thread 마지막에 system_error
        // item 을 APPEND 해 사용자가 어디서 끊겼는지 인지할 수 있게 한다.
        const errorPayload = extractNodeErrorPayload(undefined, payload.output);
        if (errorPayload && isMultiTurnAiContext(payload.nodeType)) {
          const retryable =
            typeof errorPayload.details?.retryable === "boolean"
              ? errorPayload.details.retryable
              : false;
          const retryAfterSec =
            typeof errorPayload.details?.retryAfterSec === "number"
              ? errorPayload.details.retryAfterSec
              : undefined;
          useExecutionStore.getState().addConversationMessage(
            makeSystemErrorItem({
              code: errorPayload.code,
              message: errorPayload.message,
              retryable,
              retryAfterSec,
              nodeId: payload.nodeId,
              nodeLabel: payload.nodeLabel ?? payload.nodeId,
              nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
              timestamp: payload.finishedAt ?? payload.timestamp,
            }),
          );
        }
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeFailed = useCallback(
    (data: unknown) => {
      // spec/5-system/6-websocket-protocol.md §4.1 — `error` 가 본 PR 에서
      // output.error 전체 구조 (`{code, message, details?}`) 로 운반된다.
      // 호환을 위해 string (옛 backend) 도 받는다 — 그 경우 시스템 에러
      // 인라인 item 을 APPEND 하지 않고 단순 status 갱신만 수행.
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        error?:
          | string
          | {
              code: string;
              message: string;
              details?: Record<string, unknown>;
            };
        nodeType?: string;
        nodeLabel?: string;
        input?: unknown;
        startedAt?: string;
        finishedAt?: string;
        timestamp?: string;
      };
      if (payload.nodeId) {
        const errorMessage =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message;
        updateNodeStatus(payload.nodeId, {
          status: "failed",
          error: errorMessage,
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
          error: errorMessage,
          outputData: null,
          inputData: payload.input ?? existing?.inputData,
          startedAt: payload.startedAt ?? existing?.startedAt,
        });

        // spec/conventions/conversation-thread.md §9.7 — multi-turn AI Agent
        // 가 retryable error 로 종결 시 (또는 일반 LLM 실패) conversation
        // thread 마지막에 system_error item APPEND.
        const errorPayload = extractNodeErrorPayload(payload.error, undefined);
        if (errorPayload && isMultiTurnAiContext(payload.nodeType)) {
          const retryable =
            typeof errorPayload.details?.retryable === "boolean"
              ? errorPayload.details.retryable
              : false;
          const retryAfterSec =
            typeof errorPayload.details?.retryAfterSec === "number"
              ? errorPayload.details.retryAfterSec
              : undefined;
          useExecutionStore.getState().addConversationMessage(
            makeSystemErrorItem({
              code: errorPayload.code,
              message: errorPayload.message,
              retryable,
              retryAfterSec,
              nodeId: payload.nodeId,
              nodeLabel: payload.nodeLabel ?? payload.nodeId,
              nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
              timestamp: payload.finishedAt ?? payload.timestamp,
            }),
          );
        }
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
        startedAt?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, { status: "skipped" });
        const existing = useExecutionStore.getState().nodeResults.find((r) =>
          payload.nodeExecutionId
            ? r.nodeExecutionId === payload.nodeExecutionId
            : !r.nodeExecutionId && r.nodeId === payload.nodeId,
        );
        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId: sanitizeUuid(payload.parentNodeExecutionId),
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "skipped",
          outputData: null,
          startedAt: payload.startedAt ?? existing?.startedAt,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  useEffect(() => {
    if (!executionId) return;

    cancelledRef.current = false;
    // executionId 가 바뀐 turn 의 첫 effect 진입 시 thread snapshot 적용
    // history 를 리셋해야 다음 execution 의 첫 waiting tick 이 반드시 적용된다.
    // (render-time 에서 reset 하면 react-hooks/refs 룰 위반)
    lastAppliedThreadSeqRef.current = null;
    const client = getWsClient();

    // Carousel disabled stuck 버그 fix — connect 시점에 stale token 으로
    // backend 가 reject 해 영구 실패하던 race window 차단.
    //
    // 1) 즉시 사용 가능한 token 이 있으면 그것으로 connect 시도. 만약 stale
    //    이라면 ws-client.ts 의 connect_error 핸들러가 refresh + 재연결.
    // 2) token 자체가 없으면 (AuthProvider 가 session restore 중) pending
    //    refresh 를 await 후 재시도 (별도 비동기 path).
    const initialToken = getAccessToken();
    if (initialToken) {
      client.connect(initialToken);
    } else {
      void (async () => {
        const refreshed = await ensureFreshAccessToken();
        if (cancelledRef.current || !refreshed) return;
        client.connect(refreshed);
      })();
    }

    // Track connection state. disconnect 시 snapshotReceived 도 reset —
    // 재연결 후 새 snapshot 을 기다려야 "real-time data 수신" 다시 보장.
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => {
      setIsConnected(false);
      setSnapshotReceived(false);
    };

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
    //
    // Carousel buttons-disabled stuck 버그 fix — handleSnapshot 의 inline
    // 로직을 `applyExecutionSnapshot` helper 로 추출. WS event handler 와
    // page.tsx 의 REST polling effect 양쪽이 같은 함수를 호출하여 single
    // source of truth 보장 + WS 가 실패해도 REST 가 store 를 hydrate.
    const handleSnapshot = (data: unknown) => {
      const payload = data as { execution?: ExecutionData } | null;
      applyExecutionSnapshot(
        payload?.execution,
        () => cancelledRef.current,
      );
      // WS 로 처음 snapshot 수신 = 진짜 real-time event 흐름 보장 시점.
      // Fix D toast 의 트리거 신호. setter 가 idempotent 하므로 매 snapshot
      // 마다 호출해도 안전 (React 가 같은 값에 bail-out).
      // 주의: REST polling 의 applyExecutionSnapshot (page.tsx 에서 직접 호출)
      // 은 이 setter 를 호출하지 않음 — REST 는 real-time 이 아니라 fallback.
      setSnapshotReceived(true);
    };

    client.on("execution.snapshot", handleSnapshot);

    const trySubscribe = async () => {
      try {
        await client.waitForConnect();
        if (!cancelledRef.current) {
          client.subscribe(channel);
        }
      } catch (err) {
        // WS subscribe 실패 — REST polling 이 fallback 으로 store 를 hydrate
        // 하므로 사용자 워크플로 실행은 계속 진행 (Fix A: REST → store bridge).
        // 진단 가시성을 위해 warn log — 향후 회귀 시 root cause 신속 격리.
        console.warn(
          "[useExecutionEvents] WS subscribe failed — REST polling will hydrate store as fallback",
          err,
        );
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

  // Fix D 회귀 fix — WS 연결 상태 UX feedback (snapshotReceived 기반).
  //
  // 이전 버전은 `isConnected` (WS handshake) 를 신호로 사용했으나, WS singleton
  // 이 페이지 navigation 간 재사용되어 이미 connect 된 상태일 때 connect event
  // 가 재발화하지 않아 isConnected 가 영구히 false → false positive toast.
  //
  // 새 신호: `snapshotReceived` — backend 가 subscribe 즉시 발송하는
  // `execution.snapshot` 을 받았는지. 이 시점부터 실제 real-time event 흐름이
  // 보장된다 (subscribe race window 도 자연 해소 — backend 가 missed events 를
  // snapshot 으로 보상).
  //
  // Threshold 5s → 10s — 느린 dev / cold-start 환경 친화. 영구 실패 (e.g.,
  // backend down) 는 10초 후에도 정상 감지.
  //
  // 의도된 동작:
  //  - 정상: 1초 안에 snapshot 도착 → toast 미발생
  //  - 페이지 재방문: singleton 이 이미 connect 됐어도 새 채널 subscribe + snapshot
  //    수신 사이클을 거쳐 → 1초 안에 다시 set → toast 미발생
  //  - WS 영구 실패: 10초 후 toast 유지 + REST polling 이 store hydrate (Fix A)
  //  - WS 일시 disconnect → 재연결: snapshotReceived reset → 재연결 + 새 snapshot
  //    수신 시 자동 dismiss
  useEffect(() => {
    if (!executionId) return;
    if (snapshotReceived) {
      toast.dismiss("ws-connection-warning");
      return;
    }
    const warnTimer = setTimeout(() => {
      toast.warning(t("executions.realtimeFallback"), {
        duration: Infinity,
        id: "ws-connection-warning",
      });
    }, 10000);
    return () => clearTimeout(warnTimer);
  }, [executionId, snapshotReceived, t]);

  return { isConnected };
}
