/**
 * SSRF 가드 네 벌이 함께 쓰는 IP 리터럴 판정(NERV Task `CLE-T-753725`).
 *
 * - 통합 노드(HTTP Request · DB Query · Send Email · 연결 테스트): `outbound-guard.ts`
 * - 알림 웹훅: `common/utils/ssrf-safe-url.util.ts`
 * - MCP 서버 URL: `modules/mcp/mcp-client.service.ts`
 * - LLM 엔드포인트 · S3 엔드포인트: `common/utils/ssrf.util.ts`
 *
 * 이 모듈은 환경 변수를 읽지 않고 호스트 이름도 보지 않는다. 우회 플래그(`ALLOW_PRIVATE_HOST_TARGETS` 등) · 막는 호스트 이름
 * 목록(`localhost` · 메타데이터 이름) · 사유 문구 · 오류 클래스는 각 래퍼가 정한다. 대역표 하나를 네 가드가 함께 쓰므로 대역을
 * 바꾸면 네 가드의 판정이 함께 바뀐다. 막는 대역과 그 근거는 [HTTP Request 노드](CLE-NODE-HTTP) · [알림 웹훅 SSRF](CLE-EIA-NOTIFY-SSRF)
 * 스펙에 있다.
 */

/** 판정 결과. IP 리터럴이 아니면 {@link classifyIpLiteral} 이 `null` 을 돌려준다. */
export interface IpLiteralVerdict {
  /** 리터럴의 주소 체계. 래퍼가 사유 문구를 IPv4 · IPv6 로 가를 때 쓴다. */
  family: 4 | 6;
  /** 막는 대역이거나 판정할 수 없는 리터럴이면 `true`. */
  blocked: boolean;
}

/** 막는 IPv4 대역. [시작, 끝] 을 부호 없는 32비트 정수로 둔다. */
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  cidr(0, 0, 0, 0, 8), // "this" network
  cidr(10, 0, 0, 0, 8), // RFC 1918
  cidr(100, 64, 0, 0, 10), // CGNAT (RFC 6598)
  cidr(127, 0, 0, 0, 8), // loopback
  cidr(169, 254, 0, 0, 16), // link-local (클라우드 메타데이터 169.254.169.254 포함)
  cidr(172, 16, 0, 0, 12), // RFC 1918
  cidr(192, 0, 0, 0, 24), // IETF 프로토콜 할당
  cidr(192, 168, 0, 0, 16), // RFC 1918
  cidr(198, 18, 0, 0, 15), // 벤치마크
  cidr(224, 0, 0, 0, 4), // 멀티캐스트
  cidr(240, 0, 0, 0, 4), // 예약 · 제한 브로드캐스트
];

function cidr(
  a: number,
  b: number,
  c: number,
  d: number,
  prefixLength: number,
): readonly [number, number] {
  const start = ipv4ToInt(a, b, c, d);
  return [start, start + 2 ** (32 - prefixLength) - 1];
}

function ipv4ToInt(a: number, b: number, c: number, d: number): number {
  return a * 2 ** 24 + b * 2 ** 16 + c * 2 ** 8 + d;
}

const DOTTED_IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** 점 표기 네 칸 IPv4 를 판정한다. 255 를 넘는 octet 은 주소가 아니므로 막는다. */
function isBlockedIpv4(match: RegExpExecArray): boolean {
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((n) => n > 255)) return true;
  const ip = ipv4ToInt(octets[0], octets[1], octets[2], octets[3]);
  return BLOCKED_IPV4_RANGES.some(([start, end]) => ip >= start && ip <= end);
}

/**
 * IPv6 리터럴을 WHATWG URL 파서로 한 모양(소문자 · 0 줄임 · 품은 IPv4 점 표기를 16진으로)으로 맞춘다. 대괄호와 zone id
 * (`fe80::1%eth0`)는 떼고 본다. IPv6 리터럴이 아니거나 파서가 거부하면 null.
 *
 * `URL.hostname` 은 이미 이 모양이지만 `dns.lookup` 결과 · DB host 필드는 `::ffff:127.0.0.1` 같은 점 표기로 올 수 있다.
 */
export function normalizeIpv6Literal(host: string): string | null {
  const candidate = ipv6Candidate(host);
  if (candidate === null) return null;
  try {
    return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }
}

/**
 * 대괄호 · zone id 를 뗀 IPv6 모양 문자열. `:` 가 없거나 IPv6 에 쓰지 않는 문자가 섞이면 null 이다. 파서에 넘기기 전에 문자 집합을
 * 묶는 이유: `]` · `@` · `/` 가 섞이면 `http://[…]/` 가 다른 호스트의 URL 로 읽힐 수 있다.
 */
function ipv6Candidate(host: string): string | null {
  const unbracketed =
    host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  const withoutZone = unbracketed.split('%')[0];
  if (!withoutZone.includes(':') || !/^[0-9a-fA-F:.]+$/.test(withoutZone)) {
    return null;
  }
  return withoutZone;
}

