import { Request } from 'express';
import { extractClientIp } from './client-ip';

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
  it('CF-Connecting-IP 가 있으면 가장 우선한다', () => {
    const req = makeReq({
      headers: {
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.2, 10.0.0.1',
      },
      ip: '172.16.0.1',
    });
    expect(extractClientIp(req)).toBe('203.0.113.7');
  });

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
    const req = makeReq({ headers: { 'cf-connecting-ip': '::ffff:1.2.3.4' } });
    expect(extractClientIp(req)).toBe('1.2.3.4');
  });

  it('빈 헤더 값은 무시하고 다음 우선순위로 넘어간다', () => {
    const req = makeReq({
      headers: { 'cf-connecting-ip': '', 'x-forwarded-for': '   ' },
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
