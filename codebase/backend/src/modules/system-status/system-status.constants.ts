import { BACKGROUND_EXECUTION_QUEUE } from '../execution-engine/queues/background-execution.queue';
import { CONTINUATION_EXECUTION_QUEUE } from '../execution-engine/queues/continuation-execution.queue';
import { DOCUMENT_EMBEDDING_QUEUE } from '../knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../knowledge-base/queues/graph-extraction.queue';
import { NOTIFICATION_WEBHOOK_QUEUE } from '../external-interaction/notification-dispatcher.types';
import { CAFE24_REFRESH_QUEUE } from '../integrations/cafe24-token-refresh.constants';
import { INTEGRATION_EXPIRY_QUEUE } from '../integrations/integration-expiry-scanner.service';
import { SCHEDULE_QUEUE } from '../schedules/schedule-runner.service';
import { LOGIN_HISTORY_PRUNER_QUEUE } from '../auth/jobs/login-history-pruner.service';
import { NOTIFICATION_SECRET_ROTATOR_QUEUE } from '../triggers/notification-secret-rotator.service';
import { CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE } from '../chat-channel/chat-channel-token-rotator.service';
import { ALERTS_EVALUATOR_QUEUE } from '../alerts/alerts-evaluator.service';

/**
 * 시스템 상태 화면이 모니터링하는 큐의 그룹.
 * spec: spec/2-navigation/15-system-status.md §2.3
 */
export type QueueGroup =
  | 'execution'
  | 'knowledge-base'
  | 'integration'
  | 'system';

export interface MonitoredQueue {
  /** BullMQ 큐 이름. 각 큐 정의 모듈의 상수를 재사용한다 (중복 리터럴 금지). */
  readonly name: string;
  readonly group: QueueGroup;
  /** worker concurrency. utilization(active/concurrency) 계산에 사용. */
  readonly concurrency: number;
}

/**
 * continuation worker 의 concurrency 는 env 로 조정 가능 (기본 1).
 * 다른 큐는 worker 옵션의 정적 기본값을 그대로 반영한다.
 * SoT: spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그.
 */
const continuationConcurrency =
  Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1;

/**
 * 모니터링 대상 큐 레지스트리.
 * 큐 추가/삭제 시 data-flow/0-overview.md §4 카탈로그를 먼저 갱신하고 본 표를 동기화한다.
 */
export const MONITORED_QUEUES: readonly MonitoredQueue[] = [
  { name: BACKGROUND_EXECUTION_QUEUE, group: 'execution', concurrency: 1 },
  {
    name: CONTINUATION_EXECUTION_QUEUE,
    group: 'execution',
    concurrency: continuationConcurrency,
  },
  { name: DOCUMENT_EMBEDDING_QUEUE, group: 'knowledge-base', concurrency: 3 },
  { name: GRAPH_EXTRACTION_QUEUE, group: 'knowledge-base', concurrency: 2 },
  { name: NOTIFICATION_WEBHOOK_QUEUE, group: 'integration', concurrency: 1 },
  { name: CAFE24_REFRESH_QUEUE, group: 'integration', concurrency: 1 },
  { name: SCHEDULE_QUEUE, group: 'system', concurrency: 1 },
  { name: LOGIN_HISTORY_PRUNER_QUEUE, group: 'system', concurrency: 1 },
  { name: NOTIFICATION_SECRET_ROTATOR_QUEUE, group: 'system', concurrency: 1 },
  { name: CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE, group: 'system', concurrency: 1 },
  { name: INTEGRATION_EXPIRY_QUEUE, group: 'system', concurrency: 1 },
  { name: ALERTS_EVALUATOR_QUEUE, group: 'system', concurrency: 1 },
];

/** BullModule.registerQueue 및 DI factory 의 inject 순서에 쓰이는 큐 이름 목록. */
export const SYSTEM_STATUS_QUEUE_NAMES: readonly string[] =
  MONITORED_QUEUES.map((q) => q.name);

/** 모니터링 대상 Queue 인스턴스 배열을 주입받는 DI 토큰. */
export const MONITORED_QUEUE_HANDLES = 'MONITORED_QUEUE_HANDLES';

/**
 * health 파생 임계값 (env 로 조정 가능). spec §3.
 *
 * 함수 형태로 제공해 테스트 격리(jest.resetModules 없이 process.env 변경 후
 * 즉시 반영)와 런타임 반영을 보장한다. 성능 영향은 무시 가능.
 */
export function getFailedDegradedThreshold(): number {
  return Number(process.env.SYSTEM_STATUS_FAILED_THRESHOLD) || 1;
}
export function getDelayedDegradedThreshold(): number {
  return Number(process.env.SYSTEM_STATUS_DELAYED_THRESHOLD) || 50;
}

/** @deprecated 테스트 또는 모듈 로드 순서에 영향을 받지 않도록 getter 를 사용하세요. */
export const FAILED_DEGRADED_THRESHOLD = getFailedDegradedThreshold();
/** @deprecated 테스트 또는 모듈 로드 순서에 영향을 받지 않도록 getter 를 사용하세요. */
export const DELAYED_DEGRADED_THRESHOLD = getDelayedDegradedThreshold();
