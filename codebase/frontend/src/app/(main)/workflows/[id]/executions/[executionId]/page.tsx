"use client";

import { useState, use, useMemo, useEffect } from "react";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  PauseCircle,
  Clock,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { executionsApi, type ExecutionData, type NodeExecutionData } from "@/lib/api/executions";
import { workflowsApi } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import {
  STATUS_ICON,
  STATUS_BADGE_VARIANT,
  getStatusLabel,
  formatDuration,
} from "@/lib/utils/execution-status";
import { useT, type TranslationKey } from "@/lib/i18n";
import { getNodeDefinition, loadNodeDefinitions } from "@/lib/node-definitions";
import { PresentationContent } from "@/components/editor/run-results/renderers/presentation-renderers";
import { GenericRenderer } from "@/components/editor/run-results/renderers/generic-renderer";
import { ConversationInspector } from "@/components/editor/run-results/conversation-inspector";
import { parseHistoryMessages } from "@/components/editor/run-results/conversation-utils";
import { isConversationOutput } from "@/components/editor/run-results/output-shape";
import { DynamicFormUI } from "@/components/editor/run-results/dynamic-form-ui";
import { ButtonBar } from "@/components/editor/run-results/button-bar";
import { BackgroundRunSection } from "@/components/editor/run-results/background-run-section";
import { extractBackgroundRunId } from "@/components/editor/run-results/result-detail";
import {
  parseButtonConfig,
  openExternalLink,
} from "@/components/editor/run-results/button-config";
import type { NodeResult } from "@/lib/stores/execution-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useExecutionEvents } from "@/lib/websocket/use-execution-events";
import { applyExecutionSnapshot } from "@/lib/websocket/apply-execution-snapshot";
import { useExecutionInteractionCommands } from "@/lib/websocket/use-execution-interaction-commands";

function NodeStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "waiting_for_input":
      return <PauseCircle className="h-4 w-4 text-amber-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function JsonViewer({ data }: { data: unknown }) {
  if (data == null) return <span className="text-[hsl(var(--muted-foreground))]">null</span>;

  const formatted = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed max-h-[400px]">
      <code>{formatted}</code>
    </pre>
  );
}

