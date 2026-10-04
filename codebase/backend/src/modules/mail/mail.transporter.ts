import { ConfigService } from '@nestjs/config';
import { createTransport, type SendMailOptions } from 'nodemailer';
import { MAIL_TRANSPORT_CONSOLE } from './mail.constants';

/** `MailService` 가 쓰는 전송기 표면. nodemailer 의 `Transporter` 가 이 모양을 만족한다. */
export interface MailTransporter {
  sendMail(options: SendMailOptions): Promise<unknown>;
  close(): void;
}

/**
 * 설정으로 nodemailer 전송기를 만든다.
 *
 * `mail.from` 은 두 번째 인자(메시지 기본값)로 넘겨 모든 메시지의 From 이 된다.
 * `mail.transport` 가 `console` 이면 JSON 전송기를 써서 실제로 보내지 않는다.
 *
 * 예전에는 `@nestjs-modules/mailer` 가 같은 일을 했다. 우리는 그 모듈의 템플릿 · 미리보기 ·
 * 헬스 기능을 쓰지 않았고, 그 모듈의 타입 선언이 Nest 12 를 막아 걷어 냈다(NERV Task
 * CLE-T-3X627J).
 */
export function createMailTransporter(
  configService: ConfigService,
): MailTransporter {
  const defaults = { from: configService.get<string>('mail.from') };

  if (configService.get<string>('mail.transport') === MAIL_TRANSPORT_CONSOLE) {
    return createTransport({ jsonTransport: true }, defaults);
  }

  return createTransport(
    {
      host: configService.get<string>('mail.host'),
      port: configService.get<number>('mail.port'),
      secure: configService.get<boolean>('mail.secure'),
      auth: {
        user: configService.get<string>('mail.user'),
        pass: configService.get<string>('mail.pass'),
      },
    },
    defaults,
  );
}
