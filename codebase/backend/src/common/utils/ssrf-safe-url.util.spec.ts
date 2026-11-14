import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import {
  checkResolvedHostIp,
  checkSsrfSafeUrl,
  DNS_LOOKUP_TIMEOUT_MS,
  embeddedIpv4FromIpv6,
  isNotificationDnsGuardEnabled,
  isPrivateIpv4,
  isPrivateIpv6,
  normalizeIpv6Literal,
  resolvedAddressBlockReason,
  shouldWarnNotificationDnsGuardOff,
} from './ssrf-safe-url.util';

// 발송 직전 DNS 검사는 OS 해석기(`lookup`)를 부른다. 단위 테스트는 실제 DNS 에 닿지 않게 가짜로 바꾸고 해석 결과를
// 테스트마다 정한다. 리터럴 IP 경로는 `lookup` 을 부르지 않는다.
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));
// 검사는 `lookup(host, { all: true })` 오버로드만 쓴다 — `jest.mocked(lookup)` 은 단일 주소 오버로드로 잡혀 배열을 거부한다.
const mockedLookup = lookup as unknown as jest.MockedFunction<
  (hostname: string, options: { all: true }) => Promise<LookupAddress[]>
>;

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
   * 괄호 없는 점 형은 `dns.lookup` 이 IPv6 로 돌려주는 모양이다(발송 직전 DNS rebinding 검사가 이 값을 그대로 넘긴다).
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

  /**
   * 6to4 · NAT64 로컬 접두는 `isPrivateIpv6` 가 따로 본다(아래 「특수 용도 대역」). 이 함수는 MCP 가드(`mcp-client.service.ts`)도
   * 쓰므로 두 대역을 여기서 꺼내면 MCP 의 판정 범위가 함께 바뀐다. MCP 를 맞추는 일은 NERV Task `CLE-T-753725` 의 몫이라 고정한다.
   */
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

/**
 * IANA 특수 용도 대역 가운데 공인 인터넷에서 웹훅 · MCP 서버를 받을 수 없는 대역을 사설 대역과 같이 막는다(NERV Task
 * `CLE-T-W95HND`). 대역마다 양 끝 주소가 막히고, 바로 옆 공인 주소는 통과하는지 함께 고정한다.
 */
