/**
 * 동시 요청 e2e 의 **겹침 전제 둘** — 순수 규칙이라 DB 없이 검증된다.
 *
 * 규칙을 여기 꺼내 두는 이유는 **규칙 자신을 테스트하기 위해서**다. 종전에는 둘 다
 * `test/helpers/concurrency.ts` 안(하나는 모듈 최상위 `for` 루프, 하나는 DB 의존 함수 안)에
 * 있어 어떤 테스트도 지나가지 않았다 — 「주석 대신 코드로 고정」해 놓고 그 코드가 미검증이었다.
 *
 * 자리 근거(`test/helpers/` 가 아니라 `src/shared/testing/`)는 `PROJECT.md §파일 위치·명명`
 * 한 줄이 SoT 다. 여기 복제하지 않는다.
 *
 * **런타임 의존이 없다** — import 0. `tsconfig.build.json` 이 `src/shared/testing/**` 를
 * exclude 하므로 `dist/` 로도 나가지 않는다.
 */

/**
 * 겹침을 만들려면 발사할 thunk 가 **2개 이상**이어야 한다.
 *
 * 이 가드가 실제로 막는 것은 **`1`** 이다 — 요청 하나는 락을 기다리므로 공허성 가드가
 * `pending` 을 보고 **통과**시킨다. 겹침이 없는데 초록인 테스트가 그렇게 만들어진다.
 * (`0` 은 `Promise.all([])` 가 즉시 resolve 돼 공허성 가드가 이미 `settled` 로 잡는다 —
 * 이 가드는 그 경우 메시지를 낫게 할 뿐이다.)
 *
 * @throws `fireCount` 가 2 미만이면.
 */
export function assertEnoughFiresForOverlap(fireCount: number): void {
  if (fireCount < 2) {
    throw new Error(
      `겹침을 만들려면 thunk 가 2개 이상이어야 한다 (받은 수: ${fireCount})`,
    );
  }
}

/**
 * 공허성 가드 대기 시간이 **알려진 잠금 대기 상한들보다 짧은지** 확인한다.
 *
 * 짧지 않으면 가드가 기다리는 동안 요청이 **락 타임아웃으로** 끝나 `settled` 가 되고,
 * «겹침을 못 만들었다» 와 구분되지 않는다 — 가드가 조용히 오탐한다.
 *
 * **검사 범위는 `timeouts` 에 담긴 것뿐이다.** 더 짧은 상한을 쓰는 경로가 이 헬퍼를 쓰게 되면
 * 호출부가 그 상수를 목록에 추가해야 한다. 빈 목록은 **공허하게 통과**한다 — 그 한계를
 * 여기 적어 두고, self-spec 이 그 동작을 명시적으로 고정한다.
 *
 * @param guardMs 공허성 가드가 기다리는 시간.
 * @param timeouts `[상수명, 밀리초]` 쌍들. 상수명은 실패 메시지가 **어느 것을 고쳐야 하는지**
 *   가리키는 데 쓴다.
 * @throws `guardMs` 가 어느 상한 **이상**이면 (같아도 오탐하므로 `>=` 다).
 */
export function assertGuardBelowKnownTimeouts(
  guardMs: number,
  timeouts: ReadonlyArray<readonly [string, number]>,
): void {
  for (const [name, timeoutMs] of timeouts) {
    if (guardMs >= timeoutMs) {
      throw new Error(
        `공허성 가드(${guardMs}ms)가 ${name}(${timeoutMs}ms) 이상이다 — ` +
          `가드가 락 타임아웃을 «겹침 실패» 로 오탐한다.`,
      );
    }
  }
}
