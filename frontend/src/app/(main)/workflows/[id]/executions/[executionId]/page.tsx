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
  STATUS_LABEL,
  formatDuration,
} from "@/lib/utils/execution-status";
import { getNodeDefinition } from "@/lib/node-definitions";
import { PresentationContent } from "@/components/editor/run-results/renderers/presentation-renderers";
import { GenericRenderer } from "@/components/editor/run-results/renderers/generic-renderer";
import { ConversationInspector } from "@/components/editor/run-results/conversation-inspector";
import { parseHistoryMessages } from "@/components/editor/run-results/conversation-utils";
import { DynamicFormUI } from "@/components/editor/run-results/dynamic-form-ui";
import { ButtonBar } from "@/components/editor/run-results/button-bar";
import {
  parseButtonConfig,
  openExternalLink,
} from "@/components/editor/run-results/button-config";
import type { NodeResult } from "@/lib/stores/execution-store";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useExecutionEvents } from "@/lib/websocket/use-execution-events";
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
  const { id: workflowId, executionId } = use(params);
  const router = useRouter();

  // Reset store when switching between executions so stale waiting/conversation
  // state from a previously viewed execution doesn't bleed into this one.
  // The poll loop in useExecutionEvents then repopulates from REST.
  const resetStore = useExecutionStore((s) => s.reset);
  useEffect(() => {
    resetStore();
  }, [executionId, resetStore]);

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
        <p>Failed to load execution. Please try again.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/workflows/${workflowId}/executions`)}
        >
          Back to Executions
        </Button>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
        <p>Execution not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/workflows/${workflowId}/executions`)}
        >
          Back to Executions
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
            {workflowQuery.data?.name ?? "Workflow"}
            <span className="text-[hsl(var(--muted-foreground))] font-normal">
              {" "}&mdash; Execution Detail
            </span>
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
            Prev
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
            Next
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
            {STATUS_LABEL[execution.status] ?? execution.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Started</span>
            <p className="font-medium">{formatDate(execution.startedAt, "datetime")}</p>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Finished</span>
            <p className="font-medium">
              {execution.finishedAt
                ? formatDate(execution.finishedAt, "datetime")
                : "\u2014"}
            </p>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Duration</span>
            <p className="font-medium">{formatDuration(execution.durationMs)}</p>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Nodes</span>
            <p className="font-medium">
              {completedCount}/{totalCount} completed
              {failedCount > 0 && (
                <span className="text-[hsl(var(--destructive))]">
                  , {failedCount} failed
                </span>
              )}
            </p>
          </div>
        </div>
        {execution.status === "failed" && execution.error?.message && (
          <div className="mt-3 rounded-md bg-[hsl(var(--destructive))/0.1] p-3 text-sm text-[hsl(var(--destructive))]">
            <strong>Error:</strong> {execution.error.message}
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
  const conversationMessages = useExecutionStore((s) => s.conversationMessages);
  const isWaitingAiResponse = useExecutionStore((s) => s.isWaitingAiResponse);
  const resumeFromForm = useExecutionStore((s) => s.resumeFromForm);
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
  const isWaitingForm =
    isSelectedWaiting && waitingInteractionType === "form";
  const isWaitingButtons =
    isSelectedWaiting && waitingInteractionType === "buttons";
  const isWaitingConversation =
    isSelectedWaiting && waitingInteractionType === "ai_conversation";

  const handleFormSubmit = (data: Record<string, unknown>) => {
    commands.submitForm(data);
    resumeFromForm();
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

  if (!nodeExecutions.length) {
    return (
      <p className="py-8 text-center text-[hsl(var(--muted-foreground))]">
        No node executions recorded.
      </p>
    );
  }

  const isPresentation = selectedNodeResult?.nodeCategory === "presentation";
  const isAiAgent = selectedNodeResult?.nodeType === "ai_agent";
  const isCompletedConversation =
    isAiAgent &&
    !isWaitingConversation &&
    !!(selectedNode?.outputData as Record<string, unknown> | null)?.messages;

  // Preview tab should also render when the selected node is waiting for
  // input — even if outputData is null the page must show the interactive UI.
  const hasPreview = !!selectedNode?.outputData || isSelectedWaiting;

  const detailTabs: { id: DetailTab; label: string; show: boolean }[] = [
    { id: "preview", label: "Preview", show: hasPreview },
    { id: "input", label: "Input", show: true },
    { id: "output", label: "Output", show: true },
    { id: "error", label: "Error", show: !!selectedNode?.error },
  ];

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* Left: Node List */}
      <div className="w-[240px] shrink-0 rounded-md border border-[hsl(var(--border))] overflow-y-auto">
        <div className="px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
          Nodes
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
                .filter((t) => t.show)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      "py-2 text-xs font-medium transition-colors",
                      nodeDetailTab === t.id
                        ? "border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                    )}
                    onClick={() => setNodeDetailTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {nodeDetailTab === "preview" && selectedNodeResult && (
                isWaitingConversation ? (
                  <ConversationInspector
                    result={selectedNodeResult}
                    conversationMessages={conversationMessages}
                    selectedItemIndex={null}
                    isLive={true}
                    isWaitingAiResponse={isWaitingAiResponse}
                    conversationConfig={waitingConversationConfig}
                    onSendMessage={handleSendMessage}
                    onEndConversation={handleEndConversation}
                  />
                ) : isWaitingForm && waitingFormConfig ? (
                  <DynamicFormUI
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
                        timeout={parsed.timeout}
                        timeoutAction={parsed.timeoutAction}
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
                    selectedItemIndex={null}
                    isLive={false}
                    isWaitingAiResponse={false}
                    conversationConfig={null}
                    onSendMessage={() => {}}
                    onEndConversation={() => {}}
                    previewOnly
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
