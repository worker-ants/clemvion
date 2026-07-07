"use client";

import { memo, useEffect, useMemo } from "react";
import { Handle, Position, useStore, useUpdateNodeInternals } from "@xyflow/react";
import type { NodeProps, Node } from "@xyflow/react";
import { AlertTriangle, Unplug, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getNodeDefinition, getCategoryColor } from "@/lib/node-definitions";
import { isNodeDeletable } from "@/lib/node-definitions/is-trigger";
import { resolveDynamicPorts } from "@/lib/node-definitions/resolve-dynamic-ports";
import { useExecutionStore } from "@/lib/stores/execution-store";
import { useEditorStore } from "@/lib/stores/editor-store";
import { getConfigSummary, truncateSummary } from "@/lib/utils/node-config-summary";
import type { SummaryContext } from "@/lib/utils/node-config-summary";
import { useLocale, useT } from "@/lib/i18n";
import {
  translateNodePortLabel,
  translateGraphWarning,
} from "@/lib/i18n/backend-labels";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { NodeIcon } from "./node-icon";
import { useHasDefaultLlmConfig } from "./has-default-llm-config-context";
import { useIntegrationIds } from "./integration-list-context";

type CustomNodeData = {
  type: string;
  label: string;
  config: Record<string, unknown>;
  category: string;
  isDisabled?: boolean;
};

type CustomNodeType = Node<CustomNodeData, "custom">;

// useStore with a boolean selector: only re-renders when crossing the 50% zoom threshold.
// useViewport() would re-render on every pan/zoom change, which is expensive with many nodes.
const zoomSelector = (s: { transform: number[] }) => s.transform[2] >= 0.5;

// §5 ⚠ Missing integration 배지 — Integration 노드가 참조하는 integration 이
// 워크스페이스 목록에 없을(= 삭제된 잔존 참조) 때 캔버스 노드 헤더에 앰버 배지를
// 렌더한다. 이 판정은 warningRules DSL 로는 표현할 수 없다: 평가기가 노드 자신의
// config 만 보므로 cross-entity(integration 실재) 존재 검증에 닿지 못한다. 따라서
// 렌더러 전용 cross-entity 판정이며, config 스냅샷 warnWhen DSL 을 쓰는
// `⚠ Missing workflow` 와는 다른 경로다. 존재-판정은 설정 패널
// `mcp-server-selector` 의 missing 대조와 동일한 패턴이고, 색은 캔버스
// `⚠ Missing workflow` 와 같은 앰버 계열이되(설정 패널 셀렉터의 red 와는 별개)
// graph-warning 배지(AlertTriangle)와 구분되게 Unplug(연결 끊김) 아이콘을 쓴다.
// 목록은 `WorkflowCanvas` 가 한 번 조회해 Context 로 내려준다(per-node useQuery
// 구독 회피 — has-default-llm-config 와 동일 패턴). 집합이 null 이면(로딩 중이거나
// 목록 미완전) 억제해 위양성을 피한다. SoT: spec/4-nodes/4-integration/0-common.md §5.
function MissingIntegrationBadge({
  integrationId,
  pushToRight,
}: {
  integrationId: string;
  pushToRight: boolean;
}) {
  const t = useT();
  const integrationIds = useIntegrationIds();
  const isMissing = integrationIds !== null && !integrationIds.has(integrationId);
  if (!isMissing) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "shrink-0 inline-flex items-center justify-center rounded-full p-0.5 bg-amber-400 text-amber-950",
            pushToRight && "ml-auto",
          )}
          role="img"
          aria-label="missing integration"
          data-testid="missing-integration-badge"
        >
          <Unplug className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t("integrations.missingIntegration")}
      </TooltipContent>
    </Tooltip>
  );
}

