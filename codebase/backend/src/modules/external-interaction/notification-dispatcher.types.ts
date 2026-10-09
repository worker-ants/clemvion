/**
 * BullMQ 큐 이름. [Spec EIA §3.1 / impl-prep naming W-1].
 * 케밥-케이스 컨벤션 (기존 큐들 — background-execution, schedule-execution 등 — 과 일관).
 */
export const NOTIFICATION_WEBHOOK_QUEUE = 'notification-webhook';

/**
 * Custom BullMQ backoff 전략 이름 (job opts `backoff.type` ↔ worker `settings.backoffStrategy`
 * 매칭 키). BullMQ 내장 `exponential` 은 base*2^n (1s·2s·4s·8s·16s) 이라 Spec EIA §6.6 이
 * 의도한 **base-4 간격**(1s·4s·16s·64s·256s)을 낼 수 없어 custom 전략을 등록한다.
 */
export const NOTIFICATION_BACKOFF_TYPE = 'exp-base4';

/**
 * base-4 지수 백오프 지연(ms). BullMQ `backoffStrategy(attemptsMade)` 로 호출되며,
 * `attemptsMade` 는 방금 실패한 시도까지의 누적 횟수(1-indexed)다: 1→1s, 2→4s, 3→16s,
 * 4→64s, 5→256s (Spec EIA §6.6). default maxAttempts=5 면 재시도 지연은 1s·4s·16s·64s 4개.
 */
export function notificationBackoffDelayMs(attemptsMade: number): number {
  return 1000 * Math.pow(4, Math.max(0, attemptsMade - 1));
}

/** `notification.retry.maxAttempts` 가 없을 때의 총 시도 횟수. */
export const DEFAULT_NOTIFICATION_ATTEMPTS = 5;
/** 총 시도 횟수 상한. DTO 의 `@Max` 와 같은 값이다. */
export const MAX_NOTIFICATION_ATTEMPTS = 10;

/**
 * 트리거의 `notification.retry` 를 발송 큐의 BullMQ `attempts` 로 바꾼다.
 *
 * 근거: [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY#재시도와-실패-처리) — `maxAttempts` 는 첫 시도를
 * 포함한 총 시도 횟수이고 BullMQ `attempts` 와 같은 뜻이다. 기본 5, 상한 10, 0 은 1(큐 재시도 없음).
 *
 * 타입 필드는 DTO 가 0~10 정수로 막지만 원시 `config` 로 저장된 값은 그 검증을 지나지 않는다. 그래서
 * 숫자가 아니면 기본값으로, 범위 밖이면 1~10 으로 자른다. 발송 단계에서 던지면 알림 한 건이 통째로 사라진다.
 */
export function notificationAttemptsFromRetry(retry: unknown): number {
  const raw =
    retry && typeof retry === 'object'
      ? (retry as { maxAttempts?: unknown }).maxAttempts
      : undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_NOTIFICATION_ATTEMPTS;
  }
  return Math.min(MAX_NOTIFICATION_ATTEMPTS, Math.max(1, Math.floor(raw)));
}

/**
 * Outbound notification job 의 페이로드.
 *
 * `deliveryId` 는 동일 이벤트 재시도 시에도 유지되는 멱등 키 (Stripe `X-Clemvion-Delivery`
 * 헤더와 동일 값). BullMQ jobId = deliveryId 로 dedup.
 *
 * `eventBody` 는 사용자 정의 envelope (executionId / triggerId / workflowId / type / payload /
 * timestamp / seq) 이미 포함된 완성된 JSON 객체. processor 는 stringify → 서명 → POST 만 수행.
 */
export interface NotificationWebhookJob {
  /** delivery 멱등 키 (UUID). */
  deliveryId: string;
  /** 발송 대상 Trigger id — processor 가 config / health 갱신 시 사용. */
  triggerId: string;
  /** 이벤트 종류 (예: `execution.completed`). 헤더 `X-Clemvion-Event`. */
  eventType: string;
  /** Execution id — stale 차단 검사 시 사용. waiting_for_input 인 경우만 사용. */
  executionId: string;
  /** Workflow id — 헤더 `X-Clemvion-Workflow-Id` 용. */
  workflowId: string;
  /**
   * 직렬화될 envelope 객체. processor 가 JSON.stringify(eventBody) 로 rawBody 생성 후 서명.
   * Stripe 의 `t.<rawBody>` canonical form 보장을 위해 stringify 순서가 일관되어야 한다
   * (객체 키 순서가 동일하면 stringify 결과도 동일 — JavaScript 의 insertion order 의존).
   */
  eventBody: Record<string, unknown>;
}
