import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT_CONSOLE } from './mail.constants';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const transport = configService.get<string>('mail.transport');
        const defaults = {
          from: configService.get<string>('mail.from'),
        };

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
