/**
 * Phase 2 — Durable Continuation Queue.
 *
 * SoT: spec/5-system/4-execution-engine.md §7.4 / §7.5.
 *
 * 사용자 입력 fan-out 전용 BullMQ 영속 큐. 옛 Redis pub/sub 채널
 * `execution:continuation` 을 대체한다 — at-most-once 의미론으로 인해 발생하던
 * (a) 어느 인스턴스에도 메모리 resolver 가 없을 때 silent drop, (b) 컨테이너
 * 재시작 후 재개 불가 문제 해소.
 *
 * 라우팅 원칙 (spec §7.4 / Rationale "Sticky fast-path 제거"):
 * - 모든 publisher 는 항상 본 큐에 enqueue (sticky fast-path 도입하지 않음).
 * - Worker 가 pick up 후 로컬 `pendingContinuations` Map 키 hit 면 즉시 resolve,
 *   miss 면 §7.5 rehydration 경로 (DB 체크포인트 로드 → 재개).
 */
export const CONTINUATION_EXECUTION_QUEUE = 'execution-continuation';

/**
 * BullMQ jobId 스키마: `${executionId}:${nodeExecutionId}:${seq}`.
 * - executionId / nodeExecutionId 는 publisher 가 알고 있는 식별자.
 * - seq 는 Redis INCR per executionId 로 monotonic 증가 — 중복 enqueue 시
 *   다른 jobId 가 되어 BullMQ 가 별개 job 으로 처리한다 (idempotency 보강은
 *   processor 가 NodeExecution.status 재검증으로 담당).
 */
export function buildContinuationJobId(
  executionId: string,
  nodeExecutionId: string,
  seq: number,
): string {
  return `${executionId}:${nodeExecutionId}:${seq}`;
}

/**
 * BullMQ 큐 옵션 기본값.
 *
 * - `attempts`: spec §11 의 `RESUME_BULLMQ_ATTEMPTS` (기본 3). dead-letter
 *   는 `RESUME_FAILED` 로 Execution `cancelled` 마킹 (processor 책임).
 * - `removeOnComplete: true`: 정상 처리된 job 은 즉시 제거 — Redis 메모리
 *   사용량 폭증 방지. 실패 job 은 attempts 소진 후 dead-letter 로 보관.
 * - exponential backoff: 1s / 4s / 16s (factor 4).
 */
export const CONTINUATION_QUEUE_DEFAULT_OPTS = {
  attempts: 3,
  removeOnComplete: true,
  removeOnFail: false,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
};

/**
 * Continuation job payload — `ContinuationMessage` 와 동일 shape 이나
 * BullMQ-side 명시적 타입으로 분리해 향후 wire format 변경 시 영향 격리.
 *
 * `nodeExecutionId` 는 spec §7.5 rehydration 경로에서 NodeExecution 체크포인트
 * 로드의 1차 키이므로 필수. publisher (controller / WS gateway) 가 enqueue
 * 직전 DB lookup (execution_id + node_id + status=waiting_for_input) 해 채운다.
 */
export interface ContinuationJob {
  type:
    | 'continue'
    | 'cancel'
    | 'button_click'
    | 'ai_message'
    | 'ai_end_conversation';
  executionId: string;
  nodeExecutionId: string;
  payload?: unknown;
}
