import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fetch as undiciFetch } from 'undici';
import {
  autoSelectFamilyAgentOptions,
  createGuardedLookup,
  createGuardedLookupDispatcher,
  createLazyGuardedDispatcher,
  findCause,
} from './guarded-lookup-dispatcher';

// 해석기는 가짜로 둔다. `guarded.test` 는 실제 DNS 로 풀리지 않는 이름이라, 연결이 성공하면 연결 주소가 이 조회
// 결과에서 왔다는 뜻이다. Node 내부의 `net` 은 이 mock 을 타지 않으므로 헬퍼의 조회만 바뀐다.
jest.mock('node:dns', () => ({
  ...jest.requireActual('node:dns'),
  lookup: jest.fn(),
}));

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  addresses: LookupAddress[],
) => void;
const mockedLookup = lookup as unknown as jest.Mock<
  void,
  [string, { all: true }, LookupCallback]
>;

function answer(addresses: LookupAddress[]): void {
  mockedLookup.mockImplementation((_host, _opts, cb) => cb(null, addresses));
}

class Blocked extends Error {}
const blockLoopback = (resolved: LookupAddress, hostname: string) =>
  resolved.address === '127.0.0.1' || resolved.address === '::1'
    ? new Blocked(`${hostname} -> ${resolved.address}`)
    : null;

beforeEach(() => {
  mockedLookup.mockReset();
});

