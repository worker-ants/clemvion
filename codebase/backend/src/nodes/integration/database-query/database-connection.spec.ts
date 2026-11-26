import type { LookupAddress } from 'node:dns';
import { lookup as connectLookup } from 'node:dns';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { Client as PgClient } from 'pg';
import { createConnection as mysqlCreateConnection } from 'mysql2/promise';
import { findCause } from '../../../common/utils/guarded-lookup-dispatcher';
import { SsrfBlockedError } from '../../../common/utils/ssrf/outbound-guard';
import {
  buildMysqlConnection,
  buildPgConnection,
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

// 어댑터(pg · mysql2 `stream` 팩토리) 자체의 드라이버 계약 테스트는 `common/utils/ssrf/socket-adapters.contract.spec.ts` 에
// 있다(CLE-T-AM1H7X). 여기서는 빌더가 플래그를 보고 어댑터를 싣고, 실린 어댑터가 실제 드라이버에서 판정하는지를 본다.
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
});
