import { HttpException, Logger, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { SseStreamToken, SseSubscriber } from './sse-adapter.service';
import {
  SseStreamSession,
  type SseStreamAdapterPort,
  type SseTokenCheck,
} from './sse-stream-session';
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_TOKEN_RECHECK_INTERVAL_MS,
} from './sse.constants';

const ITK: SseStreamToken = { family: 'itk', triggerId: 'trg-1' };
const IEXT: SseStreamToken = { family: 'iext' };

interface Harness {
  log: string[];
  res: Response;
  adapter: SseStreamAdapterPort & {
    admitResult: boolean;
    onAdmit?: (s: SseSubscriber) => void;
  };
  tokenCheck: SseTokenCheck & { valid: boolean | Error };
  logger: Logger;
}

function makeHarness(): Harness {
  const log: string[] = [];
  const res = {
    setHeader: jest.fn(() => log.push('header')),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(() => log.push('end')),
  } as unknown as Response;
  const adapter: Harness['adapter'] = {
    admitResult: true,
    admit: jest.fn((s: SseSubscriber) => {
      log.push('admit');
      adapter.onAdmit?.(s);
      return Promise.resolve(adapter.admitResult);
    }),
    start: jest.fn(() => {
      log.push('start');
      return Promise.resolve();
    }),
    unsubscribe: jest.fn(() => log.push('unsubscribe')),
    touch: jest.fn(() => log.push('touch')),
  };
  const tokenCheck: Harness['tokenCheck'] = {
    valid: true,
    reverify: jest.fn(() => {
      log.push('reverify');
      return Promise.resolve();
    }),
    isValid: jest.fn(() =>
      tokenCheck.valid instanceof Error
        ? Promise.reject(tokenCheck.valid)
        : Promise.resolve(tokenCheck.valid),
    ),
    reject: jest.fn((): never => {
      throw new UnauthorizedException();
    }),
  };
  const logger = new Logger('test');
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  return { log, res, adapter, tokenCheck, logger };
}

function session(h: Harness, token: SseStreamToken): SseStreamSession {
  return new SseStreamSession(
    h.res,
    'exec-1',
    token,
    h.adapter,
    h.tokenCheck,
    h.logger,
  );
}

describe('SseStreamSession', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('등록 · 재확인 · 헤더 · start 순서로 연다', async () => {
    const h = makeHarness();
    await session(h, ITK).run(3);
    expect(h.log.filter((l) => l !== 'header')).toEqual([
      'admit',
      'reverify',
      'start',
    ]);
    expect(h.log.indexOf('header')).toBeGreaterThan(h.log.indexOf('reverify'));
    expect(h.adapter.start).toHaveBeenCalledWith(expect.anything(), 3);
  });

  it('실행 단위 토큰은 다시 확인하지 않는다', async () => {
    const h = makeHarness();
    await session(h, IEXT).run(undefined);
    expect(h.tokenCheck.reverify).not.toHaveBeenCalled();
    expect(h.adapter.start).toHaveBeenCalled();
  });

  it('연결 상한이면 헤더를 보내기 전에 429 를 던진다', async () => {
    const h = makeHarness();
    h.adapter.admitResult = false;
    const err = await session(h, ITK)
      .run(undefined)
      .then(
        () => null,
        (err_: unknown) => err_,
      );
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(h.res.setHeader).not.toHaveBeenCalled();
  });

  it('등록 뒤 헤더 전에 서버가 닫으면 401 을 던진다', async () => {
    const h = makeHarness();
    h.adapter.onAdmit = (s) => s.close();
    await expect(session(h, ITK).run(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(h.res.setHeader).not.toHaveBeenCalled();
  });

  it('재확인이 던지면 구독을 풀고 그대로 던진다', async () => {
    const h = makeHarness();
    (h.tokenCheck.reverify as jest.Mock).mockRejectedValueOnce(
      new UnauthorizedException(),
    );
    await expect(session(h, ITK).run(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(h.adapter.unsubscribe).toHaveBeenCalled();
    expect(h.adapter.start).not.toHaveBeenCalled();
  });

  it('클라이언트가 끊으면 구독을 풀고 응답을 한 번만 끝내고 heartbeat 를 멈춘다', async () => {
    const h = makeHarness();
    const s = session(h, IEXT);
    await s.run(undefined);
    s.onClientClose();
    s.onClientClose();
    expect(h.res.end).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('heartbeat 마다 주석을 쓰고 연결 상한 자리를 갱신한다', async () => {
    const h = makeHarness();
    await session(h, IEXT).run(undefined);
    await jest.advanceTimersByTimeAsync(SSE_HEARTBEAT_INTERVAL_MS * 2);
    expect(h.res.write).toHaveBeenCalledWith(': heartbeat\n\n');
    expect(h.adapter.touch).toHaveBeenCalledTimes(2);
    expect(h.tokenCheck.isValid).not.toHaveBeenCalled();
  });

  it('itk 스트림은 주기마다 토큰을 다시 확인하고 무효면 닫는다', async () => {
    const h = makeHarness();
    await session(h, ITK).run(undefined);
    await jest.advanceTimersByTimeAsync(SSE_TOKEN_RECHECK_INTERVAL_MS - 1);
    expect(h.tokenCheck.isValid).not.toHaveBeenCalled();
    h.tokenCheck.valid = false;
    await jest.advanceTimersByTimeAsync(1);
    expect(h.tokenCheck.isValid).toHaveBeenCalledTimes(1);
    expect(h.adapter.unsubscribe).toHaveBeenCalled();
    expect(h.res.end).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('재확인이 끝나기 전에 다음 주기가 와도 겹쳐 확인하지 않는다', async () => {
    const h = makeHarness();
    let resolve: (valid: boolean) => void = () => undefined;
    (h.tokenCheck.isValid as jest.Mock).mockImplementation(
      () => new Promise<boolean>((r) => (resolve = r)),
    );
    await session(h, ITK).run(undefined);
    await jest.advanceTimersByTimeAsync(SSE_TOKEN_RECHECK_INTERVAL_MS * 2);
    expect(h.tokenCheck.isValid).toHaveBeenCalledTimes(1);
    resolve(true);
    await jest.advanceTimersByTimeAsync(SSE_TOKEN_RECHECK_INTERVAL_MS);
    expect(h.tokenCheck.isValid).toHaveBeenCalledTimes(2);
  });

  it('주기 재확인 조회가 실패하면 스트림을 그대로 두고 경고만 남긴다', async () => {
    const h = makeHarness();
    await session(h, ITK).run(undefined);
    h.tokenCheck.valid = new Error('db down');
    await jest.advanceTimersByTimeAsync(SSE_TOKEN_RECHECK_INTERVAL_MS);
    expect(h.logger.warn).toHaveBeenCalledTimes(1);
    expect(h.res.end).not.toHaveBeenCalled();
  });
});
