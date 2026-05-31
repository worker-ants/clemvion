import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useExecutionStore, selectPendingFormToolCallId } from "@/lib/stores/execution-store";
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  PauseCircle,
  GripHorizontal,
  History,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultTimeline } from "./result-timeline";
import { ResultDetail } from "./result-detail";
import { useT } from "@/lib/i18n";
import { ReRunModal } from "@/components/executions/rerun-modal";
import { canReRun } from "@/lib/executions/can-rerun";
import { executionsApi } from "@/lib/api/executions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { selectCurrentRole, useWorkspaceStore } from "@/lib/stores/workspace-store";

const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 240;
const MAX_HEIGHT_RATIO = 0.6; // 60% of viewport
const STORAGE_KEY = "run-results-height";

const DEFAULT_TIMELINE_WIDTH = 400;
const MIN_TIMELINE_WIDTH = 280;
const MAX_TIMELINE_WIDTH = 640;
const TIMELINE_WIDTH_STORAGE_KEY = "run-results-timeline-width";

function getStoredHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      // Clamp instead of discarding — when MIN_HEIGHT is raised (as here),
      // existing users' stored preference would otherwise silently reset
      // to DEFAULT_HEIGHT on first load.
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
      return Math.max(MIN_HEIGHT, Math.min(maxHeight, parsed));
    }
  }
  return DEFAULT_HEIGHT;
}

function getStoredTimelineWidth(): number {
  if (typeof window === "undefined") return DEFAULT_TIMELINE_WIDTH;
  const stored = localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (
      !Number.isNaN(parsed) &&
      Number.isFinite(parsed) &&
      parsed >= MIN_TIMELINE_WIDTH &&
      parsed <= MAX_TIMELINE_WIDTH
    ) {
      return parsed;
    }
  }
  return DEFAULT_TIMELINE_WIDTH;
}

