"use client";

import { LlmConfigSelector } from "@/components/llm-config/llm-config-selector";
import { KbSelector } from "@/components/knowledge-base/kb-selector";
import type { WidgetProps } from "./widgets";

/** Auto-form widget wrapping the app's LlmConfigSelector. */
export function LlmConfigSelectorWidget({ value, onChange }: WidgetProps) {
  return (
    <LlmConfigSelector
      value={typeof value === "string" ? value : ""}
      onChange={(v) => onChange(v)}
    />
  );
}

/** Auto-form widget wrapping the app's KbSelector. */
export function KbSelectorWidget({ value, onChange }: WidgetProps) {
  const safe = Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return <KbSelector value={safe} onChange={(v) => onChange(v)} />;
}
