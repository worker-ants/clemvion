import { randomUUID } from 'node:crypto';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { backgroundNodeMetadata } from './background.schema';

/**
 * Background 노드 핸들러.
 *
 * 핸들러 자체는 단순한 통과 노드 — `main` 포트로 입력을 즉시 흘려보내고 끝낸다.
 * `background` 포트로 연결된 본문 서브그래프의 비동기 실행은 ExecutionEngineService가
 * 핸들러 종료 직후 컨텍스트 스냅샷과 함께 큐로 enqueue 한다 (handler는 그래프나 큐에
 * 대한 지식이 없도록 의도적으로 분리).
 *
 * Phase 2 (C — 메타메트릭, 비-breaking, additive)
 * ---------------------------------------------
 * CONVENTIONS Principle 2 (meta = 실행 메트릭) 에 따라 fork 시점의 추적 정보를
 * `meta.*` 로 노출한다. 5필드 invariant (config / output / meta? / port? / status?)
 * 는 유지된다.
 *
 *  - `meta.durationMs`     — 핸들러 자체의 즉시 처리 시간 (fire-and-forget 이라
 *                            보통 0~수 ms 수준).
 *  - `meta.backgroundRunId` — 본 fork 를 식별하는 워크플로우 실행 내 키. 모니터링
 *                            API 의 조회 키로 사용. UUID v4 (Date.now() 기반 충돌
 *                            가능성 회피).
 *  - `meta.forkedAt`       — fork 시점의 ISO8601 타임스탬프.
 *  - `meta.jobId?`         — 실제 BullMQ job ID. 핸들러는 큐 시스템에 대한 지식이
 *                            없으므로 항상 미발행 (선택 필드). 큐 발행은
 *                            `ExecutionEngineService.scheduleBackgroundBody()` 가
 *                            담당하며 향후 그쪽에서 NodeExecution.outputData 로
 *                            stamp 할 수 있다.
 */
export class BackgroundHandler implements NodeHandler {
  metadata = backgroundNodeMetadata;

  validate(config: Record<string, unknown> = {}): ValidationResult {
    // Schema has no warningRules / validateConfig — every field is bounded
    // by zod. The helper call is wired so future schema rules flow through
    // automatically without touching the handler.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const start = Date.now();
    const forkedAt = new Date(start).toISOString();
    const backgroundRunId = randomUUID();

    // CONVENTIONS Principle 7 — config echoes the raw user input. Echo only
    // the schema-declared fields explicitly to avoid silently leaking any
    // future credential-shaped passthrough fields the schema may add
    // (review WARN — Background spread risk).
    const rawConfig = context.rawConfig ?? config;
    return {
      config: {
        notes: rawConfig.notes,
        notifyOnFailure: rawConfig.notifyOnFailure,
        maxDurationMs: rawConfig.maxDurationMs,
      },
      output: input,
      // CONVENTIONS Principle 2 — meta carries execution metrics, not config
      // echoes. `durationMs` measures only the handler-side fire-and-forget
      // step (큐 enqueue 자체는 ExecutionEngineService 가 별도로 수행).
      meta: {
        durationMs: Date.now() - start,
        backgroundRunId,
        forkedAt,
      },
      port: 'main',
    };
  }
}
