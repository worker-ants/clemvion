import {
  deleteTriggerSecretsAfterCommit,
  triggerSecretPrefix,
  undoAbsentTriggerWrite,
} from './trigger-resource-release';

/**
 * 자원 정리의 **순서와 실패 정책** — 네 삭제 경로와 다섯 쓰기 보상 자리가 모두 이 두 함수를 쓴다.
 * 여기가 틀리면 전부 틀리므로 정책 자체를 따로 고정한다.
 */
describe('trigger-resource-release', () => {
  function makeDeps(opts: { failFor?: string } = {}) {
    const events: string[] = [];
    const secrets = {
      deleteByPrefix: jest.fn((prefix: string) => {
        events.push(`delete:${prefix}`);
        if (opts.failFor && prefix.includes(opts.failFor)) {
          return Promise.reject(new Error('db down'));
        }
        return Promise.resolve(1);
      }),
    };
    const logger = {
      error: jest.fn((msg: string) => events.push(`log:${msg}`)),
    };
    return { events, secrets, logger };
  }

  it('접두는 트리거 id 로 끝나는 디렉토리다 — 이웃 id 가 접두로 겹치지 않는다', () => {
    // `trig-1` 의 접두가 `trig-10` 의 ref 를 삼키지 않으려면 끝의 `/` 가 필요하다.
    expect(triggerSecretPrefix('trig-1')).toBe('secret://triggers/trig-1/');
  });

  describe('deleteTriggerSecretsAfterCommit', () => {
    it('트리거마다 접두 삭제를 부른다', async () => {
      const { secrets, logger } = makeDeps();

      await deleteTriggerSecretsAfterCommit(secrets, logger, ['a', 'b'], 'T');

      expect(secrets.deleteByPrefix.mock.calls).toEqual([
        ['secret://triggers/a/'],
        ['secret://triggers/b/'],
      ]);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('하나가 실패해도 던지지 않고 남기며, 나머지를 계속 지운다', async () => {
      // 행은 이미 커밋돼 지워졌다 — 여기서 던져 500 을 주면 재시도가 404 가 되고, 뒤 트리거의
      // 비밀까지 고아로 남는다.
      const { events, secrets, logger } = makeDeps({ failFor: '/a/' });

      await expect(
        deleteTriggerSecretsAfterCommit(
          secrets,
          logger,
          ['a', 'b'],
          'Caller.x',
        ),
      ).resolves.toBeUndefined();

      expect(events[0]).toBe('delete:secret://triggers/a/');
      expect(events[1]).toMatch(/^log:Caller\.x: trigger=a .*db down/);
      expect(events[2]).toBe('delete:secret://triggers/b/');
    });

    it('빈 목록이면 아무것도 부르지 않는다', async () => {
      const { secrets, logger } = makeDeps();

      await deleteTriggerSecretsAfterCommit(secrets, logger, [], 'T');

      expect(secrets.deleteByPrefix).not.toHaveBeenCalled();
    });
  });

  describe('undoAbsentTriggerWrite', () => {
    it('teardown 이 비밀 삭제보다 먼저다 — teardown 이 방금 쓴 bot token 을 읽는다', async () => {
      const { events, secrets, logger } = makeDeps();
      const teardown = jest.fn(() => {
        events.push('teardown');
        return Promise.resolve();
      });

      await undoAbsentTriggerWrite({ teardown, secrets, logger }, 't1', 'C');

      expect(events).toEqual(['teardown', 'delete:secret://triggers/t1/']);
    });

    it('teardown 이 없으면 비밀만 지운다', async () => {
      const { events, secrets, logger } = makeDeps();

      await undoAbsentTriggerWrite({ secrets, logger }, 't1', 'C');

      expect(events).toEqual(['delete:secret://triggers/t1/']);
    });

    it('teardown 이 던져도 비밀은 지우고, 호출자에게 던지지 않는다', async () => {
      // 보상은 이미 실패 중인 요청(404) 또는 cron 안에서 돈다 — 보상의 실패가 원래 응답을
      // 가리거나 cron 을 멈추면 안 된다.
      const { events, secrets, logger } = makeDeps();
      const teardown = jest.fn(() =>
        Promise.reject(new Error('provider down')),
      );

      await expect(
        undoAbsentTriggerWrite({ teardown, secrets, logger }, 't1', 'C'),
      ).resolves.toBeUndefined();

      expect(events[0]).toMatch(/^log:C: trigger=t1 .*provider down/);
      expect(events[1]).toBe('delete:secret://triggers/t1/');
    });

    it('비밀 삭제가 던져도 호출자에게 던지지 않는다', async () => {
      const { secrets, logger } = makeDeps({ failFor: '/t1/' });

      await expect(
        undoAbsentTriggerWrite({ secrets, logger }, 't1', 'C'),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
