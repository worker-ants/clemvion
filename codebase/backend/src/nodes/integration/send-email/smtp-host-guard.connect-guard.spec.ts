import type { LookupAddress } from 'node:dns';
import { lookup as connectLookup } from 'node:dns';
import {
  createServer,
  type AddressInfo,
  type LookupFunction,
  type Server,
} from 'node:net';
import { createTransport } from 'nodemailer';
import { findCause } from '../../../common/utils/guarded-lookup-dispatcher';
import { SsrfBlockedError } from '../../../common/utils/ssrf/outbound-guard';
import {
  createSmtpGetSocket,
  guardedSmtpGetSocket,
  SMTP_DEFAULT_CONNECTION_TIMEOUT_MS,
} from './smtp-host-guard';

// DNS rebinding 을 재현한다(CLE-T-PTCRM4). 연결할 때의 주소 조회(`node:dns` 의 `lookup`)가 loopback 을 답한다. 서버는
// loopback 에 떠 있으므로 연결 시점 판정이 없으면 nodemailer 가 서버에 닿는다.
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

/** 판정 없이 loopback 으로 답하는 lookup. getSocket 이 lookup 을 거쳐 연결하는지(성공 경로)를 본다. */
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

describe('smtp-host-guard — 연결 시점 판정 (실제 nodemailer)', () => {
  let server: Server;
  let port: number;
  let accepted = 0;
  let originalAllow: string | undefined;

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

  beforeEach(() => {
    originalAllow = process.env.ALLOW_PRIVATE_HOST_TARGETS;
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    mockedConnect.mockReset();
    mockedConnect.mockImplementation((_host, _opts, cb) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }]),
    );
  });

  afterEach(() => {
    if (originalAllow === undefined) {
      delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    } else {
      process.env.ALLOW_PRIVATE_HOST_TARGETS = originalAllow;
    }
  });

  it('연결할 때 푼 주소가 막힌 대역이면 verify() 가 SsrfBlockedError 로 실패하고 서버에 닿지 않는다', async () => {
    const before = accepted;
    const transporter = createTransport({
      host: 'rebind.test',
      port,
      secure: false,
      connectionTimeout: 2_000,
      getSocket: guardedSmtpGetSocket(),
    });

    try {
      const err = await transporter.verify().then(
        () => undefined,
        (err_: unknown) => err_,
      );

      expect(findCause(err, SsrfBlockedError)?.message).toContain(
        'resolved to restricted IP "127.0.0.1"',
      );
      expect(mockedConnect).toHaveBeenCalledWith(
        'rebind.test',
        expect.objectContaining({ all: true }),
        expect.any(Function),
      );
      expect(accepted).toBe(before);
    } finally {
      transporter.close();
    }
  });

  it('ALLOW_PRIVATE_HOST_TARGETS=true 면 getSocket 을 싣지 않는다(nodemailer 기본 연결)', () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';

    expect(guardedSmtpGetSocket()).toBeUndefined();
  });

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
