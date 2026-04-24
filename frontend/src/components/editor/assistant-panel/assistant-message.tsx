"use client";

import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Info, RotateCw } from "lucide-react";
import type { AssistantDisplayMessage } from "@/lib/stores/assistant-store";
import { useT } from "@/lib/i18n";
import { ToolCallBadge, groupToolCalls } from "./tool-call-badge";
import { PlanCard } from "./plan-card";
import { MarkdownRenderer } from "./markdown-renderer";
import { sanitizeAssistantText } from "./harmony-filter";

interface AssistantMessageViewProps {
  message: AssistantDisplayMessage;
  onApprovePlan: () => void;
  /**
   * `ASSISTANT_TOO_MANY_TOOL_CALLS` 복구 버튼 핸들러. Parent 가 workflow
   * snapshot 을 쥐고 있으므로 bubble 에 직접 주입 대신 콜백을 넘겨받는다.
   */
  onContinueAfterBudget: () => void;
}

/**
 * 에러 코드 중 "다음 turn 한 번으로 resume 가능" 한 것들. 이 집합에 속하면
 * 에러 버블 아래에 "이어서 진행" 버튼을 노출해 사용자 타이핑을 줄인다.
 *  - `ASSISTANT_TOO_MANY_TOOL_CALLS`: 턴당 tool-call / round 상한 초과. 서버가
 *    명시적으로 "이어서 진행해줘" 메시지를 follow-up 으로 기대.
 * 다른 코드 (NO_LLM_CONFIG / STREAM_FAILED) 는 resume 로 복구 불가이므로 제외.
 */
const RESUMABLE_ERROR_CODES = new Set(['ASSISTANT_TOO_MANY_TOOL_CALLS']);

