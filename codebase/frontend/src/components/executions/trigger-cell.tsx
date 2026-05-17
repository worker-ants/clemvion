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

/**
 * 실행 한 행의 출처(Trigger source)를 아이콘 + 메인 라벨 + 보조 라벨로 렌더한다.
 * 보조 `label` (트리거명/실행자명/부모 워크플로명)은 신뢰 가능한 백엔드 응답으로 전제하며,
 * React 가 자동 escape 하므로 XSS 위험은 없다.
 *
 * 알 수 없는 source 가 들어와도 (배포 순서 불일치 / 신규 trigger type 도입 등) 크래시
 * 하지 않도록 unknown 으로 fallback 한다.
 */
export function TriggerCell({
  source,
  label,
}: {
  source: ExecutionTriggerSource;
  label: string | null;
}) {
  const t = useT();
  const Icon = TRIGGER_ICON[source] ?? HelpCircle;
  const labelKey =
    TRIGGER_LABEL_KEY[source] ?? "executions.triggerSource.unknown";
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="min-w-0">
        <div className="truncate">{t(labelKey)}</div>
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
