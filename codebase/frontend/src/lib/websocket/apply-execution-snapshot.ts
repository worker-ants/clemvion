"use client";

import {
  useExecutionStore,
  type NodeExecutionStatus,
} from "../stores/execution-store";
import { ExecutionData, NodeExecutionData } from "../api/executions";
import { getNodeDefinition } from "../node-definitions";
import { parseHistoryMessages } from "../conversation/conversation-utils";

/**
 * Snapshot reconcile / REST polling 의 store hydration entry point.
 *
 * 본 helper 는 `handleSnapshot` 의 inline 로직을 추출한 standalone 함수로,
 * **WS event handler 와 REST polling effect 양쪽이 같은 함수를 호출**하여
 * single source of truth 를 유지한다 (Carousel buttons-disabled stuck 버그
 * 의 root cause — REST → store bridge 부재 — 해소).
 *
 * 동작:
 *  - `execution.nodeExecutions` 를 startedAt 으로 정렬 후 store 의
 *    `nodeStatuses` / `nodeResults` 갱신 (status downgrade 차단).
 *  - `execution.status` 분기:
 *    - completed / failed / cancelled → 종료 setter 호출
 *    - running ↔ waiting_for_input 전이 reconcile
 *    - waiting_for_input → 5단계 fallback 으로 interactionType 추출 후
 *      `pauseForButtons` / `pauseForForm` / `pauseForConversation` 호출
 *  - 마지막 fallback (`inferInteractionTypeFromNodeType`) 은 carousel/chart/
 *    table/template → `'buttons'` 자동 추론. backend 의 `meta.interactionType`
 *    누락 또는 REST API 의 `node` relation 누락 시에도 정확한 hydration 보장.
 *  - `ai_conversation` 분기: store.conversationMessages 가 비어있고
 *    `outputData.output.result.messages`(또는 legacy nested/flat) 가 존재
 *    하면 `parseHistoryMessages` 로 시드. 페이지 재진입 시 WS 이벤트가
 *    도착하기 전 REST 만으로도 대화 timeline 이 그려지도록 한다.
 *    WS 가 먼저 채운 경우엔 덮어쓰지 않아 timeline 보호.
 *
 * Hook 외부에서 호출 가능 (Zustand 의 `useExecutionStore.getState()` 패턴).
 *
 * @param execution — REST `/executions/:id` 응답 또는 WS `execution.snapshot`
 *   event 의 `execution` 필드.
 * @param isCancelled — 호출자가 unmount 된 경우 작업 skip. WS handler 가
 *   `cancelledRef` 를 전달하고, REST useEffect 는 별도 cleanup ref 사용.
 */
