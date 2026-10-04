import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createServer, type AddressInfo, type Server, type Socket } from 'net';
import * as nodemailer from 'nodemailer';
import { MAIL_TRANSPORTER } from './mail.constants';
import { MailModule } from './mail.module';
import {
  createMailTransporter,
  type MailTransporter,
} from './mail.transporter';

const configOf = (values: Record<string, unknown>): ConfigService =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

/** SMTP 명령 줄의 동사(대문자). */
const verbOf = (line: string): string => line.split(' ')[0].toUpperCase();

/**
 * STARTTLS 를 알리지 않는 SMTP 서버. 능동 중간자가 EHLO 응답에서 STARTTLS 를 지운 상황과 같다.
 * 받은 명령의 동사를 순서대로 남긴다(DATA 본문은 빼고).
 */
async function startPlainSmtpServer(): Promise<{
  port: number;
  verbs: () => string[];
  close: () => Promise<void>;
}> {
  const commands: string[] = [];
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    // 클라이언트가 먼저 끊어도 테스트 프로세스에 처리되지 않은 에러가 남지 않게 한다.
    socket.on('error', () => undefined);
    let buffer = '';
    let inData = false;
    socket.write('220 plain.test ESMTP\r\n');
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 queued\r\n');
          }
          continue;
        }
        commands.push(line);
        socket.write(replyTo(line));
        if (verbOf(line) === 'DATA') inData = true;
        if (verbOf(line) === 'QUIT') socket.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    verbs: () => commands.map(verbOf),
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** 가짜 서버의 응답. EHLO 는 AUTH 만 알리고 STARTTLS 는 알리지 않는다. */
function replyTo(line: string): string {
  switch (verbOf(line)) {
    case 'EHLO':
      return '250-plain.test\r\n250 AUTH PLAIN\r\n';
    case 'AUTH':
      return '235 authenticated\r\n';
    case 'MAIL':
    case 'RCPT':
      return '250 ok\r\n';
    case 'DATA':
      return '354 go ahead\r\n';
    case 'QUIT':
      return '221 bye\r\n';
    default:
      return '502 command not implemented\r\n';
  }
}

