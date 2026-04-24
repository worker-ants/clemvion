"use client";

import {
  Search,
  Plus,
  Pencil,
  Trash2,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import type { AssistantToolCallRecord } from "@/lib/api/assistant";
import { useT } from "@/lib/i18n";

/**
 * `mergeRecoveryGroups` 가 "실패 → 같은 대상 성공" 을 1건으로 축약할지 판정
 * 하는 에러 코드 화이트리스트 (review W-6/W-9 — 모듈 최상위로 승격해 렌더마다
 * Set 재생성 비용 제거 + 에러 코드 문자열을 한 곳에 모음). 서버가 각각의
 * 에러에 대해 `knownPorts` / cascading FIFO / label-lookalike 로 "다음 라운드
 * 자연 복구" 를 설계한 경로만 포함 — `LABEL_CONFLICT` / `CYCLE_DETECTED` 처럼
 * 사용자·디버거에게 실패를 명시적으로 보여주는 편이 유용한 코드는 제외.
 */
const RECOVERABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "PORT_NOT_FOUND",
  "NODE_NOT_FOUND",
  // handler.validate 가 shadow add/update 에서 domain rule 위반 (버튼 수 상한,
  // 필수 필드 누락 등) 을 거부한 케이스. LLM 이 같은 턴 내 수정 후 재시도로
  // 자연 복구되는 경로라 retry-recovered 축약 대상에 포함.
  "INVALID_NODE_CONFIG",
]);

/**
 * Compact badge summarizing one tool call in the chat transcript. Edit tools
 * show the acted-upon label when available so the user doesn't have to match
 * UUIDs mentally. When the caller passes `count`, the badge renders in
 * "group" mode with a `× N` suffix — used by the message view to collapse
 * long runs of identical operations (e.g. `update_node:position × 15`).
 *
 * `retried` 그룹은 "PORT_NOT_FOUND / NODE_NOT_FOUND 로 한 번 실패 후 곧바로
 * 같은 source/target 에 대한 성공" 을 1건으로 묶은 케이스 (ED-AI-40 B안).
 * 성공 색을 유지하면서 suffix 로 "재시도 후 성공" 을 덧붙이고, 제목(title)
 * 에 원 실패 이유를 남겨 디버깅 정보를 보존한다.
 */
