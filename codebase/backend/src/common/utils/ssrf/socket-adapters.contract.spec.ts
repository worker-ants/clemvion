import type { LookupAddress } from 'node:dns';
import {
  createServer,
  Socket,
  type AddressInfo,
  type LookupFunction,
  type Server,
} from 'node:net';
import { createTransport } from 'nodemailer';
import { Client as PgClient } from 'pg';
import {
  createGuardedMysqlStream,
  createGuardedPgStream,
  createSmtpGetSocket,
  SMTP_DEFAULT_CONNECTION_TIMEOUT_MS,
} from './socket-adapters';

// 드라이버 소켓 어댑터의 계약 테스트(CLE-T-AM1H7X). 실제 pg · nodemailer 드라이버가 어댑터가 준 소켓을 쓰고, 그 소켓이 주어진
// lookup 을 거쳐 연결하는지 본다. 드라이버를 올려 소켓 호출 규약이 바뀌면 여기가 깨진다. 판정 lookup 을 실은 빌더가 막힌
// 대역에서 실제 드라이버(pg · mysql2 · nodemailer)를 막는지는 빌더 쪽 테스트가 본다
// (`database-query/database-connection.spec.ts` · `send-email/smtp-host-guard.connect-guard.spec.ts`).

/** 판정 없이 loopback 으로 답하는 lookup. 어댑터가 lookup 을 거쳐 연결하는지(성공 경로)를 본다. */
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

describe('socket-adapters — pg · mysql2 stream 팩토리 (실제 pg 드라이버)', () => {
  let server: Server;
  let port: number;
  let accepted = 0;

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

  it('pg 팩토리: 드라이버의 connect(port, host) 를 lookup 을 거친 연결로 바꿔 서버에 닿는다', async () => {
    const before = accepted;
    const calls: string[] = [];
    const client = new PgClient({
      host: 'rebind.test',
      port,
      database: 'app',
      user: 'reader',
      password: 'pw',
      stream: createGuardedPgStream(loopbackLookup(calls)),
      connectionTimeoutMillis: 2_000,
    });

    // 서버가 바로 끊으므로 연결은 실패한다. 서버에 닿았는지와 lookup 을 거쳤는지만 본다.
    await client.connect().catch(() => undefined);
    await client.end().catch(() => undefined);

    expect(calls).toContain('rebind.test');
    expect(accepted).toBe(before + 1);
  });

  it('pg 팩토리: 문자열 인자 하나인 connect 호출(유닉스 소켓 경로)은 lookup 없이 원래 connect 로 넘긴다', () => {
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

  it("pg 팩토리: 문자열 포트 connect('5432', host) 도 숫자 포트로 바꿔 lookup 을 거친 연결로 넘긴다", () => {
    const lookup = loopbackLookup([]);
    const original = jest.spyOn(Socket.prototype, 'connect').mockReturnThis();
    const socket = createGuardedPgStream(lookup)();
    try {
      // 타입 선언에는 문자열 포트 overload 가 없다. pg 는 실행 중에 이 형태로 부를 수 있어 그대로 넘긴다.
      (socket.connect as (...a: unknown[]) => Socket)('5432', 'rebind.test');

      expect(original).toHaveBeenCalledTimes(1);
      expect(original).toHaveBeenCalledWith({
        port: 5432,
        host: 'rebind.test',
        lookup,
      });
    } finally {
      original.mockRestore();
      socket.destroy();
    }
  });

  it.each([
    ['객체 인자', [{ port: 5432, host: 'rebind.test' }]],
    ['host 없는 (port, undefined)', [5432, undefined]],
    ['인자 없음', []],
    // 유닉스 소켓 경로에 연결 리스너를 붙인 형태다. 인자가 둘이라 경로 하나만 넘기는 분기에 들지 않는다. 지금 pg 는 이
    // 형태로 부르지 않으므로 닫는 쪽을 기대값으로 둔다(CLE-T-1E7X4M, 동작은 바꾸지 않는다).
    ['connect(path, cb)', ['/tmp/.s.PGSQL.5432', () => undefined]],
  ])(
    'pg 팩토리: 알 수 없는 connect 호출 형태(%s)는 lookup 없이 연결하지 않고 오류로 닫는다(fail-closed)',
    async (_label, args) => {
      const calls: string[] = [];
      const original = jest.spyOn(Socket.prototype, 'connect').mockReturnThis();
      const socket = createGuardedPgStream(loopbackLookup(calls))();
      try {
        const errored = new Promise<Error>((resolve) =>
          socket.once('error', resolve),
        );
        (socket.connect as (...a: unknown[]) => Socket)(...args);

        await expect(errored).resolves.toMatchObject({
          message:
            'Unsupported pg socket connect call; refusing to connect without SSRF lookup',
        });
        expect(original).not.toHaveBeenCalled();
        expect(calls).toEqual([]);
      } finally {
        original.mockRestore();
        socket.destroy();
      }
    },
  );

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

  it('mysql2 팩토리: config 에 host · port 가 없으면 mysql2 기본값(localhost · 3306)으로 연결한다', () => {
    // 실제로 3306 에 연결하지 않도록 소켓의 connect 만 가로챈다.
    const connectSpy = jest
      .spyOn(Socket.prototype, 'connect')
      .mockImplementation(function (this: Socket) {
        return this;
      });
    try {
      const lookup = loopbackLookup([]);
      const socket = createGuardedMysqlStream(lookup)({ config: {} });
      socket.destroy();

      // `net.connect` 는 정규화한 인자 배열([옵션, 연결 리스너])을 첫 인자로 넘겨 `socket.connect` 를 부른다.
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ host: 'localhost', port: 3306, lookup }),
        ]),
      );
    } finally {
      connectSpy.mockRestore();
    }
  });
});