export function RunResultsDrawer() {
  const t = useT();
  const params = useParams();
  const workflowId = params?.id as string | undefined;
  const [expanded, setExpanded] = useState(true);
  const [panelHeight, setPanelHeight] = useState(getStoredHeight);
  const [timelineWidth, setTimelineWidth] = useState(getStoredTimelineWidth);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeightRef = useRef(panelHeight);
  const isDraggingWidth = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const currentWidthRef = useRef(timelineWidth);

  useEffect(() => {
    currentWidthRef.current = timelineWidth;
  }, [timelineWidth]);

  // Keep ref in sync with state
  useEffect(() => {
    currentHeightRef.current = panelHeight;
  }, [panelHeight]);

  const status = useExecutionStore((s) => s.status);
  const executionId = useExecutionStore((s) => s.executionId);
  const startedAt = useExecutionStore((s) => s.startedAt);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const nodeResults = useExecutionStore((s) => s.nodeResults);
  const waitingNodeId = useExecutionStore((s) => s.waitingNodeId);
  const waitingFormConfig = useExecutionStore((s) => s.waitingFormConfig);
  const selectedResultNodeId = useExecutionStore(
    (s) => s.selectedResultNodeId,
  );
  const selectResultNode = useExecutionStore((s) => s.selectResultNode);
  const waitingInteractionType = useExecutionStore(
    (s) => s.waitingInteractionType,
  );
  const waitingButtonConfig = useExecutionStore((s) => s.waitingButtonConfig);
  const waitingConversationConfig = useExecutionStore(
    (s) => s.waitingConversationConfig,
  );
  const conversationMessages = useExecutionStore(
    (s) => s.conversationMessages,
  );
  const isWaitingAiResponse = useExecutionStore(
    (s) => s.isWaitingAiResponse,
  );
  const selectedConversationItemIndex = useExecutionStore(
    (s) => s.selectedConversationItemIndex,
  );
  const selectConversationItem = useExecutionStore(
    (s) => s.selectConversationItem,
  );
  const reset = useExecutionStore((s) => s.reset);
  const resumeFromForm = useExecutionStore((s) => s.resumeFromForm);
  const resumeFromAiRenderForm = useExecutionStore(
    (s) => s.resumeFromAiRenderForm,
  );
  const resumeFromButtons = useExecutionStore((s) => s.resumeFromButtons);
  const resumeFromConversation = useExecutionStore(
    (s) => s.resumeFromConversation,
  );
  // spec §6.1.d.ii — `ai_form_render` 의 pending form 식별자. assistant turn
  // 의 `presentations[*].form` payload 중 본 toolCallId 와 일치하는 항목만
  // interactive `DynamicFormUI` 로 렌더된다. `null` 이면 모든 form payload 가
  // display-only `FormSubmittedContent`. 早期 return 이전에 hook 을 호출해야
  // Rules of Hooks 를 준수한다.
  const pendingFormToolCallId = useExecutionStore(selectPendingFormToolCallId);

  // Re-run 진입점 (spec/5-system/13-replay-rerun.md §10.1). 드로어에서는 권한
  // 미충족 시 버튼을 hidden (disabled 아님) — 워크플로 작성 중 컨텍스트라 노이즈
  // 를 줄인다.
  const [rerunOpen, setRerunOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const currentRole = useWorkspaceStore(selectCurrentRole);

  // 현재 실행의 상세 — `executedBy`(권한 판정) / `inputData`(모달 default) 에
  // 필요. 실행이 idle 이 아닐 때만 조회하고, 상세 페이지와 같은 query key 로
  // 캐시를 공유한다.
  const detailQuery = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () => executionsApi.getById(executionId as string),
    enabled: !!executionId,
  });
  const detail = detailQuery.data;
  const allowReRun = canReRun(
    { id: currentUserId, role: currentRole },
    { executedBy: detail?.executedBy ?? null },
  );

  // Auto-selection of blocking nodes is handled directly in store actions
  // (pauseForForm, pauseForButtons, pauseForConversation set selectedResultNodeId atomically)

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = currentHeightRef.current;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleWidthMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingWidth.current = true;
    startX.current = e.clientX;
    startWidth.current = currentWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const diff = startY.current - e.clientY;
        const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
        const newHeight = Math.max(
          MIN_HEIGHT,
          Math.min(maxHeight, startHeight.current + diff),
        );
        setPanelHeight(newHeight);
      }
      if (isDraggingWidth.current) {
        const diff = e.clientX - startX.current;
        const newWidth = Math.max(
          MIN_TIMELINE_WIDTH,
          Math.min(MAX_TIMELINE_WIDTH, startWidth.current + diff),
        );
        setTimelineWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(STORAGE_KEY, String(currentHeightRef.current));
      }
      if (isDraggingWidth.current) {
        isDraggingWidth.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(
          TIMELINE_WIDTH_STORAGE_KEY,
          String(currentWidthRef.current),
        );
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (isDragging.current || isDraggingWidth.current) {
        isDragging.current = false;
        isDraggingWidth.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, []);

  // Filter out skipped nodes from results timeline
  const visibleResults = useMemo(
    () => nodeResults.filter((r) => r.status !== "skipped"),
    [nodeResults],
  );

  if (status === "idle") return null;

  const completedNodes = Array.from(nodeStatuses.entries()).filter(
    ([key, info]) => key !== "__execution__" && info.status !== "skipped",
  );
  const totalNodes = completedNodes.length;
  const completedCount = completedNodes.filter(
    ([, info]) => info.status === "completed",
  ).length;
  const failedCount = completedNodes.filter(
    ([, info]) => info.status === "failed",
  ).length;

  const statusIcon =
    status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    ) : status === "completed" ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : status === "failed" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : status === "waiting_for_input" ? (
      <PauseCircle className="h-4 w-4 text-amber-500" />
    ) : (
      <Loader2 className="h-4 w-4" />
    );

  const statusLabel =
    status === "running"
      ? t("editor.statusRunningEllipsis")
      : status === "completed"
        ? t("editor.statusCompleted")
        : status === "failed"
          ? t("editor.statusFailedLabel")
          : status === "waiting_for_input"
            ? waitingInteractionType === "ai_conversation"
              ? t("editor.statusConversing")
              : t("editor.statusWaitingInput")
            : t("editor.statusExecutionFallback");

  // Selection id is the per-iteration id (nodeExecutionId) when available so
  // each Loop/Map iteration of the same node can be inspected separately,
  // falling back to nodeId for legacy entries that lack an execution id.
  const selectedResult =
    nodeResults.find((r) =>
      r.nodeExecutionId
        ? r.nodeExecutionId === selectedResultNodeId
        : r.nodeId === selectedResultNodeId,
    ) ?? null;

  // `waitingNodeId` tracks the logical node id (stable per node) while
  // `selectedResultNodeId` may hold a per-iteration nodeExecutionId. Resolve
  // the selected result back to its nodeId before comparing so the preview
  // tab's "waiting for input" branches (form/buttons/conversation) still
  // activate after the recent iteration-aware selection changes.
  const isSelectedWaiting =
    status === "waiting_for_input" &&
    waitingNodeId != null &&
    (selectedResult?.nodeId === waitingNodeId ||
      selectedResultNodeId === waitingNodeId);

  // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + spec §12.5 — `ai_form_render`
  // 의 활성 form 의 UI 단일 진실은 assistant turn 의 timeline 인라인이다
  // (ConversationInspector 안 AssistantPresentationsBlock 의 case "form" active
  // 분기). 따라서 `isWaitingForm` 은 그래프 Form 노드 (`interactionType: 'form'`)
  // 한정으로 축소 — `ai_form_render` 는 `isWaitingConversation` 만 true 이며
  // 별도 DynamicFormUI stack 을 만들지 않는다.
  const isWaitingForm =
    isSelectedWaiting && waitingInteractionType === "form";
  const isWaitingButtons =
    isSelectedWaiting && waitingInteractionType === "buttons";
  const isWaitingConversation =
    isSelectedWaiting &&
    (waitingInteractionType === "ai_conversation" ||
      waitingInteractionType === "ai_form_render");
  const isLiveConversation =
    status === "waiting_for_input" &&
    (waitingInteractionType === "ai_conversation" ||
      waitingInteractionType === "ai_form_render");
  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Resize handle */}
      {expanded && (
        <div
          onMouseDown={handleMouseDown}
          className="flex h-1.5 cursor-row-resize items-center justify-center hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <GripHorizontal className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {/* Header bar */}
      <div className="flex h-9 items-center justify-between px-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          {/* statusIcon 은 장식 — SR 은 텍스트 statusLabel 만 듣게 한다. */}
          <span aria-hidden="true">{statusIcon}</span>
          {/* role="status" + aria-live="polite" 로 실행 상태 변경(running →
              completed → failed 등) 을 스크린 리더가 announce. 노드 카운트
              span 은 빈번 업데이트로 announce 폭증 위험이 있어 aria-live
              영역 밖으로 분리 (review I-5). */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-sm font-medium"
          >
            {statusLabel}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {t("editor.nodesCount", { completed: completedCount, total: totalNodes })}
            {failedCount > 0 && t("editor.failedParen", { count: failedCount })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {workflowId && (
            <a
              href={`/workflows/${workflowId}/executions`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <History className="h-3 w-3" />
              {t("editor.allExecutions")}
            </a>
          )}
          {/* Re-run (spec §10.1) — 권한 미충족 시 hidden. */}
          {allowReRun && executionId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => setRerunOpen(true)}
            >
              <RotateCcw className="h-3 w-3" />
              {t("history.actions.rerun")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={reset}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Two-column content */}
      {expanded && (
        <div className="flex" style={{ height: panelHeight }}>
          {/* Left: Timeline */}
          <div
            className="shrink-0 overflow-hidden"
            style={{ width: timelineWidth }}
          >
            {visibleResults.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
                {status === "running"
                  ? t("editor.waitingForNodes")
                  : t("editor.noNodesExecuted")}
              </div>
            ) : (
              <ResultTimeline
                results={visibleResults}
                selectedId={selectedResultNodeId}
                onSelect={selectResultNode}
                conversationMessages={conversationMessages}
                selectedConversationItemIndex={selectedConversationItemIndex}
                onSelectConversationItem={selectConversationItem}
                isLiveConversation={isLiveConversation}
              />
            )}
          </div>

          {/* Vertical resizer between Timeline and Detail. Styled minimal so
              it doesn't steal focus — hover shows the accent bar. */}
          <div
            onMouseDown={handleWidthMouseDown}
            className="w-1 shrink-0 cursor-col-resize bg-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors"
            aria-label={t("editor.resizeTimelinePanel")}
          />

          {/* Right: Detail */}
          <div className="flex-1 overflow-hidden">
            <ResultDetail
              result={selectedResult}
              isWaitingForm={isWaitingForm}
              formConfig={waitingFormConfig}
              isWaitingButtons={isWaitingButtons}
              buttonConfig={waitingButtonConfig}
              isWaitingConversation={isWaitingConversation}
              conversationConfig={waitingConversationConfig}
              conversationMessages={conversationMessages}
              selectedConversationItemIndex={selectedConversationItemIndex}
              isWaitingAiResponse={isWaitingAiResponse}
              executionId={executionId}
              onFormSubmit={resumeFromForm}
              onAiRenderFormSubmit={resumeFromAiRenderForm}
              pendingFormToolCallId={pendingFormToolCallId}
              onButtonClick={resumeFromButtons}
              onConversationEnd={resumeFromConversation}
              onSelectConversationItem={selectConversationItem}
            />
          </div>
        </div>
      )}

      {/* Re-run 모달 (spec §10.2). 상세 페이지와 동일 컴포넌트를 공유한다. */}
      {executionId && (
        <ReRunModal
          original={{
            id: executionId,
            workflowId: (workflowId as string) ?? detail?.workflowId ?? "",
            status: detail?.status ?? "running",
            startedAt: detail?.startedAt ?? startedAt ?? "",
            inputData: detail?.inputData,
          }}
          open={rerunOpen}
          onClose={() => setRerunOpen(false)}
        />
      )}
    </div>
  );
}
