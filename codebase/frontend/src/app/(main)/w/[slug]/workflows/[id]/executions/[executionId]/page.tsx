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
import {
  executionsApi,
  type ExecutionData,
  type ExecutionChainItem,
  type NodeExecutionData,
} from "@/lib/api/executions";
import { workflowsApi } from "@/lib/api/workflows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RotateCcw, ChevronDown as ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { ReRunModal } from "@/components/executions/rerun-modal";
import { canReRun } from "@/lib/executions/can-rerun";
import { useAuthStore } from "@/lib/stores/auth-store";
import { selectCurrentRole, useWorkspaceStore } from "@/lib/stores/workspace-store";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import {
  STATUS_ICON,
  STATUS_BADGE_VARIANT,
  getStatusLabel,
  formatDuration,
} from "@/lib/utils/execution-status";
import { useT } from "@/lib/i18n";
import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug";
import { buildExecutionHref } from "@/lib/workspace/href";
import { getNodeDefinition, loadNodeDefinitions } from "@/lib/node-definitions";
// V-05 — 실행 상세 노드 패널은 에디터 run-results 의 ResultDetail 을 그대로 재사용해
// Preview/Input/Output/Config/LLM Usage/Response/Request/References/Error 서브탭과
// live waiting 상호작용(내부 useExecutionInteractionCommands)을 한 컴포넌트로 통일한다
// (spec/2-navigation/14-execution-history.md §3.3/§3.4).
import { ResultDetail } from "@/components/editor/run-results/result-detail";
import { useResultDetailWaiting } from "@/components/editor/run-results/use-result-detail-waiting";
import type { NodeResult } from "@/lib/stores/execution-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useExecutionEvents } from "@/lib/websocket/use-execution-events";
import { applyExecutionSnapshot } from "@/lib/websocket/apply-execution-snapshot";

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

