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
import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug";
import { buildExecutionHref } from "@/lib/workspace/href";
import { formatDate } from "@/lib/utils/date";
import { executionsApi } from "@/lib/api/executions";
import type { ExecutionStatus } from "@/lib/api/executions";
import { workflowsApi } from "@/lib/api/workflows";
import type { NodeData } from "@/lib/api/workflows";
import type {
  TriggerParameterDefinition,
  TriggerParameterType,
} from "@/lib/api/triggers";
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
   * 재실행 성공 콜백. 미지정 시 app router 로 활성 워크스페이스 slug 경로
   * `/w/<slug>/workflows/:workflowId/executions/:newId` 로 네비게이션한다.
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

/** Re-run 입력 폼의 렌더 필드 — 스키마에서 도출(또는 원본 값 키 fallback). */
interface RerunField {
  name: string;
  type: TriggerParameterType;
  description?: string;
}

/** 타입별 input 표시 문자열. object/array 는 JSON 문자열로 표기. */
function displayValue(type: TriggerParameterType, value: unknown): string {
  if (value == null) return "";
  if (type === "object" || type === "array") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return String(value);
}

/**
 * raw 문자열을 파라미터 타입으로 coerce. text/number input onChange 와, 스키마
 * 늦게 도착 시 fallback string 값을 재조정하는 effect 양쪽에서 쓴다.
 * boolean → `"true"` 비교, number → 숫자(빈 문자열은 그대로 두어 편집 중 상태 보존),
 * object/array → JSON parse(실패 시 raw 유지 — 편집 중 부분 입력 허용). backend
 * `coerceToType`/`resolveTriggerParameters` 가 native-typed 값을 그대로 수용한다
 * (cross_spec 확인).
 */
function coerceInput(type: TriggerParameterType, raw: string): unknown {
  if (type === "boolean") return raw === "true";
  if (type === "number") return raw === "" ? "" : Number(raw);
  if (type === "object" || type === "array") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function ReRunModal({
  original,
  open,
  onClose,
  onSuccess,
}: ReRunModalProps) {
  const t = useT();
  const slug = useWorkspaceSlug();
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

  // spec §10.2 — 입력 폼 필드는 워크플로 manual_trigger 노드 config.parameters
  // 스키마(라벨·타입)에서 도출한다. 스키마가 없으면(노드 삭제/미로딩) 원본 런타임
  // 값 키를 untyped text 로 fallback 해 데이터 은닉을 피한다.
  const fields = useMemo<RerunField[]>(() => {
    const manualNode = workflowNodes.find((n) => n.type === "manual_trigger");
    const schema = manualNode?.config?.parameters;
    if (Array.isArray(schema) && schema.length > 0) {
      return (schema as TriggerParameterDefinition[]).map((p) => ({
        name: p.name,
        type: p.type,
        description: p.description,
      }));
    }
    return Object.keys(originalParameters).map((name) => ({
      name,
      type: "string" as const,
    }));
  }, [workflowNodes, originalParameters]);

  const setParam = (key: string, value: unknown) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  // 스키마가 비동기 로드되면 fields 가 fallback(all-string)에서 스키마 기반(typed)으로
  // 전환된다. 이때 fallback 구간에 raw string 으로 편집됐을 수 있는 paramValues 를 각
  // 필드 선언 타입으로 1회 재조정한다 — 오염된 문자열이 제출 payload(inputOverride)로
  // 새는 것을 막는다(ai-review side_effect WARNING). 이미 typed(비-string) 값은 skip
  // 하고, fields 변경(노드 로드/원본 변경)에만 반응하며 타이핑(paramValues 변경)에는
  // 재실행되지 않아 활성 편집을 덮어쓰지 않는다.
  useEffect(() => {
    setParamValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of fields) {
        const v = next[f.name];
        if (typeof v !== "string") continue;
        const coerced = coerceInput(f.type, v);
        if (coerced !== v) {
          next[f.name] = coerced;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fields]);

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
          buildExecutionHref(slug, original.workflowId, result.id),
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
              {/* spec §10.2 — ID 클릭 시 새 탭으로 원본 실행 상세 페이지. */}
              <a
                href={buildExecutionHref(slug, original.workflowId, original.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[hsl(var(--primary))] underline underline-offset-2 hover:opacity-80"
              >
                {original.id}
              </a>
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

          {/* 입력 폼 — manual_trigger 스키마 기반 typed 필드. ON 시 read-only */}
          {fields.length > 0 && (
            <div className="flex flex-col gap-2">
              {fields.map((field) => {
                const inputId = `rerun-param-${field.name}`;
                const value = paramValues[field.name];
                if (field.type === "boolean") {
                  return (
                    <label
                      key={field.name}
                      htmlFor={inputId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={value === true || value === "true"}
                        disabled={useOriginalInput}
                        onChange={(e) => setParam(field.name, e.target.checked)}
                      />
                      <span>{field.name}</span>
                      {field.description && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {field.description}
                        </span>
                      )}
                    </label>
                  );
                }
                return (
                  <div key={field.name} className="flex flex-col gap-1">
                    <Label htmlFor={inputId}>{field.name}</Label>
                    <Input
                      id={inputId}
                      type={field.type === "number" ? "number" : "text"}
                      value={displayValue(field.type, value)}
                      disabled={useOriginalInput}
                      readOnly={useOriginalInput}
                      onChange={(e) =>
                        setParam(field.name, coerceInput(field.type, e.target.value))
                      }
                    />
                    {field.description && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {field.description}
                      </span>
                    )}
                  </div>
                );
              })}
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
