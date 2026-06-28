import { Request } from 'express';
import {
  extractClientIp,
  extractClientIpFromHeaders,
  shouldTrustCfConnectingIp,
} from './client-ip';

// 04 후속 — 헤더 전용 공유 코어. hooks rate-limit/ip_whitelist 가 위임하는 단일 구현.
describe('extractClientIpFromHeaders (shared core)', () => {
  // env 스냅샷/복원으로 테스트 격리 — TRUST_CF_CONNECTING_IP 변이 누설 방지(B-4).
  let envSnapshot: NodeJS.ProcessEnv;
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });
  afterEach(() => {
    process.env = envSnapshot;
  });

  it('CF off (default) → ignores CF header, uses XFF first IP', () => {
    delete process.env.TRUST_CF_CONNECTING_IP;
    expect(
      extractClientIpFromHeaders({
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.2, 10.0.0.1',
      }),
    ).toBe('198.51.100.2');
  });

  it('CF on → CF header first', () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';
    expect(
      extractClientIpFromHeaders({
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.2',
      }),
    ).toBe('203.0.113.7');
  });

  it('normalizes IPv6-mapped IPv4, preserves pure IPv6, returns undefined when absent', () => {
    expect(
      extractClientIpFromHeaders({ 'x-forwarded-for': '::ffff:1.2.3.4' }),
    ).toBe('1.2.3.4');
    // 순수 IPv6 는 normalize 변환 없이 그대로 반환.
    expect(
      extractClientIpFromHeaders({ 'x-forwarded-for': '2001:db8::1' }),
    ).toBe('2001:db8::1');
    // 헤더에서 IP 를 찾지 못하면 undefined.
    expect(extractClientIpFromHeaders({})).toBeUndefined();
  });

  it('empty/whitespace cf-connecting-ip → falls back to XFF (CF on)', () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';
    expect(
      extractClientIpFromHeaders({
        'cf-connecting-ip': '   ',
        'x-forwarded-for': '8.8.8.8',
      }),
    ).toBe('8.8.8.8');
  });

  it('whitespace-only XFF → undefined', () => {
    expect(
      extractClientIpFromHeaders({ 'x-forwarded-for': '   ' }),
    ).toBeUndefined();
  });
});

// 04 m-3 — env-injection 직접 단위 테스트 (isFlagOn/isSwaggerEnabled 등과 일관).
describe('shouldTrustCfConnectingIp (04 m-3)', () => {
  it.each(['true', '1'])('returns true for ON value %p', (v) => {
    expect(shouldTrustCfConnectingIp({ TRUST_CF_CONNECTING_IP: v })).toBe(true);
  });

  it.each([undefined, '', 'TRUE', 'yes', 'on', '0', 'false'])(
    'returns false for non-ON value %p (fail-safe default)',
    (v) => {
      expect(shouldTrustCfConnectingIp({ TRUST_CF_CONNECTING_IP: v })).toBe(
        false,
      );
    },
  );
});

function makeReq(
  overrides: Partial<{
    headers: Record<string, string | string[] | undefined>;
    ip: string;
    socketRemoteAddress: string;
  }> = {},
): Request {
  return {
    headers: overrides.headers ?? {},
    ip: overrides.ip,
    socket: { remoteAddress: overrides.socketRemoteAddress } as any,
  } as unknown as Request;
}

describe('extractClientIp', () => {
  // 04 m-3 — CF-Connecting-IP 신뢰는 기본 off. CF 헤더를 우선해야 하는 테스트는
  // 명시적으로 TRUST_CF_CONNECTING_IP 를 켜고, env 스냅샷/복원으로 격리한다(B-4).
  let envSnapshot: NodeJS.ProcessEnv;
  beforeEach(() => {
    envSnapshot = { ...process.env };
  });
  afterEach(() => {
    process.env = envSnapshot;
  });

  it('CF-Connecting-IP 가 있으면 가장 우선한다 (TRUST_CF_CONNECTING_IP=true)', () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';
    const req = makeReq({
      headers: {
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.2, 10.0.0.1',
      },
      ip: '172.16.0.1',
    });
    expect(extractClientIp(req)).toBe('203.0.113.7');
  });

  // 04 m-3 — 기본(플래그 off)에서는 위변조 가능한 CF 헤더를 무시하고 XFF 로 폴백.
  it('기본(TRUST_CF_CONNECTING_IP 미설정)에서는 CF-Connecting-IP 를 무시한다', () => {
    delete process.env.TRUST_CF_CONNECTING_IP;
    const req = makeReq({
      headers: {
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.2, 10.0.0.1',
      },
      ip: '172.16.0.1',
    });
    // CF 헤더 무시 → XFF 첫 IP.
    expect(extractClientIp(req)).toBe('198.51.100.2');
  });

  it.each(['', 'TRUE', 'yes', '0', 'false'])(
    'CF 신뢰는 정확히 true/1 일 때만 — 비표준 값 %p 는 무시(XFF 폴백)',
    (flag) => {
      process.env.TRUST_CF_CONNECTING_IP = flag;
      const req = makeReq({
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.2',
        },
      });
      expect(extractClientIp(req)).toBe('198.51.100.2');
    },
  );

  it('CF-Connecting-IP 가 없으면 X-Forwarded-For 첫 번째 IP 를 사용한다', () => {
    const req = makeReq({
      headers: { 'x-forwarded-for': '198.51.100.2, 10.0.0.1' },
      ip: '172.16.0.1',
    });
    expect(extractClientIp(req)).toBe('198.51.100.2');
  });

  it('X-Forwarded-For 가 배열인 경우 첫 값을 사용한다', () => {
    const req = makeReq({
      headers: { 'x-forwarded-for': ['198.51.100.9', '10.0.0.2'] },
    });
    expect(extractClientIp(req)).toBe('198.51.100.9');
  });

  it('헤더가 없으면 req.ip 를 사용한다', () => {
    const req = makeReq({ ip: '172.16.0.1' });
    expect(extractClientIp(req)).toBe('172.16.0.1');
  });

  it('req.ip 도 없으면 socket.remoteAddress 를 사용한다', () => {
    const req = makeReq({ socketRemoteAddress: '10.0.0.5' });
    expect(extractClientIp(req)).toBe('10.0.0.5');
  });

  it('IPv6-mapped IPv4 (::ffff:1.2.3.4) 는 IPv4 부분만 추출한다', () => {
    // normalize 는 소스 무관 — XFF 경로로 검증(기본 플래그 off 에서도 동작).
    const req = makeReq({ headers: { 'x-forwarded-for': '::ffff:1.2.3.4' } });
    expect(extractClientIp(req)).toBe('1.2.3.4');
  });

  it('빈 헤더 값은 무시하고 다음 우선순위로 넘어간다', () => {
    const req = makeReq({
      headers: { 'x-forwarded-for': '   ' },
      ip: '172.16.0.1',
    });
    expect(extractClientIp(req)).toBe('172.16.0.1');
  });

  it('모든 소스가 비어 있으면 null 을 반환한다', () => {
    const req = makeReq({});
    expect(extractClientIp(req)).toBeNull();
  });

  it('X-Forwarded-For 의 공백·콤마를 정확히 처리한다', () => {
    const req = makeReq({
      headers: { 'x-forwarded-for': '  198.51.100.42 , 10.0.0.1 ' },
    });
    expect(extractClientIp(req)).toBe('198.51.100.42');
  });
});
