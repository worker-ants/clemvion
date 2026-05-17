import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  transport: process.env.MAIL_TRANSPORT || 'console',
  host: process.env.MAIL_HOST || '',
  port: parseInt(process.env.MAIL_PORT || '587', 10) || 587,
  secure: process.env.MAIL_SECURE === 'true',
  user: process.env.MAIL_USER || '',
  pass: process.env.MAIL_PASS || '',
  from: process.env.MAIL_FROM || 'noreply@example.com',
}));
