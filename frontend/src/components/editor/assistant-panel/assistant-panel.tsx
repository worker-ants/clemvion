"use client";

import { useEffect, useMemo, useRef } from "react";
import { X, Plus } from "lucide-react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useAssistantStore } from "@/lib/stores/assistant-store";
import { LlmConfigSelector } from "@/components/llm-config/llm-config-selector";
import { useT } from "@/lib/i18n";
import { AssistantMessageView } from "./assistant-message";
import { MessageInput } from "./message-input";
import type { AssistantWorkflowSnapshot } from "@/lib/api/assistant";
import { getNodeMeasuredSize } from "@/lib/utils/node-size";

const EXAMPLE_KEYS = [
  "assistant.exampleAddCancelFlow",
  "assistant.exampleAddHeader",
  "assistant.exampleReview",
  "assistant.exampleArrange",
] as const;

export function AssistantPanel() {
  const t = useT();

  // Assistant store
  const isOpen = useAssistantStore((s) => s.isOpen);
  const messages = useAssistantStore((s) => s.messages);
  const isStreaming = useAssistantStore((s) => s.isStreaming);
  const llmConfigId = useAssistantStore((s) => s.llmConfigId);
  const sessionTitle = useAssistantStore((s) => s.sessionTitle);
  const sendMessage = useAssistantStore((s) => s.sendMessage);
  const stop = useAssistantStore((s) => s.stop);
  const close = useAssistantStore((s) => s.close);
  const newSession = useAssistantStore((s) => s.newSession);
  const setLlmConfigId = useAssistantStore((s) => s.setLlmConfigId);
  const setWorkflow = useAssistantStore((s) => s.setWorkflow);
  const approveActivePlan = useAssistantStore((s) => s.approveActivePlan);

  // Editor store (for snapshot)
  const workflowId = useEditorStore((s) => s.workflowId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const selectNode = useEditorStore((s) => s.selectNode);

  // When Assistant opens, deselect the current node so NodeSettingsPanel
  // collapses — the two panels share the right-hand slot and must not overlap.
  useEffect(() => {
    if (isOpen) selectNode(null);
  }, [isOpen, selectNode]);

  // Inverse: when the user picks a node while the assistant is open, the
  // Settings panel takes priority and the assistant closes.
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  useEffect(() => {
    if (isOpen && selectedNodeId) close();
  }, [isOpen, selectedNodeId, close]);

  // Load session for current workflow
  useEffect(() => {
    if (isOpen && workflowId) {
      void setWorkflow(workflowId);
    }
  }, [isOpen, workflowId, setWorkflow]);

  // Auto-scroll on any visible change to the last message. content length
  // alone misses tool_call 배지 / plan 카드 추가 / plan step 체크 진행 등을
  // — bubble 크기를 넓히는 모든 변화가 아래를 밀어내므로 signature 에 같이
  // 포함해야 스크롤이 따라 내려간다. `filter` 로 만든 완료 step 수 계산이
  // 매 렌더마다 돌지 않도록 useMemo 로 캐시한다.
  const listRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const lastSignature = useMemo(() => {
    if (!last) return "";
    const doneSteps =
      last.plan?.steps.reduce(
        (n, s) => (s.status === "done" ? n + 1 : n),
        0,
      ) ?? 0;
    return [
      last.content.length,
      last.toolCalls.length,
      last.plan?.steps.length ?? 0,
      doneSteps,
      last.streaming ? 1 : 0,
    ].join("|");
  }, [last]);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, lastSignature, isStreaming]);

  // Snapshot of the current canvas, normalized to the backend DTO shape.
  const snapshot: AssistantWorkflowSnapshot = useMemo(() => {
    return {
      nodes: nodes.map((n) => {
        const data = n.data as {
          type?: string;
          label?: string;
          category?: string;
          config?: Record<string, unknown>;
          containerId?: string | null;
          toolOwnerId?: string | null;
        };
        // React Flow measurement 는 util 에 위임 — measured > initial hint,
        // 0/NaN 은 자동으로 필드 누락.
        return {
          id: n.id,
          type: data.type ?? "",
          label: data.label ?? "",
          category: data.category ?? "logic",
          positionX: n.position.x,
          positionY: n.position.y,
          ...getNodeMeasuredSize(n),
          config: data.config ?? {},
          containerId: data.containerId ?? null,
          toolOwnerId: data.toolOwnerId ?? null,
        };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        sourcePort: e.sourceHandle ?? "out",
        targetNodeId: e.target,
        targetPort: e.targetHandle ?? "in",
        type: "data",
      })),
    };
  }, [nodes, edges]);

  if (!isOpen) return null;

  const handleExample = (key: (typeof EXAMPLE_KEYS)[number]) => {
    void sendMessage(t(key), snapshot);
  };

  return (
    <aside
      className="flex h-full w-[360px] shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))]"
      role="complementary"
      aria-label={t("assistant.panelTitle")}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
            {t("assistant.panelTitle")}
          </span>
          {sessionTitle && (
            <span className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
              {sessionTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void newSession()}
            aria-label={t("assistant.newSession")}
            className="flex size-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            title={t("assistant.newSession")}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="flex size-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Model selector */}
      <div className="border-b border-[hsl(var(--border))] px-3 py-2">
        <LlmConfigSelector
          value={llmConfigId ?? ""}
          onChange={(v) => setLlmConfigId(v || null)}
          label={t("assistant.modelLabel")}
        />
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="flex-1 space-y-2 overflow-y-auto p-3"
      >
        {messages.length === 0 && !isStreaming ? (
          <EmptyState onPick={handleExample} />
        ) : (
          messages.map((m) => (
            <AssistantMessageView
              key={m.id}
              message={m}
              onApprovePlan={() => void approveActivePlan(snapshot)}
            />
          ))
        )}
      </div>

      {/* Input */}
      <MessageInput
        disabled={!workflowId}
        streaming={isStreaming}
        onSend={(content) => void sendMessage(content, snapshot)}
        onStop={stop}
      />
    </aside>
  );
}

function EmptyState({
  onPick,
}: {
  onPick: (key: (typeof EXAMPLE_KEYS)[number]) => void;
}) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-3 py-6 text-center">
      <div>
        <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
          {t("assistant.emptyTitle")}
        </div>
        <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          {t("assistant.emptySubtitle")}
        </p>
      </div>
      <div className="flex w-full flex-col gap-1.5">
        {EXAMPLE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-2 py-1.5 text-left text-[11px] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.6)]"
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
