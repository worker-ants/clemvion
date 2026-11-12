import { NotFoundException } from '@nestjs/common';

import { SecretWriteJournal } from './secret-write-journal';

/**
 * 저장소를 `Map` 으로 흉내 낸다. 되돌린 결과를 호출 기록이 아니라 **남은 값**으로 단언하려고.
 * `unreadable` 에 넣은 ref 는 복호화 실패처럼 `NotFoundException` 이 아닌 오류를 던진다.
 */
function fakeStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const unreadable = new Set<string>();
  const secrets = {
    resolve: jest.fn((ref: string) => {
      if (unreadable.has(ref)) {
        return Promise.reject(new Error('Secret decryption failed'));
      }
      const value = values.get(ref);
      return value === undefined
        ? Promise.reject(new NotFoundException('Secret not found'))
        : Promise.resolve(value);
    }),
    rotate: jest.fn((ref: string, _ws: string, plaintext: string) => {
      unreadable.delete(ref);
      values.set(ref, plaintext);
      return Promise.resolve();
    }),
    delete: jest.fn((ref: string) => {
      unreadable.delete(ref);
      values.delete(ref);
      return Promise.resolve();
    }),
  };
  return { secrets, values, unreadable };
}

function silentLogger() {
  return { warn: jest.fn(), error: jest.fn() };
}

const REF_A = 'secret://triggers/t-1/a';
const REF_B = 'secret://triggers/t-1/b';
const BOOM = new Error('step failed');

describe('SecretWriteJournal', () => {
  it('read — 행이 없으면 absent, 읽으면 present, 그 밖의 오류는 unreadable', async () => {
    const { secrets, unreadable } = fakeStore({ [REF_A]: 'v' });
    unreadable.add(REF_B);
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(journal.read(REF_A)).resolves.toEqual({
      state: 'present',
      plaintext: 'v',
    });
    await expect(journal.read(REF_B)).resolves.toEqual({
      state: 'unreadable',
    });
    await expect(journal.read('secret://triggers/t-1/none')).resolves.toEqual({
      state: 'absent',
    });
  });

  it('성공하면 쓴 값을 그대로 두고 결과를 돌려준다', async () => {
    const { secrets, values } = fakeStore({ [REF_A]: 'old' });
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    const result = await journal.undoOnFailure(
      silentLogger(),
      'test',
      async () => {
        await journal.write(REF_A, 'new', await journal.read(REF_A));
        return 'ok';
      },
    );

    expect(result).toBe('ok');
    expect(values.get(REF_A)).toBe('new');
    expect(secrets.delete).not.toHaveBeenCalled();
  });

  it('실패하면 값이 있던 행은 그 값으로, 없던 행은 지워서 되돌리고 원래 오류를 던진다', async () => {
    const { secrets, values } = fakeStore({ [REF_A]: 'old-a' });
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(silentLogger(), 'test', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        await journal.write(REF_B, 'new-b', await journal.read(REF_B));
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    expect(values.get(REF_A)).toBe('old-a');
    expect(values.has(REF_B)).toBe(false);
    expect(secrets.rotate).toHaveBeenLastCalledWith(REF_A, 'ws-1', 'old-a');
  });

  it('마지막 쓰기부터 되돌린다', async () => {
    const { secrets } = fakeStore({ [REF_A]: 'old-a', [REF_B]: 'old-b' });
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(silentLogger(), 'test', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        await journal.write(REF_B, 'new-b', await journal.read(REF_B));
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    const undoWrites = secrets.rotate.mock.calls
      .slice(2)
      .map(([ref, , plaintext]) => [ref, plaintext]);
    expect(undoWrites).toEqual([
      [REF_B, 'old-b'],
      [REF_A, 'old-a'],
    ]);
  });

  it('쓰기가 던지면 그 행은 기록하지 않아 되돌리지 않는다', async () => {
    // 다른 워크스페이스 행이라 거부된 쓰기를 «없던 행» 으로 보고 지우면 남의 비밀을 지운다.
    // 남의 행이 쓰려던 값과 같으면 «그 사이 바뀐 행» 검사로는 걸러지지 않는다. 그래서 같은 값으로 둔다.
    const { secrets, values } = fakeStore({ [REF_A]: 'new-a' });
    const mismatch = new Error('workspace mismatch');
    secrets.rotate.mockRejectedValueOnce(mismatch);
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(silentLogger(), 'test', async () => {
        await journal.write(REF_A, 'new-a', { state: 'absent' });
      }),
    ).rejects.toBe(mismatch);

    expect(values.get(REF_A)).toBe('new-a');
    expect(secrets.delete).not.toHaveBeenCalled();
  });

  it('그 사이 다른 값으로 바뀐 행은 건드리지 않고 warn 을 남긴다', async () => {
    const { secrets, values } = fakeStore({ [REF_A]: 'old-a' });
    const logger = silentLogger();
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(logger, 'test trigger=t-1', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        // 같은 트리거의 다른 재발급이 끼어들어 성공했다.
        values.set(REF_A, 'concurrent');
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    expect(values.get(REF_A)).toBe('concurrent');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('test trigger=t-1'),
    );
  });

  it('그 사이 행이 지워졌으면 다시 만들지 않는다', async () => {
    const { secrets, values } = fakeStore({ [REF_A]: 'old-a' });
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(silentLogger(), 'test', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        values.delete(REF_A);
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    expect(values.has(REF_A)).toBe(false);
  });

  it('쓰기 전 값이 빈 값이었으면 지운다', async () => {
    // 저장소는 빈 평문을 받지 않는다. 빈 토큰은 쓸 수 없어 «없음» 과 같다.
    const { secrets, values } = fakeStore({ [REF_A]: '   ' });
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(silentLogger(), 'test', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    expect(values.has(REF_A)).toBe(false);
  });

  it('쓰기 전 값을 읽지 못했으면 지우지 않고 error 를 남긴다', async () => {
    const { secrets, values, unreadable } = fakeStore({ [REF_A]: 'garbled' });
    unreadable.add(REF_A);
    const logger = silentLogger();
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(logger, 'test', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    expect(values.get(REF_A)).toBe('new-a');
    expect(secrets.delete).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(REF_A));
  });

  it('한 행을 되돌리다 실패해도 나머지를 되돌리고 원래 오류를 던진다. 로그에 평문을 싣지 않는다', async () => {
    const { secrets, values } = fakeStore({ [REF_A]: 'old-a' });
    const logger = silentLogger();
    const journal = new SecretWriteJournal(secrets, 'ws-1');

    await expect(
      journal.undoOnFailure(logger, 'test', async () => {
        await journal.write(REF_A, 'new-a', await journal.read(REF_A));
        await journal.write(REF_B, 'new-b', await journal.read(REF_B));
        secrets.delete.mockRejectedValueOnce(new Error('db down'));
        throw BOOM;
      }),
    ).rejects.toBe(BOOM);

    expect(values.get(REF_B)).toBe('new-b');
    expect(values.get(REF_A)).toBe('old-a');
    const logged = logger.error.mock.calls.map(([m]) => String(m)).join('\n');
    expect(logged).toContain(REF_B);
    expect(logged).toContain('db down');
    expect(logged).not.toContain('new-b');
    expect(logged).not.toContain('old-a');
  });
});
