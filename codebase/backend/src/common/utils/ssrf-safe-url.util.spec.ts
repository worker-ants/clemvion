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

/**
 * IPv4 를 품은 IPv6 리터럴은 품은 IPv4 로 판정한다(NERV Task `CLE-T-DCQWEB`). Node 의 URL 은 `https://[::ffff:127.0.0.1]/` 의
 * hostname 을 `[::ffff:7f00:1]` 로 바꾸고, IPv4-mapped 주소는 IPv4 대상에 그대로 닿는다. 그래서 점 형만 보는 검사는
 * loopback · 메타데이터 주소를 지나보냈다. 마지막 32비트에 IPv4 를 싣는 /96 표기 넷(mapped · compatible · SIIT · NAT64)을 본다.
 */
describe('IPv4 를 품은 IPv6 리터럴', () => {
  const blockedUrls: Array<[string, string]> = [
    ['https://[::ffff:127.0.0.1]/x', 'mapped 점 형 → 127.0.0.1'],
    ['https://[::ffff:7f00:1]/x', 'mapped hex 형 → 127.0.0.1'],
    ['https://[0:0:0:0:0:ffff:7f00:1]/x', 'mapped 전체 형 → 127.0.0.1'],
    [
      'https://[::FFFF:A9FE:A9FE]/latest/meta-data/',
      'mapped 대문자 → 169.254.169.254',
    ],
    ['https://[::ffff:10.0.0.5]/x', 'mapped → 10/8'],
    ['https://[::ffff:6440:1]/x', 'mapped → 100.64.0.1 (CGNAT)'],
    ['https://[::127.0.0.1]/x', 'IPv4-compatible → 127.0.0.1'],
    ['https://[::a9fe:a9fe]/x', 'IPv4-compatible → 169.254.169.254'],
    ['https://[::ffff:0:7f00:1]/x', 'SIIT → 127.0.0.1'],
    ['https://[64:ff9b::169.254.169.254]/x', 'NAT64 점 형 → 169.254.169.254'],
    ['https://[64:ff9b::a00:1]/x', 'NAT64 → 10.0.0.1'],
    ['https://[64:ff9b::1]/x', 'NAT64 줄인 형 → 0.0.0.1 (0/8)'],
  ];
  test.each(blockedUrls)('checkSsrfSafeUrl 차단 — %s (%s)', (url) => {
    const r = checkSsrfSafeUrl(url);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private IPv6/);
  });

  const publicUrls: Array<[string, string]> = [
    ['https://[::ffff:8.8.8.8]/x', 'mapped → 8.8.8.8'],
    ['https://[::ffff:5db8:d822]/x', 'mapped → 93.184.216.34'],
    ['https://[::808:808]/x', 'IPv4-compatible → 8.8.8.8'],
    ['https://[64:ff9b::808:808]/x', 'NAT64 → 8.8.8.8'],
    ['https://[2001:4860:4860::8888]/x', '공인 IPv6'],
  ];
  test.each(publicUrls)('checkSsrfSafeUrl 통과 — %s (%s)', (url) => {
    expect(checkSsrfSafeUrl(url).ok).toBe(true);
  });

  /**
   * 품은 IPv4 의 자리가 다르거나 접두가 다른 표기는 판정하지 않는다(6to4 `2002::/16` 은 둘째 · 셋째 16비트, NAT64 로컬 접두
   * `64:ff9b:1::/48` 은 접두 길이에 따라 자리가 바뀐다). 판정 범위를 넓히는 변경이 이 경계를 조용히 옮기지 못하게 고정한다.
   */
  it.each([
    ['2002:7f00:1::', '6to4 2002:7f00:1::'],
    ['64:ff9b:1::7f00:1', 'NAT64 로컬 접두 64:ff9b:1::/48'],
  ])('/96 표기가 아니면 품은 IPv4 로 보지 않는다(현 정책): %s — %s', (host) => {
    expect(isPrivateIpv6(host)).toBe(false);
  });

  /**
   * 괄호 없는 점 형은 `dns.resolve6` 가 돌려주는 모양이다(발송 직전 DNS rebinding 검사가 이 값을 그대로 넘긴다).
   */
  it.each([
    ['::ffff:127.0.0.1', '점 형'],
    ['::ffff:7f00:1', 'hex 형'],
    ['[::ffff:a9fe:a9fe]', '괄호 있는 hex 형'],
    ['::FFFF:7F00:1', '대문자'],
    ['0:0:0:0:0:ffff:a00:5', '전체 형 → 10.0.0.5'],
    ['::7f00:1', 'IPv4-compatible'],
    ['::ffff:0:a9fe:a9fe', 'SIIT'],
    ['64:ff9b::7f00:1', 'NAT64'],
  ])('isPrivateIpv6 — %s (%s)', (host) => {
    expect(isPrivateIpv6(host)).toBe(true);
  });

  it('zone id 가 붙은 link-local 도 사설로 본다', () => {
    expect(isPrivateIpv6('fe80::1%eth0')).toBe(true);
  });

  it('IPv6 리터럴이 아닌 문자열은 사설로 보지 않는다', () => {
    expect(isPrivateIpv6('fcbar.example.com')).toBe(false);
    expect(isPrivateIpv6('fe80:::1')).toBe(false);
    // 파서에 넘기기 전에 문자 집합을 묶어서 다른 URL 로 읽히지 않는다.
    expect(isPrivateIpv6('::1]@evil.example/')).toBe(false);
  });

  /**
   * 통합 노드의 사설망 허용 플래그는 알림 웹훅 가드에 적용되지 않는다(CLE-EIA-NOTIFY 「SSRF 방지」, 우회 수단은 `ALLOW_HTTP_HOOKS` 뿐).
   */
  it('ALLOW_PRIVATE_HOST_TARGETS=true 여도 mapped 리터럴을 막는다', () => {
    const orig = process.env.ALLOW_PRIVATE_HOST_TARGETS;
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    try {
      expect(checkSsrfSafeUrl('https://[::ffff:7f00:1]/x').ok).toBe(false);
    } finally {
      if (orig === undefined) delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
      else process.env.ALLOW_PRIVATE_HOST_TARGETS = orig;
    }
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

  // 발송 직전 검사는 `new URL(url).hostname` 을 넘긴다 — mapped 리터럴은 괄호 있는 hex 형으로 온다.
  it.each([
    '[::ffff:7f00:1]',
    '::ffff:127.0.0.1',
    '[::ffff:a9fe:a9fe]',
    '[64:ff9b::a00:1]',
  ])('IPv4 를 품은 IPv6 리터럴 %s → ok:false', async (host) => {
    const r = await checkResolvedHostIp(host);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private/);
  });
});
