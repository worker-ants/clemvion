import { expect } from '@jest/globals';
import { Client } from 'pg';

import {
  assertEnoughFiresForOverlap,
  assertGuardBelowKnownTimeouts,
} from '../../src/shared/testing/overlap-preconditions';
import { TRIGGER_DELETE_LOCK_TIMEOUT_MS } from '../../src/modules/triggers/trigger-config-lock';

/**
 * 아래 검사가 비교하는 상한들. **여기 있는 것만 검사된다.**
 *
 * 더 짧은 잠금 대기 상한을 쓰는 경로가 이 헬퍼를 쓰게 되면 **그 상수를 여기 추가해야 한다** —
 * 추가하지 않으면 검사는 통과하지만 그 호출부의 가드는 오탐한다.
 */
const KNOWN_LOCK_TIMEOUTS_MS: ReadonlyArray<readonly [string, number]> = [
  ['TRIGGER_DELETE_LOCK_TIMEOUT_MS', TRIGGER_DELETE_LOCK_TIMEOUT_MS],
];

/**
 * 공허성 가드 대기 시간. 프로덕션의 잠금 대기 상한보다 **짧아야** 한다.
 *
 * 그 관계가 왜 필요한지와 검사 범위의 한계는 `assertGuardBelowKnownTimeouts` 의 JSDoc 이
 * SoT 다 — 여기 복제하지 않는다(두 자리에 적으면 한쪽이 낡는다).
 */
const VACUITY_GUARD_MS = 1_500;

// 임포트 시 **오늘의 상수로** 규칙을 발화시킨다. 규칙 자체는 순수 함수라
// `overlap-preconditions.spec.ts` 가 임의 입력으로 직접 검증한다 — 종전에는 이 자리가
// 최상위 `for` 루프여서 규칙과 「오늘의 값에 적용」이 한 덩어리였고, 어느 쪽도 테스트되지 않았다.
assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS);

/**
 * 동시 요청 e2e 의 겹침 오케스트레이션 — **공허성 가드를 한 곳에 모은다.**
 *
 * ## 왜 헬퍼인가
 *
 * 「동시 삭제가 감사 행을 두 번 남긴다」 결함 클래스를 아홉 자리 닫으면서(#1369~#1376)
 * 같은 구조의 e2e 가 아홉 파일 11 블록 쌓였다. 줄 수보다 중요한 것은 **공허성 가드**다:
 * 그 가드가 없으면 두 요청이 우연히 순차 처리돼도 테스트가 통과하고, **고치기 전 코드까지
 * 초록으로 만든다**. 조용히 거짓 초록이 되는 부분이라 손으로 복제할수록 위험하다.
 * 실제로 #1376 에서 가드를 빠뜨린 테스트를 썼다가 리뷰가 잡았다.
 *
 * ## 겹침을 어떻게 만드나
 *
 * 우연에 맡기지 않는다 — **테스트가 락을 쥔다.** 별도 커넥션(`locker`)이 트랜잭션 안에서
 * 대상 행이나 advisory key 를 잡으면, 발사된 요청들은 무락 선조회·가드를 모두 통과한 뒤
 * 쓰기 지점에서 나란히 대기한다. 그 상태를 관측(공허성 가드)한 뒤 COMMIT 으로 함께 푼다.
 *
 * @param locker 락 전용 커넥션. **요청이 도는 동안 열려 있어야 하므로 검증용 `db` 와 달라야 한다** —
 *   같은 커넥션을 쓰면 락을 쥔 채 검증 쿼리를 보내다 자기 자신을 기다린다.
 * @param lock 락 한 문장. 행 락(`SELECT … FOR UPDATE`)·advisory lock
 *   (`SELECT pg_advisory_xact_lock(hashtext($1))`) 둘 다 이 형태다.
 * @param fires 발사할 thunk들(**2개 이상**). 대개 같은 요청을 두 번이지만, 서로 다른 대상을
 *   겹치게 할 때는 서로 다른 thunk 를 준다(`[() => del(a), () => del(b)]`).
 * @returns 각 thunk 의 결과. **정렬하지 않는다** — 무엇으로 정렬할지는 호출부가 안다.
 * @throws `fires` 가 2개 미만이면 — 락을 잡기도 전에 즉시 던진다(겹침 자체가 없다).
 * @throws `lock.sql` 자체가 실패하면 — 그대로 전파한다(락을 못 잡았으니 겹침을 만들 수 없다).
 * @throws 공허성 가드 실패 시 — 겹침을 만들지 못했다는 뜻이므로 **그 테스트의 단언은 무의미**하다.
 *
 * @example
 * const results = await raceUnderHeldLock(
 *   locker,
 *   { sql: 'SELECT id FROM workflow WHERE id = $1 FOR UPDATE', params: [id] },
 *   [fireDelete, fireDelete],
 * );
 * // 숫자 비교자를 반드시 준다 — 기본 `.sort()` 는 사전식이라 `[204, 404]` 에서는 우연히 맞지만
 * // 다른 값으로 복제하면 조용히 깨진다.
 * expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([204, 404]);
 */
export async function raceUnderHeldLock<T>(
  locker: Client,
  lock: { sql: string; params?: unknown[] },
  fires: Array<() => Promise<T>>,
): Promise<T[]> {
  // 하나만 발사하면 겹침 자체가 없다 — 아래 공허성 가드가 `pending` 을 보고 **통과**시키므로
  // 이 검사가 없으면 겹침 없는 테스트가 초록이 된다. 규칙은 순수 함수라 따로 검증된다.
  assertEnoughFiresForOverlap(fires.length);

  let pending: Promise<T[]> | undefined;
  await locker.query('BEGIN');
  try {
    await locker.query(lock.sql, lock.params);

    // 발사된 요청들은 선조회·가드를 통과한 뒤 쓰기 지점에서 위 락을 기다린다.
    pending = Promise.all(fires.map((fire) => fire()));

    // 공허성 가드 — 락을 놓기 **전에** 아무것도 끝나지 않았음을 관측한다. 먼저 끝났다면
    // fixture 가 겹침을 만들지 못한 것이고, 호출부의 단언은 고치기 전 코드도 통과시킨다.
    // 대기 시간의 근거는 `VACUITY_GUARD_MS` 선언부에 한 번만 적는다.
    const raced = await Promise.race([
      pending.then(() => 'settled' as const),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), VACUITY_GUARD_MS),
      ),
    ]);
    expect(raced).toBe('pending');

    await locker.query('COMMIT');
    return await pending;
  } finally {
    // COMMIT 을 이미 탔으면 이 ROLLBACK 은 no-op 이다(Postgres 가 에러 없이 넘긴다).
    // 단언 실패로 COMMIT 을 못 탄 경우에만 실제로 락을 푼다.
    await locker.query('ROLLBACK').catch(() => undefined);
    // 락이 풀리면 대기하던 요청들이 끝난다 — 그 rejection 이 unhandled 로 새지 않게 흡수한다.
    await pending?.catch(() => undefined);
  }
}
