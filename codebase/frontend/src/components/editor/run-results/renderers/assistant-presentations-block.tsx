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
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §4.1 — "presentationTools[].defaults 에
   * buttons 를 넣더라도 클릭은 다음 LLM turn 의 user 메시지로 흡수" 원칙.
   * presentation 노드의 graph-port 분기와 달리 AI Agent 안의 render_* 도구는
   * 버튼 클릭 시 그 라벨을 다음 user message 로 LLM 에 전달한다 (form 흐름
   * 과 동일). 미지정 시 버튼 자체가 disabled 처럼 보이는 회귀가 발생 (PR #272
   * 머지 후 사용자 보고).
   */
  onSendMessage?: (message: string) => void;
}

function findButtonLabel(
  data: Record<string, unknown>,
  buttonId: string,
): string | undefined {
  // Resolve a clicked button's user-visible label from the rendered payload.
  // CarouselContent / TemplateContent / TableContent / ChartContent all carry
  // their button definitions inside `config.buttonConfig.buttons` (canonical
  // location after the resume-flow refactor). Per-item carousel buttons live
  // in items[].buttons. Fall back to the buttonId itself if nothing matches.
  const cfg = (data?.config as Record<string, unknown> | undefined) ?? data;
  const btnConfig = cfg?.buttonConfig as Record<string, unknown> | undefined;
  const buttons = (btnConfig?.buttons ?? data?.buttons ?? []) as Array<{
    id?: string;
    label?: string;
  }>;
  for (const b of buttons) {
    if (b.id === buttonId && typeof b.label === "string") return b.label;
  }
  // Carousel per-item buttons (id format: `${buttonId}__item_${idx}`).
  const items = (data?.items ?? []) as Array<Record<string, unknown>>;
  for (const item of items) {
    const itemButtons = (item.buttons ?? []) as Array<{
      id?: string;
      label?: string;
    }>;
    for (const b of itemButtons) {
      if (
        typeof b.id === "string" &&
        typeof b.label === "string" &&
        (b.id === buttonId || buttonId.startsWith(`${b.id}__item_`))
      ) {
        return b.label;
      }
    }
  }
  return undefined;
}

function PresentationItem({
  p,
  onPortButtonClick,
  onLinkButtonClick,
}: {
  p: PresentationPayload;
  onPortButtonClick?: (buttonId: string) => void;
  onLinkButtonClick?: (url: string) => void;
}) {
  const data = p.payload as Record<string, unknown>;
  switch (p.type) {
    case "table":
      return <TableContent data={data} />;
    case "chart":
      return <ChartContent data={data} config={data} />;
    case "carousel":
      return (
        <CarouselContent
          data={data}
          config={data}
          onPortButtonClick={onPortButtonClick}
          onLinkButtonClick={onLinkButtonClick}
        />
      );
    case "template":
      return <TemplateContent data={data} config={data} />;
    case "form":
      // `render_form` blocking interactive flow renders the live form input
      // via DynamicFormUI in result-detail.tsx; this branch is the display-
      // only summary used when a form payload reaches the assistant turn
      // outside the blocking flow.
      return <FormSubmittedContent data={data} />;
    default:
      return null;
  }
}

export function AssistantPresentationsBlock({
  presentations,
  onSendMessage,
}: AssistantPresentationsBlockProps) {
  if (!presentations || presentations.length === 0) return null;

  // spec §4.1 — port-style buttons dispatch the button label as a user
  // message to the LLM rather than routing to a graph port (since AI Agent
  // tool family is "expression-only" and never routes to workflow edges).
  const handlePortButtonClick = (
    payload: Record<string, unknown>,
    buttonId: string,
  ) => {
    if (!onSendMessage) return;
    const label = findButtonLabel(payload, buttonId) ?? buttonId;
    onSendMessage(label);
  };
  const handleLinkButtonClick = (url: string) => {
    if (typeof window !== "undefined" && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

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
          <PresentationItem
            p={p}
            onPortButtonClick={
              onSendMessage
                ? (buttonId) =>
                    handlePortButtonClick(
                      p.payload as Record<string, unknown>,
                      buttonId,
                    )
                : undefined
            }
            onLinkButtonClick={onSendMessage ? handleLinkButtonClick : undefined}
          />
        </div>
      ))}
    </div>
  );
}
