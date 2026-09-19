import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import {
  assertSafeOutboundHostResolved,
  assertSafeOutboundUrl,
  isBlockedHostname,
} from './http-safety';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

// 가드는 `lookup(host, { all: true })` 오버로드만 쓴다 — `jest.mocked(lookup)` 은 단일 주소 오버로드로 잡혀 배열을 거부한다.
const mockedLookup = lookup as unknown as jest.MockedFunction<
  (hostname: string, options: { all: true }) => Promise<LookupAddress[]>
>;

describe('http-safety — assertSafeOutboundUrl (synchronous literal check)', () => {
  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
  });

  it('블록: localhost', () => {
    expect(() => assertSafeOutboundUrl('http://localhost/admin')).toThrow(
      /SSRF_BLOCKED/,
    );
  });

  it('블록: 127.0.0.1', () => {
    expect(() => assertSafeOutboundUrl('http://127.0.0.1:8080')).toThrow(
      /SSRF_BLOCKED/,
    );
  });

  it('블록: 169.254.169.254 (cloud metadata)', () => {
    expect(() => assertSafeOutboundUrl('http://169.254.169.254/')).toThrow(
      /SSRF_BLOCKED/,
    );
  });

  it('블록: IPv6 ::1', () => {
    expect(() => assertSafeOutboundUrl('http://[::1]/')).toThrow(
      /SSRF_BLOCKED/,
    );
  });

  it('블록: 비-HTTP 프로토콜 (file://)', () => {
    expect(() => assertSafeOutboundUrl('file:///etc/passwd')).toThrow(
      /SSRF_BLOCKED/,
    );
  });

  it('통과: 정상 공개 호스트', () => {
    expect(() =>
      assertSafeOutboundUrl('https://api.github.com/repos'),
    ).not.toThrow();
  });

  it('ALLOW_PRIVATE_HOST_TARGETS=true 일 때는 private 호스트 통과', () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    expect(() => assertSafeOutboundUrl('http://127.0.0.1:8080')).not.toThrow();
  });
});

describe('http-safety — assertSafeOutboundHostResolved (DNS-aware)', () => {
  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    mockedLookup.mockReset();
  });

  it('public hostname 이 public IP 로 resolve 되면 통과', async () => {
    mockedLookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
    ]);
    await expect(
      assertSafeOutboundHostResolved('example.com'),
    ).resolves.toBeUndefined();
  });

  it('DNS rebinding 차단: public hostname 이 private IP 로 resolve 되면 블록', async () => {
    mockedLookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);
    await expect(
      assertSafeOutboundHostResolved('evil.example.com'),
    ).rejects.toThrow(/SSRF_BLOCKED.*10\.0\.0\.5/);
  });

  it('하나라도 private 이면 블록 (multi-A record)', async () => {
    mockedLookup.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(
      assertSafeOutboundHostResolved('mixed.example.com'),
    ).rejects.toThrow(/SSRF_BLOCKED.*127\.0\.0\.1/);
  });

  it('DNS resolve 실패 시 fail-open (어차피 도달 불가)', async () => {
    mockedLookup.mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(
      assertSafeOutboundHostResolved('nonexistent.invalid'),
    ).resolves.toBeUndefined();
  });

  it('hostname literal 차단 (DNS lookup 호출 전)', async () => {
    await expect(assertSafeOutboundHostResolved('127.0.0.1')).rejects.toThrow(
      /SSRF_BLOCKED/,
    );
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('ALLOW_PRIVATE_HOST_TARGETS=true 면 DNS lookup 도 스킵', async () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    await expect(
      assertSafeOutboundHostResolved('127.0.0.1'),
    ).resolves.toBeUndefined();
    expect(mockedLookup).not.toHaveBeenCalled();
  });
});

