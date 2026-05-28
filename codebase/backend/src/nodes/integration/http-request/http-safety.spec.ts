import { lookup } from 'node:dns/promises';
import {
  assertSafeOutboundHostResolved,
  assertSafeOutboundUrl,
  isBlockedHostname,
} from './http-safety';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const mockedLookup = jest.mocked(lookup);

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
});
