import {
  classifyIpLiteral,
  embeddedIpv4FromIpv6,
  isBlockedIpLiteral,
  normalizeIpv6Literal,
} from './ip-classifier';

/**
 * SSRF 가드 네 벌이 함께 쓰는 IP 리터럴 판정(NERV Task `CLE-T-753725`). 대역마다 양 끝 주소가 막히고 바로 옆 공인 주소는
 * 통과하는지 고정한다. 래퍼(통합 노드 · 알림 웹훅 · MCP · LLM 엔드포인트)의 우회 플래그 · 호스트 이름 목록은 각 래퍼 테스트가 본다.
 */
describe('classifyIpLiteral — IPv4 대역', () => {
  const blocked: Array<[string, string]> = [
    ['0.0.0.0', '0.0.0.0/8 — 시작'],
    ['0.255.255.255', '0.0.0.0/8 — 끝'],
    ['10.0.0.0', '10.0.0.0/8 — 시작'],
    ['10.255.255.255', '10.0.0.0/8 — 끝'],
    ['100.64.0.0', '100.64.0.0/10 CGNAT — 시작'],
    ['100.127.255.255', '100.64.0.0/10 CGNAT — 끝'],
    ['127.0.0.1', '127.0.0.0/8 loopback'],
    ['127.255.255.255', '127.0.0.0/8 — 끝'],
    ['169.254.0.0', '169.254.0.0/16 link-local — 시작'],
    ['169.254.169.254', '169.254.0.0/16 — 클라우드 메타데이터'],
    ['169.254.255.255', '169.254.0.0/16 — 끝'],
    ['172.16.0.0', '172.16.0.0/12 — 시작'],
    ['172.31.255.255', '172.16.0.0/12 — 끝'],
    ['192.0.0.0', '192.0.0.0/24 IETF 프로토콜 할당 — 시작'],
    ['192.0.0.255', '192.0.0.0/24 — 끝'],
    ['192.168.0.0', '192.168.0.0/16 — 시작'],
    ['192.168.255.255', '192.168.0.0/16 — 끝'],
    ['198.18.0.0', '198.18.0.0/15 벤치마크 — 시작'],
    ['198.19.255.255', '198.18.0.0/15 — 끝'],
    ['224.0.0.0', '224.0.0.0/4 멀티캐스트 — 시작'],
    ['239.255.255.255', '224.0.0.0/4 — 끝'],
    ['240.0.0.0', '240.0.0.0/4 예약 — 시작'],
    ['255.255.255.255', '240.0.0.0/4 — 제한 브로드캐스트'],
  ];
  const passed: Array<[string, string]> = [
    ['1.0.0.0', '0.0.0.0/8 바로 뒤'],
    ['9.255.255.255', '10.0.0.0/8 바로 앞'],
    ['11.0.0.0', '10.0.0.0/8 바로 뒤'],
    ['100.63.255.255', 'CGNAT 바로 앞'],
    ['100.128.0.0', 'CGNAT 바로 뒤'],
    ['126.255.255.255', 'loopback 바로 앞'],
    ['128.0.0.0', 'loopback 바로 뒤'],
    ['169.253.255.255', 'link-local 바로 앞'],
    ['169.255.0.0', 'link-local 바로 뒤'],
    ['172.15.255.255', '172.16.0.0/12 바로 앞'],
    ['172.32.0.0', '172.16.0.0/12 바로 뒤'],
    ['191.255.255.255', '192.0.0.0/24 바로 앞'],
    ['192.0.1.0', '192.0.0.0/24 바로 뒤'],
    ['192.167.255.255', '192.168.0.0/16 바로 앞'],
    ['192.169.0.0', '192.168.0.0/16 바로 뒤'],
    ['198.17.255.255', '198.18.0.0/15 바로 앞'],
    ['198.20.0.0', '198.18.0.0/15 바로 뒤'],
    ['223.255.255.255', '224.0.0.0/4 바로 앞'],
    ['8.8.8.8', '공인'],
  ];

  it.each(blocked)('막는다 — %s (%s)', (host) => {
    expect(classifyIpLiteral(host)).toEqual({ family: 4, blocked: true });
  });

  it.each(passed)('통과 — %s (%s)', (host) => {
    expect(classifyIpLiteral(host)).toEqual({ family: 4, blocked: false });
  });

  // 점 표기 네 칸인데 255 를 넘는 octet 은 주소가 아니다. 해석기에 맡기지 않고 막는다(정규화 실패와 같은 fail-closed).
  it.each(['256.0.0.1', '1.2.3.999'])(
    'octet 이 255 를 넘으면 막는다 — %s',
    (host) => {
      expect(classifyIpLiteral(host)).toEqual({ family: 4, blocked: true });
    },
  );
});

