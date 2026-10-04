export const MAIL_TRANSPORT_CONSOLE = 'console';

/**
 * `MailModule` 이 설정으로 만든 nodemailer 전송기의 주입 토큰. 위 `MAIL_TRANSPORT_CONSOLE` 은
 * `mail.transport` 설정값이고 이 토큰은 전송기 객체다.
 */
export const MAIL_TRANSPORTER = Symbol('MAIL_TRANSPORTER');
