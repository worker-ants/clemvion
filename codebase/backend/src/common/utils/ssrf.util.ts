import { promises as dns } from 'node:dns';

import { classifyIpLiteral, isBlockedIpLiteral } from './ssrf/ip-classifier';

/**
 * LLM 엔드포인트 · S3 공개 base 의 SSRF 가드. non-local 프로바이더의 baseUrl 이 사설 · loopback · link-local 같은
 * 막는 대역의 IP 리터럴이거나 http(s) 가 아닌 스킴이면 막는다.
 *
 * 막는 대역은 공용 판정 모듈 `ssrf/ip-classifier.ts` 의 표 하나다(CGNAT `100.64.0.0/10` · 미지정 주소 `::` 포함,
 * NERV Task `CLE-T-63RSH6` 결정). 이 가드에는 우회 플래그가 없다. 사설망 엔드포인트는 `local` · `tei` 프로바이더로
 * 등록하고, 호출부가 그 둘에서 본 함수들을 건너뛴다.
 *
 * DNS 이름은 `resolvesToPrivate` 가 따로 본다. 여기서는 hostname 이 IP 리터럴이 아니면 false 를 돌려준다.
 */
export function isPrivateHost(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  // DTO 의 `@IsUrl` 이 이미 http/https 만 허용하지만, 다른 경로에서 재사용될 때 file:// · gopher:// 가 빈 hostname 으로
  // 통과하지 않게 막는다.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) return false;
  if (hostname === 'localhost') return true;
  return isBlockedIpLiteral(hostname);
}

/**
 * hostname 이 DNS 이름이면 해석된 IP 들이 막는 대역인지 본다. `attacker.com → 10.0.0.1` 같은 A 레코드로 IP 리터럴 검사를
 * 우회하는 경우를 저장 · 미리보기 시점에 막는다.
 *
 * 이 검사 뒤에 DNS 응답이 바뀌는 경우(DNS rebinding)는 여기서 막지 못한다. openai · azure-openai · cohere rerank
 * 호출은 연결할 때 푼 주소를 같은 표로 다시 판정한다(`modules/llm/llm-endpoint-fetch.ts`, CLE-T-PT5YB5).
 *
 * 해석 오류(ENOTFOUND · EAI_AGAIN · timeout)는 false 로 보고 다음 단계(SDK 호출)로 넘긴다. 로컬 DNS 문제를 SSRF 로 오인하면
 * 정상 엔드포인트도 저장할 수 없다.
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
  // IP 리터럴은 해석하지 않는다. 호출부가 isPrivateHost 를 빠뜨려도 같은 판정을 받게 여기서도 본다.
  if (classifyIpLiteral(hostname) !== null) return isPrivateHost(rawUrl);
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return addrs.some((entry) => isBlockedIpLiteral(entry.address));
  } catch {
    return false;
  }
}
