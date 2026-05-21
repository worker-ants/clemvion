import {
  checkSsrfSafeUrl,
  isPrivateIpv4,
  isPrivateIpv6,
} from './ssrf-safe-url.util';

describe('checkSsrfSafeUrl', () => {
  const ORIG_ENV = process.env.ALLOW_HTTP_HOOKS;
  afterEach(() => {
    if (ORIG_ENV === undefined) delete process.env.ALLOW_HTTP_HOOKS;
    else process.env.ALLOW_HTTP_HOOKS = ORIG_ENV;
  });

  it('통과 — https + public hostname', () => {
    const r = checkSsrfSafeUrl('https://customer.example.com/webhook');
    expect(r.ok).toBe(true);
  });

  it('차단 — 빈 문자열 / 비-문자열', () => {
    expect(checkSsrfSafeUrl('').ok).toBe(false);
    expect(checkSsrfSafeUrl(undefined).ok).toBe(false);
    expect(checkSsrfSafeUrl(123 as unknown).ok).toBe(false);
  });

  it('차단 — 형식 invalid', () => {
    expect(checkSsrfSafeUrl('not-a-url').ok).toBe(false);
    expect(checkSsrfSafeUrl('http://').ok).toBe(false);
  });

  it('차단 — http (ALLOW_HTTP_HOOKS 미설정)', () => {
    delete process.env.ALLOW_HTTP_HOOKS;
    const r = checkSsrfSafeUrl('http://customer.example.com/x');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/https/);
  });

  it('통과 — http 가 ALLOW_HTTP_HOOKS=1 일 때', () => {
    process.env.ALLOW_HTTP_HOOKS = '1';
    const r = checkSsrfSafeUrl('http://customer.example.com/x');
    expect(r.ok).toBe(true);
  });

  it('통과 — opts.allowHttp 명시', () => {
    delete process.env.ALLOW_HTTP_HOOKS;
    const r = checkSsrfSafeUrl('http://customer.example.com/x', {
      allowHttp: true,
    });
    expect(r.ok).toBe(true);
  });

  it('차단 — 그 외 protocol (ftp / file / javascript)', () => {
    expect(checkSsrfSafeUrl('ftp://customer.example.com/x').ok).toBe(false);
    expect(checkSsrfSafeUrl('file:///etc/passwd').ok).toBe(false);
    expect(checkSsrfSafeUrl('javascript:alert(1)').ok).toBe(false);
  });

  describe('hostname 사설/loopback 차단', () => {
    const blocked: string[] = [
      'https://localhost/x',
      'https://0.0.0.0/x',
      'https://127.0.0.1/x',
      'https://10.0.0.1/x',
      'https://10.255.255.255/x',
      'https://172.16.0.1/x',
      'https://172.31.255.255/x',
      'https://192.168.1.1/x',
      'https://169.254.169.254/latest/meta-data/', // AWS metadata
      'https://100.64.0.1/x', // CGNAT
      'https://[::1]/x',
      'https://[fe80::1]/x',
      'https://[fc00::1]/x',
      'https://[fd00::1]/x',
    ];
    test.each(blocked)('차단 — %s', (url) => {
      const r = checkSsrfSafeUrl(url);
      expect(r.ok).toBe(false);
    });
  });

  describe('hostname 통과 — public IP / domain', () => {
    const ok: string[] = [
      'https://example.com/x',
      'https://8.8.8.8/x',
      'https://172.15.0.1/x', // 172.16/12 의 직전 — public
      'https://172.32.0.1/x', // 172.16/12 의 직후 — public
      'https://172.33.0.1/x',
      'https://100.63.0.1/x', // 100.64/10 직전
      'https://[2001:db8::1]/x', // documentation IPv6 (사실상 public 영역으로 취급)
    ];
    test.each(ok)('통과 — %s', (url) => {
      const r = checkSsrfSafeUrl(url);
      expect(r.ok).toBe(true);
    });
  });
});

describe('isPrivateIpv4 / isPrivateIpv6 unit', () => {
  it('IPv4 boundary', () => {
    expect(isPrivateIpv4('10.0.0.0')).toBe(true);
    expect(isPrivateIpv4('10.255.255.255')).toBe(true);
    expect(isPrivateIpv4('11.0.0.0')).toBe(false);
    expect(isPrivateIpv4('172.16.0.0')).toBe(true);
    expect(isPrivateIpv4('172.31.255.255')).toBe(true);
    expect(isPrivateIpv4('172.32.0.0')).toBe(false);
    expect(isPrivateIpv4('192.168.0.0')).toBe(true);
    expect(isPrivateIpv4('192.169.0.0')).toBe(false);
    expect(isPrivateIpv4('169.254.0.1')).toBe(true);
    expect(isPrivateIpv4('example.com')).toBe(false);
  });

  it('IPv6 patterns', () => {
    expect(isPrivateIpv6('::1')).toBe(true);
    expect(isPrivateIpv6('::')).toBe(true);
    expect(isPrivateIpv6('fe80::1')).toBe(true);
    expect(isPrivateIpv6('fc00::1')).toBe(true);
    expect(isPrivateIpv6('fd12::1')).toBe(true);
    expect(isPrivateIpv6('2001:db8::1')).toBe(false);
    expect(isPrivateIpv6('not-ipv6')).toBe(false);
  });
});

describe('checkResolvedHostIp — DNS rebinding 방어 [Spec EIA §8.1]', () => {
  // 본 테스트는 DNS resolve mock 없이 literal IP 경로만 검증. 실제 도메인 resolve 는 e2e 또는
  // 통합 환경에서 검증 — unit 에서는 결정성 위해 literal 경로만.
  const { checkResolvedHostIp } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./ssrf-safe-url.util') as typeof import('./ssrf-safe-url.util');

  it('빈 hostname → ok:false', async () => {
    const r = await checkResolvedHostIp('');
    expect(r.ok).toBe(false);
  });

  it('literal IPv4 public → ok:true', async () => {
    const r = await checkResolvedHostIp('8.8.8.8');
    expect(r.ok).toBe(true);
  });

  it('literal IPv4 private → ok:false', async () => {
    const r = await checkResolvedHostIp('192.168.0.1');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private/);
  });

  it('literal IPv4 metadata (169.254.169.254) → ok:false', async () => {
    const r = await checkResolvedHostIp('169.254.169.254');
    expect(r.ok).toBe(false);
  });

  it('literal IPv6 private (::1) → ok:false', async () => {
    const r = await checkResolvedHostIp('::1');
    expect(r.ok).toBe(false);
  });

  it('literal IPv6 public (2001:db8::1) → ok:true', async () => {
    const r = await checkResolvedHostIp('2001:db8::1');
    expect(r.ok).toBe(true);
  });
});
