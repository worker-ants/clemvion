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
 * UUIDs mentally.
 */
export function ToolCallBadge({ call }: { call: AssistantToolCallRecord }) {
  const ok = (call.result as { ok?: boolean } | null)?.ok ?? true;
  const failed = ok === false;
  const label = summarize(call);
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
