import type { User } from '../users/entities/user.entity';

/** 알림 행의 채널. DB CHECK 값과 같다. */
export type NotificationChannel = 'in_app' | 'email' | 'both';

/** 인앱 키와 이메일 키가 함께 있어 사용자가 채널을 고르는 알림 유형. */
export type ChannelToggleType =
  'execution_failed' | 'schedule_failed' | 'integration_expired';

type Prefs = User['notificationPreferences'];

interface ChannelKeys {
  inApp: keyof Prefs;
  email: keyof Prefs;
  /** 이메일 키가 opt-in(기본 꺼짐)인지. 인앱 키는 셋 다 opt-out 이다. */
  emailOptIn: boolean;
}

/**
 * 유형별 인앱 · 이메일 키. 정본은 [알림 설정 「설정 키」](CLE-OBS-NOTIFY-SETTINGS#설정-키) 표다.
 */
const CHANNEL_KEYS: Record<ChannelToggleType, ChannelKeys> = {
  execution_failed: {
    inApp: 'executionFailedInApp',
    email: 'executionFailedEmail',
    emailOptIn: false,
  },
  schedule_failed: {
    inApp: 'scheduleFailedInApp',
    email: 'scheduleFailedEmail',
    emailOptIn: false,
  },
  integration_expired: {
    inApp: 'integrationExpiryInApp',
    email: 'integrationExpiryEmail',
    emailOptIn: true,
  },
};

/**
 * 두 키로 알림 채널을 고른다([알림 설정 「채널 계산」](CLE-OBS-NOTIFY-SETTINGS#채널-계산)).
 *
 * opt-out 키는 값이 `false` 일 때만 끔, opt-in 키는 값이 `true` 일 때만 켬이다.
 * 둘 다 끄면 `null` 을 돌려준다. 발사원은 그 수신자에게 알림 행을 만들지 않는다.
 */
export function computeNotificationChannel(
  prefs: Prefs | null | undefined,
  type: ChannelToggleType,
): NotificationChannel | null {
  const keys = CHANNEL_KEYS[type];
  const p = prefs ?? {};
  const inApp = p[keys.inApp] !== false;
  const email = keys.emailOptIn
    ? p[keys.email] === true
    : p[keys.email] !== false;
  if (inApp && email) return 'both';
  if (inApp) return 'in_app';
  if (email) return 'email';
  return null;
}

/**
 * 발사원이 `resolveNotificationChannels` 결과에서 수신자 한 명의 채널을 꺼낸다.
 * `null` 이면 그 수신자에게 알림 행을 만들지 않는다. 세 발사원(실행 실패 · 스케줄 실패 · 통합 만료)이
 * 같은 규칙을 쓰도록 한 곳에 모았다(CLE-T-EJFQ1Y).
 *
 * 맵에 항목이 없으면(조회되지 않은 사용자) 설정이 없는 것으로 보고 유형별 기본값을 계산한다.
 * 실행 · 스케줄 실패는 둘 다 켜짐이라 `both` 다.
 */
export function channelForRecipient(
  channels: ReadonlyMap<string, NotificationChannel | null>,
  userId: string,
  type: ChannelToggleType,
): NotificationChannel | null {
  return channels.has(userId)
    ? (channels.get(userId) ?? null)
    : computeNotificationChannel(undefined, type);
}
