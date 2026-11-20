import {
  NOTIFICATION_URL_CREDENTIALS_REASON,
  maskNotificationLastErrorUserinfo,
  maskNotificationUrlUserinfo,
  validateNotificationUrl,
} from './notification-url.util';

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

// 판정은 `validateNotificationUrl` 과 같은 `hasUrlUserinfo` 를 쓴다. 거부되는 URL 은 응답에서 가려지고 통과하는 URL 은
// 그대로 나가야 한다.
describe('maskNotificationUrlUserinfo', () => {
  it.each([
    [
      'https://alice:s3cr3t@hooks.example.com/a?x=1#f',
      'https://***@hooks.example.com/a?x=1#f',
    ],
    ['https://tok@hooks.example.com/a', 'https://***@hooks.example.com/a'],
    ['https://:pw@hooks.example.com/a', 'https://***@hooks.example.com/a'],
    ['https://user:@hooks.example.com/a', 'https://***@hooks.example.com/a'],
  ])('%s 의 userinfo 를 가린다', (url, expected) => {
    expect(validateNotificationUrl(url).ok).toBe(false);
    expect(maskNotificationUrlUserinfo(url)).toBe(expected);
  });

  it.each([
    'https://hooks.example.com/a?next=https://x@y',
    'https://@hooks.example.com/a',
    'not a url',
  ])('userinfo 가 없거나 파싱되지 않는 %s 는 그대로 둔다', (url) => {
    expect(maskNotificationUrlUserinfo(url)).toBe(url);
  });
});

describe('maskNotificationLastErrorUserinfo', () => {
  it('사용자명만 · 빈 사용자명 형태의 userinfo 를 가리고 나머지 글자는 둔다', () => {
    expect(
      maskNotificationLastErrorUserinfo(
        'fetch failed: https://tok@a.example/x, https://:pw@b.example/y',
      ),
    ).toBe('fetch failed: https://***@a.example/x, https://***@b.example/y');
  });

  it('userinfo 가 없는 문구는 그대로 둔다', () => {
    const text = 'HTTP 500 from https://a.example/x (mail: ops@a.example)';
    expect(maskNotificationLastErrorUserinfo(text)).toBe(text);
  });
});
