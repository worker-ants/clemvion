import { describe, it, expect } from '@jest/globals';

import {
  assertEnoughFiresForOverlap,
  assertGuardBelowKnownTimeouts,
} from './overlap-preconditions';

/**
 * **겹침 전제 둘 자신의 회귀 가드.**
 *
 * 이 두 규칙은 `test/helpers/concurrency.ts` 의 `raceUnderHeldLock` 이 「겹침을 실제로
 * 만들었다」고 주장할 수 있는 근거다. 규칙이 무르게 바뀌면 그 헬퍼를 쓰는 **e2e 11 블록이
 * 동시에** 조용히 통과한다 — 고치기 전 코드까지 초록으로 만드는 자리라 규칙 쪽에 가드를 둔다.
 *
 * 종전에는 둘 다 `concurrency.ts` 안에 있었고 **어떤 러너도 지나가지 않았다**
 * (`test/` 는 unit jest 의 `rootDir` 밖, `.spec.ts` 는 e2e `testRegex` 밖). 그 사실을
 * 발견한 것이 #1377 이고, 이 파일이 그 항목을 닫는다.
 *
 * > **경계값을 일부러 싣는다.** `>=` 를 `>` 로 낮추거나 루프를 첫 항만 보게 줄이는 편집은
 * > 「대충 맞는」 테스트를 전부 통과한다. 아래 각 블록은 그 편집 하나씩을 겨냥한다.
 */
describe('assertEnoughFiresForOverlap', () => {
  // `1` 이 이 가드의 존재 이유다 — 요청 하나는 락을 기다리므로 공허성 가드가 `pending` 을
  // 보고 통과시킨다. `0` 은 다른 방어(`Promise.all([])` 즉시 resolve)가 이미 잡는다.
  it.each([[0], [1]])('thunk %i개면 던진다', (fireCount) => {
    expect(() => assertEnoughFiresForOverlap(fireCount)).toThrow(
      /2개 이상이어야 한다/,
    );
  });

  // 경계 — `2` 가 통과해야 `< 3` 류의 과잉 가드가 죽는다.
  it.each([[2], [3], [9]])('thunk %i개면 통과한다', (fireCount) => {
    expect(() => assertEnoughFiresForOverlap(fireCount)).not.toThrow();
  });

  it('받은 수를 메시지에 싣는다 — 무엇을 고쳐야 하는지 보이게', () => {
    expect(() => assertEnoughFiresForOverlap(1)).toThrow(/받은 수: 1/);
  });
});

describe('assertGuardBelowKnownTimeouts', () => {
  const TIMEOUTS = [
    ['FIRST_TIMEOUT_MS', 5_000],
    ['SECOND_TIMEOUT_MS', 3_000],
  ] as const;

  it('모든 상한보다 짧으면 통과한다', () => {
    expect(() => assertGuardBelowKnownTimeouts(1_500, TIMEOUTS)).not.toThrow();
  });

  // 경계 — 같으면 던져야 한다. 락 타임아웃과 가드가 동시에 만료되면 어느 쪽이 이길지
  // 모르고, 그 비결정이 바로 이 검사가 막으려는 오탐이다. (`>=` → `>` 뮤턴트를 죽인다.)
  it('가장 짧은 상한과 **같으면** 던진다', () => {
    expect(() => assertGuardBelowKnownTimeouts(3_000, TIMEOUTS)).toThrow(
      /SECOND_TIMEOUT_MS/,
    );
  });

  // 위반이 **둘째 항에만** 있다(4000 < 5000 이라 첫 항은 통과). 루프를 첫 항만 보게 줄이는
  // 편집을 죽이는 유일한 케이스다 — 아래 6000 케이스는 그 편집에서도 통과한다.
  // 메시지의 이름·값까지 본다: 실패가 **어느 상수를 고치라는 것인지** 가리켜야 한다.
  it('첫 항을 통과해도 둘째 항이 위반이면 던진다', () => {
    expect(() => assertGuardBelowKnownTimeouts(4_000, TIMEOUTS)).toThrow(
      /SECOND_TIMEOUT_MS\(3000ms\)/,
    );
  });

  // 두 항 모두 위반. 먼저 만난 항을 보고한다 — 위 케이스와 **다른 값**이라
  // 둘이 서로를 구분한다(같은 입력이면 한쪽은 아무것도 추가로 말하지 않는다).
  it('여러 항이 위반이면 먼저 만난 항을 보고한다', () => {
    expect(() => assertGuardBelowKnownTimeouts(6_000, TIMEOUTS)).toThrow(
      /FIRST_TIMEOUT_MS\(5000ms\)/,
    );
  });

  // 문서화된 한계를 **동작으로** 고정한다 — 「여기 적힌 것만 검사된다」는 곧
  // 「목록이 비면 아무것도 검사하지 않는다」다. 이걸 적어 두지 않으면 다음 사람이
  // 빈 목록을 「전부 안전」으로 읽는다.
  it('빈 목록은 공허하게 통과한다 (검사 범위의 한계)', () => {
    expect(() =>
      assertGuardBelowKnownTimeouts(Number.MAX_SAFE_INTEGER, []),
    ).not.toThrow();
  });
});