export function ToolCallBadge({
  call,
  count,
  retried,
  retriedFromError,
}: {
  call: AssistantToolCallRecord;
  count?: number;
  retried?: boolean;
  /** retried 일 때 tooltip 에 표시할 원본 실패 에러 코드 (예: 'PORT_NOT_FOUND'). */
  retriedFromError?: string;
}) {
  const t = useT();
  const ok = (call.result as { ok?: boolean } | null)?.ok ?? true;
  const failed = ok === false;
  const base = summarize(call);
  // review I-3: retried 아닐 땐 i18n 함수 호출을 생략해 불필요한 lookup 회피.
  const retrySuffixText = retried
    ? t("assistant.toolCallBadgeRetryRecovered")
    : null;
  const retrySuffix = retrySuffixText ? ` (${retrySuffixText})` : "";
  const label =
    typeof count === "number" && count > 1
      ? `${base} × ${count}${retrySuffix}`
      : `${base}${retrySuffix}`;
  const iconName = pickIconName(call.name, failed);
  const color = failed
    ? "bg-red-500/10 text-red-600 border-red-500/30"
    : call.kind === "explore"
      ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  // review I-12: conditional spread 제거 — `title={undefined}` 는 DOM 에
  // attribute 를 생성하지 않으므로 명시 할당이 안전하고 가독성 좋음.
  const title =
    retried && retriedFromError && retrySuffixText
      ? `${retrySuffixText} — ${retriedFromError}`
      : undefined;
  return (
    <div
      className={`flex items-center gap-1.5 rounded border px-2 py-[3px] text-[11px] ${color}`}
      title={title}
    >
      {iconName === "alert" && <AlertCircle size={12} className="shrink-0" />}
      {iconName === "plus" && <Plus size={12} className="shrink-0" />}
      {iconName === "pencil" && <Pencil size={12} className="shrink-0" />}
      {iconName === "trash" && <Trash2 size={12} className="shrink-0" />}
      {iconName === "branch" && <GitBranch size={12} className="shrink-0" />}
      {iconName === "search" && <Search size={12} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
  );
}

function pickIconName(
  name: string,
  failed: boolean,
): "alert" | "plus" | "pencil" | "trash" | "branch" | "search" {
  if (failed) return "alert";
  if (name === "add_node") return "plus";
  if (name === "update_node") return "pencil";
  if (name === "remove_node" || name === "remove_edge") return "trash";
  if (name === "add_edge") return "branch";
  return "search";
}

/**
 * 같은 종류의 tool_call 을 묶어 "×N" 배지로 압축한다. 판정 기준인
 * `signatureOf` 는 "사용자 관점에서 동일해 보이는 action" 을 묶는다:
 *  - update_node: patch 필드 집합 (예: `update_node:position`, `update_node:config`)
 *  - add_node:    노드 타입 (예: `add_node:http_request`)
 *  - 그 외:       name 만
 * 같은 signature 가 **연속해서** 2개 이상 나오면 하나의 그룹으로 축약한다
 * (3개 기준으로 하면 중간 크기 plan 에서 여전히 시끄러움 → 2개로 낮춤).
 *
 * 그룹의 대표 call 로는 **실패가 섞여 있으면 실패 중 첫 번째**, 그 외에는
 * 마지막 성공을 쓴다 — 에러 표시가 묻히지 않도록. 실패가 섞인 경우에는
 * 실패 건만 별도 그룹으로 쪼개도록 signature 에 `:err` 를 붙인다.
 */
export interface ToolCallGroup {
  representative: AssistantToolCallRecord;
  count: number;
  /**
   * ED-AI-40 B 안: `PORT_NOT_FOUND` / `NODE_NOT_FOUND` 실패가 직후 같은
   * source/target 성공으로 이어진 "자연 복구" 시퀀스를 한 그룹으로 묶은 경우.
   * 렌더러는 성공 색 + "(재시도 후 성공)" suffix 로 표시해 "잦은 실패"
   * 체감을 줄인다.
   */
  retried?: boolean;
  /** retried 그룹일 때 tooltip 에 노출할 원본 실패 에러 코드. */
  retriedFromError?: string;
}

export function groupToolCalls(
  calls: AssistantToolCallRecord[],
): ToolCallGroup[] {
  const groups: ToolCallGroup[] = [];
  let currentSig: string | null = null;
  for (const call of calls) {
    const sig = signatureOf(call);
    const last = groups[groups.length - 1];
    if (last && sig === currentSig) {
      last.count += 1;
      // 성공이 추가되면 대표를 그대로 유지 (첫 번째가 성공이었다면 그대로)
      // 실패는 signature 가 달라 같은 그룹에 들어오지 않으므로 신경 쓸 것 없음
    } else {
      groups.push({ representative: call, count: 1 });
      currentSig = sig;
    }
  }
  return mergeRecoveryGroups(groups);
}

/**
 * 인접 그룹 쌍 중 **[count=1 실패 배지] → [성공 배지]** 패턴을 하나의
 * "재시도 후 성공" 그룹으로 축약한다 (ED-AI-40 B 안).
 *
 * 대상 조건:
 *  - 실패 그룹의 에러 코드가 `PORT_NOT_FOUND` 또는 `NODE_NOT_FOUND` (서버가
 *    `knownPorts` / cascading FIFO 로 "다음 라운드 자연 복구" 를 설계한 경로).
 *  - 같은 tool 이름이고 (`add_edge` / `update_node` / `remove_node` / `add_node`),
 *    edit 대상 identity (add_edge: source_id+target_id, 그 외: id) 가 일치.
 *  - 실패 그룹의 count 가 1 (여러 번 실패가 쌓인 그룹은 진짜 문제라 축약 안함).
 *  - 직후 그룹이 같은 identity 의 성공. count 는 1+ (그룹 내 성공 연쇄는 그대로
 *    계승되고 대표 배지는 성공 쪽으로 유지).
 *
 * 다른 에러 코드(LABEL_CONFLICT·CYCLE_DETECTED 등)는 축약하지 않는다 —
 * 사용자·디버거가 실제 실패를 보는 가치가 더 크다.
 */
function mergeRecoveryGroups(groups: ToolCallGroup[]): ToolCallGroup[] {
  if (groups.length < 2) return groups;
  const out: ToolCallGroup[] = [];
  for (let i = 0; i < groups.length; i++) {
    const fail = groups[i];
    const next = groups[i + 1];
    if (
      next &&
      fail.count === 1 &&
      isFailedCall(fail.representative) &&
      !isFailedCall(next.representative) &&
      RECOVERABLE_ERROR_CODES.has(errorCodeOf(fail.representative) ?? "") &&
      isSameEditTarget(fail.representative, next.representative)
    ) {
      out.push({
        representative: next.representative,
        count: next.count,
        retried: true,
        retriedFromError: errorCodeOf(fail.representative) ?? undefined,
      });
      i++; // 다음 그룹은 이미 흡수됨.
      continue;
    }
    out.push(fail);
  }
  return out;
}

function isFailedCall(call: AssistantToolCallRecord): boolean {
  return (call.result as { ok?: boolean } | null)?.ok === false;
}

function errorCodeOf(call: AssistantToolCallRecord): string | null {
  const r = call.result as { error?: unknown } | null;
  return typeof r?.error === "string" ? r.error : null;
}

function isSameEditTarget(
  a: AssistantToolCallRecord,
  b: AssistantToolCallRecord,
): boolean {
  if (a.name !== b.name) return false;
  if (a.name === "add_edge") {
    // source/target 쌍이 완전히 같을 때만 "같은 간선의 재시도" 로 판정.
    // port 값은 바뀌는 게 정상이라 무시.
    return (
      readEdgeEndpoint(a, "source") === readEdgeEndpoint(b, "source") &&
      readEdgeEndpoint(a, "target") === readEdgeEndpoint(b, "target")
    );
  }
  if (a.name === "update_node" || a.name === "remove_node") {
    // review I-4: `add_node` 는 recovery 축약 대상에서 제외. add_node 의
    // 성공 응답이 id 를 server 에서 발급하므로 "같은 id 의 재시도" 라는
    // 개념이 성립하지 않고, label-기반 매칭도 `LABEL_CONFLICT → 재시도 성공`
    // 같은 의도적 실패 경로와 섞이면 false positive 를 만든다.
    const aId = (a.arguments as { id?: unknown })?.id;
    const bId = (b.arguments as { id?: unknown })?.id;
    return (
      typeof aId === "string" && aId.length > 0 && aId === bId
    );
  }
  return false;
}

/**
 * `add_edge` 의 source/target id 를 인자에서 꺼낸다. snake_case(`source_id`)
 * 와 camelCase(`sourceId`) 를 모두 받는 이유: LLM provider 마다 arg 이름
 * 케이스를 조금씩 다르게 내는 사례가 있어 양쪽 모두 수용해야 recovery
 * 매칭이 안정적이다 (review I-13).
 */
function readEdgeEndpoint(
  call: AssistantToolCallRecord,
  side: "source" | "target",
): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  const snake = side === "source" ? "source_id" : "target_id";
  const camel = side === "source" ? "sourceId" : "targetId";
  const v = args[snake] ?? args[camel];
  return typeof v === "string" ? v : undefined;
}

