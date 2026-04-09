"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useExecutionStore } from "@/lib/stores/execution-store";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultTimeline } from "./result-timeline";
import { ResultDetail } from "./result-detail";

const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.6; // 60% of viewport
const STORAGE_KEY = "run-results-height";

function getStoredHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = Number(stored);
    const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
    if (
      !Number.isNaN(parsed) &&
      Number.isFinite(parsed) &&
      parsed >= MIN_HEIGHT &&
      parsed <= maxHeight
    ) {
      return parsed;
    }
  }
  return DEFAULT_HEIGHT;
}

export function RunResultsDrawer() {
  const params = useParams();
  const workflowId = params?.id as string | undefined;
  const [expanded, setExpanded] = useState(true);
  const [panelHeight, setPanelHeight] = useState(getStoredHeight);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeightRef = useRef(panelHeight);

  // Keep ref in sync with state
  useEffect(() => {
    currentHeightRef.current = panelHeight;
  }, [panelHeight]);

  const status = useExecutionStore((s) => s.status);
  const executionId = useExecutionStore((s) => s.executionId);
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
  const resumeFromButtons = useExecutionStore((s) => s.resumeFromButtons);
  const resumeFromConversation = useExecutionStore(
    (s) => s.resumeFromConversation,
  );
  const addConversationMessage = useExecutionStore(
    (s) => s.addConversationMessage,
  );
  const setWaitingAiResponse = useExecutionStore(
    (s) => s.setWaitingAiResponse,
  );

  // Auto-select any blocking node (form, buttons, conversation) so user can interact immediately
  useEffect(() => {
    if (waitingNodeId) {
      selectResultNode(waitingNodeId);
    }
  }, [waitingNodeId, selectResultNode]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = currentHeightRef.current;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const diff = startY.current - e.clientY;
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(maxHeight, startHeight.current + diff),
      );
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(currentHeightRef.current));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (isDragging.current) {
        isDragging.current = false;
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

  const handleSendMessage = useCallback(
    (message: string) => {
      addConversationMessage({
        type: "user",
        content: message,
        turnIndex:
          conversationMessages.filter((m) => m.type === "user").length + 1,
        timestamp: new Date().toISOString(),
      });
      setWaitingAiResponse(true);
    },
    [addConversationMessage, setWaitingAiResponse, conversationMessages],
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
      ? "Running..."
      : status === "completed"
        ? "Completed"
        : status === "failed"
          ? "Failed"
          : status === "waiting_for_input"
            ? waitingInteractionType === "ai_conversation"
              ? "Conversing..."
              : "Waiting for input..."
            : "Execution";

  const selectedResult =
    nodeResults.find((r) => r.nodeId === selectedResultNodeId) ?? null;

  const isSelectedWaiting =
    status === "waiting_for_input" &&
    waitingNodeId != null &&
    selectedResultNodeId === waitingNodeId;

  const isWaitingForm = isSelectedWaiting && waitingInteractionType === "form";
  const isWaitingButtons =
    isSelectedWaiting && waitingInteractionType === "buttons";
  const isWaitingConversation =
    isSelectedWaiting && waitingInteractionType === "ai_conversation";
  const isLiveConversation =
    status === "waiting_for_input" &&
    waitingInteractionType === "ai_conversation";

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
          {statusIcon}
          <span className="text-sm font-medium">{statusLabel}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {completedCount}/{totalNodes} nodes
            {failedCount > 0 && ` (${failedCount} failed)`}
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
              All Executions
            </a>
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
          <div className="w-[280px] shrink-0 border-r border-[hsl(var(--border))] overflow-hidden">
            {visibleResults.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
                {status === "running"
                  ? "Waiting for nodes..."
                  : "No nodes executed"}
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
              onButtonClick={resumeFromButtons}
              onConversationEnd={resumeFromConversation}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