describe('특수 용도 대역 (CLE-T-W95HND)', () => {
  const blockedIpv4: Array<[string, string]> = [
    ['192.0.0.0', '192.0.0.0/24 IETF 프로토콜 할당 — 시작'],
    ['192.0.0.170', '192.0.0.0/24 — NAT64 접두 탐색 주소'],
    ['192.0.0.255', '192.0.0.0/24 — 끝'],
    ['198.18.0.0', '198.18.0.0/15 벤치마크 — 시작'],
    ['198.19.255.255', '198.18.0.0/15 — 끝'],
    ['224.0.0.0', '224.0.0.0/4 멀티캐스트 — 시작'],
    ['224.0.0.251', '224.0.0.0/4 — mDNS'],
    ['239.255.255.255', '224.0.0.0/4 — 끝'],
    ['240.0.0.0', '240.0.0.0/4 예약 — 시작'],
    ['255.255.255.255', '240.0.0.0/4 — 제한 브로드캐스트'],
  ];
  const publicIpv4: Array<[string, string]> = [
    ['191.255.255.255', '192.0.0.0/24 바로 앞'],
    ['192.0.1.0', '192.0.0.0/24 바로 뒤'],
    ['198.17.255.255', '198.18.0.0/15 바로 앞'],
    ['198.20.0.0', '198.18.0.0/15 바로 뒤'],
    ['223.255.255.255', '224.0.0.0/4 바로 앞'],
  ];

  it.each(blockedIpv4)('isPrivateIpv4 차단 — %s (%s)', (host) => {
    expect(isPrivateIpv4(host)).toBe(true);
  });

  it.each(publicIpv4)('isPrivateIpv4 통과 — %s (%s)', (host) => {
    expect(isPrivateIpv4(host)).toBe(false);
  });

  it.each(blockedIpv4)('checkSsrfSafeUrl 차단 — %s (%s)', (host) => {
    const r = checkSsrfSafeUrl(`https://${host}/x`);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private IPv4/);
  });

  it.each(publicIpv4)('checkSsrfSafeUrl 통과 — %s (%s)', (host) => {
    expect(checkSsrfSafeUrl(`https://${host}/x`).ok).toBe(true);
  });

  // 10진 정수 · 16진 표기도 URL 파서가 점 표기로 바꾼 뒤 판정한다.
  it.each([
    ['https://3758096385/x', '224.0.0.1'],
    ['https://0xc6120001/x', '198.18.0.1'],
  ])('checkSsrfSafeUrl 차단 — 점 표기가 아닌 IPv4 %s (→ %s)', (url) => {
    expect(checkSsrfSafeUrl(url).ok).toBe(false);
  });

  // 새 IPv4 대역은 IPv6 에 담긴 IPv4 판정에도 그대로 쓰인다.
  it.each([
    ['::ffff:e000:1', 'mapped → 224.0.0.1'],
    ['::ffff:c612:1', 'mapped → 198.18.0.1'],
    ['64:ff9b::c000:aa', 'NAT64 → 192.0.0.170'],
    ['::ffff:ffff:ffff', 'mapped → 255.255.255.255'],
  ])('isPrivateIpv6 차단 — 담긴 IPv4 가 특수 대역 %s (%s)', (host) => {
    expect(isPrivateIpv6(host)).toBe(true);
  });

  const blockedIpv6: Array<[string, string]> = [
    ['fec0::1', 'fec0::/10 옛 site-local — 시작'],
    ['fef0::1', 'fec0::/10 — 가운데'],
    ['feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fec0::/10 — 끝'],
    ['ff00::', 'ff00::/8 멀티캐스트 — 시작'],
    ['ff02::1', 'ff00::/8 — 링크 범위 전체 노드'],
    ['ff05::1:3', 'ff00::/8 — 사이트 범위 DHCP 서버'],
    ['ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'ff00::/8 — 끝'],
  ];
  const publicIpv6: Array<[string, string]> = [
    ['fe7f:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::/10 바로 앞'],
    // 첫 그룹을 문자열 접두가 아니라 16비트 값으로 본다. `fec::1` 은 0x0fec, `ff::1` 은 0x00ff 다.
    ['fec::1', '첫 그룹 0x0fec'],
    ['ff::1', '첫 그룹 0x00ff'],
    ['2001:db8::1', '문서용 IPv6(공인 취급)'],
  ];

  it.each(blockedIpv6)('isPrivateIpv6 차단 — %s (%s)', (host) => {
    expect(isPrivateIpv6(host)).toBe(true);
  });

  it.each(publicIpv6)('isPrivateIpv6 통과 — %s (%s)', (host) => {
    expect(isPrivateIpv6(host)).toBe(false);
  });

  it.each(blockedIpv6)('checkSsrfSafeUrl 차단 — [%s] (%s)', (host) => {
    const r = checkSsrfSafeUrl(`https://[${host}]/x`);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private IPv6/);
  });

  it.each(publicIpv6)('checkSsrfSafeUrl 통과 — [%s] (%s)', (host) => {
    expect(checkSsrfSafeUrl(`https://[${host}]/x`).ok).toBe(true);
  });

  it('대문자 · zone id 가 붙은 표기도 같은 대역으로 본다', () => {
    expect(isPrivateIpv6('FEC0::1')).toBe(true);
    expect(isPrivateIpv6('[FF02::1]')).toBe(true);
    expect(isPrivateIpv6('ff02::1%eth0')).toBe(true);
  });

  /**
   * 6to4(`2002::/16`, RFC 3056)는 IPv4 자리가 둘째 · 셋째 16비트로 고정이라 꺼내서 판정한다. 공인 IPv4 를 품었으면 통과한다.
   * NAT64 로컬 접두(`64:ff9b:1::/48`, RFC 8215)는 운영자가 고른 접두 길이에 따라 IPv4 자리가 달라서(RFC 6052 §2.2) 꺼내지 않고
   * 대역 전체를 막는다. 마지막 32비트에 공인 IPv4 가 있어도 막힌다.
   */
  describe('6to4 · NAT64 로컬 접두', () => {
    const blockedEmbedding: Array<[string, string]> = [
      ['2002:7f00:1::', '6to4 → 127.0.0.1'],
      ['2002:a00:1::1', '6to4 → 10.0.0.1'],
      ['2002:a9fe:a9fe::', '6to4 → 169.254.169.254'],
      [
        '2002:c0a8:101:1:2:3:4:5',
        '6to4 → 192.168.1.1 (서브넷 · 인터페이스 비트가 있어도)',
      ],
      ['2002:e000:fb::', '6to4 → 224.0.0.251'],
      ['2002::1', '6to4 → 0.0.0.0'],
      ['64:ff9b:1::', 'NAT64 로컬 — 시작'],
      ['64:ff9b:1::808:808', 'NAT64 로컬 — 마지막 32비트가 공인 IPv4'],
      ['64:ff9b:1:abcd::1', 'NAT64 로컬 — 중간'],
      ['64:ff9b:1:ffff:ffff:ffff:ffff:ffff', 'NAT64 로컬 — 끝'],
    ];
    const passedEmbedding: Array<[string, string]> = [
      ['2002:808:808::1', '6to4 → 8.8.8.8'],
      // 둘째 · 셋째 16비트의 순서가 바뀌면 10.0.1.1 로 읽혀 막힌다.
      ['2002:101:a00::', '6to4 → 1.1.10.0 (hi/lo 비대칭)'],
      ['2001:ffff:ffff:ffff:ffff:ffff:ffff:ffff', '2002::/16 바로 앞'],
      ['2003::1', '2002::/16 바로 뒤'],
      ['64:ff9b:0:ffff:ffff:ffff:ffff:ffff', '64:ff9b:1::/48 바로 앞'],
      ['64:ff9b:2::', '64:ff9b:1::/48 바로 뒤'],
      ['64:ff9b::808:808', 'NAT64 well-known /96 → 8.8.8.8'],
    ];

    it.each(blockedEmbedding)('isPrivateIpv6 차단 — %s (%s)', (host) => {
      expect(isPrivateIpv6(host)).toBe(true);
    });

    it.each(passedEmbedding)('isPrivateIpv6 통과 — %s (%s)', (host) => {
      expect(isPrivateIpv6(host)).toBe(false);
    });

    it.each(blockedEmbedding)('checkSsrfSafeUrl 차단 — [%s] (%s)', (host) => {
      const r = checkSsrfSafeUrl(`https://[${host}]/x`);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/private IPv6/);
    });

    it.each(passedEmbedding)('checkSsrfSafeUrl 통과 — [%s] (%s)', (host) => {
      expect(checkSsrfSafeUrl(`https://[${host}]/x`).ok).toBe(true);
    });

    it('대문자 · 대괄호 표기도 같은 대역으로 본다', () => {
      expect(isPrivateIpv6('2002:7F00:1::')).toBe(true);
      expect(isPrivateIpv6('[64:FF9B:1::1]')).toBe(true);
    });
  });

  describe('발송 직전 검사(checkResolvedHostIp)', () => {
    beforeEach(() => {
      mockedLookup.mockReset();
    });

    it.each([
      ['192.0.0.170', 4],
      ['198.18.0.1', 4],
      ['224.0.0.251', 4],
      ['255.255.255.255', 4],
      ['fec0::1', 6],
      ['ff02::1', 6],
      ['2002:a9fe:a9fe::1', 6],
      ['64:ff9b:1::808:808', 6],
    ])('도메인이 특수 대역 %s 로 풀리면 ok:false', async (address, family) => {
      mockedLookup.mockResolvedValue([{ address, family }]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r.ok).toBe(false);
      expect(r.reason).toContain(address);
    });

    it.each([
      ['192.0.1.0', 4],
      ['198.20.0.0', 4],
      ['223.255.255.255', 4],
      ['fe7f::1', 6],
      ['2002:808:808::1', 6],
      ['64:ff9b:2::1', 6],
    ])(
      '도메인이 바로 옆 공인 주소 %s 로 풀리면 ok:true',
      async (address, family) => {
        mockedLookup.mockResolvedValue([{ address, family }]);
        const r = await checkResolvedHostIp('hooks.example.com');
        expect(r).toEqual({ ok: true });
      },
    );

    it.each([
      '198.19.0.1',
      '[ff02::1]',
      '[fec0::1]',
      '[2002:7f00:1::]',
      '[64:ff9b:1::1]',
    ])('리터럴 %s → ok:false (DNS 를 묻지 않는다)', async (host) => {
      const r = await checkResolvedHostIp(host);
      expect(r.ok).toBe(false);
      expect(mockedLookup).not.toHaveBeenCalled();
    });
  });
});

