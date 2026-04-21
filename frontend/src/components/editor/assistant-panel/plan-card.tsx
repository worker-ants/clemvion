"use client";

import { Check, CircleDashed, AlertCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { AssistantPlanCard } from "@/lib/stores/assistant-store";

interface PlanCardProps {
  plan: AssistantPlanCard;
  onApprove: () => void;
  canApprove: boolean;
}

export function PlanCard({ plan, onApprove, canApprove }: PlanCardProps) {
  const t = useT();
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
      {plan.openQuestions && plan.openQuestions.length > 0 && (
        <div className="mb-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-2 text-[11px]">
          <div className="mb-1 font-medium text-amber-700 dark:text-amber-300">
            ❓
          </div>
          <ul className="list-disc pl-4 text-[hsl(var(--foreground))]">
            {plan.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
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
