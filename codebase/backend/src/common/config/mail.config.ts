import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  transport: process.env.MAIL_TRANSPORT || 'console',
  host: process.env.MAIL_HOST || '',
  port: parseInt(process.env.MAIL_PORT || '587', 10) || 587,
  secure: process.env.MAIL_SECURE === 'true',
  // `secure` 가 아니면 STARTTLS 를 강제한다. 끄는 값은 `false` 하나뿐이라 비우거나 오타를 내도 강제가 남는다.
  requireTls: process.env.MAIL_REQUIRE_TLS !== 'false',
  user: process.env.MAIL_USER || '',
  pass: process.env.MAIL_PASS || '',
  from: process.env.MAIL_FROM || 'noreply@example.com',
}));

/**
 * 운영에서 STARTTLS 강제를 끈 SMTP 로 부팅하는지. `main.ts` 가 이 값으로 경고를 남긴다.
 *
 * STARTTLS 를 지원하지 않는 사내 릴레이처럼 정당한 용도가 있어 부팅을 거부하지 않는다
 * (`production-guards.ts` 의 "throw 면 거기, warn 이면 main.ts" 기준). `mailConfig` 가 해석한
 * 값을 받으므로 환경 변수 해석 규칙을 따로 두지 않는다. 전송 판정은 `createMailTransporter` 와
 * 같다(`console` 이 아니면 SMTP).
 */
export function shouldWarnPlainSmtp(
  nodeEnv: string | undefined,
  mail: { transport: string; secure: boolean; requireTls: boolean },
): boolean {
  return (
    nodeEnv === 'production' &&
    mail.transport !== 'console' &&
    !mail.secure &&
    !mail.requireTls
  );
}
