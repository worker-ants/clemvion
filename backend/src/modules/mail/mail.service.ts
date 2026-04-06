import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { MAIL_TRANSPORT_CONSOLE } from './mail.constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;
  private readonly transport: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('app.frontendUrl') || '';
    this.transport =
      this.configService.get<string>('mail.transport') ||
      MAIL_TRANSPORT_CONSOLE;

    if (!this.frontendUrl) {
      this.logger.warn(
        'FRONTEND_URL is not configured. Verification email links will be broken.',
      );
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    // if (this.transport === MAIL_TRANSPORT_CONSOLE) {
    //   this.logger.debug(`[DEV] Verification email for ${email}: ${verifyUrl}`);
    //   return;
    // }
    this.logger.debug(`[DEV] Verification email for ${email}: ${verifyUrl}`);

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Idea Workflow - 이메일 인증',
        html: this.buildVerificationHtml(name, verifyUrl),
        text: this.buildVerificationText(name, verifyUrl),
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildVerificationHtml(name: string, verifyUrl: string): string {
    const safeName = this.escapeHtml(name);
    return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
        <tr><td>
          <h1 style="margin:0 0 24px;font-size:24px;color:#111;">Idea Workflow</h1>
          <p style="margin:0 0 16px;font-size:16px;color:#333;">안녕하세요, ${safeName}님!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;">아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#111;border-radius:6px;padding:12px 32px;">
              <a href="${verifyUrl}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;">이메일 인증하기</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#999;">버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#999;word-break:break-all;">${verifyUrl}</p>
          <p style="margin:0;font-size:12px;color:#999;">이 링크는 24시간 동안 유효합니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  }

  private buildVerificationText(name: string, verifyUrl: string): string {
    return `안녕하세요, ${name}님!\n\nIdea Workflow에 가입해 주셔서 감사합니다.\n아래 링크를 클릭하여 이메일 인증을 완료해 주세요:\n\n${verifyUrl}\n\n이 링크는 24시간 동안 유효합니다.`;
  }
}
