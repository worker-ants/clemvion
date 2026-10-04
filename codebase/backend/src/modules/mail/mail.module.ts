import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MAIL_TRANSPORTER } from './mail.constants';
import {
  createMailTransporter,
  type MailTransporter,
} from './mail.transporter';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: createMailTransporter,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule implements OnModuleDestroy {
  constructor(
    @Inject(MAIL_TRANSPORTER) private readonly transporter: MailTransporter,
  ) {}

  /** 앱이 내려갈 때 SMTP 연결을 닫는다. */
  onModuleDestroy(): void {
    this.transporter.close();
  }
}
