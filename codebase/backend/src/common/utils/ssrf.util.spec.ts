import { promises as dns } from 'node:dns';

import { isPrivateHost, resolvesToPrivate } from './ssrf.util';

jest.mock('node:dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

const mockedLookup = dns.lookup as unknown as jest.Mock;

describe('ssrf.util — LLM · S3 엔드포인트 가드 (CLE-T-63RSH6 · CLE-T-4YHEKF)', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  describe('isPrivateHost', () => {
    it.each([
      ['http://127.0.0.1:8080'],
      ['http://10.0.0.5'],
      ['http://172.16.0.1'],
      ['http://192.168.1.1'],
      ['http://169.254.169.254/latest/meta-data'],
      ['http://0.0.0.0'],
      ['http://localhost:11434'],
      ['http://LOCALHOST'],
      ['http://[::1]'],
      ['http://[fc00::1]'],
      ['http://[fe80::1]'],
      ['http://[::ffff:10.0.0.1]'],
    ])('기존 차단 대역 %s 을 계속 막는다', (url) => {
      expect(isPrivateHost(url)).toBe(true);
    });

    // 63RSH6 결정(2026-11-20): 다른 세 가드와 같은 표로 맞춘다. 우회 플래그는 없다.
    it.each([
      ['CGNAT 시작', 'http://100.64.0.1'],
      ['CGNAT 끝', 'http://100.127.255.254'],
      ['미지정 주소 ::', 'http://[::]'],
      ['IETF 프로토콜 할당', 'http://192.0.0.8'],
      ['벤치마크', 'http://198.18.0.1'],
      ['멀티캐스트', 'http://224.0.0.1'],
      ['예약', 'http://240.0.0.1'],
      ['옛 site-local', 'http://[fec0::1]'],
      ['IPv6 멀티캐스트', 'http://[ff02::1]'],
      ['IPv4-compatible', 'http://[::10.0.0.1]'],
      ['NAT64', 'http://[64:ff9b::a00:1]'],
      ['6to4', 'http://[2002:a00:1::1]'],
      ['CGNAT 를 품은 mapped', 'http://[::ffff:100.64.0.1]'],
    ])('%s(%s)를 막는다', (_label, url) => {
      expect(isPrivateHost(url)).toBe(true);
    });

    it.each([
      ['CGNAT 바로 앞', 'http://100.63.255.255'],
      ['CGNAT 바로 뒤', 'http://100.128.0.0'],
      ['공인 IPv4', 'http://8.8.8.8'],
      ['공인 IPv6', 'http://[2606:4700:4700::1111]'],
      ['공인 IPv4 를 품은 mapped', 'http://[::ffff:8.8.8.8]'],
      ['호스트 이름', 'https://api.openai.com/v1'],
    ])('%s(%s)는 통과시킨다', (_label, url) => {
      expect(isPrivateHost(url)).toBe(false);
    });

    it('http(s) 가 아닌 스킴은 막는다', () => {
      expect(isPrivateHost('file:///etc/passwd')).toBe(true);
      expect(isPrivateHost('gopher://example.com')).toBe(true);
    });

    it('파싱할 수 없는 URL 은 false 다(DTO 검증이 먼저 거른다)', () => {
      expect(isPrivateHost('not a url')).toBe(false);
    });
  });

  describe('resolvesToPrivate', () => {
    it('호스트 이름이 CGNAT 로 해석되면 막는다', async () => {
      mockedLookup.mockResolvedValue([{ address: '100.64.1.2', family: 4 }]);
      await expect(resolvesToPrivate('https://llm.example.com')).resolves.toBe(
        true,
      );
    });

    it('해석 결과 중 하나라도 사설이면 막는다', async () => {
      mockedLookup.mockResolvedValue([
        { address: '8.8.8.8', family: 4 },
        { address: '::', family: 6 },
      ]);
      await expect(resolvesToPrivate('https://llm.example.com')).resolves.toBe(
        true,
      );
    });

    it('모두 공인이면 통과시킨다', async () => {
      mockedLookup.mockResolvedValue([
        { address: '8.8.8.8', family: 4 },
        { address: '2606:4700:4700::1111', family: 6 },
      ]);
      await expect(resolvesToPrivate('https://llm.example.com')).resolves.toBe(
        false,
      );
    });

    it('해석이 실패하면 통과시킨다(fail-open 유지)', async () => {
      mockedLookup.mockRejectedValue(
        Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }),
      );
      await expect(resolvesToPrivate('https://llm.example.com')).resolves.toBe(
        false,
      );
    });

    it('IP 리터럴은 해석하지 않고 판정한다', async () => {
      await expect(resolvesToPrivate('http://100.64.0.1')).resolves.toBe(true);
      await expect(resolvesToPrivate('http://[::]')).resolves.toBe(true);
      await expect(resolvesToPrivate('http://8.8.8.8')).resolves.toBe(false);
      expect(mockedLookup).not.toHaveBeenCalled();
    });

    it('http(s) 가 아닌 스킴은 막는다', async () => {
      await expect(resolvesToPrivate('ftp://example.com')).resolves.toBe(true);
    });
  });
});
