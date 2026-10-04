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