export default function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string; executionId: string }>;
}) {
  const t = useT();
  const { id: workflowId, executionId } = use(params);
  const router = useRouter();

  // Reset store when switching between executions so stale waiting/conversation
  // state from a previously viewed execution doesn't bleed into this one.
  // The poll loop in useExecutionEvents then repopulates from REST.
  const resetStore = useExecutionStore((s) => s.reset);
  useEffect(() => {
    resetStore();
  }, [executionId, resetStore]);

  useEffect(() => {
    void loadNodeDefinitions();
  }, []);

  // Subscribe to WebSocket events + REST polling so waiting state is
  // hydrated into the store even when the page is opened after the
  // waiting event was emitted.
  useExecutionEvents({ executionId });

  const workflowQuery = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      const { data } = await workflowsApi.get(workflowId);
      return data.data ?? data;
    },
  });

  // useExecutionEvents already polls REST + subscribes over WebSocket and
  // hydrates the store. The summary card/node list are driven by this
  // one-shot query plus React Query's cache invalidation on completion.
  const executionQuery = useQuery<ExecutionData>({
    queryKey: ["execution", executionId],
    queryFn: () => executionsApi.getById(executionId),
    refetchInterval: (query) => {
      // Refresh summary data while the execution is mid-flight. Polling stops
      // once a terminal status is reached; `waiting_for_input` continues to
      // poll so the summary card reflects the resumed run in real time.
      const status = query.state.data?.status;
      if (!status) return 2000;
      return status === "completed" ||
        status === "failed" ||
        status === "cancelled"
        ? false
        : 2000;
    },
  });

  // REST → store bridge (Carousel buttons-disabled stuck 버그 fix).
  //
  // 이전: executionQuery.data 는 summary card / node list 표시용으로만
  // 사용되고 useExecutionStore 와 분리. WS 가 끊기면 store 의 waiting state
  // (waitingNodeId / waitingInteractionType) 가 영영 update 안 되어
  // Preview 탭 buttons 가 disabled stuck.
  //
  // 변경: REST 폴링 결과도 같은 applyExecutionSnapshot 으로 store 에
  // hydrate. WS 가 정상 동작하면 양쪽이 동일 state 를 set (idempotent),
  // WS 가 실패하면 REST 가 fallback (2s 마다 store 갱신).
  useEffect(() => {
    if (executionQuery.data) {
      applyExecutionSnapshot(executionQuery.data);
    }
  }, [executionQuery.data]);

  // Fetch adjacent executions for prev/next navigation
  const adjacentQuery = useQuery({
    queryKey: ["executions-adjacent", workflowId, executionId],
    queryFn: async () => {
      const responseData = await executionsApi.getByWorkflow(workflowId, {
        limit: 100,
        sort: "started_at",
        order: "desc",
      });
      const items = responseData.data ?? [];
      const currentIndex = items.findIndex(
        (e: { id: string }) => e.id === executionId,
      );
      if (currentIndex === -1) return { prev: null, next: null };
      return {
        prev: currentIndex < items.length - 1 ? items[currentIndex + 1]?.id : null,
        next: currentIndex > 0 ? items[currentIndex - 1]?.id : null,
      };
    },
  });

  const execution = executionQuery.data;

  const nodeExecutions = execution?.nodeExecutions;

  const sortedNodeExecutions = useMemo(() => {
    if (!nodeExecutions) return [];
    return [...nodeExecutions]
      .filter((ne) => ne.status !== "skipped")
      .sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
      );
  }, [nodeExecutions]);

  const completedCount = sortedNodeExecutions.filter(
    (ne) => ne.status === "completed",
  ).length;
  const failedCount = sortedNodeExecutions.filter(
    (ne) => ne.status === "failed",
  ).length;
  const totalCount = sortedNodeExecutions.length;

  if (executionQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />
        <div className="h-32 animate-pulse rounded bg-[hsl(var(--muted))]" />
        <div className="h-64 animate-pulse rounded bg-[hsl(var(--muted))]" />
      </div>
    );
  }

  if (executionQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
        <p>{t("executions.loadDetailFailed")}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/workflows/${workflowId}/executions`)}
        >
          {t("executions.backToExecutions")}
        </Button>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
        <p>{t("executions.executionNotFound")}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/workflows/${workflowId}/executions`)}
        >
          {t("executions.backToExecutions")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              router.push(`/workflows/${workflowId}/executions`)
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {t("executions.detailHeader", {
              name: workflowQuery.data?.name ?? t("executions.defaultName"),
            })}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacentQuery.data?.prev}
            onClick={() =>
              adjacentQuery.data?.prev &&
              router.push(
                `/workflows/${workflowId}/executions/${adjacentQuery.data.prev}`,
              )
            }
          >
            <ChevronLeftIcon className="mr-1 h-4 w-4" />
            {t("executions.prev")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacentQuery.data?.next}
            onClick={() =>
              adjacentQuery.data?.next &&
              router.push(
                `/workflows/${workflowId}/executions/${adjacentQuery.data.next}`,
              )
            }
          >
            {t("executions.nextBtn")}
            <ChevronRightIcon className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <div
        className={cn(
          "rounded-lg border p-4",
          execution.status === "failed"
            ? "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/0.05]"
            : "border-[hsl(var(--border))]",
        )}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">{STATUS_ICON[execution.status] ?? "\u2753"}</span>
          <Badge variant={STATUS_BADGE_VARIANT[execution.status] ?? "outline"} className="text-sm">
            {getStatusLabel(execution.status)}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">{t("executions.summaryStarted")}</span>
            <p className="font-medium">{formatDate(execution.startedAt, "datetime")}</p>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">{t("executions.summaryFinished")}</span>
            <p className="font-medium">
              {execution.finishedAt
                ? formatDate(execution.finishedAt, "datetime")
                : "\u2014"}
            </p>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">{t("executions.summaryDuration")}</span>
            <p className="font-medium">{formatDuration(execution.durationMs)}</p>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">{t("executions.summaryNodes")}</span>
            <p className="font-medium">
              {t("executions.completedSummary", { completed: completedCount, total: totalCount })}
              {failedCount > 0 && (
                <span className="text-[hsl(var(--destructive))]">
                  {t("executions.failedSuffix", { count: failedCount })}
                </span>
              )}
            </p>
          </div>
        </div>
        {execution.status === "failed" && execution.error?.message && (
          <div className="mt-3 rounded-md bg-[hsl(var(--destructive))/0.1] p-3 text-sm text-[hsl(var(--destructive))]">
            <strong>{t("executions.errorHeading")}</strong> {execution.error.message}
          </div>
        )}
      </div>

      {/* Node Results */}
      <NodeResultsTab
        executionId={executionId}
        nodeExecutions={sortedNodeExecutions}
      />
    </div>
  );
}