export function AssistantMessageView({
  message,
  onApprovePlan,
  onContinueAfterBudget,
}: AssistantMessageViewProps) {
  const t = useT();
  // hooks must run unconditionally — so sanitize/memo before any early
  // return below. user 메시지 경로에서는 displayText 를 사용하지 않지만,
  // React Hooks 규칙을 지키려면 호출 순서가 매 렌더마다 동일해야 한다.
  //
  // harmony 제어 토큰만 leak 된 assistant 메시지(예: commentary/json 블록)는
  // sanitize 후 빈 문자열이 되므로 bubble 자체를 렌더하지 않는다. 스트리밍
  // 중이면 커서 애니메이션을 위해 bubble 을 유지한다. useMemo 로 content
  // 변경 시에만 regex 가 돌도록 캐시한다.
  const displayText = useMemo(
    () => (message.content ? sanitizeAssistantText(message.content) : ""),
    [message.content],
  );

  if (message.role === "user") {
    // User text stays as plain preformatted content — we don't re-interpret
    // the user's own input as markdown (surprising, and their raw words are
    // what they typed).
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-md bg-[hsl(var(--primary))] px-2.5 py-1.5 text-xs text-[hsl(var(--primary-foreground))]">
          {message.content}
        </div>
      </div>
    );
  }

  // assistant — render markdown so LLM-authored **bold**, lists, fenced code
  // blocks, tables, and links display properly. The blinking cursor is a
  // sibling of the markdown block so it's never caught inside a code fence
  // or other inline element during streaming.
  const showBubble = displayText.length > 0 || message.streaming;
  return (
    <div className="flex flex-col gap-1.5">
      {message.autoResume && (() => {
        // Stall 자동 복구(§10) 로 버블이 분리된 경계. 위 버블과 이 버블 사이에
        // 얇은 divider 로 "🔄 자동으로 이어서 진행했어요" 를 렌더한다.
        // 동일 confirmation 문구가 한 버블에 쌓이는 gpt-oss-120b quirk 의 UX
        // 완화. divider 자체는 conversation 의 signal 이지 message 가 아니므로
        // muted 톤으로 유지해 assistant text 가독성을 침범하지 않는다.
        //
        // `max` 는 실시간 SSE 경로에서만 존재 (rehydrate 시에는 서버 상수 변경
        // 대비 생략 — review W-10). 두 경로가 같은 문구를 공유하지 않고 각자
        // 의미에 맞는 i18n 키를 고른다:
        //   - max 있음 → "(1/2)" 식 진행도 표시 (`autoResumedHint`)
        //   - max 없음 → "(1번째)" 식 순번만 표시 (`autoResumedHintShort`)
        const hint =
          message.autoResume.max !== undefined
            ? t("assistant.autoResumedHint", {
                attempt: message.autoResume.attempt,
                max: message.autoResume.max,
              })
            : t("assistant.autoResumedHintShort", {
                attempt: message.autoResume.attempt,
              });
        return (
          <div
            role="separator"
            aria-label={hint}
            className="flex items-center gap-1.5 pt-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]"
          >
            <RotateCw size={11} className="shrink-0" aria-hidden="true" />
            <span>{hint}</span>
            <span
              className="h-px flex-1 bg-[hsl(var(--border))]"
              aria-hidden="true"
            />
          </div>
        );
      })()}
      {showBubble && (
        <div className="rounded-md bg-[hsl(var(--muted)/0.4)] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
          {displayText && <MarkdownRenderer content={displayText} />}
          {message.streaming && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-current align-[-2px]"
            />
          )}
        </div>
      )}
      {message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {groupToolCalls(message.toolCalls).map((group) => (
            <ToolCallBadge
              key={group.representative.id}
              call={group.representative}
              count={group.count}
            />
          ))}
        </div>
      )}
      {message.plan && (
        <PlanCard plan={message.plan} onApprove={onApprovePlan} canApprove />
      )}
      {message.error && (
        <div
          role="alert"
          // 채도가 낮은 shade (red-800/200) 를 쓰면 배경에 묻혀 "beige-on-beige"
          // 로 읽히고, 사용자는 에러 메세지를 스캔해야 할 순간에 판독 비용이
          // 커진다. systemHint 와 같은 "가장 짙은 950 (light) / 가장 옅은 50
          // (dark)" + `font-medium` 조합으로 작은 11px 글꼴에서도 또렷이
          // 읽히게 한다. 에러 코드 pill 도 red-200/800 대비로 명확히.
          className="flex flex-col gap-1.5 rounded-md border border-red-400/70 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-950 dark:border-red-500/60 dark:bg-red-950/70 dark:text-red-50"
        >
          <div className="flex items-start gap-1.5">
            <AlertCircle size={14} className="mt-[2px] shrink-0" />
            <div className="min-w-0 flex-1">
              <div>{t("assistant.errorBubbleTitle")}</div>
              <div className="mt-0.5 break-words text-[11px] font-normal leading-[1.45]">
                <span className="mr-1 inline-block rounded border border-red-300/80 bg-red-200 px-1 font-mono text-[10px] font-medium text-red-950 dark:border-red-600/70 dark:bg-red-800 dark:text-red-50">
                  {message.error.code}
                </span>
                <span className="break-all">{message.error.message}</span>
              </div>
            </div>
          </div>
          {RESUMABLE_ERROR_CODES.has(message.error.code) && (
            // 버블 내부 버튼 — plan card 의 "계획대로 진행" 과 동일 패턴. 단
            // 클릭으로 parent 가 "이어서 진행해줘" user turn 을 전송하고 서버
            // active-plan-context 가 남은 step 을 이어간다. 에러 라벨 대비로
            // 는 "text-red" 계열 배경을 쓰지 않고, plan approve 버튼과 동일한
            // "고대비 primary" 스타일을 유지해 액션성이 드러나도록 한다.
            <button
              type="button"
              onClick={onContinueAfterBudget}
              className="ml-5 self-start rounded-md bg-[hsl(var(--primary))] px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90"
            >
              {t("assistant.continueAfterBudgetButton")}
            </button>
          )}
        </div>
      )}
      {message.systemHint && (
        <div
          // 배경·테두리·텍스트 색 대비를 확실히 확보한다. 11px 컴팩트 버블에서
          // amber/emerald 계열은 채도가 낮은 shade 를 쓰면 "beige-on-beige"
          // 로 읽혀 가독성이 급격히 떨어진다. 본문은 가장 짙은 950 (light) /
          // 가장 옅은 50 (dark) 로 고정하고 font-medium 으로 stroke 를 실어
          // 소형 글꼴에서도 또렷하게 한다. dark mode 배경은 `/70` 으로 parent
          // bleed-through 를 줄인다.
          //
          // inline `<code>` 는 MarkdownRenderer 의 전역 `--muted` 회색 pill 이
          // 기본값이지만, amber/emerald 바탕 위에서는 회색이 맥락을 깨뜨려
          // pill 경계·글자 모두 흐려진다. 컨테이너 scope 에서만 `[&_code]`
          // override 로 계열색을 입혀 대비 + 문맥 적합성을 동시에 얻는다.
          className={
            message.systemHint.kind === "success"
              ? "flex items-start gap-1.5 rounded-md border border-emerald-400/70 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-950 dark:border-emerald-500/60 dark:bg-emerald-950/70 dark:text-emerald-50 [&_code]:border [&_code]:border-emerald-300/80 [&_code]:bg-emerald-200 [&_code]:text-emerald-950 dark:[&_code]:border-emerald-600/70 dark:[&_code]:bg-emerald-800 dark:[&_code]:text-emerald-50"
              : "flex items-start gap-1.5 rounded-md border border-amber-400/70 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/70 dark:text-amber-50 [&_code]:border [&_code]:border-amber-300/80 [&_code]:bg-amber-200 [&_code]:text-amber-950 dark:[&_code]:border-amber-600/70 dark:[&_code]:bg-amber-800 dark:[&_code]:text-amber-50"
          }
        >
          {message.systemHint.kind === "success" ? (
            <CheckCircle2 size={14} className="mt-[2px] shrink-0" />
          ) : (
            <Info size={14} className="mt-[2px] shrink-0" />
          )}
          <MarkdownRenderer content={message.systemHint.text} />
        </div>
      )}
    </div>
  );
}
