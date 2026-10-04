import { mailConfig, shouldWarnPlainSmtp } from './mail.config';

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

/**
 * 운영에서 STARTTLS 강제를 끈 채 SMTP 로 부팅하면 `main.ts` 가 경고한다. 정당한 용도(STARTTLS 를
 * 지원하지 않는 사내 릴레이)가 있어 거부하지 않는다. 판정은 `mailConfig` 가 해석한 값을 받으므로
 * 환경 변수 해석 규칙이 두 벌로 갈리지 않는다.
 */
describe('shouldWarnPlainSmtp', () => {
  const plain = { transport: 'smtp', secure: false, requireTls: false };

  it('운영 · smtp · secure 아님 · 강제 끔 이면 경고한다', () => {
    expect(shouldWarnPlainSmtp('production', plain)).toBe(true);
  });

  it.each([
    ['개발 환경이면', 'development', plain],
    ['테스트 환경이면', 'test', plain],
    ['NODE_ENV 가 없으면', undefined, plain],
    ['console 전송이면', 'production', { ...plain, transport: 'console' }],
    ['암묵적 TLS(secure)면', 'production', { ...plain, secure: true }],
    ['강제가 켜져 있으면', 'production', { ...plain, requireTls: true }],
  ])('%s 경고하지 않는다', (_label, nodeEnv, mail) => {
    expect(shouldWarnPlainSmtp(nodeEnv, mail)).toBe(false);
  });

  it('console 이 아닌 전송 값은 모두 SMTP 로 본다(전송기와 같은 판정)', () => {
    // createMailTransporter 는 console 이 아니면 SMTP 전송기를 만든다.
    expect(
      shouldWarnPlainSmtp('production', { ...plain, transport: 'SMTP' }),
    ).toBe(true);
  });
});