describe('createMailTransporter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('SMTP 설정을 전송 옵션으로, mail.from 을 메시지 기본값으로 넘긴다', () => {
    const spy = jest.spyOn(nodemailer, 'createTransport');

    createMailTransporter(
      configOf({
        'mail.transport': 'smtp',
        'mail.host': 'smtp.example.com',
        'mail.port': 2525,
        'mail.secure': true,
        'mail.requireTls': false,
        'mail.user': 'mailer',
        'mail.pass': 'secret',
        'mail.from': 'Clemvion <noreply@example.com>',
      }),
    );

    expect(spy).toHaveBeenCalledWith(
      {
        host: 'smtp.example.com',
        port: 2525,
        secure: true,
        requireTLS: false,
        auth: { user: 'mailer', pass: 'secret' },
      },
      { from: 'Clemvion <noreply@example.com>' },
    );
  });

  it('secure 이고 mail.requireTls 값이 없으면 requireTLS 를 켠 채 넘긴다', () => {
    // 465 배포의 조합이다. nodemailer 는 secure 연결에서 STARTTLS 를 다시 시도하지 않으므로
    // requireTLS 가 켜져 있어도 동작은 같다. 값이 그대로 넘어가는지만 고정한다.
    const spy = jest.spyOn(nodemailer, 'createTransport');

    createMailTransporter(
      configOf({
        'mail.transport': 'smtp',
        'mail.host': 'smtp.example.com',
        'mail.secure': true,
      }),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, requireTLS: true }),
      expect.anything(),
    );
  });

  it('mail.requireTls 값이 없으면 STARTTLS 를 강제한다', () => {
    // 기본값의 정본은 mail.config 다. 설정이 값을 주지 않는 경로에서도 평문으로 열리지 않게 한다.
    const spy = jest.spyOn(nodemailer, 'createTransport');

    createMailTransporter(
      configOf({ 'mail.transport': 'smtp', 'mail.host': 'smtp.example.com' }),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true }),
      expect.anything(),
    );
  });

  describe('STARTTLS 를 알리지 않는 SMTP 서버', () => {
    let server: Awaited<ReturnType<typeof startPlainSmtpServer>>;

    beforeEach(async () => {
      server = await startPlainSmtpServer();
    });
    afterEach(async () => {
      await server.close();
    });

    const smtpConfig = (requireTls: boolean) =>
      configOf({
        'mail.transport': 'smtp',
        'mail.host': '127.0.0.1',
        'mail.port': server.port,
        'mail.secure': false,
        'mail.requireTls': requireTls,
        'mail.user': 'mailer',
        'mail.pass': 'secret',
        'mail.from': 'noreply@example.com',
      });
    const message = { to: 'user@example.com', subject: 'reset', text: 'link' };

    it('기본 설정이면 자격 증명과 메일을 보내지 않고 실패한다', async () => {
      const transporter = createMailTransporter(smtpConfig(true));
      try {
        // 운영 로그에 남는 것은 code 가 아니라 이 message 다(MailService 는 stack 을 남긴다).
        await expect(transporter.sendMail(message)).rejects.toMatchObject({
          code: 'ETLS',
          message: expect.stringContaining(
            'Error upgrading connection with STARTTLS',
          ) as unknown,
        });
      } finally {
        transporter.close();
      }

      // nodemailer 는 requireTLS 면 서버가 알리지 않아도 STARTTLS 를 시도한다. 그 시도가 실패해
      // 멈췄다는 것(서버 사정이 아니라 requireTLS 때문)을 STARTTLS 동사로 확인한다.
      expect(server.verbs()).toContain('STARTTLS');
      expect(server.verbs()).not.toContain('AUTH');
      expect(server.verbs()).not.toContain('MAIL');
    });

    it('MAIL_REQUIRE_TLS=false 면 평문 연결로도 보낸다', async () => {
      // 위 테스트가 서버 쪽 사정이 아니라 requireTLS 때문에 실패했다는 대조군이다.
      const transporter = createMailTransporter(smtpConfig(false));
      try {
        await expect(transporter.sendMail(message)).resolves.toBeDefined();
      } finally {
        transporter.close();
      }

      expect(server.verbs()).toEqual(
        expect.arrayContaining(['AUTH', 'MAIL', 'DATA']),
      );
      expect(server.verbs()).not.toContain('STARTTLS');
    });
  });

  it('console 이면 JSON 전송기를 만들어 실제로 보내지 않는다', () => {
    const spy = jest.spyOn(nodemailer, 'createTransport');

    createMailTransporter(
      configOf({
        'mail.transport': 'console',
        'mail.from': 'noreply@example.com',
      }),
    );

    expect(spy).toHaveBeenCalledWith(
      { jsonTransport: true },
      { from: 'noreply@example.com' },
    );
  });

  it('mail.from 기본값이 실제로 보낸 메시지의 From 이 된다', async () => {
    // 옛 `@nestjs-modules/mailer` 는 이 값을 전송 옵션 타입으로 선언해 단언이 필요했다.
    // 런타임에서 메시지 기본값으로 동작하는지를 실제 JSON 전송기로 확인한다.
    const transporter = createMailTransporter(
      configOf({
        'mail.transport': 'console',
        'mail.from': 'Clemvion <noreply@example.com>',
      }),
    );

    const info = (await transporter.sendMail({
      to: 'user@example.com',
      subject: 'hello',
      text: 'body',
    })) as { message: string };
    const message = JSON.parse(info.message) as {
      from: { address: string; name: string };
    };

    expect(message.from).toEqual({
      address: 'noreply@example.com',
      name: 'Clemvion',
    });
    transporter.close();
  });
});

describe('MailModule', () => {
  // 앱에서는 전역 `ConfigModule` 이 주는 것을 테스트에서 같은 모양으로 준다.
  @Global()
  @Module({
    providers: [
      {
        provide: ConfigService,
        useValue: configOf({
          'app.frontendUrl': 'http://localhost:3000',
          'mail.transport': 'console',
        }),
      },
    ],
    exports: [ConfigService],
  })
  class TestConfigModule {}

  it('모듈을 닫으면 전송기를 닫는다', async () => {
    const close = jest.fn();
    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, MailModule],
    })
      .overrideProvider(MAIL_TRANSPORTER)
      .useValue({ sendMail: jest.fn(), close })
      .compile();

    await moduleRef.close();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('전송기를 닫다가 실패해도 모듈 종료를 막지 않는다', async () => {
    const close = jest.fn(() => {
      throw new Error('already closed');
    });
    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, MailModule],
    })
      .overrideProvider(MAIL_TRANSPORTER)
      .useValue({ sendMail: jest.fn(), close })
      .compile();

    await expect(moduleRef.close()).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('설정으로 실제 전송기를 만들어 주입한다', async () => {
    // 위 두 테스트는 전송기를 바꿔 끼우므로 `useFactory` · `inject` 배선은 여기서만 확인된다.
    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, MailModule],
    }).compile();

    const transporter = moduleRef.get<MailTransporter>(MAIL_TRANSPORTER);
    const info = (await transporter.sendMail({
      to: 'user@example.com',
      subject: 'hello',
      text: 'body',
    })) as { message: string };

    expect(JSON.parse(info.message)).toMatchObject({ subject: 'hello' });
    await moduleRef.close();
  });
});
