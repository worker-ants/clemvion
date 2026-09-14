import { describe, it, expect, jest } from '@jest/globals';
import type { EntityManager } from 'typeorm';

import { Trigger } from './entities/trigger.entity';
import {
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

  /** 호출 순서를 관측할 수 있는 EntityManager mock. */
  function makeManager(fresh: Partial<Trigger> | null) {
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
        return undefined;
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

  it('config 가 비어 있으면(null·undefined) 빈 객체로 좁혀 넘긴다', async () => {
    // `??` 라 두 값의 동작은 같다 — 제목이 `null` 만 말하면 fixture 와 어긋난다.
    const { manager } = makeManager({ config: undefined });
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

  it('행이 있으면 true 를 돌려준다', async () => {
    const { manager } = makeManager({ config: {} });

    await expect(
      rewriteTriggerConfigLocked(manager, TRIGGER_ID, (c) => c),
    ).resolves.toBe(true);
  });
});
