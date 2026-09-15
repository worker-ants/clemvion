import { describe, it, expect, jest } from '@jest/globals';
import type { EntityManager } from 'typeorm';

import { Trigger } from './entities/trigger.entity';
import {
  acquireTriggerConfigLock,
  rewriteTriggerConfigLocked,
  triggerConfigLockKey,
  TRIGGER_CONFIG_LOCK_PREFIX,
} from './trigger-config-lock';

/**
 * `rewriteTriggerConfigLocked` 자체를 보는 유일한 suite.
 *
 * 서비스 경유 테스트(`triggers.service.spec.ts`)는 «호출부가 올바르게 쓰는가» 를 보고,
 * 여기서는 **헬퍼의 계약**을 본다 — 특히 서비스 경유로는 만들 수 없는 분기:
 *
 * - 재읽기 시점에 **행이 사라진 경우**(`!fresh`) — 쓰기 skip + `false`.
 *   `/ai-review` `review/code/2026/09/14/18_17_44` testing WARNING#2 가 *"unit·e2e 어디에도
 *   커버되지 않는다 — 전용 테스트 파일 자체가 없다"* 로 지적한 자리다.
 * - **락을 읽기보다 먼저** 잡는가 — 순서가 뒤집히면 «락 안에서 다시 읽는다» 가 거짓이 된다.
 * - `columns` 와 `config` 의 **스프레드 순서** — `config` 가 뒤에 와야 호출부의 컬럼이
 *   실수로 덮지 못한다.
 */
