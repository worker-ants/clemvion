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

  /**
   * Send an email verification link. The link expires in 24 hours. Raw token
   * URL is only logged when MAIL_TRANSPORT=console (dev environment); in other
   * transports the logger intentionally omits the token to prevent secrets
   * leaking into production log aggregators.
   */
  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    if (this.transport === MAIL_TRANSPORT_CONSOLE) {
      this.logger.debug(`Verification email for ${email}: ${verifyUrl}`);
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Clemvion - 이메일 인증',
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
          <h1 style="margin:0 0 24px;font-size:24px;color:#111;">Clemvion</h1>
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
    return `안녕하세요, ${name}님!\n\nClemvion에 가입해 주셔서 감사합니다.\n아래 링크를 클릭하여 이메일 인증을 완료해 주세요:\n\n${verifyUrl}\n\n이 링크는 24시간 동안 유효합니다.`;
  }

  /**
   * Send a workspace invitation email. The link points at the frontend's
   * accept-invitation route, which prompts sign-up for new users or auto-links
   * the workspace for already-authenticated users with the matching email.
   */
  async sendWorkspaceInvitationEmail(
    email: string,
    workspaceName: string,
    token: string,
  ): Promise<void> {
    const acceptUrl = `${this.frontendUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
    this.logger.debug(`[DEV] Workspace invitation for ${email}: ${acceptUrl}`);

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Clemvion - "${workspaceName}" 워크스페이스 초대`,
        html: this.buildInvitationHtml(workspaceName, acceptUrl),
        text: this.buildInvitationText(workspaceName, acceptUrl),
      });
      this.logger.log(`Invitation email sent to ${email} for ${workspaceName}`);
    } catch (error) {
      this.logger.error(
        `Failed to send invitation email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private buildInvitationHtml(
    workspaceName: string,
    acceptUrl: string,
  ): string {
    const safeWorkspace = this.escapeHtml(workspaceName);
    return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
        <tr><td>
          <h1 style="margin:0 0 24px;font-size:24px;color:#111;">Clemvion</h1>
          <p style="margin:0 0 16px;font-size:16px;color:#333;"><strong>${safeWorkspace}</strong> 워크스페이스에 초대되었습니다.</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;">아래 버튼을 클릭하여 초대를 수락해 주세요. 가입되어 있지 않다면 가입 후 자동으로 멤버가 됩니다.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#111;border-radius:6px;padding:12px 32px;">
              <a href="${acceptUrl}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;">초대 수락하기</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#999;">버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#999;word-break:break-all;">${acceptUrl}</p>
          <p style="margin:0;font-size:12px;color:#999;">이 링크는 7일 동안 유효합니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  }

  private buildInvitationText(
    workspaceName: string,
    acceptUrl: string,
  ): string {
    return `${workspaceName} 워크스페이스에 초대되었습니다.\n\n아래 링크에서 초대를 수락해 주세요:\n\n${acceptUrl}\n\n이 링크는 7일 동안 유효합니다.`;
  }

  /**
   * Send a password reset link. The link expires in 30 minutes — shorter than
   * the verification link because it grants account takeover on its own. Raw
   * token URL is only logged when MAIL_TRANSPORT=console (dev); other
   * transports omit it to avoid leaking the secret to log aggregators.
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    if (this.transport === MAIL_TRANSPORT_CONSOLE) {
      this.logger.debug(`Password reset email for ${email}: ${resetUrl}`);
    }

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Clemvion - 비밀번호 재설정',
        html: this.buildPasswordResetHtml(name, resetUrl),
        text: this.buildPasswordResetText(name, resetUrl),
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private buildPasswordResetHtml(name: string, resetUrl: string): string {
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
          <h1 style="margin:0 0 24px;font-size:24px;color:#111;">Clemvion</h1>
          <p style="margin:0 0 16px;font-size:16px;color:#333;">안녕하세요, ${safeName}님!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;">비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#111;border-radius:6px;padding:12px 32px;">
              <a href="${resetUrl}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:600;">비밀번호 재설정하기</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#999;">버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요:</p>
          <p style="margin:0 0 24px;font-size:12px;color:#999;word-break:break-all;">${resetUrl}</p>
          <p style="margin:0 0 8px;font-size:12px;color:#999;">이 링크는 30분 동안 유효합니다.</p>
          <p style="margin:0;font-size:12px;color:#999;">본인이 요청하지 않으셨다면 이 메일을 무시해 주세요. 비밀번호는 변경되지 않습니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  }

  private buildPasswordResetText(name: string, resetUrl: string): string {
    return `안녕하세요, ${name}님!\n\n비밀번호 재설정을 요청하셨습니다.\n아래 링크를 클릭하여 새 비밀번호를 설정해 주세요:\n\n${resetUrl}\n\n이 링크는 30분 동안 유효합니다.\n본인이 요청하지 않으셨다면 이 메일을 무시해 주세요. 비밀번호는 변경되지 않습니다.`;
  }
}