function signatureOf(call: AssistantToolCallRecord): string {
  const result = call.result as { ok?: boolean } | null;
  const failed = result?.ok === false;
  const suffix = failed ? ":err" : "";
  const args = call.arguments;
  if (call.name === "update_node") {
    const patch = (args.patch as Record<string, unknown> | undefined) ?? {};
    const keys = Object.keys(patch).sort().join(",") || "any";
    return `update_node:${keys}${suffix}`;
  }
  if (call.name === "add_node") {
    return `add_node:${String(args.type ?? "any")}${suffix}`;
  }
  return `${call.name}${suffix}`;
}

function summarize(call: AssistantToolCallRecord): string {
  const args = call.arguments;
  if (call.name === "add_node") {
    return `+ ${String(args.label ?? args.type ?? "node")}`;
  }
  if (call.name === "update_node") {
    const patch = (args.patch as Record<string, unknown> | undefined) ?? {};
    const keys = Object.keys(patch).join(", ");
    return `✎ ${keys || "node"}`;
  }
  if (call.name === "remove_node") return "− node";
  if (call.name === "add_edge") return "→ edge";
  if (call.name === "remove_edge") return "− edge";
  if (call.name === "list_integrations") return "integrations";
  if (call.name === "list_workflows") return "workflows";
  if (call.name === "get_workflow") return "workflow ref";
  if (call.name === "get_node_schema") return `schema: ${String(args.type ?? "")}`;
  if (call.name === "list_knowledge_bases") return "knowledge bases";
  if (call.name === "get_workflow_executions") {
    // 요약 라벨에 "상태 필터 유무" 와 "돌려받은 건수" 를 동시에 담아 사용자가
    // 배지만 보고 어시스턴트가 어떤 의도로 리스트를 뒤졌는지 파악할 수 있다.
    const status = typeof args.status === "string" ? args.status : undefined;
    const items =
      (call.result as { items?: unknown[] } | null)?.items;
    const count = Array.isArray(items) ? items.length : undefined;
    const prefix = status ? `executions (${status})` : "executions";
    return count !== undefined ? `${prefix}: ${count}` : prefix;
  }
  if (call.name === "get_execution_details") {
    const timeline =
      (call.result as { timeline?: unknown[] } | null)?.timeline;
    const count = Array.isArray(timeline) ? timeline.length : undefined;
    return count !== undefined
      ? `execution detail: ${count} nodes`
      : "execution detail";
  }
  return call.name;
}
