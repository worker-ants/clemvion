"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import { executionsApi } from "@/lib/api/executions";
import type { ExecutionStatus } from "@/lib/api/executions";
import { workflowsApi } from "@/lib/api/workflows";
import type { NodeData } from "@/lib/api/workflows";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions/types";

/**
 * Re-run modal (spec/5-system/13-replay-rerun.md §10.2).
 *
 * 원본 실행을 기반으로 새 Execution 을 트리거하는 모달. 외부 호출(dry-run
 * 지원) 노드 개수를 안내하고, 입력 편집 / dry-run toggle 을 제공한다. 성공
 * 시 새 실행 상세 페이지로 라우팅한다.
 */
export interface ReRunModalProps {
  /** 원본 실행 — 모달 헤더 + 입력 default + 워크플로 노드 로딩에 사용. */
  original: {
    id: string;
    workflowId: string;
    status: ExecutionStatus;
    startedAt: string;
    /** 원본 실행 입력. `parameters` 가 Manual Trigger 파라미터 default 가 된다. */
    inputData?: Record<string, unknown> | null;
  };
  open: boolean;
  onClose: () => void;
  /**
   * 재실행 성공 콜백. 미지정 시 app router 로
   * `/workflows/:workflowId/executions/:newId` 로 네비게이션한다.
   */
  onSuccess?: (newExecutionId: string) => void;
}

/**
 * axios 에러에서 백엔드 에러 코드(RERUN_*) 를 추출한다.
 *
 * 정식 wire 형식은 nested `response.data.error.code` — backend
 * `GlobalExceptionFilter` (codebase/backend/src/common/filters/http-exception.filter.ts)
 * 가 모든 예외를 `{ error: { code, message, requestId } }` 로 직렬화한다.
 * flat `response.data.code` fallback 은 같은 코드를 단순 형태로 mock 하는
 * 기존 테스트/방어 호환을 위해 유지한다.
 */
function parseErrorCode(err: unknown): string | undefined {
  const data = (
    err as {
      response?: {
        data?: { code?: string; error?: { code?: string } };
      };
    }
  )?.response?.data;
  return data?.error?.code ?? data?.code;
}

/** RERUN_* 코드 → i18n 키 매핑. 미매핑 코드는 undefined (generic fallback). */
const ERROR_CODE_TO_KEY: Record<
  string,
  | "history.rerun.permissionDenied"
  | "history.rerun.chainDepthExceeded"
  | "history.rerun.workflowDeleted"
  | "history.rerun.dryRunNotApplicable"
> = {
  RERUN_PERMISSION_DENIED: "history.rerun.permissionDenied",
  RERUN_CHAIN_DEPTH_EXCEEDED: "history.rerun.chainDepthExceeded",
  RERUN_WORKFLOW_DELETED: "history.rerun.workflowDeleted",
  RERUN_DRY_RUN_NOT_APPLICABLE: "history.rerun.dryRunNotApplicable",
};

/** 원본 실행 입력에서 Manual Trigger parameters 객체를 안전 추출. */
function extractParameters(
  inputData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const params = (inputData as { parameters?: unknown } | null | undefined)
    ?.parameters;
  if (params && typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }
  return {};
}