type DetailTab = "preview" | "input" | "output" | "error";

function toNodeResult(ne: NodeExecutionData): NodeResult {
  const def = getNodeDefinition(ne.node?.type ?? "");
  return {
    nodeId: ne.nodeId,
    nodeLabel: ne.node?.label ?? ne.nodeId,
    nodeType: ne.node?.type ?? "",
    nodeCategory: def?.category ?? "unknown",
    status: ne.status,
    duration: ne.durationMs ?? undefined,
    error: ne.error?.message,
    outputData: ne.outputData,
  };
}

function NodeResultsTab({
  executionId,
  nodeExecutions,
}: {
  executionId: string;
  nodeExecutions: NodeExecutionData[];
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeDetailTab, setNodeDetailTab] = useState<DetailTab>("preview");
  // Tracks which conversation message (if any) the user drilled into via
  // Preview. `null` = node-level view (whole conversation).
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null);
  // Tracks which waitingNodeId we've already auto-selected, so changes to the
  // waiting node (e.g. after resumption into a new waiting node) move the
  // selection once without fighting manual clicks.
  const [lastAutoSelectedWaiting, setLastAutoSelectedWaiting] =
    useState<string | null>(null);

  // Waiting-state selectors — populated by useExecutionEvents when the
  // execution (live or already persisted) is in `waiting_for_input`.
  const waitingNodeId = useExecutionStore((s) => s.waitingNodeId);
  const waitingInteractionType = useExecutionStore(
    (s) => s.waitingInteractionType,
  );
  const waitingFormConfig = useExecutionStore((s) => s.waitingFormConfig);
  const waitingButtonConfig = useExecutionStore((s) => s.waitingButtonConfig);
  const waitingConversationConfig = useExecutionStore(
    (s) => s.waitingConversationConfig,
  );
  // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + spec §12.5 — `ai_form_render`
  // 의 활성 form 식별자. assistant turn 의 `presentations[*].form` 중 본
  // toolCallId 와 일치하는 항목만 interactive `DynamicFormUI` 로 렌더 (별도
  // surface stack 아님 — ConversationInspector 안에서 단일).
  const pendingFormToolCallId =
    waitingInteractionType === "ai_form_render"
      ? ((waitingConversationConfig as
          | { pendingFormToolCall?: { toolCallId?: string } | null }
          | null)?.pendingFormToolCall?.toolCallId ?? null)
      : null;
  const conversationMessages = useExecutionStore((s) => s.conversationMessages);
  const isWaitingAiResponse = useExecutionStore((s) => s.isWaitingAiResponse);
  const resumeFromForm = useExecutionStore((s) => s.resumeFromForm);
  const resumeFromAiRenderForm = useExecutionStore(
    (s) => s.resumeFromAiRenderForm,
  );
  const resumeFromButtons = useExecutionStore((s) => s.resumeFromButtons);
  const resumeFromConversation = useExecutionStore(
    (s) => s.resumeFromConversation,
  );

  const commands = useExecutionInteractionCommands(executionId);

  // Derived-state pattern (not an effect): when a newly-surfaced waiting node
  // differs from the one we previously auto-selected, move the selection once.
  // The user can still click away freely afterwards.
  if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
    setLastAutoSelectedWaiting(waitingNodeId);
    setSelectedNodeId(waitingNodeId);
    setNodeDetailTab("preview");
  }

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodeExecutions.find((ne) => ne.nodeId === selectedNodeId) ?? null;
  }, [selectedNodeId, nodeExecutions]);

  const selectedNodeResult = useMemo(() => {
    if (!selectedNode) return null;
    return toNodeResult(selectedNode);
  }, [selectedNode]);

  const isSelectedWaiting =
    !!waitingNodeId && selectedNodeId === waitingNodeId;
  // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + spec §12.5 — 그래프 Form 노드
  // (`interactionType: 'form'`) 한정으로 축소. `ai_form_render` 의 활성 form 은
  // ConversationInspector 안 timeline 인라인 (AssistantPresentationsBlock case
  // "form" active 분기) 으로 그려진다.
  const isWaitingForm =
    isSelectedWaiting && waitingInteractionType === "form";
  const isWaitingButtons =
    isSelectedWaiting && waitingInteractionType === "buttons";
  const isWaitingConversation =
    isSelectedWaiting &&
    (waitingInteractionType === "ai_conversation" ||
      waitingInteractionType === "ai_form_render");

  const handleFormSubmit = (data: Record<string, unknown>) => {
    commands.submitForm(data);
    resumeFromForm();
  };

  // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — AI Agent render_form 제출.
  // multi-turn 컨텍스트 보존 (spec §9.7.1 + Inv-7) — `pendingFormToolCall` 만
  // nested null patch, 나머지 affordance 보존.
  const handleAiRenderFormSubmit = (data: Record<string, unknown>) => {
    commands.submitForm(data);
    resumeFromAiRenderForm();
  };

  const handlePortButtonClick = (buttonId: string) => {
    commands.clickButton(buttonId);
    resumeFromButtons();
  };

  const handleContinueClick = () => {
    commands.clickContinue();
    resumeFromButtons();
  };

  const handleLinkButtonClick = (url: string) => {
    openExternalLink(url);
  };

  const handleSendMessage = (message: string) => {
    if (!selectedNode) return;
    commands.sendMessage(selectedNode.nodeId, message);
  };

  const handleEndConversation = () => {
    if (!selectedNode) return;
    commands.endConversation(selectedNode.nodeId);
    resumeFromConversation();
  };

  const t = useT();

  if (!nodeExecutions.length) {
    return (
      <p className="py-8 text-center text-[hsl(var(--muted-foreground))]">
        {t("executions.noNodeExecutions")}
      </p>
    );
  }

  const isPresentation = selectedNodeResult?.nodeCategory === "presentation";
  // Detect any conversation-shaped output (AI Agent or Information Extractor)
  // — used to render the conversation view inside the Preview tab while the
  // Output tab still shows the raw produced value.
  //
  // Fallback (PR #273 follow-up): isConversationOutput 가 false 반환해도
  // nodeType ∈ {ai_agent, information_extractor} 면 conversation 으로 간주.
  // 실행 내역 페이지에서 envelope shape 가 sparse 한 케이스에서도 Preview
  // 탭에 ConversationInspector 가 그려지도록 보장 (사용자 보고: 실행 내역
  // 보기 timeline 누락 회귀). isMultiTurnConversation 와 동일 정책 유지로
  // 두 surface 의 분기 일관성 확보.
  const selectedNodeType = selectedNode?.node?.type;
  const looksLikeConversationNode =
    selectedNodeType === "ai_agent" ||
    selectedNodeType === "information_extractor";
  const isCompletedConversation =
    !isWaitingConversation &&
    (isConversationOutput(selectedNode?.outputData) ||
      looksLikeConversationNode);

  // Preview tab should also render when the selected node is waiting for
  // input — even if outputData is null the page must show the interactive UI.
  const hasPreview = !!selectedNode?.outputData || isSelectedWaiting;

  const detailTabs: { id: DetailTab; labelKey: TranslationKey; show: boolean }[] = [
    { id: "preview", labelKey: "executions.tabPreview", show: hasPreview },
    { id: "input", labelKey: "executions.tabInput", show: true },
    { id: "output", labelKey: "executions.tabOutput", show: true },
    { id: "error", labelKey: "executions.tabError", show: !!selectedNode?.error },
  ];

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Left: Node List */}
      <div className="w-[240px] shrink-0 rounded-md border border-[hsl(var(--border))] overflow-y-auto">
        <div className="px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
          {t("executions.nodesPanelTitle")}
        </div>
        {nodeExecutions.map((ne) => (
          <button
            key={ne.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              selectedNodeId === ne.nodeId
                ? "bg-[hsl(var(--accent))]"
                : "hover:bg-[hsl(var(--accent))/0.5]",
            )}
            onClick={() => {
              setSelectedNodeId(ne.nodeId);
              setNodeDetailTab(
                ne.error ? "error" : (ne.outputData || ne.nodeId === waitingNodeId) ? "preview" : "output",
              );
            }}
          >
            <NodeStatusIcon status={ne.status} />
            <span className="flex-1 truncate">
              {ne.node?.label ?? ne.nodeId}
            </span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {formatDuration(ne.durationMs)}
            </span>
          </button>
        ))}
      </div>

      {/* Right: Node Detail */}
      <div className="flex-1 rounded-md border border-[hsl(var(--border))] overflow-hidden">
        {!selectedNode ? (
          <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
            Select a node to view details
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Node header */}
            <div className="border-b border-[hsl(var(--border))] px-4 py-3">
              <div className="flex items-center gap-2">
                <NodeStatusIcon status={selectedNode.status} />
                <span className="font-medium">
                  {selectedNode.node?.label ?? selectedNode.nodeId}
                </span>
                {selectedNode.node?.type && (
                  <Badge variant="outline" className="text-xs">
                    {selectedNode.node.type}
                  </Badge>
                )}
                <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                  {formatDuration(selectedNode.durationMs)}
                </span>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-[hsl(var(--border))] px-4">
              {detailTabs
                .filter((tab) => tab.show)
                .map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "py-2 text-xs font-medium transition-colors",
                      nodeDetailTab === tab.id
                        ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                    )}
                    onClick={() => setNodeDetailTab(tab.id)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {nodeDetailTab === "preview" && selectedNodeResult && (
                isWaitingConversation ? (
                  // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + spec §12.5 —
                  // `ai_form_render` 의 활성 form 은 ConversationInspector 안
                  // timeline 아이템 (assistant turn 의 `presentations[*].form`
                  // payload, AssistantPresentationsBlock case "form" active
                  // 분기) 으로 그려진다. pendingFormToolCallId / onSubmitForm
                  // 을 prop drill 하여 active toolCallId 매칭 시 interactive
                  // `DynamicFormUI` 렌더.
                  <ConversationInspector
                    result={selectedNodeResult}
                    conversationMessages={conversationMessages}
                    selectedItemIndex={selectedMsgIndex}
                    isLive={true}
                    isWaitingAiResponse={isWaitingAiResponse}
                    conversationConfig={waitingConversationConfig}
                    onSendMessage={handleSendMessage}
                    onEndConversation={handleEndConversation}
                    onSelectMessage={setSelectedMsgIndex}
                    onBackToConversation={() => setSelectedMsgIndex(null)}
                    pendingFormToolCallId={pendingFormToolCallId}
                    onSubmitForm={handleAiRenderFormSubmit}
                  />
                ) : isWaitingForm && waitingFormConfig ? (
                  // 그래프 Form 노드 (`interactionType: 'form'`) 의 standalone
                  // form. `waitingFormConfig` 는 WS 이벤트마다 새 객체 참조로
                  // 재계산되지만 `key={waitingNodeId}` 가 같으면 mount 유지 →
                  // 입력 보존 (spec/4-nodes/6-presentation/0-common.md
                  // §Rationale form option/state 안정화).
                  <DynamicFormUI
                    key={waitingNodeId ?? "no-waiting-node"}
                    formConfig={waitingFormConfig as Record<string, unknown>}
                    onSubmit={handleFormSubmit}
                  />
                ) : isWaitingButtons ? (
                  isPresentation ? (
                    <PresentationContent
                      result={selectedNodeResult}
                      onPortButtonClick={handlePortButtonClick}
                      onLinkButtonClick={handleLinkButtonClick}
                      previewOnly
                    />
                  ) : (() => {
                    const parsed = parseButtonConfig(waitingButtonConfig);
                    if (!parsed) return null;
                    return (
                      <ButtonBar
                        buttons={parsed.buttons}
                        onPortButtonClick={handlePortButtonClick}
                        onLinkButtonClick={handleLinkButtonClick}
                        onContinueClick={handleContinueClick}
                      />
                    );
                  })()
                ) : isCompletedConversation ? (
                  <ConversationInspector
                    result={selectedNodeResult}
                    conversationMessages={parseHistoryMessages(selectedNode?.outputData)}
                    selectedItemIndex={selectedMsgIndex}
                    isLive={false}
                    isWaitingAiResponse={false}
                    conversationConfig={null}
                    onSendMessage={() => {}}
                    onEndConversation={() => {}}
                    onSelectMessage={setSelectedMsgIndex}
                    onBackToConversation={() => setSelectedMsgIndex(null)}
                  />
                ) : isPresentation ? (
                  <PresentationContent result={selectedNodeResult} previewOnly />
                ) : (
                  <GenericRenderer result={selectedNodeResult} previewOnly />
                )
              )}
              {nodeDetailTab === "input" && (
                <JsonViewer data={selectedNode.inputData} />
              )}
              {nodeDetailTab === "output" && (
                <JsonViewer data={selectedNode.outputData} />
              )}
              {nodeDetailTab === "error" && (
                <JsonViewer data={selectedNode.error} />
              )}
              {selectedNode.node?.type === "background" &&
                extractBackgroundRunId(selectedNode.outputData) && (
                  <BackgroundRunSection
                    executionId={executionId}
                    backgroundRunId={extractBackgroundRunId(
                      selectedNode.outputData,
                    )}
                  />
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
