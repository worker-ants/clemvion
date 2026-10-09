import {
  INTERACTION_STREAM_CLOSER,
  closeTriggerTokenStreams,
} from './interaction-stream-closer';

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰) — 닫기는 best-effort 다. 닫지
// 못해도 재발급 · PATCH · 삭제의 결과는 그대로다.
describe('closeTriggerTokenStreams', () => {
  function makeLogger() {
    return { error: jest.fn() };
  }

  it('포트를 지연 해석해 닫을 트리거를 넘긴다', () => {
    const closer = { closeTriggerTokenStreams: jest.fn().mockReturnValue(2) };
    const moduleRef = { get: jest.fn().mockReturnValue(closer) };
    const logger = makeLogger();
    closeTriggerTokenStreams(moduleRef, ['trg-1'], logger, 'caller');
    expect(moduleRef.get).toHaveBeenCalledWith(INTERACTION_STREAM_CLOSER, {
      strict: false,
    });
    expect(closer.closeTriggerTokenStreams).toHaveBeenCalledWith(['trg-1']);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('빈 목록이면 포트를 찾지 않는다', () => {
    const moduleRef = { get: jest.fn() };
    closeTriggerTokenStreams(moduleRef, [], makeLogger(), 'caller');
    expect(moduleRef.get).not.toHaveBeenCalled();
  });

  // 이 단계가 조용히 빠지면 무효가 된 토큰으로 연 스트림이 살아남는다 — 경고가 아니라 오류로 남겨 알림에 걸리게 한다.
  it('포트를 찾지 못하면 error 로 남기고 던지지 않는다', () => {
    const moduleRef = {
      get: jest.fn(() => {
        throw new Error('Nest could not find NOT_FOUND_MARK');
      }),
    };
    const logger = makeLogger();
    expect(() =>
      closeTriggerTokenStreams(moduleRef, ['trg-1'], logger, 'caller'),
    ).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('NOT_FOUND_MARK'),
    );
  });

  it('닫기가 던져도 삼키고 error 를 남긴다', () => {
    const closer = {
      closeTriggerTokenStreams: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const logger = makeLogger();
    expect(() =>
      closeTriggerTokenStreams(
        { get: jest.fn().mockReturnValue(closer) },
        ['trg-1'],
        logger,
        'caller',
      ),
    ).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  // 워크스페이스 삭제는 트리거를 한꺼번에 넘긴다 — 한 줄이 수천 id 로 길어지지 않게 개수와 앞 몇 개만 싣는다.
  it('실패 로그에는 트리거 id 를 개수와 앞 몇 개만 싣는다', () => {
    const logger = makeLogger();
    const ids = Array.from({ length: 5000 }, (_, i) => `trg-${i}`);
    closeTriggerTokenStreams(
      {
        get: jest.fn(() => {
          throw new Error('boom');
        }),
      },
      ids,
      logger,
      'caller',
    );
    const message = String(logger.error.mock.calls[0][0]);
    expect(message).toContain('5000개');
    expect(message).toContain('trg-0,trg-1,trg-2');
    expect(message).not.toContain('trg-3,');
    expect(message.length).toBeLessThan(300);
  });
});