export function ReRunModal({
  original,
  open,
  onClose,
  onSuccess,
}: ReRunModalProps) {
  const t = useT();
  const router = useRouter();

  // Node definitions — external-call 카운트 + dry-run 적용성 판정에 필요.
  const loadDefinitions = useNodeDefinitionsStore((s) => s.load);
  const definitions = useNodeDefinitionsStore((s) => s.definitions);
  useEffect(() => {
    if (open) void loadDefinitions();
  }, [open, loadDefinitions]);

  // Workflow nodes — 원본 실행의 현재 워크플로 노드 목록.
  const { data: workflowNodes = [] } = useQuery<NodeData[]>({
    queryKey: ["workflow-nodes", original.workflowId],
    queryFn: async () => {
      const res = await workflowsApi.getNodes(original.workflowId);
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  // 입력 폼 상태 — default = 원본 inputData.parameters.
  const originalParameters = useMemo(
    () => extractParameters(original.inputData),
    [original.inputData],
  );
  const [useOriginalInput, setUseOriginalInput] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [paramValues, setParamValues] =
    useState<Record<string, unknown>>(originalParameters);
  const [submitting, setSubmitting] = useState(false);

  // 모달이 열릴 때마다 폼 상태를 원본 기준으로 리셋.
  useEffect(() => {
    if (open) {
      setUseOriginalInput(false);
      setDryRun(false);
      setParamValues(originalParameters);
      setSubmitting(false);
    }
  }, [open, originalParameters]);

  // External-call 노드 — 워크플로 노드 중 정의의 supportsDryRun === true.
  // spec §10.2 — 단순 카운트 + node type/label 별 breakdown ("Send Email × 1,
  // HTTP × 2") 을 함께 제공한다. label 은 node 정의 메타데이터(이미 로컬라이즈
  // 됐거나 영문 type label)를 그대로 사용한다.
  const externalCall = useMemo(() => {
    const counts = new Map<string, number>();
    let count = 0;
    for (const node of workflowNodes) {
      const def: NodeDefinition | undefined = definitions[node.type];
      if (def?.supportsDryRun === true) {
        count += 1;
        const label = def.label ?? node.type;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    const breakdown = [...counts.entries()]
      .map(([label, n]) => `${label} × ${n}`)
      .join(", ");
    return { count, breakdown };
  }, [workflowNodes, definitions]);

  // dry-run 미적용: integration category 인데 supportsDryRun !== true 인 노드가
  // 하나라도 있으면 (spec §7.2 — 백엔드 RERUN_DRY_RUN_NOT_APPLICABLE 와 동일).
  const dryRunDisabled = useMemo(() => {
    return workflowNodes.some((node) => {
      const def: NodeDefinition | undefined = definitions[node.type];
      const category = def?.category ?? node.category;
      return category === "integration" && def?.supportsDryRun !== true;
    });
  }, [workflowNodes, definitions]);

  // dry-run 이 비활성화되면 체크 상태도 강제 해제.
  useEffect(() => {
    if (dryRunDisabled) setDryRun(false);
  }, [dryRunDisabled]);

  const paramKeys = useMemo(
    () => Object.keys(originalParameters),
    [originalParameters],
  );

  const handleParamChange = (key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await executionsApi.reRun(original.id, {
        useOriginalInput,
        ...(useOriginalInput ? {} : { inputOverride: paramValues }),
        dryRun,
      });
      if (onSuccess) {
        onSuccess(result.id);
      } else {
        router.push(
          `/workflows/${original.workflowId}/executions/${result.id}`,
        );
      }
      onClose();
    } catch (err) {
      const code = parseErrorCode(err);
      const key = code ? ERROR_CODE_TO_KEY[code] : undefined;
      toast.error(key ? t(key) : t("history.rerun.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("history.rerun.modal.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 원본 실행 정보 */}
          <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3 text-sm">
            <div className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t("history.rerun.modal.originalLabel")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{original.id}</span>
              <span className="text-[hsl(var(--muted-foreground))]">
                {formatDate(original.startedAt, "datetime")}
              </span>
              <Badge variant="outline">{original.status}</Badge>
            </div>
          </div>

          {/* External-call 노드 안내 — lead 문장 + node type 별 breakdown. */}
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("history.rerun.modal.sideEffectWarning", {
              count: externalCall.count,
            })}
            {externalCall.breakdown && (
              <span className="block text-xs">{externalCall.breakdown}</span>
            )}
          </p>

          {/* Use original input toggle */}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={useOriginalInput}
              onChange={(e) => setUseOriginalInput(e.target.checked)}
            />
            {t("history.rerun.useOriginalInput")}
          </label>

          {/* 입력 폼 — useOriginalInput=ON 이면 read-only */}
          {paramKeys.length > 0 && (
            <div className="flex flex-col gap-2">
              {paramKeys.map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <Label htmlFor={`rerun-param-${key}`}>{key}</Label>
                  <Input
                    id={`rerun-param-${key}`}
                    value={String(paramValues[key] ?? "")}
                    disabled={useOriginalInput}
                    readOnly={useOriginalInput}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* dry-run toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  className={
                    "flex w-fit items-center gap-2 text-sm font-medium" +
                    (dryRunDisabled ? " cursor-not-allowed opacity-60" : "")
                  }
                >
                  <input
                    type="checkbox"
                    checked={dryRun}
                    disabled={dryRunDisabled}
                    onChange={(e) => setDryRun(e.target.checked)}
                  />
                  {t("history.rerun.dryRunToggle")}
                </label>
              </TooltipTrigger>
              {dryRunDisabled && (
                <TooltipContent>
                  {t("history.rerun.dryRunDisabledTooltip")}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("history.rerun.cancelButton")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {t("history.rerun.confirmButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
