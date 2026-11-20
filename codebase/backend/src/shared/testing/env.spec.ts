import {
  restoreEnvAfterEach,
  setEnvForEach,
  snapshotEnv,
  withEnv,
} from './env';

// 이 파일만 쓰는 이름이라 바깥 환경과 겹치지 않는다.
const SET = 'CLE_TEST_ENV_HELPER_SET';
const UNSET = 'CLE_TEST_ENV_HELPER_UNSET';

function resetFixture(): void {
  process.env[SET] = 'original';
  delete process.env[UNSET];
}

describe('shared/testing/env', () => {
  afterAll(() => {
    delete process.env[SET];
    delete process.env[UNSET];
  });

  describe('snapshotEnv', () => {
    beforeEach(resetFixture);

    it('있던 값은 그 값으로, 없던 변수는 키째 지워 되돌린다', () => {
      const restore = snapshotEnv([SET, UNSET]);
      process.env[SET] = 'changed';
      process.env[UNSET] = 'added';

      restore();

      expect(process.env[SET]).toBe('original');
      expect(UNSET in process.env).toBe(false);
    });
  });

  describe('withEnv', () => {
    beforeEach(resetFixture);

    it('동기 fn 안에서는 patch 값이 보이고 끝나면 되돌린다(undefined 는 지움)', () => {
      const seen = withEnv({ [SET]: undefined, [UNSET]: 'on' }, () => ({
        set: process.env[SET],
        hasSet: SET in process.env,
        unset: process.env[UNSET],
      }));

      expect(seen).toEqual({ set: undefined, hasSet: false, unset: 'on' });
      expect(process.env[SET]).toBe('original');
      expect(UNSET in process.env).toBe(false);
    });

    it('fn 이 던져도 되돌리고 그 오류를 그대로 던진다', () => {
      const boom = new Error('boom');

      expect(() =>
        withEnv({ [SET]: 'inside' }, () => {
          throw boom;
        }),
      ).toThrow(boom);
      expect(process.env[SET]).toBe('original');
    });

    it('비동기 fn 은 끝날 때까지 patch 를 유지한 뒤 되돌린다', async () => {
      let resolveInner: () => void = () => undefined;
      const inner = new Promise<void>((resolve) => {
        resolveInner = resolve;
      });

      const pending = withEnv({ [SET]: 'async' }, async () => {
        await inner;
        return process.env[SET];
      });
      expect(process.env[SET]).toBe('async');

      resolveInner();
      await expect(pending).resolves.toBe('async');
      expect(process.env[SET]).toBe('original');
    });

    it('비동기 fn 이 거부해도 되돌린다', async () => {
      const boom = new Error('async boom');

      await expect(
        withEnv({ [UNSET]: 'on' }, async () => {
          await Promise.resolve();
          throw boom;
        }),
      ).rejects.toBe(boom);
      expect(UNSET in process.env).toBe(false);
    });
  });

  describe('setEnvForEach', () => {
    beforeAll(() => {
      process.env[SET] = 'outer';
      process.env[UNSET] = 'outer';
    });
    afterAll(resetFixture);

    describe('안쪽', () => {
      setEnvForEach({ [SET]: 'inner', [UNSET]: undefined });

      it('테스트가 시작할 때 patch 값으로 맞춘다(undefined 는 지움)', () => {
        expect(process.env[SET]).toBe('inner');
        expect(UNSET in process.env).toBe(false);
        process.env[SET] = 'changed in test';
      });

      it('앞 테스트가 바꿔도 다음 테스트는 다시 patch 값에서 시작한다', () => {
        expect(process.env[SET]).toBe('inner');
      });
    });

    it('블록을 벗어나면 바깥 값으로 돌아와 있다', () => {
      expect(process.env[SET]).toBe('outer');
      expect(process.env[UNSET]).toBe('outer');
    });
  });

  describe('restoreEnvAfterEach', () => {
    // 테스트마다 다시 세팅하지 않는다. 그래야 두 번째 테스트가 도우미의 복원만으로 원래 값을 보는지 확인할 수 있다.
    beforeAll(resetFixture);
    restoreEnvAfterEach(SET, UNSET);

    // 두 테스트는 순서대로 돈다. 첫 테스트가 바꾼 값이 두 번째 테스트 시작 전에 되돌려졌는지 본다.
    it('테스트 안에서 바꾼다', () => {
      process.env[SET] = 'leaked?';
      process.env[UNSET] = 'leaked?';
      expect(process.env[SET]).toBe('leaked?');
    });

    it('앞 테스트가 바꾼 값은 남지 않는다', () => {
      expect(process.env[SET]).toBe('original');
      expect(UNSET in process.env).toBe(false);
    });
  });
});
