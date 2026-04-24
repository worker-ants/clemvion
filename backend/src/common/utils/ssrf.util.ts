/**
 * SSRF 완화 — non-local 프로바이더가 loopback/link-local/RFC1918/IPv6 사설
 * 대역·비 http(s) 스킴을 가리키는 것을 차단한다.
 *
 * 의도적 한계:
 * - DNS 이름은 해석하지 않는다 (비용·공격 빈도 대비). 공격자가 RFC1918 로 해석
 *   되는 도메인을 넣으면 우회 가능. rate limit + editor 권한 + egress 방화벽으로
 *   완화한다.
 * - `local` 프로바이더는 self-hosted Ollama/vLLM 런타임이 localhost/사설망에
 *   있는 게 정상 사용 사례 — 호출부에서 본 함수를 건너뛴다.
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