export default function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string; executionId: string }>;
}) {
  const t = useT();
  const slug = useWorkspaceSlug();
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

  // Re-run 진입점 (spec/5-system/13-replay-rerun.md §10.1 / §10.3).
  const [rerunOpen, setRerunOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const currentRole = useWorkspaceStore(selectCurrentRole);
  const allowReRun = canReRun(
    { id: currentUserId, role: currentRole },
    { executedBy: execution?.executedBy ?? null },
  );

  // Re-run chain (spec §8.2). re-run 이거나 본 실행이 chain root 일 수 있으므로
  // 항상 조회하되, 단일 실행(길이 1)이면 badge/dropdown 둘 다 숨긴다.
  const chainQuery = useQuery<ExecutionChainItem[]>({
    queryKey: ["execution-chain", executionId],
    queryFn: () => executionsApi.getChain(executionId),
  });
  const chain = useMemo(() => chainQuery.data ?? [], [chainQuery.data]);

  // chain "n" — started_at ASC chain 에서 root(reRunOf==null) 를 제외한 재실행
  // 목록 중 본 실행의 1-based 위치. (chain 은 백엔드가 ASC 정렬해 반환하지만
  // 방어적으로 다시 정렬한다.)
  const sortedChain = useMemo(
    () =>
      [...chain].sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
      ),
    [chain],
  );
  const chainIndex = useMemo(() => {
    // root(reRunOf==null) 는 "원본" 이므로 n 계산에서 제외하고, 남은 재실행만
    // started_at ASC 로 셈한다. 첫 재실행이 n=1 이 되도록 findIndex(0-based) 에
    // +1 한다. 본 실행이 재실행 목록에 없으면(=root) null → badge 미표시.
    const reRuns = sortedChain.filter((e) => e.reRunOf != null);
    const pos = reRuns.findIndex((e) => e.id === executionId);
    return pos >= 0 ? pos + 1 : null;
  }, [sortedChain, executionId]);

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
          onClick={() => router.push(buildExecutionHref(slug, workflowId))}
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
          onClick={() => router.push(buildExecutionHref(slug, workflowId))}
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
              router.push(buildExecutionHref(slug, workflowId))
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
                buildExecutionHref(slug, workflowId, adjacentQuery.data.prev),
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
                buildExecutionHref(slug, workflowId, adjacentQuery.data.next),
              )
            }
          >
            {t("executions.nextBtn")}
            <ChevronRightIcon className="ml-1 h-4 w-4" />
          </Button>
          {/* Re-run 진입점 (spec §10.1) — 권한 미충족 시 disabled + tooltip. */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span wrapper: disabled button 은 hover 이벤트를 발생시키지
                    않아 tooltip 이 안 뜨므로 감싼다. */}
                <span className="inline-flex">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!allowReRun}
                    onClick={() => setRerunOpen(true)}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    {t("history.actions.rerun")}
                  </Button>
                </span>
              </TooltipTrigger>
              {!allowReRun && (
                <TooltipContent>
                  {t("history.rerun.permissionDenied")}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
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

        {/* Chain 표시 (spec §10.3) — re-run 이거나 chain 길이 ≥2 일 때. */}
        {(execution.reRunOf != null || chain.length >= 2) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3 text-sm">
            {execution.reRunOf != null && (
              <>
                <Badge variant="outline" className="font-mono">
                  📎 {t("history.rerun.chainBadge", { n: chainIndex ?? 1 })}
                  {execution.dryRun &&
                    ` · ${t("history.rerun.chainBadgeDryRun")}`}
                </Badge>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {t("history.rerun.chainOrigin")}:{" "}
                  <Link
                    href={buildExecutionHref(slug, workflowId, execution.reRunOf)}
                    className="font-mono text-[hsl(var(--primary))] hover:underline"
                  >
                    #{execution.reRunOf}
                  </Link>
                </span>
              </>
            )}
            {chain.length >= 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    {t("history.rerun.viewChain", { count: chain.length })}
                    <ChevronDownIcon className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-w-[20rem]">
                  {sortedChain.map((item) => (
                    <DropdownMenuItem key={item.id} asChild>
                      <Link
                        href={buildExecutionHref(slug, workflowId, item.id)}
                        className="flex items-center gap-2"
                      >
                        <span className="font-mono text-xs">#{item.id}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatDate(item.startedAt, "datetime")}
                        </span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {item.status}
                        </Badge>
                        {item.dryRun && (
                          <Badge variant="outline" className="text-[10px]">
                            {t("history.rerun.chainBadgeDryRun")}
                          </Badge>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {/* Node Results */}
      <NodeResultsTab
        executionId={executionId}
        nodeExecutions={sortedNodeExecutions}
        executionDryRun={execution.dryRun === true}
      />

      {/* Re-run 모달 (spec §10.2) — 두 진입점이 공유한다. */}
      <ReRunModal
        original={{
          id: execution.id,
          workflowId: execution.workflowId,
          status: execution.status,
          startedAt: execution.startedAt,
          inputData: execution.inputData,
        }}
        open={rerunOpen}
        onClose={() => setRerunOpen(false)}
      />
    </div>
  );
}

function toNodeResult(ne: NodeExecutionData): NodeResult {
  const def = getNodeDefinition(ne.node?.type ?? "");
  return {
    nodeId: ne.nodeId,
    nodeLabel: ne.node?.label ?? ne.nodeId,
    nodeType: ne.node?.type ?? "",
    nodeCategory: def?.category ?? "unknown",
    status: ne.status,
    duration: ne.durationMs ?? undefined,
    // ResultDetail 의 Input 탭은 result.inputData 를, 헤더 시작 시각은
    // result.startedAt 을 읽는다 — 매핑을 빠뜨리면 Input 탭이 영구 "로드 중"
    // placeholder 로만 뜨고 헤더 시작 시각이 사라진다(§3.3 Input 서브탭 위반).
    startedAt: ne.startedAt,
    error: ne.error?.message,
    inputData: ne.inputData,
    outputData: ne.outputData,
  };
}

function NodeResultsTab({
  executionId,
  nodeExecutions,
  executionDryRun,
}: {
  executionId: string;
  nodeExecutions: NodeExecutionData[];
  executionDryRun: boolean;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Tracks which conversation message (if any) the user drilled into via
  // Preview. `null` = node-level view (whole conversation). ResultDetail 이
  // 이 인덱스를 받아 메시지 레벨(Response/Request/LLM Usage) 탭으로 전환한다.
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<number | null>(null);
  // Tracks which waitingNodeId we've already auto-selected, so changes to the
  // waiting node (e.g. after resumption into a new waiting node) move the
  // selection once without fighting manual clicks.
  const [lastAutoSelectedWaiting, setLastAutoSelectedWaiting] =
    useState<string | null>(null);

  // Waiting-state selectors — populated by useExecutionEvents when the
  // execution (live or already persisted) is in `waiting_for_input`.
  const waitingNodeId = useExecutionStore((s) => s.waitingNodeId);
  // ResultDetail 의 store 파생 입력(waiting selector·resume 콜백·pendingFormToolCallId)
  // 을 에디터 Run Results 드로어와 공용 hook 으로 단일화(V-05 후속). 타입별 대기
  // 플래그는 isSelectedWaiting(실행 상세 고유: selectedNodeId === waitingNodeId)에
  // 의존하므로 deriveFlags 로 계산한다.
  const {
    waitingFormConfig,
    waitingButtonConfig,
    waitingConversationConfig,
    conversationMessages,
    isWaitingAiResponse,
    pendingFormToolCallId,
    resumeFromForm,
    resumeFromAiRenderForm,
    resumeFromButtons,
    resumeFromConversation,
    deriveFlags,
  } = useResultDetailWaiting();

  // Derived-state pattern (not an effect): when a newly-surfaced waiting node
  // differs from the one we previously auto-selected, move the selection once.
  // The user can still click away freely afterwards.
  if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
    setLastAutoSelectedWaiting(waitingNodeId);
    setSelectedNodeId(waitingNodeId);
    setSelectedMsgIndex(null);
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
  // 타입별 대기 플래그(ai_form_render 뉘앙스 포함)는 공용 hook 의 deriveFlags 단일 정의.
  const { isWaitingForm, isWaitingButtons, isWaitingConversation } =
    deriveFlags(isSelectedWaiting);

  const t = useT();

  if (!nodeExecutions.length) {
    return (
      <p className="py-8 text-center text-[hsl(var(--muted-foreground))]">
        {t("executions.noNodeExecutions")}
      </p>
    );
  }

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
              // 노드 전환 시 메시지 레벨 선택만 초기화 — ResultDetail 이 activeTab 은
              // 노드 변경마다 자체 리셋한다(에러면 Error, 아니면 Preview).
              setSelectedMsgIndex(null);
            }}
          >
            <NodeStatusIcon status={ne.status} />
            <span className="flex-1 truncate">
              {ne.node?.label ?? ne.nodeId}
            </span>
            {/* spec/conventions/conversation-thread.md §9.12 — 노드 발생 시각(절대) + 소요시간 */}
            <span className="flex shrink-0 flex-col items-end text-[10px] text-[hsl(var(--muted-foreground))]">
              {ne.startedAt && <span>{formatDate(ne.startedAt, "time-seconds")}</span>}
              <span>{formatDuration(ne.durationMs)}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Right: Node Detail — 에디터 run-results 의 ResultDetail 을 그대로 재사용
          (V-05). 헤더(label/type/status/duration + dry-run 배지)·서브탭
          (Preview/Input/Output/Config/LLM Usage/Response/Request/References/Error)·
          완결 대화 인스펙터·BackgroundRunSection·live waiting 상호작용(내부
          useExecutionInteractionCommands)을 한 컴포넌트가 담당한다. null result 시
          "Select a node to view details" placeholder 를 자체 렌더. */}
      <div className="flex-1 rounded-md border border-[hsl(var(--border))] overflow-hidden">
        <ResultDetail
          result={selectedNodeResult}
          executionDryRun={executionDryRun}
          isWaitingForm={isWaitingForm}
          formConfig={waitingFormConfig}
          isWaitingButtons={isWaitingButtons}
          buttonConfig={waitingButtonConfig}
          isWaitingConversation={isWaitingConversation}
          conversationConfig={waitingConversationConfig}
          conversationMessages={conversationMessages}
          selectedConversationItemIndex={selectedMsgIndex}
          isWaitingAiResponse={isWaitingAiResponse}
          executionId={executionId}
          onFormSubmit={resumeFromForm}
          onAiRenderFormSubmit={resumeFromAiRenderForm}
          pendingFormToolCallId={pendingFormToolCallId}
          onButtonClick={resumeFromButtons}
          onConversationEnd={resumeFromConversation}
          onSelectConversationItem={setSelectedMsgIndex}
        />
      </div>
    </div>
  );
}
