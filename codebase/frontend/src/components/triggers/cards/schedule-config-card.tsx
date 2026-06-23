import { type TriggerDetail } from "@/lib/api/triggers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export function ScheduleConfigurationCard({ trigger }: { trigger: TriggerDetail }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("triggers.detail.sectionSchedule")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-3 text-sm">
          {trigger.cronExpression && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.cronExpressionLabel")}
              </dt>
              <dd>
                <code className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                  {trigger.cronExpression}
                </code>
              </dd>
            </div>
          )}
          {trigger.timezone && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.timezoneLabel")}
              </dt>
              <dd className="font-medium">{trigger.timezone}</dd>
            </div>
          )}
          {trigger.nextRunAt && (
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.detail.nextRunLabel")}
              </dt>
              <dd className="font-medium">
                {formatDate(trigger.nextRunAt, "datetime")}
              </dd>
            </div>
          )}
        </dl>
        <div className="border-t border-[hsl(var(--border))] pt-3 text-xs space-y-1">
          <Link
            href={`/schedules?triggerId=${encodeURIComponent(trigger.id)}`}
            className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
          >
            {t("triggers.detail.editInSchedule")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
          <p className="text-[hsl(var(--muted-foreground))]">
            {t("triggers.detail.editInScheduleHelp")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
