import { Module } from '@nestjs/common';
import { MailerModule, type MailerOptions } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import type { MailDefaults } from 'nodemailer';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT_CONSOLE } from './mail.constants';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const transport = configService.get<string>('mail.transport');
        // `@nestjs-modules/mailer` 2.3.7 은 `defaults` 를 nodemailer 의 *전송* 옵션
        // 타입으로 선언하지만, 런타임에서는 `createTransport(transport, defaults)` 의
        // *메시지* 기본값으로 넘긴다(mailer-transport.factory.js). nodemailer 10 이
        // 자체 타입을 내면서 전송 옵션에서 `from` 같은 메시지 필드가 빠졌고, 그래서 그
        // 선언이 런타임이 기대하는 값을 받지 못한다. 값은 nodemailer 의 `MailDefaults`
        // 로 검사하고, 단언은 mailer 의 낡은 선언을 건너는 데만 쓴다. mailer 가
        // `defaults` 를 `MailDefaults` 로 선언하면 단언을 지운다. mailer 를 올리는 작업은
        // NERV Task CLE-T-3X627J(Nest 12) 이므로 그때 다시 본다.
        const mailDefaults: MailDefaults = {
          from: configService.get<string>('mail.from'),
        };
        const defaults = mailDefaults as MailerOptions['defaults'];

        if (transport === MAIL_TRANSPORT_CONSOLE) {
          return {
            transport: { jsonTransport: true },
            defaults,
          };
        }

        return {
          transport: {
            host: configService.get<string>('mail.host'),
            port: configService.get<number>('mail.port'),
            secure: configService.get<boolean>('mail.secure'),
            auth: {
              user: configService.get<string>('mail.user'),
              pass: configService.get<string>('mail.pass'),
            },
          },
          defaults,
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