describe('rewriteTriggerConfigLocked', () => {
  const TRIGGER_ID = 'trig-x';

  /**
   * 호출 순서를 관측할 수 있는 EntityManager mock.
   *
   * `config` 를 `null` 로도 줄 수 있게 넓혔다 — 아래 «null·undefined» 케이스가
   * `Trigger['config']`(= `Record<string, unknown>`) 로는 표현되지 않는다. 캐스트로 뭉개면
   * **타입 ratchet 말고는 아무도 못 보는** 오류가 된다(jest 는 타입을 strip 한다).
   */
  function makeManager(
    // `Omit` 으로 벗겨낸 뒤 다시 붙인다 — **교차 타입은 프로퍼티 타입도 교차**시키므로
    // `Partial<Trigger> & { config?: … | null }` 은 `null` 을 도로 잘라낸다.
    fresh:
      | (Omit<Partial<Trigger>, 'config'> & {
          config?: Record<string, unknown> | null;
        })
      | null,
    // `UpdateResult.affected` 는 `number | null | undefined` 다 — 드라이버가 보고하지
    // 않으면 비어 온다. 기본 `1` 은 «정상적으로 한 행을 썼다».
    updateAffected: number | null | undefined = 1,
  ) {
    const calls: string[] = [];
    const query = jest.fn(async (...args: unknown[]) => {
      calls.push(`query:${String(args[0])}`);
      return [];
    });
    // **인자를 받는 형태로 선언한다.** `jest.fn(async () => ...)` 로 두면 «0-인자 함수» 로
    // 추론돼 `toHaveBeenCalledWith(Trigger, where, patch)` 가 타입 오류가 된다 — 그리고 그
    // 오류는 jest 가 타입을 strip 하므로 **타입 ratchet 말고는 아무도 못 본다**.
    const findOne = jest.fn(async (_entity: unknown, _options: unknown) => {
      calls.push('findOne');
      return fresh;
    });
    const update = jest.fn(
      async (_entity: unknown, _where: unknown, _patch: unknown) => {
        calls.push('update');
        return { affected: updateAffected };
      },
    );
    const manager = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) =>
        cb({ query, findOne, update }),
      ),
    } as unknown as EntityManager;
    return { manager, calls, query, findOne, update };
  }

  it('lock key 는 `trigger-config:<id>` 다', () => {
    expect(triggerConfigLockKey(TRIGGER_ID)).toBe(
      `${TRIGGER_CONFIG_LOCK_PREFIX}:${TRIGGER_ID}`,
    );
  });

  it('락을 **읽기보다 먼저** 잡는다', async () => {
    const { manager, calls } = makeManager({ config: {} });

    await rewriteTriggerConfigLocked(manager, TRIGGER_ID, (c) => c);

    // 순서가 뒤집히면 재읽기가 락 밖에서 일어나 이 헬퍼의 존재 이유가 사라진다.
    const lockAt = calls.findIndex((c) => c.includes('pg_advisory_xact_lock'));
    const readAt = calls.indexOf('findOne');
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(readAt).toBeGreaterThan(lockAt);
  });

  it('advisory lock 에 이 트리거의 key 를 바인딩한다', async () => {
    const { manager, query } = makeManager({ config: {} });

    await rewriteTriggerConfigLocked(manager, TRIGGER_ID, (c) => c);

    expect(query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`${TRIGGER_CONFIG_LOCK_PREFIX}:${TRIGGER_ID}`],
    );
  });

  it('머지 콜백은 **재읽은 행의** config 를 받는다', async () => {
    const { manager } = makeManager({ config: { fromDb: true } });
    const merge = jest.fn((c: Trigger['config']) => ({ ...c, added: 1 }));

    await rewriteTriggerConfigLocked(manager, TRIGGER_ID, merge);

    expect(merge).toHaveBeenCalledWith({ fromDb: true });
  });

  // **제목이 말하는 두 값을 실제로 둘 다 건다.** 종전엔 제목만 «null·undefined» 이고
  // fixture 는 `undefined` 하나였다 — 3라운드 연속 지적된 자리다
  // (`review/code/2026/09/14/21_18_21` testing INFO#7). `??` 라 동작은 같지만, 제목이
  // 약속한 것을 fixture 가 덮지 않으면 그 제목이 다음 사람을 속인다.
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('config 가 %s 면 빈 객체로 좁혀 넘긴다', async (_label, config) => {
    const { manager } = makeManager({ config });
    const merge = jest.fn((c: Trigger['config']) => c);

    await rewriteTriggerConfigLocked(manager, TRIGGER_ID, merge);

    expect(merge).toHaveBeenCalledWith({});
  });

  it('columns 와 config 를 함께 쓰되 **config 가 뒤에** 온다', async () => {
    const { manager, update } = makeManager({ config: {} });

    await rewriteTriggerConfigLocked(
      manager,
      TRIGGER_ID,
      () => ({ merged: true }),
      // 호출부가 실수로 `config` 를 컬럼에 섞어 보내도 머지 결과가 이겨야 한다.
      {
        chatChannelHealth: 'healthy',
        config: { shouldLose: true },
      } as never,
    );

    expect(update).toHaveBeenCalledWith(
      Trigger,
      { id: TRIGGER_ID },
      { chatChannelHealth: 'healthy', config: { merged: true } },
    );
  });

  it('행이 사라졌으면 쓰지 않고 false 를 돌려준다', async () => {
    const { manager, update } = makeManager(null);
    const merge = jest.fn((c: Trigger['config']) => c);

    const wrote = await rewriteTriggerConfigLocked(manager, TRIGGER_ID, merge);

    expect(wrote).toBe(false);
    // **머지도 부르지 않는다.** 콜백이 부작용(로깅·카운터)을 가질 수 있어, 쓰지 않을
    // 거라면 계산도 하지 않는 것이 계약이다.
    expect(merge).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('UPDATE 가 0행에 매치되면 false 를 돌려준다 (락으로도 못 막는 세 번째 삭제 경로)', async () => {
    // 재읽기(`findOne`)는 advisory lock 아래의 **평범한 SELECT** 이지 행 잠금이 아니다.
    // `Trigger` 행을 지우는 경로는 셋인데 그중 **`Workflow`·`Workspace` 삭제의 FK
    // `onDelete: 'CASCADE'`** 는 DB 레벨이라 이 락을 애초에 잡을 수 없다. 그래서 재읽기와
    // UPDATE 사이에 행이 사라질 수 있고, 그때 `true` 를 돌려주면 호출부의 `if (wrote)` 가
    // 거짓을 믿는다 — `rotateBotToken` 은 404 대신 성공을 주고 secret store 에는 새 토큰만
    // 남는다 (`/ai-review` `review/code/2026/09/15/01_42_04` database INFO#19, 전제를 재다
    // «삭제 경로 둘이 락을 공유한다» 는 옛 서술이 반증됐다).
    const { manager } = makeManager({ id: TRIGGER_ID, config: {} }, 0);

    await expect(
      rewriteTriggerConfigLocked(manager, TRIGGER_ID, (c) => c),
    ).resolves.toBe(false);
  });

  it('affected 를 보고하지 않는 드라이버에서는 true 를 유지한다', async () => {
    // **«모른다» 를 «없다» 로 읽으면 정상 쓰기를 실패로 뒤집는다.** 위 케이스와 짝이 되는
    // 대조군이라, `affected == null` 을 0 과 같이 처리하는 편집을 잡는다.
    for (const affected of [undefined, null]) {
      const { manager } = makeManager({ id: TRIGGER_ID, config: {} }, affected);
      await expect(
        rewriteTriggerConfigLocked(manager, TRIGGER_ID, (c) => c),
      ).resolves.toBe(true);
    }
  });

  it('행이 있으면 true 를 돌려준다', async () => {
    const { manager } = makeManager({ config: {} });

    await expect(
      rewriteTriggerConfigLocked(manager, TRIGGER_ID, (c) => c),
    ).resolves.toBe(true);
  });
});

