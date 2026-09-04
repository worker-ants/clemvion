import * as fs from 'node:fs';

import { withFiles, withFixture } from './temp-fixture';

/**
 * 이 헬퍼는 저장소 repo-guard spec 다수(`nullable-type-lie-cast.spec.ts`·
 * `swagger-dto-contract.spec.ts`)가 공유한다. 정상 경로는 그 소비처들이 광범위하게
 * 반복 호출해 간접 검증되지만, 예외 경로·async 오용 경로는 여기서 직접 겨눈다.
 */
describe('temp-fixture', () => {
  it('콜백에 절대경로를 넘기고 파일이 실제로 존재한다', () => {
    withFiles({ 'a.ts': 'const a = 1;' }, (paths) => {
      expect(fs.existsSync(paths['a.ts'])).toBe(true);
      expect(fs.readFileSync(paths['a.ts'], 'utf8')).toBe('const a = 1;');
    });
  });

  it('콜백 완료 후 tmpdir 을 지운다', () => {
    let capturedDir = '';
    withFiles({ 'a.ts': '' }, (paths) => {
      capturedDir = paths['a.ts'];
    });
    expect(fs.existsSync(capturedDir)).toBe(false);
  });

  it('콜백이 throw 해도 tmpdir 을 지운다', () => {
    let capturedDir = '';
    expect(() =>
      withFiles({ 'a.ts': '' }, (paths) => {
        capturedDir = paths['a.ts'];
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(fs.existsSync(capturedDir)).toBe(false);
  });

  it('withFixture 는 단일 파일 이름을 그대로 넘긴다', () => {
    withFixture(
      'x',
      (file) => {
        expect(file.endsWith('probe.ts')).toBe(true);
      },
      'probe.ts',
    );
  });

  /**
   * ## async 콜백은 조용한 레이스 대신 명확한 에러로 실패한다 (리뷰 W4)
   *
   * `fn` 이 thenable 을 반환하면 `finally` 의 `rmSync` 가 그 완료를 기다리지 않는다 —
   * 고쳐지지 않았다면 이 테스트는 그냥 통과했을 것이다(콜백이 아직 아무 것도 안 하는
   * async 함수라). 지금은 그 대신 동기적으로 명확한 메시지를 던진다.
   */
  it('async(thenable 반환) 콜백을 넘기면 조용히 지나가지 않고 명시적으로 실패한다', () => {
    expect(() =>
      withFiles({ 'a.ts': '' }, async (paths) => {
        void paths;
        return 'ignored';
      }),
    ).toThrow(/동기 콜백만 지원/);
  });

  /**
   * ## 왜 "실제로 reject 하는" 콜백이어야 하는가
   *
   * 종전 이 테스트는 콜백이 `return 1` 이라 **resolve** 했다 — async 함수의 성공 반환도
   * Promise 로 감싸이므로, 이름만 "실패해도" 일 뿐 바로 위 테스트와 **똑같은 경로**를
   * 다시 검사했다(3R WARNING#3). 정작 위험한 경로 — 콜백이 reject 하고 그 rejection 을
   * 아무도 구독하지 않아 **무관한 다음 테스트로 전이되는** 것 — 은 무방비였다.
   */
  it('async 콜백이 실제로 reject 해도 tmpdir 은 지워지고 unhandled rejection 이 새지 않는다', async () => {
    const leaked: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      leaked.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    let capturedDir = '';
    try {
      expect(() =>
        withFiles({ 'a.ts': '' }, async (paths) => {
          capturedDir = paths['a.ts'];
          await Promise.resolve();
          throw new Error('콜백이 실제로 reject 한다');
        }),
      ).toThrow(/동기 콜백만 지원/);

      expect(fs.existsSync(capturedDir)).toBe(false);

      // rejection 이 전파될 틈을 준다 — 핸들러가 없으면 여기서 잡힌다.
      await new Promise((resolve) => setImmediate(resolve));
      expect(leaked).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
