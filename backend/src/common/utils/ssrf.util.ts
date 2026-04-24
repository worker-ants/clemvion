import { promises as dns } from 'node:dns';

/**
 * SSRF 완화 — non-local 프로바이더가 loopback/link-local/RFC1918/IPv6 사설
 * 대역·비 http(s) 스킴을 가리키는 것을 차단한다 (IP 리터럴 기준).
 *
 * DNS 이름은 `resolvesToPrivate` 가 별도로 검사한다. 여기서는 hostname 이 IP
 * 리터럴이 아닐 때 false 를 반환하고, 호출부가 resolvesToPrivate 를 추가로
 * 호출하도록 한다.
 *
 * `local` 프로바이더는 self-hosted Ollama/vLLM 이 localhost/사설망에 있는 게
 * 정상 사용 사례 — 호출부에서 본 함수들을 건너뛴다.
 */
export function isPrivateHost(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  // Defense-in-depth — DTO 의 `@IsUrl` 이 이미 http/https 만 허용하지만, 본
  // 헬퍼가 다른 경로에서 재사용될 때 file://·gopher:// 등이 hostname 빈 값으로
  // 통과하지 않도록 차단.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  let hostname = parsed.hostname.toLowerCase();
  if (!hostname) return false;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname === 'localhost') return true;

  // IPv6 처리 먼저. `::1` loopback, `fc00::/7` ULA, `fe80::/10` link-local,
  // IPv4-mapped (`::ffff:<ipv4>`).
  if (hostname.includes(':')) {
    if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true;
    const prefix = hostname.split('%')[0]; // strip zone id (e.g. fe80::1%eth0)
    if (/^fc[0-9a-f]{2}:/i.test(prefix)) return true;
    if (/^fd[0-9a-f]{2}:/i.test(prefix)) return true;
    if (/^fe[89ab][0-9a-f]:/i.test(prefix)) return true;
    // IPv4-mapped IPv6 — Node URL 은 `::ffff:10.0.0.1` 을 `::ffff:a00:1` 로
    // 정규화하므로 hex 세그먼트 두 개를 IPv4 로 재구성해 다시 검사한다.
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(prefix);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateHost(`http://${ipv4}`);
    }
    const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(
      prefix,
    );
    if (mappedDotted) return isPrivateHost(`http://${mappedDotted[1]}`);
    return false;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 0) return true; // 0.0.0.0/8 unspecified
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  return false;
}

/**
 * hostname 이 DNS 이름인 경우, 실제 해석된 IP 들이 사설 대역인지 추가 검증.
 * 공격자가 `attacker.com → 10.0.0.1` 같은 A 레코드를 배포해 IP 리터럴 검사를
 * 우회하는 케이스를 1차 해석 시점에 차단한다.
 *
 * **한계**: DNS rebinding 2차 공격 (TTL 경과 후 재해석) 은 connect 시점 re-resolve
 * 가 필요해 현 Node 표준 라이브러리로는 차단할 수 없다. 완전 차단이 필요한
 * 환경에서는 egress 방화벽/네트워크 정책으로 보완 (spec §5.5 참고).
 *
 * 모든 해석 에러 (ENOTFOUND·EAI_AGAIN·timeout) 는 false 로 간주해 다음 단계
 * (SDK 호출) 로 넘긴다 — 로컬 DNS 문제를 SSRF 판단으로 오인하면 사용자가
 * 정상 엔드포인트에도 접근 못하게 된다.
 */
export async function resolvesToPrivate(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const hostname = parsed.hostname;
  if (!hostname) return false;
  // IP 리터럴 (IPv4/IPv6) 은 이미 isPrivateHost 가 검사했을 테지만, 호출부 실수
  // 방지 겸 여기서도 short-circuit.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
    return isPrivateHost(rawUrl);
  }
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return addrs.some((entry) => isPrivateHost(`http://${entry.address}`));
  } catch {
    return false;
  }
}
