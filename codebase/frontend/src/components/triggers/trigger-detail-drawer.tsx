import { SlideDrawer } from "@/components/ui/slide-drawer";
import { useT } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { OverviewCard } from "./cards/overview-card";
import { ScheduleConfigurationCard } from "./cards/schedule-config-card";
import { WebhookConfigCard } from "./cards/webhook-config-card";
import { ExternalInteractionCard } from "./cards/external-interaction-card";
import { ChatChannelCard } from "./cards/chat-channel-card";
import { useTrigger } from "./hooks/use-trigger";

interface TriggerDetailDrawerProps {
  triggerId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TriggerDetailDrawer({ triggerId, open, onClose }: TriggerDetailDrawerProps) {
  const t = useT();
  const { trigger, isLoading: isLoadingTrigger, invalidate } = useTrigger(triggerId, open);

  return (
    <SlideDrawer open={open} onClose={onClose} title={t("triggers.detail.drawerTitle")}>
      {isLoadingTrigger ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : trigger ? (
        <div className="space-y-6">
          {/* Overview */}
          <OverviewCard trigger={trigger} onSaved={invalidate} />

          {/* Webhook Details */}
          {trigger.type === "webhook" && (
            <WebhookConfigCard trigger={trigger} onSaved={invalidate} />
          )}

          {/* External Interaction API (Spec EIA §4) — webhook 트리거에서만 표시 */}
          {trigger.type === "webhook" && (
            <ExternalInteractionCard trigger={trigger} onSaved={invalidate} />
          )}

          {/* Chat Channel (Spec Chat Channel §4.1 / 2-trigger-list R-8) — webhook 트리거에서만 표시 */}
          {trigger.type === "webhook" && (
            <ChatChannelCard trigger={trigger} onSaved={invalidate} />
          )}

          {/* Schedule Details */}
          {trigger.type === "schedule" && (
            <ScheduleConfigurationCard trigger={trigger} />
          )}

          {/*
            Recent Calls 카드는 [Spec §2.1 + Rationale R-7] 에 따라 본 drawer 에서
            제거됨. ⋮ 메뉴 → "호출 이력" (별도 Dialog) 가 동일 데이터를 더 가벼운
            modal 로 노출한다.
          */}
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {t("triggers.detail.notFound")}
        </p>
      )}
    </SlideDrawer>
  );
}
