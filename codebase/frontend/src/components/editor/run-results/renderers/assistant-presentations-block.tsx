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
} from "./presentation-renderers";
import { DynamicFormUI } from "../dynamic-form-ui";

interface AssistantPresentationsBlockProps {
  presentations: PresentationPayload[];
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §4.1 + spec/4-nodes/6-presentation/0-common.md
   * §10.8 — "presentationTools[].defaults 에 buttons 를 넣더라도 클릭은 다음
   * LLM turn 의 user 메시지로 흡수" 원칙. presentation 노드의 graph-port 분기와
   * 달리 AI Agent 안의 render_* 도구는 버튼 클릭 시 합성된 user message 를 다음
   * turn 으로 LLM 에 전달한다 (form 흐름과 동일). 합성 우선순위:
   * `button.userMessage` (LLM-author) → `"{item.title} → {label}"` (per-item) →
   * `"{label}"` (global) → `buttonId` (fallback). 미지정 시 버튼이 disabled 처럼
   * 보이는 회귀가 발생 (PR #272 머지 후 사용자 보고).
   */
  onSendMessage?: (message: string) => void;
  /**
   * spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + spec/4-nodes/6-presentation/
   * 0-common.md §10.6 — `render_form` 활성 form 의 UI 단일 진실.
   * `payload.toolCallId === pendingFormToolCallId` 매칭 시 interactive
   * `DynamicFormUI` 로, 그 외 `FormSubmittedContent` 로 렌더.
   *
   * store selector 로 `waitingConversationConfig.pendingFormToolCall.toolCallId`
   * 를 가져와 SummaryView / SelectedItemDetail 양쪽에서 동일 selector 사용.
   */
  pendingFormToolCallId?: string | null;
  /**
   * Active form 제출 콜백. caller (ResultDetail / ExecutionDetailPage) 가
   * `commands.submitForm(data)` + `resumeFromAiRenderForm()` 호출 책임.
   */
  onSubmitForm?: (data: Record<string, unknown>) => void;
}

/**
 * Minimal button shape surfaced by `findButtonContext`. Carries only the fields
 * needed for user-message synthesis — not the full Zod schema output.
 */
export interface ButtonDef {
  id?: string;
  label?: string;
  type?: string;
  userMessage?: string;
}

/**
 * Return type of `findButtonContext`. Shared by `findButtonContext` and
 * `composeUserMessage` so both helpers reference the same named shape.
 */
export interface ButtonContext {
  button: ButtonDef;
  item?: Record<string, unknown>;
}

/**
 * @internal — exported for testing only; not part of the public API.
 *
 * 클릭된 버튼 정의 + (per-item 인 경우) 부모 아이템을 함께 해석한다.
 *
 * spec/4-nodes/6-presentation/0-common.md §10.8 — user-message 합성 SoT.
 *
 * 검색 우선순위 (specific → general):
 *   1. `items[].buttons` (static 모드 per-item 버튼) — 가장 구체적인 정의 위치.
 *      spec §3 step 1 에 따라 같은 button id 가 `buttonConfig.buttons` 에도 합쳐져
 *      들어가지만, 부모 item 컨텍스트는 본 경로에서만 얻을 수 있으므로 먼저 검색.
 *   2. `config.itemButtons` definitions (dynamic 모드) + buttonId 의 `__item_{idx}`
 *      suffix → `items[idx]` 부모 매핑.
 *   3. `config.buttonConfig.buttons` / `data.buttons` (global 버튼 — 부모 item 없음).
 *      dynamic 모드의 synthesized runtime button (`{base}__item_{idx}`) 도 본 경로
 *      에서 매칭되며, 이 경우 suffix 로 부모 아이템 보충.
 *
 * `userMessage` 옵션 필드도 함께 보존된다 (spec §1).
 *
 * (`findButtonLabel` 의 후속 — label 만 반환하던 helper 를 user-message 합성
 *  단계가 필요로 하는 `ButtonContext` 구조로 확장.)
 */
export function findButtonContext(
  data: Record<string, unknown>,
  buttonId: string,
): ButtonContext | undefined {
  const cfg = (data?.config as Record<string, unknown> | undefined) ?? data;
  const btnConfig = cfg?.buttonConfig as Record<string, unknown> | undefined;
  const items = (data?.items ?? []) as Array<Record<string, unknown>>;

  // Dynamic per-item runtime ID 패턴: `{base}__item_{idx}` (spec §1.1 reserved
  // separator). suffix 가 있으면 items[idx] 가 부모 아이템.
  const dynamicMatch = buttonId.match(/__item_(\d+)$/);
  const dynamicIdx = dynamicMatch
    ? Number.parseInt(dynamicMatch[1], 10)
    : null;
  const dynamicItem =
    dynamicIdx !== null &&
    Number.isFinite(dynamicIdx) &&
    dynamicIdx >= 0 &&
    dynamicIdx < items.length
      ? items[dynamicIdx]
      : undefined;

  // 1. static 모드 per-item buttons — 부모 item 컨텍스트가 가장 풍부한 경로
  for (const item of items) {
    const itemButtons = (item.buttons ?? []) as ButtonDef[];
    for (const b of itemButtons) {
      if (typeof b.id === "string" && b.id === buttonId) {
        return { button: b, item };
      }
    }
  }

  // 2. dynamic mode itemButtons definitions — `__item_{idx}` suffix 로 매칭
  const itemButtons = (cfg?.itemButtons ?? []) as ButtonDef[];
  for (const b of itemButtons) {
    if (typeof b.id === "string" && buttonId.startsWith(`${b.id}__item_`)) {
      return { button: b, item: dynamicItem };
    }
  }

  // 3. global buttons + dynamic synthesized runtime buttons (fallback)
  const buttons = (btnConfig?.buttons ?? data?.buttons ?? []) as ButtonDef[];
  for (const b of buttons) {
    if (b.id === buttonId) {
      return { button: b, item: dynamicItem };
    }
  }

  return undefined;
}

/** Maximum character length accepted for a synthesized user message (mirrors backend .max(500)). */
const USER_MESSAGE_MAX_LEN = 500;

/**
 * Sanitize a candidate user-message string: strip leading/trailing whitespace,
 * enforce max length, and reject dangerous URI schemes (`javascript:`, `data:`,
 * `vbscript:`). Returns `null` when the value should be treated as absent.
 * Pure plain-text channel — chat renders the string verbatim, no HTML parsing.
 */
function sanitizeUserMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  return trimmed.length > USER_MESSAGE_MAX_LEN
    ? trimmed.slice(0, USER_MESSAGE_MAX_LEN)
    : trimmed;
}

