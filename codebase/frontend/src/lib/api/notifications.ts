import { apiClient } from "./client";

/**
 * 알림 설정. 서버가 저장하지 않은 키에 기본값을 채워 돌려준다.
 * 키와 기본값의 정본은 CLE-OBS-NOTIFY-SETTINGS 「설정 키」 표다.
 */
export interface NotificationSettings {
  executionFailedInApp: boolean;
  executionFailedEmail: boolean;
  scheduleFailedInApp: boolean;
  scheduleFailedEmail: boolean;
  integrationExpiryInApp: boolean;
  integrationExpiryEmail: boolean;
}

export type NotificationSettingKey = keyof NotificationSettings;

export const NOTIFICATION_SETTINGS_QUERY_KEY = [
  "notifications",
  "settings",
] as const;

export const notificationsApi = {
  getSettings: async (): Promise<NotificationSettings> => {
    const { data } = await apiClient.get("/notifications/settings");
    return data.data;
  },
  updateSettings: async (
    patch: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> => {
    const { data } = await apiClient.patch("/notifications/settings", patch);
    return data.data;
  },
};
