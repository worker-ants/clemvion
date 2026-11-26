import type { LookupAddress } from 'node:dns';
import { lookup as connectLookup } from 'node:dns';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { createTransport } from 'nodemailer';
import { findCause } from '../../../common/utils/guarded-lookup-dispatcher';
import { SsrfBlockedError } from '../../../common/utils/ssrf/outbound-guard';
import { restoreEnvAfterEach } from '../../../shared/testing/env';
import { guardedSmtpGetSocket } from './smtp-host-guard';

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

// `getSocket` 어댑터 자체의 nodemailer 계약 테스트는 `common/utils/ssrf/socket-adapters.contract.spec.ts` 에 있다
// (CLE-T-AM1H7X). 여기서는 {@link guardedSmtpGetSocket} 이 플래그를 보고 어댑터를 싣고, 실린 어댑터가 실제 nodemailer 에서
// 판정하는지를 본다.
describe('smtp-host-guard — 연결 시점 판정 (실제 nodemailer)', () => {
  let server: Server;
  let port: number;
  let accepted = 0;
  restoreEnvAfterEach('ALLOW_PRIVATE_HOST_TARGETS');

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
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    mockedConnect.mockReset();
    mockedConnect.mockImplementation((_host, _opts, cb) =>
      cb(null, [{ address: '127.0.0.1', family: 4 }]),
    );
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
});
