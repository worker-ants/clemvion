import { isSmtpHostBlocked } from './smtp-host-guard';

type GuardModule = typeof import('./smtp-host-guard');

describe('smtp-host-guard', () => {
  const orig = process.env.ALLOW_PRIVATE_HOST_TARGETS;
  afterEach(() => {
    if (orig === undefined) delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    else process.env.ALLOW_PRIVATE_HOST_TARGETS = orig;
  });

  it('blocks private / loopback / link-local hosts by default (guard on)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('127.0.0.1')).toBe(true);
    expect(await isSmtpHostBlocked('10.0.0.5')).toBe(true);
    expect(await isSmtpHostBlocked('172.16.3.4')).toBe(true);
    expect(await isSmtpHostBlocked('192.168.1.10')).toBe(true);
    expect(await isSmtpHostBlocked('169.254.169.254')).toBe(true);
    expect(await isSmtpHostBlocked('localhost')).toBe(true);
    expect(await isSmtpHostBlocked('::1')).toBe(true);
  });

  /**
   * spec(4-integration §5.5 · 3-send-email §4 7번)은 SMTP 가드가 HTTP Request 가드와 **같은 메커니즘**이라 적는다 — CGNAT 를 막고,
   * 표기만 바꾼 루프백(IPv4-mapped · `::`)도 막는다. 종전 구현(`ssrf.util`)은 CGNAT 와 `::` 를 통과시켰다.
   */
  it.each([
    ['100.64.0.1', 'CGNAT 시작'],
    ['100.127.255.255', 'CGNAT 끝'],
    ['::', 'IPv6 unspecified'],
    ['::ffff:127.0.0.1', 'IPv4-mapped 루프백'],
    ['[::ffff:a9fe:a9fe]', 'IPv4-mapped 메타데이터'],
  ])('blocks %s (%s) — HTTP Request 가드와 같은 대역', async (host) => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked(host)).toBe(true);
  });

  it('allows the edges just outside CGNAT (대조군)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('100.63.255.255')).toBe(false);
    expect(await isSmtpHostBlocked('100.128.0.0')).toBe(false);
  });

  it('allows private hosts when ALLOW_PRIVATE_HOST_TARGETS=true (self-host opt-out)', async () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    expect(await isSmtpHostBlocked('10.0.0.5')).toBe(false);
    expect(await isSmtpHostBlocked('localhost')).toBe(false);
    expect(await isSmtpHostBlocked('169.254.169.254')).toBe(false);
  });

  it('allows public IP literals (guard on, but not private)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('8.8.8.8')).toBe(false);
  });

  it('SSRF 판정이 아닌 오류는 «막힘» 으로 바꾸지 않고 그대로 던진다', async () => {
    const boom = new Error('guard exploded');
    let guarded: typeof isSmtpHostBlocked | undefined;
    jest.isolateModules(() => {
      jest.doMock('../http-request/http-safety.js', () => ({
        assertSafeOutboundHostResolved: jest.fn().mockRejectedValue(boom),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('./smtp-host-guard') as GuardModule;
      guarded = fresh.isSmtpHostBlocked;
    });
    await expect(guarded!('smtp.example.com')).rejects.toBe(boom);
  });

  it('returns false for empty host', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('')).toBe(false);
  });
});
