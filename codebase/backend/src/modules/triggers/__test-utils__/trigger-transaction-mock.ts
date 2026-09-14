/**
 * 락 안 재읽기(`m.findOne`)가 **바깥 `findOne` 과 다른 값**을 보게 만드는 옵션.
 *
 * 기본값(미지정)은 바깥 repo mock 에 위임 — 즉 «최초 읽기 == 락 안 재읽기» 다. 그 기본값은
 * lost update 수정을 **검증하지 못한다**: 두 읽기가 늘 같으면 «다시 읽는다» 는 동작이
 * 관측되지 않기 때문이다. 실측으로 확인했다 — `survivesWithFresh` 의 세 번째 OR 항을
 * 통째로 지워도 `src/modules/triggers` 279건이 전부 GREEN 이었다
 * (`/ai-review` `review/code/2026/09/14/18_17_44` testing CRITICAL#2·#3).
 * 그래서 **두 읽기를 갈라 놓는 테스트**가 따로 필요하고, 이 옵션이 그 자리를 만든다.
 */
export interface TransactionMockOptions {
  /** 락 안 `m.findOne` 이 돌려줄 값. 미지정이면 바깥 `findOne` 에 위임. */
  freshFindOne?: (options: unknown) => unknown;
  /**
   * advisory lock 이 잡힐 때마다 그 **키**로 불린다.
   *
   * 락은 SQL 한 줄이라 바깥에서 관측할 방법이 없었다 — «이 경로가 락을 잡는가» 를 단언하려면
   * 그 사실이 테스트에 보여야 한다. 락을 빼는 뮤턴트를 잡는 유일한 고리다.
   */
  onLock?: (key: string) => void;
  /**
   * `SET LOCAL lock_timeout` 이 걸릴 때마다 그 **구문**으로 불린다.
   *
   * 상한도 SQL 한 줄이라 관측 고리가 없으면 «삭제 경로만 상한을 둔다» 를 단언할 수 없다 —
   * 실측으로 확인했다: 상한을 지우는 뮤턴트가 305건 전건 GREEN 으로 살아남았다.
   */
  onLockTimeout?: (statement: string) => void;
}

/**
 * `Trigger` repo mock 에 **`manager.transaction` 을 달아** 준다 —
 * 콜백을 실제로 실행하고, 안쪽 호출을 바깥 repo mock 으로 위임한다.
 *
 * ## 왜 이 파일이 `triggers.service.spec.ts` 밖에 있나
 *
 * 처음엔 그 파일 안의 지역 헬퍼였고, `getRepositoryToken(Trigger)` provider 를 **그 파일
 * 안에서만** 세어 전부 감쌌다. 그런데 `TriggersService.update()` 가 트랜잭션을 쓰게 되자
 * **다른 파일**(`triggers.web-chat.spec.ts`)이 `Cannot read properties of undefined
 * (reading 'transaction')` 로 깨졌다 — 그 파일도 자기 Trigger repo mock 을 갖고 있었다.
 * 전수로 세니 provider 는 **6개 파일**에 흩어져 있다. 열거 범위를 «한 파일» 로 잡은 것이
 * 결함이었으므로, 헬퍼를 공용 자리로 올려 다음 파일이 찾을 수 있게 한다.
 *
 * **6개 전부를 이관한 것은 아니다** — 실제로 감싼 것은 `TriggersService` 의 트랜잭션 경로를
 * 타는 **2개**(`triggers.service.spec.ts` · `triggers.web-chat.spec.ts`)다. 나머지 4개
 * (`auth-configs` · `external-interaction` · `hooks` · `schedules`)는 그 경로를 호출하지 않아
 * 지금은 안전하지만, 호출하게 되는 순간 같은 `Cannot read properties of undefined` 로 깨진다.
 * 그때 고칠 자리가 여기라는 뜻이다.
 *
 * ## 무엇을 위임하나 — 그리고 왜 no-op 이면 안 되나
 *
 * 콜백을 실행하지 않으면 repo mock 의 `update`/`save` 가 한 번도 안 불려서, `config` 쓰기를
 * 단언하는 테스트들이 «아무 일도 안 일어났는데 통과» 한다. 그래서
 * `m.update(Trigger, where, patch)` → `repo.update(where, patch)`,
 * `m.save(Trigger, entity)` → `repo.save(entity)`,
 * `m.remove(entity)` → `repo.remove(entity)` 로 넘겨 **기존 단언의 의미를 보존**한다.
 *
 * **실측(뮤턴트)**: `transaction` 이 콜백을 실행하지 않게 바꾸면 `src/modules/triggers` 에서
 * **53개 케이스가 RED** 다(R-CC-21 9 · lost-update 8 · `rotateBotToken` 8 · schedule 동기화 7 ·
 * 생성 경로 5 · 그 외 16). 즉 이 위임은 장식이 아니라 그 53건을 살아 있게 하는 배선이다 —
 * GREEN 만으로는 증거가 되지 않아 빼 보고 셌다.
 *
 * > **이 수는 시점 의존이다.** 처음 쟀을 땐 13이었는데, 그 뒤 창 1 과 `remove()` 가 같은
 * > 트랜잭션 경로로 들어오면서 의존하는 테스트가 늘었다. 위 값은 **이 PR 이 닫히는 시점**의
 * > 실측이다 — 이 파일을 고칠 땐 다시 재라.
 *
 * `m.findOne` 도 같은 이유로 위임한다 — 락 안 재읽기가 «지금 DB 에 있는 값» 을 보는 것이
 * 이 수정의 핵심이라, 그 자리를 고정값으로 채우면 presence 게이트 재계산이 검증되지 않는다.
 * 두 읽기를 **다르게** 만들어야 하는 테스트는 `options.freshFindOne` 을 쓴다.
 *
 * 선례: `execution-engine.service.spec.ts` 의 admission advisory-lock 트랜잭션 mock
 * (그쪽도 콜백을 실제로 실행한다).
 */