export function applyExecutionSnapshot(
  execution: ExecutionData | null | undefined,
  isCancelled?: () => boolean,
): void {
  if (!execution) return;
  if (isCancelled?.()) return;

  const store = useExecutionStore.getState();
  const {
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
    pauseForButtons,
    pauseForConversation,
    setConversationMessages,
    resumeFromForm,
    resumeFromButtons,
    resumeFromConversation,
  } = store;

  if (execution.nodeExecutions) {
    const sorted = [...execution.nodeExecutions].sort((a, b) => {
      const aStarted = a.startedAt ?? "";
      const bStarted = b.startedAt ?? "";
      return aStarted < bStarted ? -1 : aStarted > bStarted ? 1 : 0;
    });
    for (const ne of sorted) {
      const nodeType = ne.node?.type ?? "unknown";
      const nodeLabel = ne.node?.label ?? ne.nodeId;
      const incomingStatus = isNodeWaitingForInput(ne)
        ? "waiting_for_input"
        : mapNodeStatus(ne.status);

      // status downgrade 차단 — node.completed 가 snapshot 보다 먼저 도착한
      // race 에서 stale snapshot 이 terminal → running 으로 되돌리지 않게.
      const currentStatus = useExecutionStore
        .getState()
        .nodeStatuses.get(ne.nodeId)?.status;
      if (shouldUpdateStatus(currentStatus, incomingStatus)) {
        updateNodeStatus(ne.nodeId, {
          status: incomingStatus,
          duration: ne.durationMs ?? undefined,
          error: ne.error?.message,
        });
      }

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

  // ── Inconsistent-snapshot reconciliation (양방향 defense) ────────────────
  // Backend 의 status 업데이트 트랜잭션 commit 과 snapshot publish 사이의 race
  // 로 인해 `execution.status='running'` 이지만 `nodeExecutions` 에
  // `waiting_for_input` row 가 존재하는 inconsistent snapshot 이 도착할 수 있다.
  // 이전 fix(31209d37) 의 단방향 defense 는 `prevStatus==='waiting_for_input'`
  // 일 때만 동작 — `prevStatus==='running'` 또는 `'pending'` 에서 첫 snapshot
  // 이 inconsistent 면 waiting UI 가 hydration 되지 않고 'Running' 으로 stuck.
  //
  // 양방향 reconcile: 노드의 진실을 우선해 effective execution.status 를
  // 'waiting_for_input' 으로 격상. terminal status (completed/failed/cancelled)
  // 는 절대 reconcile 하지 않는다 (terminal 진입 후엔 nodeExec 가 stale 이라
  // 트리거하면 안 됨).
  const isTerminal =
    execution.status === "completed" ||
    execution.status === "failed" ||
    execution.status === "cancelled";
  const reconcileToWaiting =
    !isTerminal &&
    execution.status !== "waiting_for_input" &&
    execution.nodeExecutions?.some(isNodeWaitingForInput);
  const effectiveExecutionStatus = reconcileToWaiting
    ? ("waiting_for_input" as const)
    : execution.status;

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
  if (execution.status === "running" && prevStatus === "waiting_for_input") {
    // Carousel disabled stuck (Phase 3) — backend `findById` 의 SELECT 가
    // Execution / NodeExecution 두 번 분리 호출 (executions.service.ts) 라
    // 그 사이에 엔진의 WAITING_FOR_INPUT 트랜잭션이 commit 하면
    // `execution.status='running'` 인데 `nodeExecutions` 에는
    // `waiting_for_input` row 가 존재하는 **inconsistent snapshot** 이 도착한다.
    // 그 경우 local state 가 실제 backend 상태와 일치하므로 resume 분기를
    // skip — 그렇지 않으면 buttons/form/AI 의 waiting UI 가 wipe 되어
    // disabled stuck 회귀 (이 분기가 root cause).
    const hasWaitingNode =
      execution.nodeExecutions?.some(isNodeWaitingForInput);
    if (hasWaitingNode) {
      return;
    }
    // Execution already resumed before we joined — reconcile local state.
    const { waitingInteractionType: wit } = useExecutionStore.getState();
    if (wit === "ai_conversation" || wit === "ai_form_render") {
      resumeFromConversation();
    } else if (wit === "buttons") {
      resumeFromButtons();
    } else {
      resumeFromForm();
    }
    return;
  }
  if (
    execution.status === "running" &&
    prevStatus === "idle" &&
    !reconcileToWaiting
  ) {
    // Page opened mid-execution: store still shows idle because the
    // execution.started event fired before we were listening. Promote
    // to running without clearing the just-populated timeline.
    // (reconcileToWaiting 시는 아래 메인 waiting 분기에서 hydration)
    useExecutionStore.setState({
      executionId: execution.id,
      status: "running",
      startedAt: execution.startedAt ?? new Date().toISOString(),
    });
    return;
  }
  if (effectiveExecutionStatus === "waiting_for_input") {
    const { waitingNodeId: currentWaiting } = useExecutionStore.getState();
    const waitingNode = execution.nodeExecutions?.find(isNodeWaitingForInput);
    if (currentWaiting && currentWaiting === waitingNode?.nodeId) {
      // form/buttons 의 waitingConfig 는 store 가 그대로 보존되므로 재설정
      // 불필요. 다만 AI 대화의 `conversationMessages` 는 별도 슬롯이라,
      // 페이지 재진입·재구독 후 store 가 비어있는 경우 backend 영속
      // outputData 에서 안전망 재시드가 필요하다 (이 early return 으로
      // 건너뛰면 영구히 빈 채로 남던 회귀가 있었음).
      maybeSeedAiConversationMessages(waitingNode);
      return;
    }
    if (waitingNode?.outputData) {
      const raw = waitingNode.outputData as Record<string, unknown>;

      // Structured shape: `{ config, output, status, meta: { interactionType } }`
      // Legacy flat:      `{ type: 'form', formConfig, interactionType, ... }`
      const isStructured =
        raw != null &&
        typeof raw === "object" &&
        "config" in raw &&
        "output" in raw;

      const meta = isStructured
        ? (raw.meta as Record<string, unknown> | undefined)
        : undefined;

      // 추출 우선 순위: envelope.meta.interactionType (정식) → envelope.output
      // .interactionType (legacy nested) → top-level (legacy flat) → raw.type
      // ==='form' → nodeType 기반 fallback. 마지막 fallback 은 backend 가 meta
      // 를 빠뜨려도 카테고리 노드 타입으로 정확히 hydrate 되도록 보장.
      //
      // Defense-in-depth: REST `/executions/:id` 응답이 `nodeExecutions[].node`
      // 객체를 nest 하지 않거나 (TypeORM eager load 누락 / select fields 제한
      // 등) stale 한 경우를 대비해 row 자체의 nodeType / type 도 fallback 으로
      // 시도. 어떤 응답 shape 라도 nodeType 만 한 번 잡히면 추론 가능.
      const envelopeOutput = isStructured
        ? (raw.output as Record<string, unknown> | undefined)
        : undefined;
      const fallbackNodeType =
        waitingNode.node?.type ??
        (waitingNode as { nodeType?: string }).nodeType ??
        (waitingNode as { type?: string }).type;
      const interactionType =
        (meta?.interactionType as string | undefined) ??
        (envelopeOutput?.interactionType as string | undefined) ??
        (raw.interactionType as string | undefined) ??
        (raw.type === "form" ? "form" : undefined) ??
        inferInteractionTypeFromNodeType(fallbackNodeType);

      if (
        interactionType === "ai_conversation" ||
        interactionType === "ai_form_render"
      ) {
        // D6 (2026-05-17) — multi-turn 대화 상태(`message` / `turnCount` /
        // `maxTurns` / `messages`)는 structured envelope 의 `output.result.*`
        // 에 있고, handler config (model, systemPrompt, mode, ...) 는
        // `config.*` 에 있다. SummaryView 의 단계 카운터는 `turnCount` /
        // `maxTurns` 를 읽으므로 두 위치를 병합해서 넘긴다 — 그렇지 않으면
        // `config.turnCount` 가 항상 undefined 라 카운터가 깨진다 (legacy
        // shape 의 `conversationConfig` 한 객체에 모여있던 필드들과 동등).
        // ai_form_render 는 동일 conversation snapshot 위에 form input
        // overlay 만 추가되는 형태라 같은 hydration 경로를 공유한다.
        const convConfig = isStructured
          ? buildConvConfigFromStructured(raw)
          : (raw.conversationConfig as Record<string, unknown> | undefined);
        pauseForConversation(waitingNode.nodeId, convConfig ?? null);
        if (interactionType === "ai_form_render") {
          // pauseForConversation 이 store 의 waitingInteractionType 을
          // 'ai_conversation' 으로 set 하므로, form-render 케이스에서는
          // 정확한 값으로 override 한다. submitForm dispatch 분기 (use-
          // execution-events.handleExecutionResumed) 가 이 값으로 분기.
          useExecutionStore.setState({
            waitingInteractionType: "ai_form_render",
          });
        }

        // 페이지 재진입 hydration — store.conversationMessages 가 비어있고
        // outputData 에 메시지가 영속되어 있으면 시드한다. WS 경로
        // (`use-execution-events.ts:handleWaitingForInput`) 와 동등.
        // 비어있지 않은 경우엔 덮어쓰지 않아 WS 가 먼저 채운 timeline 보호.
        if (useExecutionStore.getState().conversationMessages.length === 0) {
          const items = parseHistoryMessages(raw);
          if (items.length > 0) {
            setConversationMessages(items);
          }
        }
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
}

/**
 * 같은 waiting 노드 reconcile (early return) 경로에서도 AI 대화 메시지
 * 안전망은 유지한다. store 가 비어있고 영속 outputData 에 messages 가
 * 있으면 시드해, SPA 재진입·WS 재구독 후 store 와 backend 가 어긋난
 * 상태로 timeline 이 영구히 비어 보이는 회귀를 차단한다. form/buttons 는
 * `waitingFormConfig` / `waitingButtonConfig` 단일 객체로 store 가
 * 보존되어 같은 안전망이 필요 없다.
 */
function maybeSeedAiConversationMessages(
  waitingNode: NodeExecutionData | undefined,
): void {
  if (!waitingNode?.outputData) return;
  const { waitingInteractionType, conversationMessages, setConversationMessages } =
    useExecutionStore.getState();
  // ai_conversation (chat) 와 ai_form_render (chat + form input overlay) 둘 다
  // multi-turn timeline 을 가진다 — 둘 다 seed 대상.
  if (
    waitingInteractionType !== "ai_conversation" &&
    waitingInteractionType !== "ai_form_render"
  ) {
    return;
  }
  if (conversationMessages.length > 0) return;
  const items = parseHistoryMessages(waitingNode.outputData);
  if (items.length > 0) {
    setConversationMessages(items);
  }
}

/**
 * Structured envelope (`{config, output:{result:{...}}, meta, status}`) 에서
 * SummaryView 가 기대하는 `conversationConfig` shape 으로 평탄화한다.
 * D6 (2026-05-17) 통일로 multi-turn 대화 상태(`message` / `turnCount` /
 * `maxTurns` / `messages`)는 `output.result.*`, handler 설정 (model, mode,
 * systemPrompt 등)은 `config.*` 에 분리되어 있어, snapshot reconcile 이
 * 두 위치를 병합해야 단계 카운터 등 UI 가 정상 동작한다. handler config
 * 가 base, output.result 가 override (같은 `maxTurns` 가 양쪽에 있을 때
 * runtime 의 실제 값을 우선).
 */
export function buildConvConfigFromStructured(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const handlerConfig =
    (raw.config as Record<string, unknown> | undefined) ?? {};
  const output = raw.output as Record<string, unknown> | undefined;
  const result = output?.result as Record<string, unknown> | undefined;
  if (!result) return { ...handlerConfig };
  const merged: Record<string, unknown> = { ...handlerConfig };
  if (typeof result.message === "string") merged.message = result.message;
  if (typeof result.turnCount === "number") merged.turnCount = result.turnCount;
  if (typeof result.maxTurns === "number") merged.maxTurns = result.maxTurns;
  if (Array.isArray(result.messages)) merged.messages = result.messages;
  return merged;
}

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers (also used by use-execution-events.ts).
// ────────────────────────────────────────────────────────────────────────────

/**
 * NodeExecution 이 사용자 입력 대기 상태인지 — `status` 컬럼과 `outputData.status`
 * 봉투 신호를 **함께** 본다.
 *
 * Backend blocking 노드(carousel/form/AI)는 `executeNode` 가 핸들러 봉투
 * (`outputData.status='waiting_for_input'`)를 먼저 저장하고 `NodeExecution.status`
 * 컬럼은 `running` 으로 둔 뒤, 직후 `waitForXxx` 가 atomic 으로 `waiting_for_input`
 * 전이한다 (spec §전이 원자성). 그 사이 snapshot 이 읽히면 `ne.status==='running'`
 * 인데 `outputData.status==='waiting_for_input'` 인 intra-row inconsistent row 가
 * 도착한다 (backend `executions.service.findById` 가 1차 정규화하지만, WS snapshot·
 * read-replica·legacy 응답 경로에선 여전히 도착 가능). `ne.status` 한 필드만 신뢰하면
 * waiting UI 가 hydrate 되지 않거나(첫 진입), 먼저 도착한 WS waiting 이벤트의 상태가
 * resume 으로 오인돼 wipe 된다 (Carousel disabled stuck 회귀).
 *
 * terminal(completed/failed/skipped/cancelled) row 는 stale 봉투 문자열이
 * 재트리거하지 않도록 제외 — `running`/`pending` 일 때만 봉투 신호를 채택한다.
 */
export function isNodeWaitingForInput(ne: NodeExecutionData): boolean {
  if (ne.status === "waiting_for_input") return true;
  if (ne.status === "running" || ne.status === "pending") {
    return (
      (ne.outputData as { status?: unknown } | null)?.status ===
      "waiting_for_input"
    );
  }
  return false;
}

export function mapNodeStatus(
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

export function getCategoryForType(nodeType: string): string {
  return getNodeDefinition(nodeType)?.category ?? "unknown";
}

/**
 * snapshot reconcile 의 마지막 안전망 — backend 가 envelope `meta.interactionType`
 * 을 빠뜨려도 nodeType 으로 분기를 유추해 store 의 waitingInteractionType 을
 * 정확히 set 한다. 누락 시 page.tsx 의 `isWaitingButtons` 가 false 로 떨어져
 * Preview 탭의 버튼이 콜백 없이 disabled 로 그려지는 회귀가 발생한다.
 */
export function inferInteractionTypeFromNodeType(
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

// Higher priority = more terminal. Prevents stale WS events from overwriting.
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  running: 1,
  waiting_for_input: 2,
  completed: 3,
  failed: 3,
  skipped: 3,
};

export function shouldUpdateStatus(
  current: NodeExecutionStatus | undefined,
  incoming: NodeExecutionStatus,
): boolean {
  if (!current) return true;
  return (STATUS_PRIORITY[incoming] ?? 0) >= (STATUS_PRIORITY[current] ?? 0);
}