/**
 * @internal — exported for testing only; not part of the public API.
 *
 * 버튼 컨텍스트로부터 chat 에 발화될 user message 텍스트를 합성한다.
 *
 * spec/4-nodes/6-presentation/0-common.md §10.8 — 우선순위:
 *   1. `button.userMessage` (LLM-author override). 빈 문자열·위험 스킴 무시.
 *   2. per-item 버튼 → `"{item.title} → {label}"`.
 *   3. global 버튼 → `"{label}"`.
 *   4. 라벨 없음 / 매칭 실패 → `buttonId` 그대로.
 *
 * U+2192 (` → `) 구분자는 locale-agnostic — 한·영 동일 형식 (spec §Rationale).
 */
export function composeUserMessage(
  ctx: ButtonContext | undefined,
  buttonId: string,
): string {
  if (!ctx) return buttonId;
  const rawUserMessage = ctx.button.userMessage;
  if (typeof rawUserMessage === "string" && rawUserMessage.length > 0) {
    const sanitized = sanitizeUserMessage(rawUserMessage);
    if (sanitized !== null) return sanitized;
  }
  const label = ctx.button.label;
  if (typeof label !== "string" || label.length === 0) {
    return buttonId;
  }
  const itemTitle = (ctx.item as { title?: unknown } | undefined)?.title;
  if (typeof itemTitle === "string" && itemTitle.length > 0) {
    return `${itemTitle} → ${label}`;
  }
  return label;
}

