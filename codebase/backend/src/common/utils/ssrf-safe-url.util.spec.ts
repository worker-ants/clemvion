import {
  checkSsrfSafeUrl,
  embeddedIpv4FromIpv6,
  isPrivateIpv4,
  isPrivateIpv6,
  normalizeIpv6Literal,
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
    // 앞 16비트와 뒤 16비트가 달라서 둘을 바꿔 읽으면 다른 IPv4 가 되는 값. 바꿔 읽으면 `1.1.192.168` 처럼 공인으로 남는다.
    ['https://[::ffff:c0a8:101]/x', 'mapped → 192.168.1.1 (hi/lo 비대칭)'],
    ['https://[::ffff:ac10:505]/x', 'mapped → 172.16.5.5 (hi/lo 비대칭)'],
    ['https://[::ffff:a01:203]/x', 'mapped → 10.1.2.3 (hi/lo 비대칭)'],
    ['https://[::c0a8:101]/x', 'IPv4-compatible → 192.168.1.1 (hi/lo 비대칭)'],
    ['https://[::ffff:0:c0a8:101]/x', 'SIIT → 192.168.1.1 (hi/lo 비대칭)'],
    ['https://[64:ff9b::c0a8:101]/x', 'NAT64 → 192.168.1.1 (hi/lo 비대칭)'],
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
    // `1.1.10.0` 은 공인이고 앞뒤를 바꿔 읽은 `10.0.1.1` 은 사설이다. 변환 순서가 뒤집히면 이 줄이 막힌다.
    ['https://[::ffff:101:a00]/x', 'mapped → 1.1.10.0 (hi/lo 비대칭)'],
    ['https://[::101:a00]/x', 'IPv4-compatible → 1.1.10.0 (hi/lo 비대칭)'],
    ['https://[::ffff:0:101:a00]/x', 'SIIT → 1.1.10.0 (hi/lo 비대칭)'],
    ['https://[64:ff9b::101:a00]/x', 'NAT64 → 1.1.10.0 (hi/lo 비대칭)'],
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
    ['::ffff:c0a8:101', 'mapped → 192.168.1.1 (hi/lo 비대칭)'],
    ['::ffff:192.168.1.1', 'mapped 점 형 → 192.168.1.1'],
  ])('isPrivateIpv6 — %s (%s)', (host) => {
    expect(isPrivateIpv6(host)).toBe(true);
  });

  it.each([
    ['::ffff:101:a00', 'mapped → 1.1.10.0'],
    ['::ffff:1.1.10.0', 'mapped 점 형 → 1.1.10.0'],
  ])('isPrivateIpv6 — 공인 %s (%s)', (host) => {
    expect(isPrivateIpv6(host)).toBe(false);
  });

  /**
   * 품은 IPv4 의 hi/lo 16비트 순서를 직접 고정한다. 앞뒤가 같은 값이나 하위 16비트가 0 인 값으로는 순서가 바뀌어도 판정이
   * 같아서 위 판정 표만으로는 이 변환의 회귀를 잡지 못한다.
   */
  it.each([
    ['::ffff:c0a8:101', '192.168.1.1'],
    ['::ffff:ac10:505', '172.16.5.5'],
    ['::ffff:a01:203', '10.1.2.3'],
    ['::ffff:101:a00', '1.1.10.0'],
    ['::c0a8:101', '192.168.1.1'],
    ['::ffff:0:c0a8:101', '192.168.1.1'],
    ['64:ff9b::c0a8:101', '192.168.1.1'],
    ['64:ff9b::101:a00', '1.1.10.0'],
    ['0:0:0:0:0:ffff:c0a8:101', '192.168.1.1'],
  ])('embeddedIpv4FromIpv6 — %s → %s', (host, expected) => {
    expect(embeddedIpv4FromIpv6(host)).toBe(expected);
  });

  it.each([
    ['2002:c0a8:101::', '6to4'],
    ['64:ff9b:1::c0a8:101', 'NAT64 로컬 접두'],
    ['2001:db8::1', '공인 IPv6'],
    ['fe80::1', 'link-local'],
  ])('embeddedIpv4FromIpv6 — /96 표기가 아니면 null: %s (%s)', (host) => {
    expect(embeddedIpv4FromIpv6(host)).toBeNull();
  });

  /**
   * export 된 함수가 "정규화된 입력" 이라는 전제에 기대지 않는다. 정규화되지 않은 입력에서 `parseInt` 가 앞쪽 16진수만 읽으면
   * 점 표기 `::ffff:127.0.0.1` 이 `255.255.1.39` 로 읽혀 공인으로 보인다. 틀린 IPv4 를 돌려주는 대신 null 이다.
   */
  it.each([
    ['::ffff:127.0.0.1', '점 표기'],
    ['::127.0.0.1', 'IPv4-compatible 점 표기'],
    ['64:ff9b::169.254.169.254', 'NAT64 점 표기'],
    ['::FFFF:7F00:1', '대문자'],
    ['[::ffff:7f00:1]', '대괄호'],
    ['::ffff:7f00:1%eth0', 'zone id'],
    ['::ffff:12345:1', '5자리 그룹'],
    ['::ffff:7f00:zz', '16진수가 아닌 그룹'],
    ['::ffff:7f00:', '빈 그룹'],
    ['0:0:0:0:0:ffff:7f00', '그룹 7개'],
    ['0:0:0:0:0:0:ffff:7f00:1', '그룹 9개'],
    ['::1::2', '`::` 둘'],
    [':::', '`:` 셋'],
    ['1:2:3:4:5:6:7::8:9', '`::` 가 줄일 자리가 없다'],
    ['1:2:3:4:5:6:7::8', '`::` 가 0 그룹을 줄인다'],
    ['', '빈 문자열'],
    ['example.com', '호스트 이름'],
  ])('embeddedIpv4FromIpv6 — 정규화되지 않은 입력은 null: %s (%s)', (host) => {
    expect(embeddedIpv4FromIpv6(host)).toBeNull();
  });

  it('normalizeIpv6Literal 을 거친 값은 점 표기 입력도 같은 IPv4 를 돌려준다', () => {
    const normalized = normalizeIpv6Literal('::ffff:192.168.1.1');
    expect(normalized).toBe('::ffff:c0a8:101');
    expect(embeddedIpv4FromIpv6(normalized as string)).toBe('192.168.1.1');
  });

  it('zone id 가 붙은 link-local 도 사설로 본다', () => {
    expect(isPrivateIpv6('fe80::1%eth0')).toBe(true);
  });

  it('`:` 가 없는 문자열은 IPv6 리터럴이 아니라서 사설로 보지 않는다', () => {
    expect(isPrivateIpv6('fcbar.example.com')).toBe(false);
  });

  it('URL 파서가 거부하는 IPv6 문자열은 사설로 보지 않는다', () => {
    expect(isPrivateIpv6('fe80:::1')).toBe(false);
  });

  /**
   * 파서에 넘기기 전에 문자 집합(`/^[0-9a-fA-F:.]+$/`)을 묶는 가드를 고정한다. 가드가 없으면 `::1]@xfd.example/` 이
   * `http://[::1]@xfd.example//]/` 로 읽혀 hostname 이 `xfd.example` 이 되고, `slice(1, -1)` 로 잘린 `fd.exampl` 이 ULA(`fd`)
   * 접두로 보여 true 가 된다. 가드가 있으면 null 이라 false 다. 입력 끝이 `evil.example` 처럼 사설 접두가 아니면 가드가 없어도
   * false 가 되어 이 가드를 고정하지 못한다.
   */
  it('문자 집합 가드: `]` · `@` · `/` 가 섞인 문자열은 다른 URL 로 읽히지 않는다', () => {
    expect(isPrivateIpv6('::1]@xfd.example/')).toBe(false);
    expect(normalizeIpv6Literal('::1]@xfd.example/')).toBeNull();
  });

  /**
   * `ALLOW_PRIVATE_HOST_TARGETS` 는 HTTP Request · Database Query · Send Email 통합 노드의 가드(`http-safety.ts`) 전용이다.
   * 알림 웹훅 가드(`checkSsrfSafeUrl`)는 이 플래그를 읽지 않고 사설망 허용 우회 플래그도 없다. `ALLOW_HTTP_HOOKS` 는
   * `http:` 스킴만 연다.
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
    '[::ffff:c0a8:101]',
  ])('IPv4 를 품은 IPv6 리터럴 %s → ok:false', async (host) => {
    const r = await checkResolvedHostIp(host);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private/);
  });

  it('공인 IPv4 를 품은 IPv6 리터럴 [::ffff:101:a00] → ok:true', async () => {
    const r = await checkResolvedHostIp('[::ffff:101:a00]');
    expect(r.ok).toBe(true);
  });
});