/**
 * `acquireTriggerConfigLock` 의 `timeoutMs` 는 **파라미터 바인딩이 안 되는 자리**에 보간된다.
 *
 * 현재 호출부는 모듈 상수만 넘기므로 익스플로잇은 불가능하지만(실측: 두 자리 모두
 * `TRIGGER_DELETE_LOCK_TIMEOUT_MS`), 보간이 남아 있는 한 값의 형태는 이 함수가 스스로
 * 보장해야 한다 — 다음 호출부가 계산식을 넘겨도 SQL 이 깨지지 않게
 * (`/ai-review` `review/code/2026/09/15/01_42_04` security·database INFO#2).
 */
describe('acquireTriggerConfigLock — timeoutMs 는 SQL 에 보간되기 전에 좁혀진다', () => {
  function makeQueryingManager() {
    const statements: string[] = [];
    const query = jest.fn(async (...args: unknown[]) => {
      statements.push(String(args[0]));
      return [];
    });
    return { manager: { query } as unknown as EntityManager, statements };
  }

  it('유한하지 않으면 던진다 — clamp 하지 않는다', async () => {
    // `Math.trunc(NaN)` 은 `NaN` 이라 종전엔 `'NaNms'` 가 그대로 SQL 에 실렸다.
    // **조용히 1ms 로 clamp 하면** 삭제 경로가 «왜인지 늘 타임아웃» 하는 상태가 되는데,
    // 그건 이 상수가 막으려던 «조용한 실패» 그 자체다.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const { manager, statements } = makeQueryingManager();
      await expect(
        acquireTriggerConfigLock(manager, 'trig-bad', { timeoutMs: bad }),
      ).rejects.toThrow('유한한 수');
      // **아무 SQL 도 나가지 않았다** — 깨진 구문이 실제로 전송되지 않는 것이 요점이다.
      expect(statements).toEqual([]);
    }
  });

  it('범위를 벗어난 유한 값은 clamp 한다 — 그리고 정상 값은 그대로 통과한다', async () => {
    // 세 입력이 **서로 다른 출력**을 내야 관측된다: 하한·상한·통과.
    const cases: Array<[number, string]> = [
      [-5, "SET LOCAL lock_timeout = '1ms'"],
      [999_999, "SET LOCAL lock_timeout = '60000ms'"],
      [5_000, "SET LOCAL lock_timeout = '5000ms'"],
      [1_500.9, "SET LOCAL lock_timeout = '1500ms'"],
    ];
    for (const [input, expected] of cases) {
      const { manager, statements } = makeQueryingManager();
      await acquireTriggerConfigLock(manager, 'trig-c', { timeoutMs: input });
      expect(statements[0]).toBe(expected);
    }
  });

  it('timeoutMs 를 안 주면 상한 구문 자체가 나가지 않는다', async () => {
    // 대칭 단언 — 상한을 «모든 경로» 로 넓히는 편집을 잡는다.
    const { manager, statements } = makeQueryingManager();
    await acquireTriggerConfigLock(manager, 'trig-n');
    expect(statements.filter((s) => s.includes('lock_timeout'))).toEqual([]);
    expect(statements).toHaveLength(1);
  });
});