export function withTransactionMock(
  triggerRepoMock: Record<string, unknown>,
  options: TransactionMockOptions = {},
): Record<string, unknown> {
  // 이미 `manager` 를 가진 mock 은 그대로 둔다 — 이중 래핑 방지.
  // **현재 이 분기에 도달하는 테스트는 없다**(전수 확인). 그래도 두는 이유는 `createBaseProviders`
  // 가 호출부에서 받은 mock 을 그대로 감싸기 때문이다 — 호출부가 자기 `manager` 를 넣어 주는
  // 순간 이중 래핑이 조용히 동작을 바꾼다. 「검증된 동작」으로 인용하지 말 것.
  if (triggerRepoMock.manager) return triggerRepoMock;
  return {
    ...triggerRepoMock,
    manager: {
      // `async` 를 붙이지 않는다 — `await` 가 없어 `require-await` 에 걸린다. 콜백의 반환을
      // 그대로 돌려주면 Promise 든 아니든 호출부의 `await` 가 동일하게 처리한다.
      transaction: jest.fn((cb: (m: Record<string, unknown>) => unknown) =>
        Promise.resolve(
          cb({
            query: jest.fn((sql: unknown, params: unknown) => {
              if (typeof sql === 'string' && sql.includes('lock_timeout')) {
                options.onLockTimeout?.(sql);
              }
              if (
                typeof sql === 'string' &&
                sql.includes('pg_advisory_xact_lock') &&
                Array.isArray(params)
              ) {
                options.onLock?.(String(params[0]));
              }
              return Promise.resolve([]);
            }),
            findOne: jest.fn((_entity: unknown, findOptions: unknown) => {
              if (options.freshFindOne)
                return options.freshFindOne(findOptions);
              const findOneMock = triggerRepoMock.findOne as
                ((o: unknown) => unknown) | undefined;
              return findOneMock ? findOneMock(findOptions) : undefined;
            }),
            remove: jest.fn((target: unknown) => {
              const removeMock = triggerRepoMock.remove as
                ((e: unknown) => unknown) | undefined;
              return removeMock ? removeMock(target) : target;
            }),
            save: jest.fn((_entity: unknown, target: unknown) => {
              const saveMock = triggerRepoMock.save as
                ((e: unknown) => unknown) | undefined;
              return saveMock ? saveMock(target) : target;
            }),
            update: jest.fn(
              (_entity: unknown, where: unknown, patch: unknown) => {
                const updateMock = triggerRepoMock.update as
                  ((w: unknown, p: unknown) => unknown) | undefined;
                return updateMock ? updateMock(where, patch) : undefined;
              },
            ),
          }),
        ),
      ),
    },
  };
}
