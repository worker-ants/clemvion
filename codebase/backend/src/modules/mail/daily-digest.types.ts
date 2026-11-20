/**
 * 일일 요약 메일의 공유 타입. `mail` 과 `notifications` 가 모두 가져가므로 어느 쪽 서비스 파일에도 두지 않는다
 * (import 방향을 `notifications` → `mail` 한 쪽으로 둔다).
 * 근거: [알림 설정 「일일 요약」](CLE-OBS-NOTIFY-SETTINGS#일일-요약), CLE-T-BAXAN4.
 */

/** 요약에 모으는 알림 유형. 통합 알림과 알림 규칙 알림은 넣지 않는다. */
export const DIGEST_TYPES = [
  'execution_failed',
  'schedule_failed',
  'background_failed',
] as const;

export type DigestType = (typeof DIGEST_TYPES)[number];

/** 일일 요약 메일 한 통의 내용. 묶는 일은 `NotificationDigestService` 가 한다. */
export interface DailyDigest {
  windowStart: Date;
  windowEnd: Date;
  /** 창 안의 알림 전체 건수(메일에 싣지 못한 것 포함). */
  total: number;
  workspaces: DailyDigestWorkspace[];
}

export interface DailyDigestWorkspace {
  id: string;
  name: string;
  total: number;
  /** 메일에 싣는 항목. 최신 순이고 `total` 보다 적을 수 있다. */
  items: { type: string; title: string; createdAt: Date }[];
}