describe('checkResolvedHostIp — DNS rebinding 방어 [Spec EIA §8.1]', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

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

  it('리터럴 IP 는 DNS 를 묻지 않는다', async () => {
    await checkResolvedHostIp('8.8.8.8');
    await checkResolvedHostIp('[::ffff:7f00:1]');
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  // CLE-T-M1P83C — 도메인은 fetch 와 같은 OS 해석기(`lookup`)로 푼다. `/etc/hosts` · 검색 도메인도 fetch 가 실제로
  // 닿는 주소와 같게 본다.
  describe('도메인 해석 결과 검사 (lookup)', () => {
    it('lookup 을 { all: true } 로 한 번 부른다', async () => {
      mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r).toEqual({ ok: true });
      expect(mockedLookup).toHaveBeenCalledTimes(1);
      expect(mockedLookup).toHaveBeenCalledWith('hooks.example.com', {
        all: true,
      });
    });

    it.each([
      ['10.0.0.5', 4],
      ['127.0.0.1', 4],
      ['169.254.169.254', 4],
      ['172.17.0.2', 4],
      ['100.64.0.1', 4],
    ])('사설 IPv4 %s 로 풀리면 ok:false', async (address, family) => {
      mockedLookup.mockResolvedValue([{ address, family }]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r.ok).toBe(false);
      expect(r.reason).toContain(address);
    });

    it.each([
      ['::1', 6],
      ['fd00::1', 6],
      ['fe80::1', 6],
      ['::ffff:127.0.0.1', 6],
      ['64:ff9b::a00:1', 6],
    ])('사설 IPv6 %s 로 풀리면 ok:false', async (address, family) => {
      mockedLookup.mockResolvedValue([{ address, family }]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r.ok).toBe(false);
      expect(r.reason).toContain(address);
    });

    it('주소 하나라도 사설이면 ok:false (공인 · 사설 섞임)', async () => {
      mockedLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::1', family: 6 },
        { address: '10.1.2.3', family: 4 },
      ]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('10.1.2.3');
    });

    it('공인 IPv4 · IPv6 만이면 ok:true', async () => {
      mockedLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::1', family: 6 },
      ]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r).toEqual({ ok: true });
    });

    it('해석 실패(ENOTFOUND)는 ok:true — fail-open', async () => {
      mockedLookup.mockRejectedValue(
        Object.assign(new Error('getaddrinfo ENOTFOUND'), {
          code: 'ENOTFOUND',
        }),
      );
      const r = await checkResolvedHostIp('nowhere.example.invalid');
      expect(r).toEqual({ ok: true });
    });

    it('해석 결과가 비면 ok:true', async () => {
      mockedLookup.mockResolvedValue([]);
      const r = await checkResolvedHostIp('hooks.example.com');
      expect(r).toEqual({ ok: true });
    });
  });
});

