import type { LookupAddress } from 'node:dns';
import { lookup as connectLookup } from 'node:dns';
import {
  createServer,
  Socket,
  type AddressInfo,
  type LookupFunction,
  type Server,
} from 'node:net';
import { Client as PgClient } from 'pg';
import { createConnection as mysqlCreateConnection } from 'mysql2/promise';
import { findCause } from '../../../common/utils/guarded-lookup-dispatcher';
import { SsrfBlockedError } from '../../../common/utils/ssrf/outbound-guard';
import {
  buildMysqlConnection,
  buildPgConnection,
  createGuardedMysqlStream,
  createGuardedPgStream,
  type DbCredentials,
} from './database-connection';
import { restoreEnvAfterEach } from '../../../shared/testing/env';

// DNS rebinding 을 재현한다(CLE-T-691T4G). 연결할 때의 주소 조회(`node:dns` 의 `lookup`)가 loopback 을 답한다. 서버는
// loopback 에 떠 있으므로 연결 시점 판정이 없으면 드라이버가 서버에 닿는다. 연결 전 판정(`node:dns/promises`)은 이
// 모듈이 하지 않으므로 여기서는 보지 않는다.
jest.mock('node:dns', () => ({
  ...jest.requireActual('node:dns'),
  lookup: jest.fn(),
}));

const mockedConnect = connectLookup as unknown as jest.Mock<
  void,
  [
    string,
    { all: true },
    (err: Error | null, addresses: LookupAddress[]) => void,
  ]
>;

/** 판정 없이 loopback 으로 답하는 lookup. 팩토리가 lookup 을 거쳐 연결하는지(성공 경로)를 본다. */
function loopbackLookup(calls: string[]): LookupFunction {
  return ((hostname: string, options: { all?: boolean }, callback) => {
    calls.push(hostname);
    if (options.all) {
      (callback as (e: null, a: LookupAddress[]) => void)(null, [
        { address: '127.0.0.1', family: 4 },
      ]);
      return;
    }
    (callback as (e: null, a: string, f: number) => void)(null, '127.0.0.1', 4);
  }) as LookupFunction;
}

describe('database-connection — 연결 시점 판정 (실제 드라이버)', () => {
  let server: Server;
  let port: number;
  let accepted = 0;
  restoreEnvAfterEach('ALLOW_PRIVATE_HOST_TARGETS');

  beforeAll(async () => {
    // 연결을 받자마자 끊는다. 드라이버는 핸드셰이크 전에 실패하지만 «서버에 닿았는가» 는 accepted 로 센다.
    server = createServer((socket) => {
      accepted++;
      socket.destroy();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** 서버 쪽 accept 가 클라이언트의 connect 이벤트보다 늦을 수 있어, 셀 때는 accept 를 기다린다. */
  async function untilAccepted(target: number): Promise<void> {
    while (accepted < target) {
      await new Promise<void>((resolve) =>
        server.once('connection', () => setImmediate(resolve)),
      );
    }
  }

  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    mockedConnect.mockReset();
    mockedConnect.mockImplementation((_host, _opts, cb) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }]),
    );
  });

  function creds(driver: DbCredentials['driver']): DbCredentials {
    return {
      driver,
      host: 'rebind.test',
      port,
      database: 'app',
      username: 'reader',
      password: 'pw',
      ssl: 'disable',
    };
  }

  it('pg: 연결할 때 푼 주소가 막힌 대역이면 SsrfBlockedError 로 실패하고 서버에 닿지 않는다', async () => {
    const before = accepted;
    const client = new PgClient({
      ...buildPgConnection(creds('postgres')),
      connectionTimeoutMillis: 2_000,
    });

    const err = await client.connect().then(
      () => undefined,
      (err_: unknown) => err_,
    );
    await client.end().catch(() => undefined);

    expect(findCause(err, SsrfBlockedError)?.message).toContain(
      'resolved to restricted IP "127.0.0.1"',
    );
    expect(mockedConnect).toHaveBeenCalledWith(
      'rebind.test',
      expect.objectContaining({ all: true }),
      expect.any(Function),
    );
    expect(accepted).toBe(before);
  });

  it('mysql2: 연결할 때 푼 주소가 막힌 대역이면 SsrfBlockedError 로 실패하고 서버에 닿지 않는다', async () => {
    const before = accepted;

    const err = await mysqlCreateConnection({
      ...buildMysqlConnection(creds('mysql')),
      connectTimeout: 2_000,
    }).then(
      async (conn) => {
        await conn.end();
        return undefined;
      },
      (err_: unknown) => err_,
    );

    expect(findCause(err, SsrfBlockedError)?.message).toContain(
      'resolved to restricted IP "127.0.0.1"',
    );
    expect(accepted).toBe(before);
  });

  it('ALLOW_PRIVATE_HOST_TARGETS=true 면 stream 팩토리를 싣지 않는다(드라이버 기본 연결)', () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';

    expect(buildPgConnection(creds('postgres'))).not.toHaveProperty('stream');
    expect(buildMysqlConnection(creds('mysql'))).not.toHaveProperty('stream');
  });

  it('pg 팩토리: 드라이버의 connect(port, host) 를 lookup 을 거친 연결로 바꿔 서버에 닿는다', async () => {
    const before = accepted;
    const calls: string[] = [];
    const client = new PgClient({
      ...buildPgConnection(creds('postgres')),
      stream: createGuardedPgStream(loopbackLookup(calls)),
      connectionTimeoutMillis: 2_000,
    });

    // 서버가 바로 끊으므로 연결은 실패한다. 서버에 닿았는지와 lookup 을 거쳤는지만 본다.
    await client.connect().catch(() => undefined);
    await client.end().catch(() => undefined);

    expect(calls).toContain('rebind.test');
    expect(accepted).toBe(before + 1);
  });

  it('pg 팩토리: 호스트 없는 connect 호출(유닉스 소켓 경로)은 원래 connect 로 넘긴다', () => {
    const calls: string[] = [];
    // 팩토리는 소켓을 만들 때 원래 connect 를 묶어 둔다. 그래서 spy 를 먼저 건다.
    const original = jest.spyOn(Socket.prototype, 'connect').mockReturnThis();
    const socket = createGuardedPgStream(loopbackLookup(calls))();
    try {
      socket.connect('/tmp/.s.PGSQL.5432');

      expect(original).toHaveBeenCalledWith('/tmp/.s.PGSQL.5432');
      expect(calls).toEqual([]);
    } finally {
      original.mockRestore();
      socket.destroy();
    }
  });

  it('mysql2 팩토리: lookup 을 거쳐 연결하고 기본 연결과 같이 noDelay · keep-alive 를 건다', async () => {
    const before = accepted;
    const calls: string[] = [];
    const noDelay = jest.spyOn(Socket.prototype, 'setNoDelay');
    const keepAlive = jest.spyOn(Socket.prototype, 'setKeepAlive');
    try {
      const socket = createGuardedMysqlStream(loopbackLookup(calls))({
        config: {
          host: 'rebind.test',
          port,
          enableKeepAlive: true,
          keepAliveInitialDelay: 1_234,
        },
      });
      await new Promise<void>((resolve) => {
        socket.once('connect', () => resolve());
        socket.once('error', () => resolve());
      });
      await untilAccepted(before + 1);
      socket.destroy();

      expect(calls).toContain('rebind.test');
      expect(accepted).toBe(before + 1);
      expect(noDelay).toHaveBeenCalledWith(true);
      expect(keepAlive).toHaveBeenCalledWith(true, 1_234);
    } finally {
      noDelay.mockRestore();
      keepAlive.mockRestore();
    }
  });
});
