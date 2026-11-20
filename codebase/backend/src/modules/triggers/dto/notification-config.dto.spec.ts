import {
  NOTIFICATION_URL_CREDENTIALS_REASON,
  validateNotificationUrl,
} from './notification-config.dto';

// 알림 URL 의 userinfo 는 Node fetch 가 요청을 만들지 않아 발송이 늘 실패한다. 등록 · 발송 직전 모두 이 헬퍼로 거부한다
// (NERV Task `CLE-T-RCQGCC`).
describe('validateNotificationUrl', () => {
  it('공개 https URL 은 통과한다', () => {
    expect(
      validateNotificationUrl('https://customer.example.com/webhook'),
    ).toEqual({ ok: true });
  });

  it.each([
    ['https://user:pass@customer.example.com/webhook', '사용자명과 비밀번호'],
    ['https://tok@customer.example.com/webhook', '사용자명만'],
    ['https://:pw@customer.example.com/webhook', '빈 사용자명과 비밀번호'],
    ['https://user:@customer.example.com/webhook', '빈 비밀번호'],
  ])('userinfo 가 있는 %s (%s) 는 거부한다', (url) => {
    const result = validateNotificationUrl(url);
    expect(result).toEqual({
      ok: false,
      reason: NOTIFICATION_URL_CREDENTIALS_REASON,
    });
  });

  it('거부 사유에 URL 원문 · 자격 증명이 실리지 않는다', () => {
    const result = validateNotificationUrl(
      'https://alice:s3cr3t@customer.example.com/webhook',
    );
    expect(result.reason).not.toContain('alice');
    expect(result.reason).not.toContain('s3cr3t');
    expect(result.reason).not.toContain('customer.example.com');
  });

  // `https://@host` 는 파싱하면 userinfo 가 비고 직렬화 때 `@` 가 사라진다. fetch 도 받으므로 막지 않는다.
  it('빈 userinfo(`https://@host`)는 통과한다', () => {
    expect(
      validateNotificationUrl('https://@customer.example.com/webhook'),
    ).toEqual({ ok: true });
  });

  it('SSRF 판정이 먼저 거부하면 그 사유를 그대로 돌려준다', () => {
    expect(validateNotificationUrl('https://u:p@192.168.0.1/x')).toEqual({
      ok: false,
      reason: 'URL hostname must not be a private IPv4 address',
    });
  });
});
