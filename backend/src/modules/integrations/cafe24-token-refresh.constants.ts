/**
 * Cafe24 토큰 갱신을 위한 BullMQ 큐 상수.
 *
 * 멀티 인스턴스 race 방지: 동일 `integrationId` 에 대한 refresh 요청이
 * 두 pod 에서 동시에 발생하더라도 `jobId = ${integrationId}` 로 BullMQ
 * 큐가 dedup 한다. 이미 진행 중인 job 이 있으면 같은 job 참조가 반환되어,
 * 모든 호출자가 동일 worker 의 결과를 공유한다.
 *
 * 백그라운드 갱신: `IntegrationExpiryScannerService` 의 일일 잡이 `lastRotatedAt
 * < now - REFRESH_PROACTIVE_THRESHOLD_DAYS` 인 cafe24 통합을 스캔해 이 큐로
 * enqueue. refresh_token (14일) 만료 전 충분한 안전 마진을 확보.
 *
 * spec/2-navigation/4-integration.md §10.5 (proactive refresh)
 * spec/4-nodes/4-integration/4-cafe24.md §9.6 (멀티 인스턴스 trade-off — 본
 * 큐 도입으로 해소).
 */

/** BullMQ 큐 이름. registerQueue / @InjectQueue 에 사용. */
export const CAFE24_REFRESH_QUEUE = 'cafe24-token-refresh';

/** QueueEvents instance DI 토큰 — `waitUntilFinished` 용도. */
export const CAFE24_REFRESH_QUEUE_EVENTS = 'CAFE24_REFRESH_QUEUE_EVENTS';

/** 단일 refresh 잡 이름. */
export const CAFE24_REFRESH_JOB = 'refresh-cafe24-token';

/**
 * 백그라운드 proactive refresh 임계 (일). refresh_token 이 14일 유효이고
 * Cafe24 가 매 refresh 마다 새 refresh_token 을 발급 (rotation) 하므로,
 * lastRotatedAt 이 N 일 이상 경과한 통합을 미리 갱신해 14 - N 일의 안전
 * 마진을 확보한다.
 *
 * N=10 → 4 일 마진. 사용자가 통합을 만들고 무한 idle 해도 자동으로 살아
 * 있는 상태가 유지된다.
 */
export const REFRESH_PROACTIVE_THRESHOLD_DAYS = 10;

/**
 * Cafe24ApiClient 가 enqueue 후 worker 가 잡을 완료할 때까지 기다리는
 * timeout. Cafe24 token endpoint 의 일반적 응답 (~1s) + worker pickup
 * latency + 약간의 여유. 이 timeout 을 넘기면 호출자가 transport 에러로
 * 받게 되어 노드 실행은 실패하지만, worker 는 별도 시도를 계속한다.
 */
export const REFRESH_JOB_WAIT_TIMEOUT_MS = 30_000;

/**
 * Cafe24Module 의 onApplicationShutdown 에서 in-flight `waitUntilFinished`
 * listener 가 자연 해소될 때까지 기다리는 최대 시간. REFRESH_JOB_WAIT_TIMEOUT_MS
 * (단일 호출자가 기다리는 상한) 과 약간의 여유 (1s) 를 더해 normal-path
 * 완료를 한 cycle 안에 흡수한다. 이 시간을 넘기면 강제 close — 진행 중인
 * `waitUntilFinished` 는 stream close error 를 받지만 worker job 자체는
 * Redis 가 다음 부트에서 이어 받는다 (job dedup = jobId = integrationId).
 */
export const CAFE24_MODULE_SHUTDOWN_GRACE_MS =
  REFRESH_JOB_WAIT_TIMEOUT_MS + 1_000;

export interface Cafe24RefreshJobData {
  integrationId: string;
  /** 'proactive' = API 호출 직전 lazy, 'background' = 일일 스캐너. 진단용. */
  source: 'proactive' | 'background';
}