describe('socket-adapters — SMTP getSocket (실제 nodemailer)', () => {
  let server: Server;
  let port: number;
  let accepted = 0;

  beforeAll(async () => {
    // 최소 SMTP 서버. 인사 → EHLO → QUIT 만 답한다. 인증 없는 verify() 는 여기까지로 성공한다.
    server = createServer((socket) => {
      accepted++;
      socket.write('220 test ESMTP\r\n');
      let buffered = '';
      socket.on('data', (chunk) => {
        buffered += chunk.toString('utf8');
        let idx: number;
        while ((idx = buffered.indexOf('\r\n')) >= 0) {
          const line = buffered.slice(0, idx).toUpperCase();
          buffered = buffered.slice(idx + 2);
          if (line.startsWith('EHLO')) {
            socket.write('250-test\r\n250 OK\r\n');
          } else if (line.startsWith('QUIT')) {
            socket.end('221 bye\r\n');
          } else {
            socket.write('250 OK\r\n');
          }
        }
      });
      socket.on('error', () => undefined);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /**
   * 다음에 받는 연결이 처음 보낸 바이트. 서버의 연결 처리(`accepted` 집계)가 끝난 뒤에 풀린다. 직접 TLS 면 TLS 레코드
   * 헤더의 내용 유형(0x16, handshake)이다. 클라이언트가 실패를 먼저 알아도 서버 쪽 집계를 기다릴 수 있다.
   */
  function nextFirstByte(): Promise<number> {
    return new Promise((resolve) =>
      server.once('connection', (socket) =>
        socket.once('data', (chunk: Buffer) => resolve(chunk[0])),
      ),
    );
  }

  it('lookup 을 통과한 주소면 그 소켓으로 SMTP 대화가 끝까지 된다', async () => {
    const before = accepted;
    const calls: string[] = [];
    const transporter = createTransport({
      host: 'smtp.rebind.test',
      port,
      secure: false,
      connectionTimeout: 2_000,
      getSocket: createSmtpGetSocket(loopbackLookup(calls)),
    });

    try {
      await expect(transporter.verify()).resolves.toBe(true);
      expect(calls).toContain('smtp.rebind.test');
      expect(accepted).toBe(before + 1);
    } finally {
      transporter.close();
    }
  });

  it('secure: true(직접 TLS)면 getSocket 이 준 소켓 위에서 TLS 를 맺으려 시도한다', async () => {
    // 서버는 평문이라 TLS 핸드셰이크는 실패한다. 소켓이 lookup 을 거쳐 서버에 닿고 nodemailer 가 TLS 단계까지 가는지만 본다.
    // TLS 단계 도달은 두 쪽에서 본다. 서버가 받은 첫 바이트가 TLS handshake 레코드(0x16)이고, verify() 가 OpenSSL
    // 오류로 실패한다. 연결 거부 · 타임아웃으로 실패하면 둘 다 맞지 않는다.
    const before = accepted;
    const calls: string[] = [];
    const firstByte = nextFirstByte();
    const transporter = createTransport({
      host: 'smtp.rebind.test',
      port,
      secure: true,
      connectionTimeout: 2_000,
      getSocket: createSmtpGetSocket(loopbackLookup(calls)),
      tls: { rejectUnauthorized: true },
    });

    try {
      await expect(transporter.verify()).rejects.toMatchObject({
        code: 'ESOCKET',
        library: 'SSL routines',
      });
      await expect(firstByte).resolves.toBe(0x16);
      expect(calls).toContain('smtp.rebind.test');
      expect(accepted).toBe(before + 1);
    } finally {
      transporter.close();
    }
  });

  it('TCP 연결이 상한 안에 맺히지 않으면 소켓을 닫고 ETIMEDOUT 오류를 넘긴다', async () => {
    // 답하지 않는 lookup — 연결이 시작되지 않은 채 머문다.
    const hanging = (() => undefined) as unknown as LookupFunction;
    const getSocket = createSmtpGetSocket(hanging);

    const err = await new Promise<Error | null>((resolve) =>
      getSocket(
        { host: 'smtp.rebind.test', port, connectionTimeout: 30 },
        (e) => resolve(e),
      ),
    );

    expect(err).toMatchObject({
      message: 'Connection timeout',
      code: 'ETIMEDOUT',
    });
  });

  it('connectionTimeout 이 없으면 nodemailer 기본값(2분)을 상한으로 쓴다', () => {
    jest.useFakeTimers();
    try {
      const hanging = (() => undefined) as unknown as LookupFunction;
      const callback = jest.fn();
      createSmtpGetSocket(hanging)(
        { host: 'smtp.rebind.test', port },
        callback,
      );

      jest.advanceTimersByTime(SMTP_DEFAULT_CONNECTION_TIMEOUT_MS - 1);
      expect(callback).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ETIMEDOUT' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