describe('classifyIpLiteral — IPv6 대역', () => {
  const blocked: Array<[string, string]> = [
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['0:0:0:0:0:0:0:1', 'loopback 전체 형'],
    ['fe80::1', 'fe80::/10 link-local — 시작'],
    ['febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::/10 — 끝'],
    ['fc00::1', 'fc00::/7 ULA — 시작'],
    ['fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fc00::/7 — 끝'],
    ['fec0::1', 'fec0::/10 옛 site-local — 시작'],
    ['feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fec0::/10 — 끝'],
    ['ff00::', 'ff00::/8 멀티캐스트 — 시작'],
    ['ff02::1', 'ff00::/8 — 링크 범위 전체 노드'],
    ['64:ff9b:1::', '64:ff9b:1::/48 NAT64 로컬 — 시작'],
    ['64:ff9b:1::808:808', 'NAT64 로컬 — 마지막 32비트가 공인 IPv4 여도'],
    ['64:ff9b:1:ffff:ffff:ffff:ffff:ffff', 'NAT64 로컬 — 끝'],
  ];
  const passed: Array<[string, string]> = [
    ['fbff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fc00::/7 바로 앞'],
    ['fe7f:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::/10 바로 앞'],
    ['2001:db8::1', '문서용 IPv6(공인 취급)'],
    ['2001:4860:4860::8888', '공인'],
    ['64:ff9b:0:ffff:ffff:ffff:ffff:ffff', '64:ff9b:1::/48 바로 앞'],
    ['64:ff9b:2::', '64:ff9b:1::/48 바로 뒤'],
    // 첫 그룹을 문자열 접두가 아니라 16비트 값으로 본다. 정규화된 표기는 앞자리 0 을 지운다.
    ['fc::1', '첫 그룹 0x00fc — ULA 가 아니다'],
    ['fd::1', '첫 그룹 0x00fd — ULA 가 아니다'],
    ['fe8::1', '첫 그룹 0x0fe8 — link-local 이 아니다'],
    ['fec::1', '첫 그룹 0x0fec'],
    ['ff::1', '첫 그룹 0x00ff'],
  ];

  it.each(blocked)('막는다 — %s (%s)', (host) => {
    expect(classifyIpLiteral(host)).toEqual({ family: 6, blocked: true });
  });

  it.each(passed)('통과 — %s (%s)', (host) => {
    expect(classifyIpLiteral(host)).toEqual({ family: 6, blocked: false });
  });

  it.each([
    ['[::1]', '대괄호'],
    ['FE80::1', '대문자'],
    ['fe80::1%eth0', 'zone id'],
    ['[FF02::1%25eth0]', '대괄호 · 대문자 · URL 인코딩된 zone id'],
  ])('표기만 다른 입력도 같은 대역으로 본다 — %s (%s)', (host) => {
    expect(isBlockedIpLiteral(host)).toBe(true);
  });
});

/**
 * IPv4 를 품은 IPv6 는 품은 IPv4 를 IPv4 대역표로 판정한다. 공인 IPv4 를 품었으면 통과한다. 마지막 32비트에 IPv4 를 싣는 /96 표기
 * 넷과 6to4(둘째 · 셋째 16비트)를 본다.
 */
