/**
 * [Spec EIA §3.4 EIA-RL-07 / §R19] 공개 웹채팅 위젯 idle-wait execution 회수 reaper 상수.
 *
 * 별도 types 파일 — system-status 레지스트리(MONITORED_QUEUES)가 service 구현을 import 하지
 * 않고 큐 이름만 참조하는 패턴(terminal-revoke-reconciler.types 선례).
 *
 * EIA-RL-06 `terminal-revoke-reconciler` 와 **동일 패턴이되 별도 큐/서비스명** — 두 sweep 은
 * 목적(terminal 토큰 revoke vs park idle 회수)과 대상 상태(terminal vs waiting_for_input)가
 * 다르므로 분리한다.
 */
export const WEBCHAT_IDLE_REAPER_QUEUE = 'webchat-idle-reaper';

/**
 * grace window 기본값 — 익명 위젯 토큰의 **모든 발급 토큰 영구 만료** 이후 추가로 대기하는 여유.
 * `execution_token.exp_at` 은 이미 과거인데, 그 위에 grace 를 더 둬 (a) 롤링 배포/시계 편차,
 * (b) 만료 직후 사용자가 (만료 전이었다면) 잠깐 돌아왔을 극단 경우의 안전 마진을 확보한다.
 * 기본 1시간 — 토큰은 이미 만료(un-refreshable)라 세션은 client 관점에서 이미 죽었으므로
 * 작은 grace 로 충분하다.
 */
export const DEFAULT_WEBCHAT_IDLE_REAP_GRACE_MS = 60 * 60 * 1000; // 1시간

/**
 * `WEBCHAT_IDLE_REAP_GRACE_MS` env 로 grace(ms)를 결정한다. 순수 파서 — 정규식 선검증
 * (`^\d+$`) 후 채택, 비숫자·소수·공학표기·음수·`0` 은 기본값 fallback(`resolveQueueWaitTimeoutMs`
 * 와 동일 규약; `0`=즉시 reap 은 위험하므로 무제한/즉시 관용 없이 기본값으로 되돌린다).
 * 모듈/호출 시 평가 — 변경은 인스턴스 재시작 시 반영.
 */
export function resolveWebchatIdleReapGraceMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.WEBCHAT_IDLE_REAP_GRACE_MS;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const parsed = Number.parseInt(raw, 10);
    if (parsed > 0) return parsed;
  }
  return DEFAULT_WEBCHAT_IDLE_REAP_GRACE_MS;
}

/** 단일 sweep tick 당 처리 execution 수 상한 (terminal-revoke reconcile 과 동형). */
export const WEBCHAT_IDLE_REAP_BATCH_LIMIT = 500;
