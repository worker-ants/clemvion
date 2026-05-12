import type { Job } from 'bullmq';

/**
 * BullMQ job payload 검증 실패 시 throw 되는 에러.
 *
 * processor 의 catch 가 이 타입을 식별해 jobId/timestamp/payloadKeys 같은 디버그
 * 컨텍스트를 함께 로깅한다. 큐는 `defaultJobOptions` 가 비어 있어 BullMQ 기본
 * attempts=1 — throw 한 번에 곧장 `failed` 큐로 이동해 재시도 폭주를 막는다.
 */
export class InvalidJobPayloadError extends Error {
  constructor(
    public readonly reason: string,
    public readonly debug: Record<string, unknown>,
  ) {
    super(`Invalid job payload: ${reason}`);
    this.name = 'InvalidJobPayloadError';
  }
}

/**
 * 손상/레거시 job 의 payload 에서 documentId 가 빠진 경우를 service 진입 전에
 * 차단한다. `undefined` / `null` / 빈 문자열 / 공백만 / non-string 을 모두 거부.
 *
 * 정상 흐름에서는 모든 producer 가 DB UUID 를 채워 enqueue 하므로 도달하지 않으나,
 * Redis 에 누적된 손상 job 또는 알 수 없는 외부 producer 가 만든 job 이 worker
 * 부팅 직후 service 의 `update(documentId=undefined, …)` 를 TypeORM "Empty
 * criteria(s)" 로 폭발시키던 회귀를 차단한다.
 */
export function assertDocumentIdPayload<T extends { documentId?: unknown }>(
  job: Job<T>,
  context: string,
): string {
  const documentId = job.data?.documentId;
  if (typeof documentId !== 'string' || documentId.trim() === '') {
    throw new InvalidJobPayloadError(
      `${context}: documentId is missing or not a string`,
      {
        jobId: job.id,
        jobName: job.name,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        payloadKeys: Object.keys(job.data ?? {}),
        documentIdType: typeof documentId,
      },
    );
  }
  return documentId;
}