describe('classifyIpLiteral — IPv4 를 품은 IPv6', () => {
  const blocked: Array<[string, string]> = [
    ['::ffff:127.0.0.1', 'mapped 점 형 → 127.0.0.1'],
    ['::ffff:7f00:1', 'mapped → 127.0.0.1'],
    ['::FFFF:A9FE:A9FE', 'mapped 대문자 → 169.254.169.254'],
    ['::ffff:6440:1', 'mapped → 100.64.0.1 (CGNAT)'],
    ['::ffff:e000:1', 'mapped → 224.0.0.1'],
    ['::ffff:ffff:ffff', 'mapped → 255.255.255.255'],
    ['::7f00:1', 'IPv4-compatible → 127.0.0.1'],
    ['::127.0.0.1', 'IPv4-compatible 점 형'],
    ['::ffff:0:7f00:1', 'SIIT → 127.0.0.1'],
    ['64:ff9b::a00:1', 'NAT64 → 10.0.0.1'],
    ['64:ff9b::169.254.169.254', 'NAT64 점 형'],
    ['64:ff9b::c000:aa', 'NAT64 → 192.0.0.170'],
    ['2002:7f00:1::', '6to4 → 127.0.0.1'],
    [
      '2002:c0a8:101:1:2:3:4:5',
      '6to4 → 192.168.1.1 (서브넷 · 인터페이스 비트가 있어도)',
    ],
    ['2002::1', '6to4 → 0.0.0.0'],
    // hi/lo 16비트를 바꿔 읽으면 공인이 되는 값. 순서가 뒤집히면 이 줄이 통과한다.
    ['::ffff:c0a8:101', 'mapped → 192.168.1.1 (hi/lo 비대칭)'],
    ['::ffff:ac10:505', 'mapped → 172.16.5.5 (hi/lo 비대칭)'],
  ];
  const passed: Array<[string, string]> = [
    ['::ffff:8.8.8.8', 'mapped → 8.8.8.8'],
    ['::808:808', 'IPv4-compatible → 8.8.8.8'],
    ['::ffff:0:808:808', 'SIIT → 8.8.8.8'],
    ['64:ff9b::808:808', 'NAT64 → 8.8.8.8'],
    ['2002:808:808::1', '6to4 → 8.8.8.8'],
    ['2001:ffff:ffff:ffff:ffff:ffff:ffff:ffff', '2002::/16 바로 앞'],
    ['2003::1', '2002::/16 바로 뒤'],
    // `1.1.10.0` 은 공인이고 앞뒤를 바꿔 읽은 `10.0.1.1` 은 사설이다.
    ['::ffff:101:a00', 'mapped → 1.1.10.0 (hi/lo 비대칭)'],
    ['::101:a00', 'IPv4-compatible → 1.1.10.0 (hi/lo 비대칭)'],
    ['::ffff:0:101:a00', 'SIIT → 1.1.10.0 (hi/lo 비대칭)'],
    ['64:ff9b::101:a00', 'NAT64 → 1.1.10.0 (hi/lo 비대칭)'],
    ['2002:101:a00::', '6to4 → 1.1.10.0 (hi/lo 비대칭)'],
  ];

  it.each(blocked)('막는다 — %s (%s)', (host) => {
    expect(isBlockedIpLiteral(host)).toBe(true);
  });

  it.each(passed)('통과 — %s (%s)', (host) => {
    expect(isBlockedIpLiteral(host)).toBe(false);
  });
});

/**
 * 정규화하지 못한 IPv6 모양 입력은 막는다(fail-closed). 원래 알림 웹훅 가드는 통과(false), MCP 가드는 차단(true)으로 달랐다.
 * 호출자가 넘기는 값은 대개 URL 파서 · DNS 가 이미 IPv6 로 받은 문자열이라 이 분기에 닿는 일은 드물다. 닿는다면 판정할 수 없는
 * 주소를 공인으로 보지 않는다.
 */
describe('classifyIpLiteral — 정규화 실패는 막는다', () => {
  it.each([
    ['fe80:::1', '`:` 셋'],
    ['::1::2', '`::` 둘'],
    ['1:2:3:4:5:6:7:8:9', '그룹 아홉'],
    ['::ffff:12345:1', '다섯 자리 그룹'],
  ])('%s (%s)', (host) => {
    expect(classifyIpLiteral(host)).toEqual({ family: 6, blocked: true });
  });

  /**
   * 파서에 넘기기 전에 문자 집합(`/^[0-9a-fA-F:.]+$/`)을 묶는다. 묶지 않으면 `::1]@xfd.example/` 이 `http://[::1]@xfd.example//]/`
   * 로 읽혀 다른 호스트로 정규화된다. 문자 집합 밖의 입력은 IP 리터럴이 아니라 호스트 이름으로 본다.
   */
  it('문자 집합 밖의 입력은 IP 리터럴이 아니다', () => {
    expect(normalizeIpv6Literal('::1]@xfd.example/')).toBeNull();
    expect(classifyIpLiteral('::1]@xfd.example/')).toBeNull();
  });
});