/**
 * 정규화된 IPv6 문자열을 16비트 그룹 여덟 개로 푼다. 정규화된 모양이 아니면 null.
 * 각 그룹은 소문자 16진 1~4자리여야 한다. 점 표기 · 대문자 · 대괄호 · zone id · `::` 가 둘 이상 · 그룹 수가 8이 아닌 입력은
 * `parseInt` 가 앞쪽 16진수만 읽어 틀린 값을 돌려주므로 여기서 거른다.
 */
function ipv6Groups(normalized: string): number[] | null {
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const compressed = halves.length === 2;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = compressed && halves[1] ? halves[1].split(':') : [];
  // `::` 는 0 그룹 하나 이상을 줄인다. 그룹이 이미 8개 이상이면 줄일 자리가 없다(`Array(음수)` 는 RangeError).
  const fill = compressed ? 8 - head.length - tail.length : 0;
  if (compressed && fill < 1) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/** 16비트 그룹 두 개(상위 · 하위)를 점 표기 IPv4 로 바꾼다. */
function ipv4FromGroups(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/** 마지막 32비트에 IPv4 를 싣는 /96 접두인지. */
function isIpv4Carrying96(groups: readonly number[]): boolean {
  const [a, b, c, d, e, f] = groups;
  const zeroPrefix = a === 0 && b === 0 && c === 0 && d === 0;
  const mappedOrCompatible = zeroPrefix && e === 0 && (f === 0xffff || f === 0);
  const siit = zeroPrefix && e === 0xffff && f === 0;
  const nat64 =
    a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0;
  return mappedOrCompatible || siit || nat64;
}

/**
 * 마지막 32비트에 IPv4 를 품는 IPv6 표기에서 그 IPv4 를 꺼낸다. 아니면 null.
 * - IPv4-mapped `::ffff:0:0/96`
 * - IPv4-compatible `::/96`
 * - SIIT `::ffff:0:0:0/96`
 * - NAT64 well-known prefix `64:ff9b::/96`
 *
 * 인자는 {@link normalizeIpv6Literal} 이 돌려준 값이다(소문자 · 대괄호 없음 · 점 표기 없음). 그 모양이 아니면 틀린 IPv4 를
 * 돌려주지 않고 null 을 돌려준다. 6to4 와 NAT64 로컬 접두는 IPv4 자리가 달라 보지 않는다({@link classifyIpLiteral} 이 따로 본다).
 */
export function embeddedIpv4FromIpv6(normalized: string): string | null {
  const groups = ipv6Groups(normalized);
  if (!groups || !isIpv4Carrying96(groups)) return null;
  return ipv4FromGroups(groups[6], groups[7]);
}

/** 정규화된 IPv6 의 그룹 값으로 판정한다. 문자열 접두로 보지 않는다(`fc::1` 은 0x00fc 라 ULA 가 아니다). */
function isBlockedIpv6Groups(groups: readonly number[]): boolean {
  const [first, second, third] = groups;
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] <= 1) {
    return true; // `::` unspecified · `::1` loopback
  }
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 옛 site-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 멀티캐스트
  // 64:ff9b:1::/48 NAT64 로컬 용도(RFC 8215). 운영자가 고른 접두 길이에 따라 IPv4 자리가 달라 꺼내지 않고 대역 전체를 막는다.
  if (first === 0x64 && second === 0xff9b && third === 0x1) return true;
  const carried = isIpv4Carrying96(groups)
    ? ipv4FromGroups(groups[6], groups[7])
    : first === 0x2002 // 6to4(RFC 3056). IPv4 자리는 둘째 · 셋째 그룹이다.
      ? ipv4FromGroups(groups[1], groups[2])
      : null;
  if (carried === null) return false;
  return isBlockedIpv4(DOTTED_IPV4.exec(carried) as RegExpExecArray);
}

/**
 * 호스트 문자열이 IP 리터럴이면 그 판정을, 아니면 null 을 돌려준다.
 *
 * - 점 표기 네 칸이면 IPv4 대역표로 본다. 255 를 넘는 octet 은 막는다.
 * - IPv6 문자 집합의 `:` 든 문자열이면(대괄호 · zone id 허용) IPv6 로 본다. 정규화하지 못하면 막는다(fail-closed).
 * - 그 밖(호스트 이름 · `127.1` 같은 줄임 표기 · 포트가 붙은 이름)은 리터럴이 아니다. 해석 결과는 호출자가 다시 이 함수로 본다.
 */
export function classifyIpLiteral(host: string): IpLiteralVerdict | null {
  const v4 = DOTTED_IPV4.exec(host);
  if (v4) return { family: 4, blocked: isBlockedIpv4(v4) };
  if (ipv6Candidate(host) === null) return null;
  const normalized = normalizeIpv6Literal(host);
  const groups = normalized === null ? null : ipv6Groups(normalized);
  return { family: 6, blocked: groups === null || isBlockedIpv6Groups(groups) };
}

/** {@link classifyIpLiteral} 이 막는다고 본 리터럴이면 `true`. IP 리터럴이 아니면 `false`. */
export function isBlockedIpLiteral(host: string): boolean {
  return classifyIpLiteral(host)?.blocked ?? false;
}
