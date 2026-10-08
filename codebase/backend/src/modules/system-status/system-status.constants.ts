import { BACKGROUND_EXECUTION_QUEUE } from '../execution-engine/queues/background-execution.queue';
import {
  CONTINUATION_EXECUTION_QUEUE,
  resolveContinuationWorkerConcurrency,
} from '../execution-engine/queues/continuation-execution.queue';
import { EXECUTION_RUN_QUEUE } from '../execution-engine/queues/execution-run.queue';
import { resolveExecutionRunWorkerConcurrency } from '../execution-engine/execution-limits';
import { DOCUMENT_EMBEDDING_QUEUE } from '../knowledge-base/queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from '../knowledge-base/queues/graph-extraction.queue';
import { NOTIFICATION_WEBHOOK_QUEUE } from '../external-interaction/notification-dispatcher.types';
import { TERMINAL_REVOKE_RECONCILE_QUEUE } from '../external-interaction/terminal-revoke-reconciler.types';
import { WEBCHAT_IDLE_REAPER_QUEUE } from '../external-interaction/webchat-idle-reaper.types';
import { CAFE24_REFRESH_QUEUE } from '../integrations/cafe24-token-refresh.constants';
import { MAKESHOP_REFRESH_QUEUE } from '../integrations/makeshop-token-refresh.constants';
import { INTEGRATION_EXPIRY_QUEUE } from '../integrations/integration-expiry-scanner.service';
import { SCHEDULE_QUEUE } from '../schedules/schedule-runner.service';
import { LOGIN_HISTORY_PRUNER_QUEUE } from '../auth/jobs/login-history-pruner.service';
import { WORKSPACE_INVITATIONS_PRUNER_QUEUE } from '../workspaces/jobs/workspace-invitations-pruner.service';
import { NOTIFICATION_SECRET_ROTATOR_QUEUE } from '../triggers/notification-secret-rotator.service';
import { CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE } from '../triggers/chat-channel-token-rotator.service';
import { ALERTS_EVALUATOR_QUEUE } from '../alerts/alerts-evaluator.service';

/**
 * 시스템 상태 화면이 모니터링하는 큐의 그룹.
 * 근거: [시스템 상태 「모니터링 대상 큐」](CLE-OBS-STATUS#모니터링-대상-큐)
 */
export type QueueGroup =
  'execution' | 'knowledge-base' | 'integration' | 'system';

export interface MonitoredQueue {
  /** BullMQ 큐 이름. 각 큐 정의 모듈의 상수를 재사용한다 (중복 리터럴 금지). */
  readonly name: string;
  readonly group: QueueGroup;
  /** worker concurrency. utilization(active/concurrency) 계산에 사용. */
  readonly concurrency: number;
}

/**
 * continuation·execution-run worker 의 concurrency 는 env 로 조정 가능 (기본 1). 두 값 모두
 * 각 큐 모듈이 소유한 **canonical resolver** 를 재사용해 파싱을 일원화한다(MAINT#9) — 종전
 * inline `Number(env) || 1` 은 큐 워커 스펙이 문서화한 "비양수·비정수·비숫자→1 fallback" 계약과
 * 어긋나(공학표기·소수 등을 loose 하게 수용) 있었다. resolver 는 정규식 선검증으로 그 계약을
 * 그대로 구현한다. 다른 큐는 worker 옵션의 정적 기본값을 반영.
 * SoT: [큐 워커와 동시 실행 제한](CLE-EXEC-WORKER) · [비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE)
 */
const continuationConcurrency = resolveContinuationWorkerConcurrency();

/** execution-run intake worker concurrency (env, 기본 1) — canonical resolver 재사용. */
const executionRunConcurrency = resolveExecutionRunWorkerConcurrency();

/**
 * 모니터링 대상 큐 레지스트리.
 * 큐 추가/삭제 시 [비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE) 카탈로그를 먼저 갱신하고 본 표를 동기화한다.
 * 또한 `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 목록도 함께 갱신할 것.
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
  {
    name: WORKSPACE_INVITATIONS_PRUNER_QUEUE,
    group: 'system',
    concurrency: 1,
  },
  { name: NOTIFICATION_SECRET_ROTATOR_QUEUE, group: 'system', concurrency: 1 },
  {
    name: TERMINAL_REVOKE_RECONCILE_QUEUE,
    group: 'system',
    concurrency: 1,
  },
  { name: WEBCHAT_IDLE_REAPER_QUEUE, group: 'system', concurrency: 1 },
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
 * 시스템 상태 환경 변수를 양수로 읽는다. 미설정 · 빈 값 · 숫자가 아닌 값 · 0 · 음수는 기본값으로
 * 대신한다. `integer` 면 정수가 아닌 값도 기본값이다(개수를 뜻하는 값).
 * 근거: [시스템 상태 「큐 건강도 판정」](CLE-OBS-STATUS#큐-건강도-판정) (REQ-SYSSTAT-021).
 *
 * 예전에는 임계값이 `Number(env) || 기본값` 이라 음수가 그대로 통과했고(음수 실패 임계값이면 모든
 * 큐가 `degraded`), 윈도우 · 스캔 상한은 `Math.max(1, …)` 라 음수가 기본값이 아니라 1 이 됐다.
 */
function readPositiveEnv(
  name: string,
  fallback: number,
  opts: { integer?: boolean } = {},
): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  if (opts.integer && !Number.isInteger(value)) return fallback;
  return value;
}

/**
 * health 파생 임계값 (env 로 조정 가능).
 *
 * 함수 형태로 제공해 테스트 격리(jest.resetModules 없이 process.env 변경 후
 * 즉시 반영)와 런타임 반영을 보장한다. 성능 영향은 무시 가능.
 */
export function getFailedDegradedThreshold(): number {
  return readPositiveEnv('SYSTEM_STATUS_FAILED_THRESHOLD', 1);
}
export function getDelayedDegradedThreshold(): number {
  return readPositiveEnv('SYSTEM_STATUS_DELAYED_THRESHOLD', 50);
}

/**
 * `recentFailed` 산정 윈도우(분). `finishedOn >= now - window` 인 실패 job 만 집계한다.
 * env `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, 기본 60.
 */
export function getFailedWindowMinutes(): number {
  return readPositiveEnv('SYSTEM_STATUS_FAILED_WINDOW_MINUTES', 60);
}

/**
 * 큐당 `getFailed()` 역순 스캔 상한. 캡 도달 시 스캔을 멈추고 `recentFailed` 는
 * 하한값으로 간주한다 (UI 는 "N+" 표기). env `SYSTEM_STATUS_FAILED_SCAN_CAP`, 기본 1000.
 * 상수 비용을 포기하는 대신 비용 상한을 보장한다.
 */
export function getFailedScanCap(): number {
  return readPositiveEnv('SYSTEM_STATUS_FAILED_SCAN_CAP', 1000, {
    integer: true,
  });
}