describe('classifyIpLiteral — IP 리터럴이 아닌 입력', () => {
  it.each([
    ['', '빈 문자열'],
    ['example.com', '호스트 이름'],
    ['fcbar.example.com', '`fc` 로 시작하는 호스트 이름'],
    ['localhost', 'localhost (호스트 이름 목록은 래퍼가 본다)'],
    ['db.example.com:5432', '포트가 붙은 호스트 이름'],
    ['127.1', '점 표기 네 칸이 아닌 숫자'],
  ])('null — %s (%s)', (host) => {
    expect(classifyIpLiteral(host)).toBeNull();
    expect(isBlockedIpLiteral(host)).toBe(false);
  });
});

describe('normalizeIpv6Literal', () => {
  it.each([
    ['::ffff:192.168.1.1', '::ffff:c0a8:101'],
    ['[0:0:0:0:0:0:0:1]', '::1'],
    ['FE80::1%eth0', 'fe80::1'],
  ])('%s → %s', (host, expected) => {
    expect(normalizeIpv6Literal(host)).toBe(expected);
  });

  it.each(['127.0.0.1', 'example.com', 'fe80:::1'])(
    'IPv6 리터럴이 아니면 null — %s',
    (host) => {
      expect(normalizeIpv6Literal(host)).toBeNull();
    },
  );
});

/**
 * /96 표기 넷(mapped · compatible · SIIT · NAT64)의 마지막 32비트를 꺼낸다. 6to4 와 NAT64 로컬 접두는 IPv4 자리가 달라 이 함수가
 * 보지 않는다(6to4 는 {@link classifyIpLiteral} 이 따로 꺼내고, NAT64 로컬 접두는 대역 전체를 막는다).
 */
describe('embeddedIpv4FromIpv6', () => {
  // hi/lo 16비트 순서를 직접 고정한다. 앞뒤가 같은 값이나 하위 16비트가 0 인 값으로는 순서가 바뀌어도 판정이 같다.
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
  ])('%s → %s', (host, expected) => {
    expect(embeddedIpv4FromIpv6(host)).toBe(expected);
  });

  it.each([
    ['2002:c0a8:101::', '6to4'],
    ['64:ff9b:1::c0a8:101', 'NAT64 로컬 접두'],
    ['2001:db8::1', '공인 IPv6'],
    ['fe80::1', 'link-local'],
  ])('/96 표기가 아니면 null — %s (%s)', (host) => {
    expect(embeddedIpv4FromIpv6(host)).toBeNull();
  });

  /**
   * 접두가 한 그룹만 달라도 /96 표기가 아니다. 접두 판정의 각 조건을 하나씩 뒤집은 값이라 조건이 느슨해지면(과차단 쪽) 이 줄이
   * IPv4 를 돌려준다.
   */
  it.each([
    ['0:0:0:0:1:ffff:7f00:1', 'mapped 의 다섯째 그룹이 1'],
    ['0:0:0:0:1:0:7f00:1', 'compatible 의 다섯째 그룹이 1'],
    ['0:0:0:1:0:ffff:7f00:1', 'mapped 의 넷째 그룹이 1'],
    ['0:0:0:0:0:1:7f00:1', '여섯째 그룹이 0 · ffff 가 아니다'],
    ['0:0:0:0:ffff:1:7f00:1', 'SIIT 의 여섯째 그룹이 1'],
    ['64:ff9b:0:0:1::7f00:1', 'NAT64 의 다섯째 그룹이 1'],
    ['65:ff9b::7f00:1', 'NAT64 의 첫 그룹이 다르다'],
    ['64:ff9a::7f00:1', 'NAT64 의 둘째 그룹이 다르다'],
  ])('접두가 다르면 null — %s (%s)', (host) => {
    expect(embeddedIpv4FromIpv6(host)).toBeNull();
  });

  /**
   * 정규화되지 않은 입력에서 `parseInt` 가 앞쪽 16진수만 읽으면 점 표기 `::ffff:127.0.0.1` 이 `255.255.1.39` 로 읽혀 공인으로
   * 보인다. 틀린 IPv4 를 돌려주는 대신 null 이다.
   */
  it.each([
    ['::ffff:127.0.0.1', '점 표기'],
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
    // 그룹이 이미 8개라 `::` 가 0 그룹을 줄인다. 줄일 그룹 수가 0 인 경우를 받으면 mapped 로 읽혀 127.0.0.1 이 나온다.
    ['0:0:0:0:0:ffff:7f00::1', '`::` 가 0 그룹을 줄인다'],
    ['', '빈 문자열'],
    ['example.com', '호스트 이름'],
  ])('정규화되지 않은 입력은 null — %s (%s)', (host) => {
    expect(embeddedIpv4FromIpv6(host)).toBeNull();
  });
});
