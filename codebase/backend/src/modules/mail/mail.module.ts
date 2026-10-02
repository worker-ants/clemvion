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
        // `@nestjs-modules/mailer` 2.3.7 declares `defaults` as nodemailer's
        // *transport* options, yet hands it to `createTransport(transport,
        // defaults)` as the *message* defaults (mailer-transport.factory.js).
        // nodemailer 10 ships its own types, in which transport options no
        // longer carry message fields such as `from`, so that declaration stops
        // accepting the value the runtime expects. The value is checked against
        // nodemailer's own `MailDefaults`; the cast only bridges the mailer's
        // stale declaration. Drop it once the mailer types `defaults` as
        // `MailDefaults`.
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
