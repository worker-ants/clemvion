import { Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
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
  private readonly logger = new Logger(MailModule.name);

  constructor(
    @Inject(MAIL_TRANSPORTER) private readonly transporter: MailTransporter,
  ) {}

  /**
   * 앱이 내려갈 때 SMTP 연결을 닫는다. 닫다가 실패해도 경고만 남긴다. 종료 중 한 모듈의 오류가
   * 다른 모듈의 정리를 막지 않게 하려는 것이고, 걷어 낸 `@nestjs-modules/mailer` 도 그렇게 했다.
   */
  onModuleDestroy(): void {
    try {
      this.transporter.close();
    } catch (err) {
      this.logger.warn(
        `Failed to close mail transporter: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
