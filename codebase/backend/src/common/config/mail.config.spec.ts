import { mailConfig } from './mail.config';

/**
 * `MAIL_REQUIRE_TLS` 는 끄는 값 하나만 받는다. 비우거나 빠뜨리거나 오타를 내도 STARTTLS 강제가
 * 유지돼야 한다(평문 SMTP 는 운영자가 `false` 를 명시했을 때만 열린다).
 */
describe('mailConfig.requireTls', () => {
  const saved = process.env.MAIL_REQUIRE_TLS;

  afterEach(() => {
    if (saved === undefined) delete process.env.MAIL_REQUIRE_TLS;
    else process.env.MAIL_REQUIRE_TLS = saved;
  });

  it('값이 없으면 true', () => {
    delete process.env.MAIL_REQUIRE_TLS;
    expect(mailConfig().requireTls).toBe(true);
  });

  it('false 면 false', () => {
    process.env.MAIL_REQUIRE_TLS = 'false';
    expect(mailConfig().requireTls).toBe(false);
  });

  it.each(['', 'true', 'FALSE', '0', 'no'])(
    '%j 는 끄는 값이 아니라 true',
    (value) => {
      process.env.MAIL_REQUIRE_TLS = value;
      expect(mailConfig().requireTls).toBe(true);
    },
  );
});
