"use client";

import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { AssistantDisplayMessage } from "@/lib/stores/assistant-store";
import { useT } from "@/lib/i18n";
import { ToolCallBadge, groupToolCalls } from "./tool-call-badge";
import { PlanCard } from "./plan-card";
import { MarkdownRenderer } from "./markdown-renderer";
import { sanitizeAssistantText } from "./harmony-filter";

interface AssistantMessageViewProps {
  message: AssistantDisplayMessage;
  onApprovePlan: () => void;
}

export function AssistantMessageView({
  message,
  onApprovePlan,
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
          className="flex items-start gap-1.5 rounded-md border border-red-400/60 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-900 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100"
        >
          <AlertCircle size={14} className="mt-[2px] shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">
              {t("assistant.errorBubbleTitle")}
            </div>
            <div className="break-words text-[10px] text-red-800 dark:text-red-200">
              <span className="font-mono">[{message.error.code}]</span>{" "}
              {message.error.message}
            </div>
          </div>
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