describe('isNotificationDnsGuardEnabled (CLE-T-M1P83C)', () => {
  const env = (
    nodeEnv: string | undefined,
    value: string | undefined,
  ): NodeJS.ProcessEnv => {
    const e: NodeJS.ProcessEnv = {};
    if (nodeEnv !== undefined) e.NODE_ENV = nodeEnv;
    if (value !== undefined) e.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD = value;
    return e;
  };

  // 운영은 기본으로 켠다. 정확히 '0' 일 때만 끈다 — 오타 · 다른 표기로 꺼지지 않게 한다.
  it.each([undefined, '1', '', 'false', 'off', ' 0', '0 ', 'no'])(
    'production 에서 값 %p 이면 켜진다',
    (value) => {
      expect(isNotificationDnsGuardEnabled(env('production', value))).toBe(
        true,
      );
    },
  );

  it('production 에서 정확히 "0" 이면 꺼진다', () => {
    expect(isNotificationDnsGuardEnabled(env('production', '0'))).toBe(false);
  });

  // 운영 밖은 기본으로 끈다. 정확히 '1' 일 때만 켠다(지금까지의 opt-in 규칙).
  it.each(['development', 'test', undefined])(
    'NODE_ENV=%p 에서 정확히 "1" 이면 켜진다',
    (nodeEnv) => {
      expect(isNotificationDnsGuardEnabled(env(nodeEnv, '1'))).toBe(true);
    },
  );

  it.each([undefined, '0', 'true', '', ' 1'])(
    'production 밖에서 값 %p 이면 꺼진다',
    (value) => {
      expect(isNotificationDnsGuardEnabled(env('test', value))).toBe(false);
    },
  );

  it('인자를 주지 않으면 process.env 를 읽는다', () => {
    const origNode = process.env.NODE_ENV;
    const origFlag = process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD;
      expect(isNotificationDnsGuardEnabled()).toBe(true);
      process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD = '0';
      expect(isNotificationDnsGuardEnabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = origNode;
      if (origFlag === undefined)
        delete process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD;
      else process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD = origFlag;
    }
  });
});