describe('createGuardedLookup', () => {
  function callLookup(
    guardFn: Parameters<typeof createGuardedLookup>[0],
    options: { all?: boolean },
  ): Promise<{ err: Error | null; result: unknown[] }> {
    const fn = createGuardedLookup(guardFn);
    return new Promise((resolve) => {
      fn('api.example.com', options as never, (err, ...result) =>
        resolve({ err, result }),
      );
    });
  }

  it('returns every resolved address when net asks for all', async () => {
    const addresses = [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::1', family: 6 },
    ];
    answer(addresses);

    const { err, result } = await callLookup(() => null, { all: true });

    expect(err).toBeNull();
    expect(result[0]).toEqual(addresses);
    expect(mockedLookup).toHaveBeenCalledWith(
      'api.example.com',
      expect.objectContaining({ all: true }),
      expect.any(Function),
    );
  });

  it('returns the first address and family when net asks for one', async () => {
    answer([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::1', family: 6 },
    ]);

    const { err, result } = await callLookup(() => null, {});

    expect(err).toBeNull();
    expect(result).toEqual(['93.184.216.34', 4]);
  });

  it('fails with the guard error when any resolved address is blocked', async () => {
    answer([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);

    const { err } = await callLookup(blockLoopback, { all: true });

    expect(err).toBeInstanceOf(Blocked);
    expect(err?.message).toBe('api.example.com -> 127.0.0.1');
  });

  it('passes resolver errors through unchanged', async () => {
    const notFound = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    mockedLookup.mockImplementation((_host, _opts, cb) => cb(notFound, []));
    const guardFn = jest.fn(() => null);

    const { err } = await callLookup(guardFn, { all: true });

    expect(err).toBe(notFound);
    expect(guardFn).not.toHaveBeenCalled();
  });

  it('fails with ENOTFOUND when the resolver returns no address', async () => {
    answer([]);
    const guardFn = jest.fn(() => null);

    const { err } = await callLookup(guardFn, { all: true });

    expect((err as NodeJS.ErrnoException).code).toBe('ENOTFOUND');
    expect(guardFn).not.toHaveBeenCalled();
  });

  it('hands a throwing guard to the callback as an error', async () => {
    answer([{ address: '93.184.216.34', family: 4 }]);
    const boom = new Error('guard exploded');

    const { err } = await callLookup(
      () => {
        throw boom;
      },
      { all: true },
    );

    expect(err).toBe(boom);
  });
});

describe('createGuardedLookupDispatcher (real fetch against a local server)', () => {
  let server: Server;
  let port: number;
  let requests = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      requests++;
      res.end(`host=${req.headers.host}`);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('connects to the address the guarded lookup returned and keeps the Host header', async () => {
    answer([{ address: '127.0.0.1', family: 4 }]);
    const dispatcher = createGuardedLookupDispatcher(() => null);
    try {
      const res = await fetch(`http://guarded.test:${port}/`, {
        dispatcher,
      } as RequestInit);

      expect(await res.text()).toBe(`host=guarded.test:${port}`);
    } finally {
      await dispatcher.close();
    }
  });

  it('rejects the fetch with the guard error as its cause when the address is blocked', async () => {
    answer([{ address: '127.0.0.1', family: 4 }]);
    const dispatcher = createGuardedLookupDispatcher(blockLoopback);
    try {
      // 운영의 전역 fetch 는 판정 오류 인스턴스를 그대로 `cause` 에 싣는다. jest 에서는 판정 오류가 테스트 realm 에서
      // 만들어져 Node 내장 fetch 의 `instanceof Error` 검사를 통과하지 못하고 `new Error(String(err))` 로 다시
      // 감싸진다. 그래서 인스턴스 확인은 테스트 realm 에 함께 올라오는 npm undici 의 fetch 로 한다.
      const failure: unknown = await undiciFetch(
        `http://guarded.test:${port}/`,
        { dispatcher },
      ).catch((err: unknown) => err);

      expect((failure as Error).message).toBe('fetch failed');
      const blocked = findCause(failure, Blocked);
      expect(blocked).toBeInstanceOf(Blocked);
      expect(blocked?.message).toBe('guarded.test -> 127.0.0.1');
    } finally {
      await dispatcher.close();
    }
  });

  it('fails the global fetch before any byte reaches the blocked address', async () => {
    answer([{ address: '127.0.0.1', family: 4 }]);
    const before = requests;
    const dispatcher = createGuardedLookupDispatcher(blockLoopback);
    try {
      const failure: unknown = await fetch(`http://guarded.test:${port}/`, {
        dispatcher,
      } as RequestInit).catch((err: unknown) => err);

      expect((failure as Error).message).toBe('fetch failed');
      expect(String((failure as Error).cause)).toContain(
        'guarded.test -> 127.0.0.1',
      );
      expect(requests).toBe(before);
    } finally {
      await dispatcher.close();
    }
  });
});

describe('findCause', () => {
  it('finds the error itself, a nested cause, or nothing', () => {
    const inner = new Blocked('inner');
    const outer = new TypeError('fetch failed', {
      cause: new Error('wrap', { cause: inner }),
    });

    expect(findCause(inner, Blocked)).toBe(inner);
    expect(findCause(outer, Blocked)).toBe(inner);
    expect(findCause(new TypeError('x'), Blocked)).toBeUndefined();
    expect(findCause('not an error', Blocked)).toBeUndefined();
    expect(findCause(undefined, Blocked)).toBeUndefined();
  });

  it('stops on a cause cycle', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b', { cause: a });
    a.cause = b;

    expect(findCause(a, Blocked)).toBeUndefined();
  });
});

describe('autoSelectFamilyAgentOptions', () => {
  it('turns on Happy Eyeballs unless DISABLE_UNDICI_AUTO_SELECT_FAMILY=1', () => {
    expect(autoSelectFamilyAgentOptions({})).toEqual({
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 300,
    });
    expect(
      autoSelectFamilyAgentOptions({ DISABLE_UNDICI_AUTO_SELECT_FAMILY: '1' }),
    ).toEqual({});
  });
});

describe('createLazyGuardedDispatcher', () => {
  it('builds once and reuses, then rebuilds after reset (closing the old one)', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const factory = jest.fn(() => ({ close }) as never);
    const lazy = createLazyGuardedDispatcher(factory);

    expect(factory).not.toHaveBeenCalled();
    const first = lazy.get();
    expect(lazy.get()).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);

    await lazy.reset();
    expect(close).toHaveBeenCalledTimes(1);
    await lazy.reset();
    expect(close).toHaveBeenCalledTimes(1);
    lazy.get();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
