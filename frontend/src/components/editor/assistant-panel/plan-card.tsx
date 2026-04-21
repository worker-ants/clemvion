"use client";

import { useState } from "react";
import { Check, CircleDashed, AlertCircle, Send } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { AssistantPlanCard } from "@/lib/stores/assistant-store";

interface PlanCardProps {
  plan: AssistantPlanCard;
  onApprove: () => void;
  onAnswerQuestions?: (answer: string) => void;
  canApprove: boolean;
  isStreaming?: boolean;
}

const ANSWER_MAX_LENGTH = 4000;

export function PlanCard({
  plan,
  onApprove,
  onAnswerQuestions,
  canApprove,
  isStreaming = false,
}: PlanCardProps) {
  const t = useT();
  const hasQuestions = !!plan.openQuestions && plan.openQuestions.length > 0;
  // plan 이 이미 approved 된 뒤에는 답변 입력창을 숨긴다. 실행 완료된 plan
  // 카드에서 textarea 가 남아있으면 사용자가 의미 없는 추가 메시지를
  // 보내기 쉽다.
  const showAnswerInput =
    hasQuestions && !!onAnswerQuestions && !plan.approved;
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmed = answer.trim();
  const canSubmitAnswer =
    showAnswerInput && !isStreaming && !isSubmitting && trimmed.length > 0;
  const submitAnswer = () => {
    if (!canSubmitAnswer) return;
    setIsSubmitting(true);
    try {
      onAnswerQuestions?.(trimmed);
      setAnswer("");
    } finally {
      // 동기 콜백이지만 React state 배치로 인한 더블 서브밋을 막기 위해
      // micro task 한 프레임 후 해제한다.
      queueMicrotask(() => setIsSubmitting(false));
    }
  };
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-3 text-xs">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {t("assistant.planCardTitle")}
      </div>
      <div className="mb-1 text-sm font-semibold text-[hsl(var(--foreground))]">
        {plan.title}
      </div>
      {plan.summary && (
        <p className="mb-2 whitespace-pre-wrap text-[hsl(var(--muted-foreground))]">
          {plan.summary}
        </p>
      )}
      <ul className="mb-2 space-y-1">
        {plan.steps.map((step, idx) => (
          <li
            key={step.id}
            className="flex items-start gap-2"
            aria-checked={step.status === "done"}
            role="checkbox"
            aria-disabled="true"
          >
            <span className="mt-[2px] shrink-0">
              {step.status === "done" ? (
                <Check size={14} className="text-emerald-500" />
              ) : step.status === "failed" ? (
                <AlertCircle size={14} className="text-red-500" />
              ) : (
                <CircleDashed
                  size={14}
                  className="text-[hsl(var(--muted-foreground))]"
                />
              )}
            </span>
            <span className="text-[hsl(var(--foreground))]">
              <span className="text-[hsl(var(--muted-foreground))]">
                {idx + 1}.{" "}
              </span>
              {step.description}
            </span>
          </li>
        ))}
      </ul>
      {hasQuestions && (
        <div className="mb-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-2 text-[11px]">
          <div className="mb-1 font-medium text-amber-700 dark:text-amber-300">
            ❓ {t("assistant.planQuestionsTitle")}
          </div>
          <ul className="mb-2 list-disc pl-4 text-[hsl(var(--foreground))]">
            {plan.openQuestions!.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          {showAnswerInput && (
            <div className="flex items-start gap-1">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitAnswer();
                  }
                }}
                rows={2}
                maxLength={ANSWER_MAX_LENGTH}
                disabled={isStreaming}
                placeholder={t("assistant.planQuestionsPlaceholder")}
                aria-label={t("assistant.planQuestionsPlaceholder")}
                className="min-h-[48px] flex-1 resize-none rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-1.5 text-[11px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-amber-500/60 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmitAnswer}
                aria-label={t("assistant.planQuestionsSend")}
                title={t("assistant.planQuestionsSend")}
                className="flex h-[48px] w-[28px] shrink-0 items-center justify-center rounded-sm bg-amber-500 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={12} />
              </button>
            </div>
          )}
        </div>
      )}
      {!plan.approved && canApprove && (
        <button
          type="button"
          onClick={onApprove}
          className="w-full rounded-md bg-[hsl(var(--primary))] py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          {t("assistant.planApproveButton")}
        </button>
      )}
    </div>
  );
}
