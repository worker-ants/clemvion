import { BACKGROUND_EXECUTION_QUEUE } from '../execution-engine/queues/background-execution.queue';
import { CONTINUATION_EXECUTION_QUEUE } from '../execution-engine/queues/continuation-execution.queue';
import {
  EXECUTION_RUN_QUEUE,
  resolveExecutionRunWorkerConcurrency,
} from '../execution-engine/queues/execution-run.queue';
import { DOCUMENT_EMBEDDING_QUEUE } from '../knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../knowledge-base/queues/graph-extraction.queue';
import { NOTIFICATION_WEBHOOK_QUEUE } from '../external-interaction/notification-dispatcher.types';
import { CAFE24_REFRESH_QUEUE } from '../integrations/cafe24-token-refresh.constants';
import { MAKESHOP_REFRESH_QUEUE } from '../integrations/makeshop-token-refresh.constants';
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

/** execution-run intake worker concurrency (env, 기본 1) — PR1 패턴 재사용. */
const executionRunConcurrency = resolveExecutionRunWorkerConcurrency();

/**
 * 모니터링 대상 큐 레지스트리.
 * 큐 추가/삭제 시 data-flow/0-overview.md §4 카탈로그를 먼저 갱신하고 본 표를 동기화한다.
 */
export const MONITORED_QUEUES: readonly MonitoredQueue[] = [
  {
    name: EXECUTION_RUN_QUEUE,
    group: 'execution',
    concurrency: executionRunConcurrency,
  },
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
  { name: MAKESHOP_REFRESH_QUEUE, group: 'integration', concurrency: 1 },
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

/**
 * `recentFailed` 산정 윈도우(분). `finishedOn >= now - window` 인 실패 job 만 집계한다.
 * env `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, 기본 60. spec §2·§3 / R-5.
 */
export function getFailedWindowMinutes(): number {
  // Math.max(1, …): 음수·0 입력 시 cutoff 가 미래가 되는 것을 방지(최소 1분).
  return Math.max(
    1,
    Number(process.env.SYSTEM_STATUS_FAILED_WINDOW_MINUTES) || 60,
  );
}

/**
 * 큐당 `getFailed()` 역순 스캔 상한. 캡 도달 시 스캔을 멈추고 `recentFailed` 는
 * 하한값으로 간주한다 (UI 는 "N+" 표기). env `SYSTEM_STATUS_FAILED_SCAN_CAP`, 기본 1000.
 * 상수 비용을 포기하는 대신 비용 상한을 보장한다 (spec R-5).
 */
export function getFailedScanCap(): number {
  // Math.max(1, …): 음수·0 입력 시 스캔이 0 회가 되어 recentFailed 가 항상 0 이 되는 것을 방지(최소 1).
  return Math.max(1, Number(process.env.SYSTEM_STATUS_FAILED_SCAN_CAP) || 1000);
}
