import {
  INTERACTION_STREAM_CLOSER,
  closeTriggerTokenStreams,
} from './interaction-stream-closer';

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰) — 닫기는 best-effort 다. 닫지
// 못해도 재발급 · PATCH · 삭제의 결과는 그대로다.
describe('closeTriggerTokenStreams', () => {
  function makeLogger() {
    return { warn: jest.fn() };
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
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('빈 목록이면 포트를 찾지 않는다', () => {
    const moduleRef = { get: jest.fn() };
    closeTriggerTokenStreams(moduleRef, [], makeLogger(), 'caller');
    expect(moduleRef.get).not.toHaveBeenCalled();
  });

  it('포트를 찾지 못하면 경고만 남기고 던지지 않는다', () => {
    const moduleRef = {
      get: jest.fn(() => {
        throw new Error('Nest could not find INTERACTION_STREAM_CLOSER');
      }),
    };
    const logger = makeLogger();
    expect(() =>
      closeTriggerTokenStreams(moduleRef, ['trg-1'], logger, 'caller'),
    ).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('caller'));
  });

  it('ModuleRef 가 없으면(단위 대역) 경고만 남긴다', () => {
    const logger = makeLogger();
    expect(() =>
      closeTriggerTokenStreams(undefined, ['trg-1'], logger, 'caller'),
    ).not.toThrow();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('닫기가 던져도 삼키고 경고를 남긴다', () => {
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
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});
