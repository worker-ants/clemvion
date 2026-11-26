import { restoreEnvAfterEach } from '../../../shared/testing/env';
import { SsrfBlockedError } from '../../../common/utils/ssrf/outbound-guard';
import { checkSmtpHost } from './smtp-host-guard';

type GuardModule = typeof import('./smtp-host-guard');

// DNS 를 mock 하지 않는다 — 입력이 IP 리터럴 · `localhost` 라 가드가 조회 전에 판정하거나, 조회하더라도 리터럴을 그대로 돌려받아
// 네트워크 질의가 일어나지 않는다. 호스트 이름 해석 경로는 `outbound-guard.spec.ts` 가 mock 으로 본다.
// 판정 결과만 보는 단언은 «막힘 = 판정 오류를 돌려받음» 으로 줄여 쓴다.
const isBlocked = async (host: string): Promise<boolean> =>
  (await checkSmtpHost(host)) !== null;

describe('smtp-host-guard', () => {
  restoreEnvAfterEach('ALLOW_PRIVATE_HOST_TARGETS');

  // CLE-T-FWSAJ4 — 호출부가 차단 원문(host · IP)을 서버 경고 로그에 남기려면 판정 오류를 그대로 받아야 한다.
  it('막힌 host 면 차단된 host · IP 가 담긴 판정 오류를 돌려준다', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    const blocked = await checkSmtpHost(' 10.0.0.5 ');
    expect(blocked).toBeInstanceOf(SsrfBlockedError);
    expect(blocked?.message).toContain('10.0.0.5');
  });

  it('blocks private / loopback / link-local hosts by default (guard on)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isBlocked('127.0.0.1')).toBe(true);
    expect(await isBlocked('10.0.0.5')).toBe(true);
    expect(await isBlocked('172.16.3.4')).toBe(true);
    expect(await isBlocked('192.168.1.10')).toBe(true);
    expect(await isBlocked('169.254.169.254')).toBe(true);
    expect(await isBlocked('localhost')).toBe(true);
    expect(await isBlocked('::1')).toBe(true);
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
    expect(await isBlocked(host)).toBe(true);
  });

  it('allows the edges just outside CGNAT (대조군)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isBlocked('100.63.255.255')).toBe(false);
    expect(await isBlocked('100.128.0.0')).toBe(false);
  });

  it('allows private hosts when ALLOW_PRIVATE_HOST_TARGETS=true (self-host opt-out)', async () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    expect(await isBlocked('10.0.0.5')).toBe(false);
    expect(await isBlocked('localhost')).toBe(false);
    expect(await isBlocked('169.254.169.254')).toBe(false);
  });

  it('allows public IP literals (guard on, but not private)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isBlocked('8.8.8.8')).toBe(false);
  });

  it('SSRF 판정이 아닌 오류는 «막힘» 으로 바꾸지 않고 그대로 던진다', async () => {
    const boom = new Error('guard exploded');
    let guarded: typeof checkSmtpHost | undefined;
    jest.isolateModules(() => {
      jest.doMock('../../../common/utils/ssrf/outbound-guard.js', () => ({
        assertSafeOutboundHostResolved: jest.fn().mockRejectedValue(boom),
        SsrfBlockedError: class SsrfBlockedError extends Error {},
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('./smtp-host-guard') as GuardModule;
      guarded = fresh.checkSmtpHost;
    });
    await expect(guarded!('smtp.example.com')).rejects.toBe(boom);
  });

  it('returns null for empty host', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await checkSmtpHost('')).toBeNull();
    expect(await checkSmtpHost('   ')).toBeNull();
  });

  it('returns null for a missing host (호출부가 `credentials.host as string` 으로 넘긴다)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await checkSmtpHost(undefined as unknown as string)).toBeNull();
  });
});
