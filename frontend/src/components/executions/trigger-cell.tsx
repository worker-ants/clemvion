import {
  Clock,
  GitBranch,
  HelpCircle,
  User,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { ExecutionTriggerSource } from "@/lib/api/executions";

const TRIGGER_ICON: Record<ExecutionTriggerSource, LucideIcon> = {
  manual: User,
  schedule: Clock,
  webhook: Webhook,
  subworkflow: GitBranch,
  unknown: HelpCircle,
};

const TRIGGER_LABEL_KEY: Record<ExecutionTriggerSource, TranslationKey> = {
  manual: "executions.triggerSource.manual",
  schedule: "executions.triggerSource.schedule",
  webhook: "executions.triggerSource.webhook",
  subworkflow: "executions.triggerSource.subworkflow",
  unknown: "executions.triggerSource.unknown",
};

export function TriggerCell({
  source,
  label,
}: {
  source: ExecutionTriggerSource;
  label: string | null;
}) {
  const t = useT();
  const Icon = TRIGGER_ICON[source];
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0">
        <div className="truncate">{t(TRIGGER_LABEL_KEY[source])}</div>
        {label ? (
          <div
            className="truncate text-xs text-[hsl(var(--muted-foreground))]"
            title={label}
          >
            {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}
