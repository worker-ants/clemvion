import { User } from './entities/user.entity';
import { USER_ROW_LOCK_TIMEOUT_MS, lockUserRow } from './user-row-lock';

describe('lockUserRow', () => {
  function makeManager(row: { id: string } | null) {
    const findOne = jest.fn().mockResolvedValue(row);
    const query = jest.fn().mockResolvedValue(undefined);
    const getRepository = jest.fn((entity: unknown) => {
      if (entity !== User) throw new Error('unexpected entity');
      return { findOne };
    });
    return { manager: { query, getRepository }, findOne, query };
  }

  it('sets the lock wait limit before taking the user row lock', async () => {
    const { manager, findOne, query } = makeManager({ id: 'u1' });

    await lockUserRow(manager as never, 'u1');

    expect(query).toHaveBeenCalledWith(
      `SET LOCAL lock_timeout = '${USER_ROW_LOCK_TIMEOUT_MS}ms'`,
    );
    expect(query.mock.invocationCallOrder[0]).toBeLessThan(
      findOne.mock.invocationCallOrder[0],
    );
  });

  // FOR UPDATE 는 `webauthn_credential` INSERT 의 외래 키 검사(FOR KEY SHARE)까지 막는다.
  // 모드를 바꾸면 같은 사용자의 등록이 자기 잠금에 막히므로 모드를 통째로 단언한다.
  it('locks only the id column with FOR NO KEY UPDATE', async () => {
    const { manager, findOne } = makeManager({ id: 'u1' });

    await lockUserRow(manager as never, 'u1');

    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true },
      lock: { mode: 'for_no_key_update' },
    });
  });

  it('returns whether the user row exists', async () => {
    await expect(
      lockUserRow(makeManager({ id: 'u1' }).manager as never, 'u1'),
    ).resolves.toBe(true);
    await expect(
      lockUserRow(makeManager(null).manager as never, 'u1'),
    ).resolves.toBe(false);
  });
});