function PresentationItem({
  p,
  onPortButtonClick,
  onLinkButtonClick,
  pendingFormToolCallId,
  onSubmitForm,
}: {
  p: PresentationPayload;
  onPortButtonClick?: (buttonId: string) => void;
  onLinkButtonClick?: (url: string) => void;
  pendingFormToolCallId?: string | null;
  onSubmitForm?: (data: Record<string, unknown>) => void;
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
    case "form": {
      // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — 활성 form 의 UI 단일
      // 진실은 assistant turn 의 timeline 인라인 (interactive `DynamicFormUI`).
      // 제출 완료된 form payload 는 ToolCallBadge (`🔧 render_form`) 가 이미
      // 도구 호출을 표시하고 있고, 제출된 사용자 데이터는 별도
      // `presentation_user` turn 카드 (`<nodeLabel> · 폼 제출` + key-value)
      // 에 그려진다. 본 분기에서 추가로 form schema raw JSON 을 dump 하면
      // 중복·노이즈이므로 null 반환 — 사용자 보고 (2026-05-23 "도구 호출 형태로
      // 표기").
      const isActive =
        !!pendingFormToolCallId &&
        !!p.toolCallId &&
        p.toolCallId === pendingFormToolCallId &&
        !!onSubmitForm;
      if (isActive) {
        return (
          <DynamicFormUI
            key={p.toolCallId}
            formConfig={data}
            onSubmit={onSubmitForm!}
          />
        );
      }
      // submitted 상태 — ToolCallBadge + presentation_user 카드가 이미 표현 담당.
      return null;
    }
    default:
      return null;
  }
}

export function AssistantPresentationsBlock({
  presentations,
  onSendMessage,
  pendingFormToolCallId,
  onSubmitForm,
}: AssistantPresentationsBlockProps) {
  if (!presentations || presentations.length === 0) return null;

  // spec §4.1 / §10.8 — port-style buttons dispatch a synthesized user
  // message to the LLM rather than routing to a graph port (since AI Agent
  // tool family is "expression-only" and never routes to workflow edges).
  // 우선순위: button.userMessage (LLM-author) → "{item.title} → {label}"
  // (per-item) → label (global) → buttonId (fallback). 합성 로직은
  // composeUserMessage 헬퍼가 SoT.
  const handlePortButtonClick = (
    payload: Record<string, unknown>,
    buttonId: string,
  ) => {
    if (!onSendMessage) return;
    const ctx = findButtonContext(payload, buttonId);
    onSendMessage(composeUserMessage(ctx, buttonId));
  };
  const handleLinkButtonClick = (url: string) => {
    if (typeof window !== "undefined" && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // SummaryView (conversation-inspector.tsx) wraps each assistant message row
  // in an outer `<div role="button" onClick={...}>` that selects the turn.
  // Inner buttons inside the rendered presentation (carousel "주문하기",
  // template buttons, form submit, etc.) bubble their click event up to that
  // outer handler — turn selection fires, the inner onClick effect (sendMessage
  // dispatch) is overshadowed because the UI swaps to SelectedItemDetail.
  //
  // Containment fix: every click/keydown originating inside this block is
  // stopped at the outermost wrapper so it never reaches the parent row's
  // selection handler. Inner interactive elements still receive their own
  // event (stopPropagation does not cancel the target's handler) so buttons,
  // links, and form fields all keep their semantics. The outer wrapper has
  // no onClick of its own — propagation stop is the only behaviour.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="mt-3 flex flex-col gap-3"
      onClick={stop}
      onKeyDown={stop}
    >
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
            pendingFormToolCallId={pendingFormToolCallId}
            onSubmitForm={onSubmitForm}
          />
        </div>
      ))}
    </div>
  );
}
