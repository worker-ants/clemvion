"use client";

/**
 * AssistantPresentationsBlock — AI Agent 가 `render_*` tool family
 * (spec/4-nodes/3-ai/1-ai-agent.md §4.1, §7.10) 로 emit 한 페이로드를 chat UI
 * 의 `ai_assistant` 본문 아래에 inline 으로 렌더한다.
 *
 * 같은 turn 의 텍스트 응답 (`item.content`) + 표·차트·캐러셀·템플릿이
 * 한 카드 안에 함께 표시되는 SoT (spec §10.6). 그래프 상의 presentation
 * 노드와 시각 일관성을 위해 기존 `TableContent` / `CarouselContent` /
 * `ChartContent` / `TemplateContent` / `FormSubmittedContent` 를 그대로
 * 재사용한다 — drift 방지.
 */

import type { PresentationPayload } from "@/lib/conversation/conversation-utils";
import {
  TableContent,
  CarouselContent,
  ChartContent,
  TemplateContent,
  FormSubmittedContent,
} from "./presentation-renderers";

interface AssistantPresentationsBlockProps {
  presentations: PresentationPayload[];
}

function PresentationItem({ p }: { p: PresentationPayload }) {
  const data = p.payload as Record<string, unknown>;
  switch (p.type) {
    case "table":
      return <TableContent data={data} />;
    case "chart":
      return <ChartContent data={data} config={data} />;
    case "carousel":
      return <CarouselContent data={data} config={data} />;
    case "template":
      return <TemplateContent data={data} config={data} />;
    case "form":
      // `render_form` blocking interactive flow is phase 2b; the display-only
      // preview falls back to the form-submitted summary so the assistant
      // turn still has something visible when the LLM emits a form payload
      // outside the multi-turn interactive flow.
      return <FormSubmittedContent data={data} />;
    default:
      return null;
  }
}

export function AssistantPresentationsBlock({
  presentations,
}: AssistantPresentationsBlockProps) {
  if (!presentations || presentations.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-3">
      {presentations.map((p, idx) => (
        <div
          key={`${p.toolCallId || p.type}-${idx}`}
          className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <span>🤖</span>
            <span>render_{p.type}</span>
            {p.truncation?.itemsTruncated || p.truncation?.rowsTruncated ? (
              <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400">
                truncated · total{" "}
                {p.truncation.itemsTotalCount ?? p.truncation.rowsTotalCount}
              </span>
            ) : null}
          </div>
          <PresentationItem p={p} />
        </div>
      ))}
    </div>
  );
}
