import type { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';

/**
 * BullMQ job payload 검증 실패 시 throw 되는 에러.
 *
 * `UnrecoverableError` 를 상속하므로 BullMQ 가 attempts 와 무관하게 즉시 `failed`
 * 큐로 옮긴다 — 큐 설정(defaultJobOptions.attempts) 이 향후 늘어나도 손상 job 의
 * 재시도 폭주를 코드 수준에서 막는다.
 *
 * processor 의 catch 가 이 타입을 식별해 jobId/timestamp/payloadKeys 같은 디버그
 * 컨텍스트를 함께 로깅한다.
 */
export class InvalidJobPayloadError extends UnrecoverableError {
  public readonly debug: Record<string, unknown>;

  constructor(
    public readonly reason: string,
    debug: Record<string, unknown>,
  ) {
    super(`Invalid job payload: ${reason}`);
    this.name = 'InvalidJobPayloadError';
    this.debug = debug;
  }
}

/**
 * documentId 가 BullMQ 큐 진입에 사용 가능한 형태인지 검증.
 *
 * 다음을 모두 차단: `undefined` / `null` / 빈 문자열 / 공백만(`'   '`) / non-string.
 * processor·service·cleanup 스크립트가 동일 기준을 공유하기 위한 단일 진실 소스.
 */
export function isValidDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 손상/레거시 job 의 payload 를 service 진입 전에 차단한다. 정상 producer 는 항상
 * DB UUID 를 채우므로 도달하지 않으나, Redis 에 누적된 손상 job 이 부팅 직후
 * `documentRepository.update(undefined, …)` 를 TypeORM "Empty criteria(s)" 로
 * 폭발시키던 회귀를 차단한다.
 */
export function assertDocumentIdPayload<T extends { documentId?: unknown }>(
  job: Job<T>,
  context: string,
): string {
  const documentId = job.data?.documentId;
  if (!isValidDocumentId(documentId)) {
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

/**
 * `InvalidJobPayloadError` 일 때만 진단 컨텍스트를 한 줄로 출력한다. 두 processor 가
 * 동일 패턴으로 호출하므로 helper 로 추출.
 */
export function logInvalidJobPayload(
  logger: Logger,
  jobType: string,
  job: Job<{ documentId?: unknown }>,
  err: unknown,
): void {
  if (err instanceof InvalidJobPayloadError) {
    logger.error(
      `Dropping invalid ${jobType} job ${job.id ?? '<no-id>'}: ${err.reason} ` +
        `(debug=${JSON.stringify(err.debug)})`,
    );
  }
}
