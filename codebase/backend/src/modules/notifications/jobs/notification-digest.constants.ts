/**
 * 일일 요약 메일 작업의 상수. 큐 이름은 시스템 상태 레지스트리가 import 하므로 서비스 파일과 떼어 둔다
 * (서비스 파일은 알림 모듈 그래프를 끌어온다).
 * 근거: [알림 설정 「일일 요약」](CLE-OBS-NOTIFY-SETTINGS#일일-요약), CLE-T-BAXAN4.
 */
export const NOTIFICATION_DIGEST_QUEUE = 'notification-digest';

/** 요약에 모으는 알림 유형. 통합 알림과 알림 규칙 알림은 넣지 않는다. */
export const DIGEST_TYPES = [
  'execution_failed',
  'schedule_failed',
  'background_failed',
] as const;

export type DigestType = (typeof DIGEST_TYPES)[number];

/** 보낼 때 모으는 창. 보내는 시각부터 거꾸로 24시간이다. */
export const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 한 워크스페이스에서 메일에 싣는 항목 수. 넘는 건은 건수만 적는다. */
export const DIGEST_ITEMS_PER_WORKSPACE = 10;

/** 받는 사람을 한 번에 읽는 수. */
export const DIGEST_RECIPIENT_BATCH = 500;