describe('http-safety — isBlockedHostname', () => {
  it('각 private CIDR 대표 IP 블록', () => {
    for (const ip of [
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
    ]) {
      expect(isBlockedHostname(ip)).toBe(true);
    }
  });

  it('public IP 는 통과', () => {
    for (const ip of [
      '93.184.216.34',
      '8.8.8.8',
      '172.32.0.1', // 172.16/12 바로 위
      '169.255.0.1', // 169.254/16 바로 위
    ]) {
      expect(isBlockedHostname(ip)).toBe(false);
    }
  });

  it('IPv6 loopback/link-local/ULA 블록', () => {
    for (const v6 of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12::1']) {
      expect(isBlockedHostname(v6)).toBe(true);
    }
  });

  /**
   * **IPv4-mapped IPv6 는 품은 IPv4 의 대역으로 판정한다.** `http://[::ffff:127.0.0.1]/` 은 127.0.0.1 에만 바인드한 서버에 실제로
   * 닿는다(macOS · `node:24-alpine` 실측) — 표기만 바꾼 루프백 · 메타데이터 우회였다. 모양이 셋이다: URL 이 정규화한 hex 형
   * (`[::ffff:7f00:1]`), 괄호 없는 점 형(DB host 필드 · `dns.lookup` 결과), 줄이지 않은 전체 형.
   */
  it.each([
    ['[::ffff:7f00:1]', '127.0.0.1 (URL 이 정규화한 hex 형)'],
    ['::ffff:7f00:1', '127.0.0.1 (괄호 없는 hex 형)'],
    ['::ffff:127.0.0.1', '127.0.0.1 (점 형 — DB host · dns.lookup)'],
    ['::FFFF:7F00:1', '127.0.0.1 (대문자)'],
    ['0:0:0:0:0:ffff:7f00:1', '127.0.0.1 (전체 형)'],
    ['[::ffff:a9fe:a9fe]', '169.254.169.254 (메타데이터)'],
    ['::ffff:10.0.0.5', '10/8'],
    ['::ffff:6440:1', '100.64.0.1 (CGNAT)'],
    ['::ffff:0.0.0.0', '0.0.0.0/8'],
  ])('IPv4-mapped 블록: %s — %s', (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it.each([
    ['::ffff:808:808', '8.8.8.8'],
    ['::ffff:8.8.8.8', '8.8.8.8 (점 형)'],
    ['[::ffff:5db8:d822]', '93.184.216.34'],
    ['2001:4860:4860::8888', '공인 IPv6'],
  ])('공인 대상은 통과: %s — %s', (host) => {
    expect(isBlockedHostname(host)).toBe(false);
  });
});

describe('http-safety — IPv4-mapped IPv6 가 두 층을 모두 지나지 못한다', () => {
  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    mockedLookup.mockReset();
  });

  it.each([
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/latest/meta-data/',
    'http://[0:0:0:0:0:ffff:a00:1]:5432/',
  ])('리터럴 URL %s → SSRF_BLOCKED', (url) => {
    expect(() => assertSafeOutboundUrl(url)).toThrow(/SSRF_BLOCKED/);
  });

  it('공인 IPv4 를 품은 mapped URL 은 통과 (대조군)', () => {
    expect(() =>
      assertSafeOutboundUrl('http://[::ffff:8.8.8.8]/'),
    ).not.toThrow();
  });

  it('DB host 처럼 괄호 없는 mapped 리터럴 → DNS 조회 전에 막는다', async () => {
    await expect(
      assertSafeOutboundHostResolved('::ffff:127.0.0.1'),
    ).rejects.toThrow(/SSRF_BLOCKED/);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('DNS 가 mapped 주소(AAAA)를 돌려주면 막는다', async () => {
    mockedLookup.mockResolvedValueOnce([
      { address: '::ffff:10.0.0.5', family: 6 },
    ]);
    await expect(
      assertSafeOutboundHostResolved('mapped.example.com'),
    ).rejects.toThrow(/SSRF_BLOCKED/);
  });
});