describe('shouldWarnNotificationDnsGuardOff (CLE-T-M1P83C)', () => {
  it('production 에서 정확히 "0" 이면 경고한다', () => {
    expect(
      shouldWarnNotificationDnsGuardOff({
        NODE_ENV: 'production',
        NOTIFICATION_ENFORCE_DNS_REBIND_GUARD: '0',
      }),
    ).toBe(true);
  });

  it.each([
    ['production', undefined],
    ['production', '1'],
    ['production', 'false'],
    ['test', '0'],
    ['development', undefined],
  ])('NODE_ENV=%s · 값 %p 이면 경고하지 않는다', (nodeEnv, value) => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: nodeEnv };
    if (value !== undefined) env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD = value;
    expect(shouldWarnNotificationDnsGuardOff(env)).toBe(false);
  });
});

describe('checkResolvedHostIp — 조회 타임아웃', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('조회가 끝나지 않으면 제한 시간 뒤 fail-open 으로 통과시키고 사유를 남긴다', async () => {
    mockedLookup.mockReturnValue(new Promise<LookupAddress[]>(() => {}));
    let settled = false;
    const pending = checkResolvedHostIp('example.com').then((r) => {
      settled = true;
      return r;
    });
    // 경계 — 제한 시간 1ms 전에는 아직 끝나지 않는다.
    await jest.advanceTimersByTimeAsync(DNS_LOOKUP_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    const r = await pending;
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/timed out/);
  });

  // 늦은 거부가 처리되지 않으면 Jest(jest-circus)가 실제 process 에 단 처리기로 받아 이 테스트를 실패시킨다. 판별은
  // 이 경로가 한다. `Promise.race` 를 처리기 없는 `then` 으로 바꾼 뮤턴트로 이 테스트가 실패하는 것을 확인했다.
  // 테스트 파일의 `process` 는 Jest 가 만든 사본이라 아래 리스너에는 그 거부가 닿지 않는다(같은 뮤턴트에서 0건).
  // 리스너 단언은 보조로만 둔다(channel-listener.bus.spec.ts 의 같은 설명 참고).
  // Node 는 마이크로태스크 큐가 빈 뒤에야 처리되지 않은 거부를 알린다. 마이크로태스크만 흘리면 거부가 테스트가 끝난
  // 뒤에 알려져 Jest 프로세스가 통째로 죽는다(같은 뮤턴트로 확인). 그래서 늦은 거부 뒤에 실제 타이머로 돌아가
  // setImmediate 를 한 번 기다린다(가짜 타이머는 setImmediate 도 막는다).
  it('제한 시간이 먼저 지난 뒤 lookup 이 거부해도 처리되지 않은 거부가 남지 않는다', async () => {
    let rejectLate: (err: Error) => void = () => undefined;
    mockedLookup.mockReturnValue(
      new Promise<LookupAddress[]>((_resolve, reject) => {
        rejectLate = reject;
      }),
    );
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const pending = checkResolvedHostIp('example.com');
      await jest.advanceTimersByTimeAsync(DNS_LOOKUP_TIMEOUT_MS);
      const r = await pending;
      expect(r.ok).toBe(true);
      expect(r.reason).toMatch(/timed out/);

      jest.useRealTimers();
      rejectLate(
        Object.assign(new Error('getaddrinfo ETIMEOUT'), { code: 'ETIMEOUT' }),
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('제한 시간 안에 끝나면 타이머를 지운다', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const r = await checkResolvedHostIp('example.com');
    expect(r.ok).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});

// 발송 직전 검사와 연결 시점 판정(CLE-T-GAQCF9)이 같은 판정과 사유 문구를 쓴다. 차단 사유 문구에 기대는 degraded 메시지
// (`DNS rebinding 차단: …`)가 어느 쪽에서 막혀도 같은 모양이 되게 한다.
describe('resolvedAddressBlockReason', () => {
  it.each([
    [
      '10.0.0.5',
      'resolved IPv4 10.0.0.5 falls in a private/loopback/metadata range',
    ],
    [
      '169.254.169.254',
      'resolved IPv4 169.254.169.254 falls in a private/loopback/metadata range',
    ],
    ['::1', 'resolved IPv6 ::1 falls in a private range'],
    ['::ffff:7f00:1', 'resolved IPv6 ::ffff:7f00:1 falls in a private range'],
  ])('막힌 대역 %s 는 사유를 돌려준다', (address, reason) => {
    expect(resolvedAddressBlockReason(address)).toBe(reason);
  });

  it.each(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])(
    '공인 주소 %s 는 null 이다',
    (address) => {
      expect(resolvedAddressBlockReason(address)).toBeNull();
    },
  );

  it('checkResolvedHostIp 의 거부 사유와 같은 문구다', async () => {
    mockedLookup.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);

    await expect(checkResolvedHostIp('hook.example.com')).resolves.toEqual({
      ok: false,
      reason: resolvedAddressBlockReason('10.0.0.5'),
    });
  });
});
