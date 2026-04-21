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

/**
 * Compact badge summarizing one tool call in the chat transcript. Edit tools
 * show the acted-upon label when available so the user doesn't have to match
 * UUIDs mentally. When the caller passes `count`, the badge renders in
 * "group" mode with a `× N` suffix — used by the message view to collapse
 * long runs of identical operations (e.g. `update_node:position × 15`).
 */
export function ToolCallBadge({
  call,
  count,
}: {
  call: AssistantToolCallRecord;
  count?: number;
}) {
  const ok = (call.result as { ok?: boolean } | null)?.ok ?? true;
  const failed = ok === false;
  const base = summarize(call);
  const label =
    typeof count === "number" && count > 1 ? `${base} × ${count}` : base;
  const iconName = pickIconName(call.name, failed);
  const color = failed
    ? "bg-red-500/10 text-red-600 border-red-500/30"
    : call.kind === "explore"
      ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return (
    <div
      className={`flex items-center gap-1.5 rounded border px-2 py-[3px] text-[11px] ${color}`}
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
  return groups;
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
  return call.name;
}
