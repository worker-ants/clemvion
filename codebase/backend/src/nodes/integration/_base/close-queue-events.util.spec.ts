import { closeQueueEventsWithinGrace } from './close-queue-events.util';

/**
 * CLE-T-7H7VET 회귀 테스트. 예전 구현은 `Promise.race` 의 grace 타이머를 지우지 않았다. close 가 바로 끝나도
 * 타이머가 이벤트 루프를 grace(31초) 동안 붙잡았고, 그 뒤 「exceeded grace」 경고를 남겼다. SIGTERM 뒤 다른
 * SIGTERM 리스너가 남아 있으면 Node 는 기본 종료를 하지 않고 이벤트 루프가 빌 때까지 기다리므로 종료가 늘 31초
 * 늦어졌다(e2e 스택 실측: SIGTERM 뒤 31.7초, 종료 코드 0).
 */
describe('closeQueueEventsWithinGrace', () => {
  const GRACE_MS = 31_000;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const makeLogger = () => ({ warn: jest.fn() });

  it('close 가 grace 안에 끝나면 타이머를 남기지 않고 경고도 남기지 않는다', async () => {
    const logger = makeLogger();
    const queueEvents = { close: jest.fn().mockResolvedValue(undefined) };

    await closeQueueEventsWithinGrace(
      queueEvents,
      GRACE_MS,
      logger,
      'TestModule',
    );

    expect(queueEvents.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(GRACE_MS);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('close 가 grace 를 넘기면 경고를 남기고 기다리지 않고 끝난다', async () => {
    const logger = makeLogger();
    const queueEvents = {
      close: jest.fn(() => new Promise<void>(() => undefined)),
    };

    const closing = closeQueueEventsWithinGrace(
      queueEvents,
      GRACE_MS,
      logger,
      'TestModule',
    );
    jest.advanceTimersByTime(GRACE_MS);
    await closing;

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(String(logger.warn.mock.calls[0][0])).toContain(
      `TestModule shutdown: queueEvents.close() exceeded ${GRACE_MS}ms grace`,
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('close 가 실패하면 실패 경고 하나만 남기고 타이머를 지운다', async () => {
    const logger = makeLogger();
    const queueEvents = {
      close: jest.fn().mockRejectedValue(new Error('Connection is closed')),
    };

    await expect(
      closeQueueEventsWithinGrace(queueEvents, GRACE_MS, logger, 'TestModule'),
    ).resolves.toBeUndefined();

    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(GRACE_MS);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(String(logger.warn.mock.calls[0][0])).toBe(
      'TestModule shutdown: queueEvents.close() failed — Connection is closed',
    );
  });
});