function CustomNodeComponent({ id, data, selected }: NodeProps<CustomNodeType>) {
  const definition = getNodeDefinition(data.type);
  const categoryColor = getCategoryColor(data.category);
  const inputs = definition?.inputs ?? [];
  const containerId =
    (data as Record<string, unknown>).containerId as string | null | undefined;
  // Look up the container's label so the badge stays in sync with renames.
  // useStore subscribes only when the looked-up label string changes, keeping
  // re-renders cheap even for very large canvases.
  const containerLabel = useStore((s: { nodes: Array<{ id: string; data: { label?: string } }> }) => {
    if (!containerId) return null;
    const found = s.nodes.find((n) => n.id === containerId);
    return found ? (found.data.label ?? null) : null;
  });
  const outputs = useMemo(
    () => resolveDynamicPorts(data.type, data.config, getNodeDefinition(data.type)),
    [data.type, data.config],
  );
  const hasMultipleOutputs = useMemo(() => {
    const defaultIds = new Set(
      (getNodeDefinition(data.type)?.outputs ?? []).map((o) => o.id),
    );
    const hasDynamic =
      outputs.length > 0 && outputs.some((p) => !defaultIds.has(p.id));
    return outputs.length > 1 || hasDynamic;
  }, [outputs, data.type]);
  const isContainer = definition?.isContainer ?? false;

  // Force React Flow to re-measure handle positions when outputs change
  // (e.g. button reorder in presentation nodes, condition changes in AI Agent)
  const updateNodeInternals = useUpdateNodeInternals();
  const outputKey = outputs.map((p) => p.id).join(",");
  useEffect(() => {
    updateNodeInternals(id);
  }, [outputKey, id, updateNodeInternals]);

  const nodeStatus = useExecutionStore((s) => s.nodeStatuses.get(id));
  const showSummary = useStore(zoomSelector);

  // §5.4 노드 삭제 버튼 — 호버/선택 시 노드 우상단에 나타나는 ✕ 어포던스.
  // Manual Trigger 는 삭제 불가(§9.2)라 버튼을 숨기고, 워크플로우 실행 중에는
  // 편집을 차단하기 위해 숨긴다. 클릭은 `requestNodeDelete` 로 위임해 §11.3 확인
  // 다이얼로그(자식 있는 컨테이너)를 거치거나, 그 외에는 즉시 연결 엣지까지 함께
  // 삭제한다(§5.4.3).
  const t = useT();
  const requestNodeDelete = useEditorStore((s) => s.requestNodeDelete);
  const executionStatus = useExecutionStore((s) => s.status);
  const isExecuting =
    executionStatus === "running" || executionStatus === "waiting_for_input";
  const showDeleteButton = isNodeDeletable(data.type) && !isExecuting;

  // Cross-node graphWarningRules (parallel-p2 결정 D + E + I) — store 에 로컬
  // 평가된 결과 중 이 노드(id) 에 해당하는 항목만 추려 severity 별 배지를
  // 렌더한다. error 가 하나라도 있으면 error 우선. SoT:
  // spec/conventions/cross-node-warning-rules.md.
  // 배열 reference 안정성을 위해 store 의 results 원본만 구독하고 (zustand
  // 기본 Object.is 비교가 동작) 필터링은 useMemo 로 파생한다. 셀렉터에서
  // .filter 를 돌리면 매 스냅샷마다 새 배열이 나와 무한 재렌더가 발생한다.
  const allGraphWarnings = useEditorStore((s) => s.graphWarnings.results);
  const graphWarnings = useMemo(
    () => allGraphWarnings.filter((r) => r.nodeId === id),
    [allGraphWarnings, id],
  );
  const graphWarningSeverity: "error" | "warning" | null = useMemo(() => {
    if (graphWarnings.length === 0) return null;
    return graphWarnings.some((r) => r.severity === "error")
      ? "error"
      : "warning";
  }, [graphWarnings]);
  const isAiNode = data.type === "ai_agent" || data.type === "text_classifier" || data.type === "information_extractor";
  // Shared workspace-level flag from context — see has-default-llm-config-context.
  const hasDefaultLlmConfig = useHasDefaultLlmConfig();
  const summaryContext = useMemo<SummaryContext | undefined>(() => {
    if (!isAiNode) return undefined;
    return { hasDefaultLlmConfig };
  }, [isAiNode, hasDefaultLlmConfig]);

  const locale = useLocale();
  // i18n Principle 3-C: 동적 graphWarning 메시지를 ruleId 별 ko 템플릿으로 localize
  // (영문 message 는 SoT/fallback). 배지 tooltip 은 캔버스에서 사용자에게 직접 노출.
  const graphWarningMessage = useMemo(
    () => graphWarnings.map((r) => translateGraphWarning(r, locale)).join("\n"),
    [graphWarnings, locale],
  );
  const summary = useMemo(
    () => getConfigSummary(data.type, data.config, summaryContext, locale),
    [data.type, data.config, summaryContext, locale],
  );

  const { display: displayText, isTruncated } = useMemo(
    () => (summary ? truncateSummary(summary.text) : { display: "", isTruncated: false }),
    [summary],
  );

  const statusStyles = useMemo(() => {
    if (!nodeStatus) return "";
    switch (nodeStatus.status) {
      case "running":
        return "ring-2 ring-blue-400 animate-pulse";
      case "completed":
        return "ring-2 ring-green-400";
      case "failed":
        return "ring-2 ring-red-400";
      case "skipped":
        return "opacity-40";
      default:
        return "";
    }
  }, [nodeStatus]);

  const isWarning = summary?.isWarning ?? false;
  // Warnings are unified as a single amber icon in the header for every node
  // type so the body keeps a consistent layout regardless of configuration
  // state. Non-warning summaries still follow the existing split: container
  // nodes render in the header, regular nodes in the body.
  const showHeaderWarning = showSummary && summary && isWarning;
  const showHeaderSummary = isContainer && showSummary && summary && !isWarning;
  const showBodySummary = !isContainer && showSummary && summary && !isWarning;

  // §5 ⚠ Missing integration — category=integration 노드가 참조하는
  // integrationId. http_request 만 integrationId 가 `authentication ===
  // "integration"` 일 때만 유효하다(다른 인증 모드에선 미사용 필드 —
  // schema `visibleWhen`). 그 조건이 아니면 잔존 필드값에 배지를 걸지 않아
  // 오탐을 막는다. 나머지 통합 노드는 integrationId 가 무조건 필수라 category
  // 만으로 충분하다. 실재 대조는 <MissingIntegrationBadge> 가 담당한다.
  const usesIntegrationId =
    data.category === "integration" &&
    (data.type !== "http_request" ||
      data.config.authentication === "integration");
  const integrationId =
    usesIntegrationId && typeof data.config.integrationId === "string"
      ? data.config.integrationId
      : "";

  return (
    <div
      className={cn(
        "group relative w-[180px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm transition-shadow",
        selected && "ring-2 ring-[hsl(var(--ring))] shadow-md",
        data.isDisabled && "opacity-50",
        // Cross-node graph-warning ring — only when execution status isn't
        // already painting a ring, so the two signals don't fight. error
        // takes precedence over warning.
        !statusStyles &&
          graphWarningSeverity === "error" &&
          "ring-2 ring-red-500",
        !statusStyles &&
          graphWarningSeverity === "warning" &&
          "ring-2 ring-amber-400",
        statusStyles,
      )}
    >
      {/* §5.4 삭제 버튼 — 노드 우상단 외곽 20×20 원형. 호버 시 fade in(200ms),
          선택 상태면 항상 표시. `nodrag`/`nopan` 으로 버튼 조작이 노드 드래그·
          캔버스 팬으로 새지 않게 한다. */}
      {showDeleteButton && (
        <button
          type="button"
          data-testid="node-delete-button"
          aria-label={t("editor.deleteNode")}
          className={cn(
            "nodrag nopan absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] shadow-sm transition-opacity duration-200 hover:bg-red-500 hover:text-white",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            requestNodeDelete(id);
          }}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {/* Header bar */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ backgroundColor: categoryColor }}
      >
        <NodeIcon name={definition?.icon ?? "HelpCircle"} size={14} className="text-white shrink-0" />
        <span className="truncate text-xs font-medium text-white">
          {data.label}
        </span>
        {showHeaderSummary && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto shrink-0 truncate text-[10px] text-white/70" style={{ maxWidth: "60px" }}>
                {displayText}
              </span>
            </TooltipTrigger>
            {isTruncated && (
              <TooltipContent side="bottom">{summary.text}</TooltipContent>
            )}
          </Tooltip>
        )}
        {showHeaderWarning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="ml-auto shrink-0 inline-flex items-center justify-center text-white/70 hover:text-white transition-colors"
                role="img"
                aria-label="warning"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{summary.text}</TooltipContent>
          </Tooltip>
        )}
        {/* Cross-node graph-warning badge — distinct from the single-node
            config-summary warning above. Red for error, amber for warning.
            `ml-auto` only when no header summary/warning already pushed to the
            right, so the two never double up on the same slot. */}
        {graphWarningSeverity && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center rounded-full p-0.5",
                  !showHeaderSummary && !showHeaderWarning && "ml-auto",
                  graphWarningSeverity === "error"
                    ? "bg-red-500 text-white"
                    : "bg-amber-400 text-amber-950",
                )}
                role="img"
                aria-label={
                  graphWarningSeverity === "error"
                    ? "graph error"
                    : "graph warning"
                }
                data-testid="graph-warning-badge"
                data-severity={graphWarningSeverity}
              >
                <AlertTriangle className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="whitespace-pre-line">
              {graphWarningMessage}
            </TooltipContent>
          </Tooltip>
        )}
        {/* §5 Missing integration 배지 — 참조하던 Integration 이 삭제된 잔존
            참조일 때. graph-warning(AlertTriangle) 배지와 구분되는 Unplug 아이콘·
            별도 슬롯. integrationId 가 유효할 때만 mount 한다. ml-auto 는 앞선
            우측 정렬 요소가 없을 때만 부여해 슬롯 중복을 피한다. */}
        {integrationId !== "" && (
          <MissingIntegrationBadge
            integrationId={integrationId}
            pushToRight={
              !showHeaderSummary && !showHeaderWarning && !graphWarningSeverity
            }
          />
        )}
      </div>

      {/* Container membership badge — visible only for body children so users
          can verify which container a node belongs to without opening the
          settings panel. */}
      {containerId && (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-0.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            in <span className="text-[hsl(var(--foreground))]">{containerLabel ?? "(deleted)"}</span>
          </span>
        </div>
      )}

      {/* Body with handles */}
      <div className="relative px-3 py-2">
        {/* Input handles — aligned to center of body. Multi-input nodes
            render a label and per-type color so ports like ForEach's
            "Input" vs "Emit" are distinguishable at a glance. */}
        {inputs.length === 1 ? (
          <Handle
            key={inputs[0].id}
            id={inputs[0].id}
            type="target"
            position={Position.Left}
            className="!h-2.5 !w-2.5 !border-2 !border-white !bg-gray-400"
            style={{ top: "50%" }}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {inputs.map((port) => {
              const isEmit = port.id === "emit";
              return (
                <div key={port.id} className="relative flex items-center">
                  <Handle
                    id={port.id}
                    type="target"
                    position={Position.Left}
                    className={cn(
                      "!h-2.5 !w-2.5 !border-2 !border-white",
                      isEmit ? "!bg-purple-400" : "!bg-gray-400",
                    )}
                    style={{ top: "50%", left: "-12px" }}
                  />
                  <span
                    className={cn(
                      "text-[10px]",
                      isEmit
                        ? "text-purple-500"
                        : "text-[hsl(var(--muted-foreground))]",
                    )}
                  >
                    {translateNodePortLabel(port.label, locale) ?? port.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Config summary */}
        {showBodySummary && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className={cn(
                  "mb-1 truncate text-[10px] leading-tight",
                  isWarning
                    ? "text-amber-500"
                    : "text-[hsl(var(--muted-foreground))]",
                )}
              >
                {displayText}
              </p>
            </TooltipTrigger>
            {isTruncated && (
              <TooltipContent side="bottom">{summary.text}</TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Port labels with co-located output handles */}
        {hasMultipleOutputs ? (
          <div className="flex flex-col gap-0.5">
            {outputs.map((port, index) => {
              const group = (port as { group?: string }).group;
              const prevGroup = index > 0 ? (outputs[index - 1] as { group?: string }).group : undefined;
              const showSystemDivider = index > 0 &&
                outputs[index - 1].type === "data" &&
                (port.type === "system" || port.type === "error");
              const showGlobalDivider = !showSystemDivider && index > 0 && prevGroup && !group;

              // resolveDynamicPorts 가 id 를 dedupe 하지만, 그 전에 port.id
              // 가 빈 문자열이 넘어오거나 미래의 새 dynamic-ports kind 가
              // 중복을 허용할 가능성을 대비해 렌더 key 에도 index 를 함께
              // 포함해 React key warning 이 재발하지 않게 한다.
              return (
              <div key={`${port.id || "port"}-${index}`}>
                {showGlobalDivider && (
                  <div className="border-t border-dashed border-[hsl(var(--border))] my-0.5" />
                )}
                {showSystemDivider && (
                  <div className="border-t border-dashed border-[hsl(var(--border))] my-0.5" />
                )}
                <div className="relative flex items-center justify-end">
                  {(() => {
                    const portLabel =
                      translateNodePortLabel(port.label, locale) ?? port.label;
                    return group ? (
                      <span className="text-[10px]">
                        <span className="text-[hsl(var(--muted-foreground))/0.6]">{group}</span>
                        <span className="text-[hsl(var(--muted-foreground))/0.4] mx-1">›</span>
                        <span className="text-[hsl(var(--muted-foreground))]">{portLabel}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {portLabel}
                      </span>
                    );
                  })()}
                  <Handle
                    id={port.id}
                    type="source"
                    position={Position.Right}
                    className={cn(
                      "!h-2.5 !w-2.5 !border-2 !border-white",
                      port.type === "error"
                        ? "!bg-red-400"
                        : port.type === "system"
                          ? "!bg-blue-400"
                          : "!bg-green-400",
                    )}
                    style={{ top: "50%", right: "-12px" }}
                  />
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Single output handle — centered */}
            {outputs.map((port) => (
              <Handle
                key={port.id}
                id={port.id}
                type="source"
                position={Position.Right}
                className={cn(
                  "!h-2.5 !w-2.5 !border-2 !border-white",
                  port.type === "error"
                    ? "!bg-red-400"
                    : port.type === "system"
                      ? "!bg-blue-400"
                      : "!bg-green-400",
                )}
                style={{ top: "50%" }}
              />
            ))}
            {!showBodySummary && <div className="h-2" />}
          </>
        )}

        {/* Execution status indicator */}
        {nodeStatus?.status === "completed" && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {nodeStatus?.status === "failed" && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold">
            !
          </div>
        )}
      </div>
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
