"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  NOTIFICATION_SETTINGS_QUERY_KEY,
  notificationsApi,
  type NotificationSettingKey,
  type NotificationSettings,
} from "@/lib/api/notifications";

/**
 * 유형별 인앱 · 이메일 토글 표 (CLE-OBS-NOTIFY-SETTINGS 「알림 설정 화면과 수신 거부 링크」, CLE-T-EJFQ1Y).
 * 키가 없는 유형(팀 초대 · Background 실패 · 알림 규칙 · 통합 조치 필요)에는 토글을 두지 않는다.
 */
const ROWS: Array<{
  labelKey: TranslationKey;
  inApp: NotificationSettingKey;
  email: NotificationSettingKey;
}> = [
  {
    labelKey: "profile.notifications.typeExecutionFailed",
    inApp: "executionFailedInApp",
    email: "executionFailedEmail",
  },
  {
    labelKey: "profile.notifications.typeScheduleFailed",
    inApp: "scheduleFailedInApp",
    email: "scheduleFailedEmail",
  },
  {
    labelKey: "profile.notifications.typeIntegrationExpired",
    inApp: "integrationExpiryInApp",
    email: "integrationExpiryEmail",
  },
];

export function NotificationSettingsPanel() {
  const t = useT();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<NotificationSettings>({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: notificationsApi.getSettings,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) =>
      notificationsApi.updateSettings(patch),
    onSuccess: (next) => {
      queryClient.setQueryData(NOTIFICATION_SETTINGS_QUERY_KEY, next);
      toast.success(t("profile.notifications.saved"));
    },
    onError: () => {
      toast.error(t("profile.notifications.saveFailed"));
    },
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("profile.notifications.loadFailed")}
      </p>
    );
  }

  const settings = settingsQuery.data;
  const toggle = (key: NotificationSettingKey, value: boolean) =>
    mutation.mutate({ [key]: value });

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] text-left">
              <th className="px-4 py-3 font-medium">
                {t("profile.notifications.columnType")}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {t("profile.notifications.columnInApp")}
              </th>
              <th className="px-4 py-3 text-center font-medium">
                {t("profile.notifications.columnEmail")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const label = t(row.labelKey);
              const off = !settings[row.inApp] && !settings[row.email];
              return (
                <tr
                  key={row.inApp}
                  className="border-b border-[hsl(var(--border))] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <p>{label}</p>
                    {off ? (
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {t("profile.notifications.bothOff")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={t("profile.notifications.inAppAria", {
                        type: label,
                      })}
                      checked={settings[row.inApp]}
                      disabled={mutation.isPending}
                      onChange={(e) => toggle(row.inApp, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={t("profile.notifications.emailAria", {
                        type: label,
                      })}
                      checked={settings[row.email]}
                      disabled={mutation.isPending}
                      onChange={(e) => toggle(row.email, e.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("profile.notifications.alwaysOnNote")}
      </p>
    </div>
  );
}
