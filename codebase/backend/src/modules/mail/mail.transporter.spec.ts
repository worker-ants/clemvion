import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { MAIL_TRANSPORTER } from './mail.constants';
import { MailModule } from './mail.module';
import { createMailTransporter } from './mail.transporter';

const configOf = (values: Record<string, unknown>): ConfigService =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

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
        auth: { user: 'mailer', pass: 'secret' },
      },
      { from: 'Clemvion <noreply@example.com>' },
    );
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
});
