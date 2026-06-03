/**
 * MakeShop 토큰 갱신을 위한 BullMQ 큐 상수.
 *
 * cafe24 의 `cafe24-token-refresh` 큐와 **분리된 전용 큐** 다 — service 별
 * token endpoint (`auth.makeshop.com`) 과 rotation 정책이 달라 큐를 공유하지
 * 않는다 (spec/4-nodes/4-integration/5-makeshop.md §4 step 6).
 *
 * 멀티 인스턴스 race 방지: 동일 `integrationId` 에 대한 refresh 요청이 두
 * pod 에서 동시에 발생하더라도 `jobId = ${integrationId}` 로 BullMQ 큐가
 * dedup 한다. 이미 진행 중인 job 이 있으면 같은 job 참조가 반환되어, 모든
 * 호출자가 동일 worker 의 결과를 공유한다. MakeShop refresh_token 도 1회
 * 사용 후 rotation 되므로 (TTL 30~90일) 동시 발사 시 한 쪽 토큰만 살아남고
 * 나머지는 orphan 이 되는 cafe24 와 동일한 위험을 갖는다.
 *
 * spec/2-navigation/4-integration.md §10.5 (proactive refresh)
 * spec/4-nodes/4-integration/5-makeshop.md §4 step 6 (전용 큐).
 */

/** BullMQ 큐 이름. registerQueue / @InjectQueue 에 사용. */
export const MAKESHOP_REFRESH_QUEUE = 'makeshop-token-refresh';

/** QueueEvents instance DI 토큰 — `waitUntilFinished` 용도. */
export const MAKESHOP_REFRESH_QUEUE_EVENTS = 'MAKESHOP_REFRESH_QUEUE_EVENTS';

/** 단일 refresh 잡 이름. */
export const MAKESHOP_REFRESH_JOB = 'refresh-makeshop-token';

/**
 * MakeshopApiClient 가 enqueue 후 worker 가 잡을 완료할 때까지 기다리는
 * timeout. cafe24 와 동일 정책 (~1s 응답 + worker pickup latency + 여유).
 * 이 timeout 을 넘기면 호출자가 transport 에러로 받지만 worker 는 별도
 * 시도를 계속한다.
 */
export const MAKESHOP_REFRESH_JOB_WAIT_TIMEOUT_MS = 30_000;

/**
 * MakeshopModule 의 onApplicationShutdown 에서 in-flight `waitUntilFinished`
 * listener 가 자연 해소될 때까지 기다리는 최대 시간. cafe24 와 동일 정책.
 */
export const MAKESHOP_MODULE_SHUTDOWN_GRACE_MS =
  MAKESHOP_REFRESH_JOB_WAIT_TIMEOUT_MS + 1_000;

export interface MakeshopRefreshJobData {
  integrationId: string;
  /**
   * 진단·라우팅 라벨.
   * - `'proactive'` = API 호출 직전 lazy refresh (ensureFreshToken).
   * - `'background'` = 일일 스캐너 또는 MCP buildTools self-heal.
   * - `'reactive_401'` = `executeWithRetry` 의 401 empirical 자가 회복 경로.
   *   caller 가 실제 401 을 받은 강한 신호라 worker 는 short-circuit guard 를
   *   skip 하고 항상 refresh 를 시도한다.
   */
  source: 'proactive' | 'background' | 'reactive_401';
}
