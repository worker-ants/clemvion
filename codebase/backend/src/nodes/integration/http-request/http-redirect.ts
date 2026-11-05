import type { HttpCredentials } from './http-credentials.js';
import {
  SsrfBlockedError,
  assertSafeOutboundHostResolved,
  assertSafeOutboundUrl,
} from './http-safety.js';

/**
 * 리다이렉트 추종 상한 — HTTP Request 노드(spec/4-nodes/4-integration/1-http-request.md §4)와 HTTP 통합 연결 테스트
 * (spec/2-navigation/4-integration.md §5.3)가 같은 값을 쓴다.
 */
export const MAX_REDIRECT_HOPS = 5;

export type RedirectOutcome =
  | { blocked: false; response: Response; url: string }
  | { blocked: true; reason: string };

function isRedirectWithLocation(res: Response): boolean {
  return res.status >= 300 && res.status < 400 && !!res.headers.get('location');
}

/**
 * 나가는 요청 대상 URL 을 두 SSRF 가드(리터럴 · DNS 해석)로 검사한다. 통과하면 `null`, 막히면 사유. 사유에는 차단된
 * host/IP 가 들어 있을 수 있으므로 서버 로그에만 남긴다.
 *
 * **판정만 사유가 된다** — 가드가 던지는 차단 판정은 `SsrfBlockedError` 하나뿐이고(`http-safety.ts`), 그 밖의 오류는 가드의
 * 고장이지 차단이 아니다. 삼켜 사유로 둔갑시키면 막힌 적 없는 요청이 «SSRF 로 막혔다» 로 보고된다 — 그대로 던져 호출자가
 * 각자의 실패 경로(노드 `HTTP_TRANSPORT_FAILED` · 연결 테스트 `HTTP_CONNECT_FAILED`)로 분류하게 한다. SMTP 가드
 * (`send-email/smtp-host-guard.ts`)와 같은 규약이다.
 */
export async function outboundBlockReason(url: string): Promise<string | null> {
  try {
    assertSafeOutboundUrl(url);
    await assertSafeOutboundHostResolved(new URL(url).hostname);
    return null;
  } catch (err) {
    if (err instanceof SsrfBlockedError) return err.message;
    throw err;
  }
}

/** 응답 본문을 읽지 않고 취소한다(연결을 붙잡지 않게). 취소 실패는 무시한다. */
export async function discardBody(res: Response): Promise<void> {
  await res.body?.cancel().catch(() => {});
}

/**
 * 출처가 바뀐 홉에서 자격 증명 헤더 키와 상관없이 늘 빼는 헤더(소문자). 사용자가 직접 적은 헤더여도 인증 성격이 분명하다.
 */
const CREDENTIAL_LIKE_HEADERS: readonly string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
];

/**
 * 요청을 본문 없는 GET 으로 바꿀 때 함께 빼는 헤더(소문자). Fetch 표준의 request-body-header name 넷에 `content-length`
 * 를 더했다. Node 의 fetch 는 사용자가 적은 `Content-Length` 를 막지 않아, 본문 없는 요청에 남으면 길이 불일치가 된다.
 */
const BODY_HEADERS: readonly string[] = [
  'content-type',
  'content-encoding',
  'content-language',
  'content-location',
  'content-length',
];

/** scheme · host · port 가 모두 같으면 같은 출처다. `URL.host` 는 기본 port 를 지운 값이다. */
function isSameOrigin(a: URL, b: URL): boolean {
  return a.protocol === b.protocol && a.host === b.host;
}

/**
 * `RequestInit.headers` 세 형태(객체 · `Headers` · 배열)를 이름을 살린 평문 객체로 옮기며 `drop`(소문자 이름)을 뺀다.
 */
function headersWithout(
  headers: HeadersInit | undefined,
  drop: ReadonlySet<string>,
): Record<string, string> {
  const entries: Iterable<[string, string]> =
    headers === undefined
      ? []
      : headers instanceof Headers
        ? headers.entries()
        : Array.isArray(headers)
          ? headers.map(([name, value]) => [name, value] as [string, string])
          : Object.entries(headers);
  const out: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (!drop.has(name.toLowerCase())) out[name] = value;
  }
  return out;
}

/**
 * 출처가 바뀐 홉의 요청 옵션 — 통합 자격 증명 헤더 · 공용 헤더(`default_headers`)의 이름과 {@link CREDENTIAL_LIKE_HEADERS}
 * 를 대소문자와 무관하게 뺀다. 공용 헤더도 통합 자격 증명 묶음에 저장되므로 인증 값이 들어 있을 수 있다. 사용자가
 * 같은 이름의 헤더를 적었어도 이름으로 빼므로 함께 빠진다.
 */
function withoutCredentialHeaders(
  init: RequestInit,
  credentials: Pick<HttpCredentials, 'headers' | 'defaultHeaders'>,
): RequestInit {
  const drop = new Set(
    [
      ...CREDENTIAL_LIKE_HEADERS,
      ...Object.keys(credentials.headers ?? {}),
      ...Object.keys(credentials.defaultHeaders ?? {}),
    ].map((name) => name.toLowerCase()),
  );
  return { ...init, headers: headersWithout(init.headers, drop) };
}

/**
 * 출처가 바뀐 홉의 URL 에서 자격 증명 query(`api_key` 의 query 위치)를 뺀다. 이름과 값이 둘 다 같은 항목만 빼고, 뺄 것이
 * 없으면 URL 을 그대로 돌려준다(다시 직렬화하면 다른 query 의 인코딩이 바뀐다).
 */
function withoutCredentialQuery(
  url: URL,
  params: Record<string, string> | undefined,
): URL {
  const credentialEntries = Object.entries(params ?? {});
  if (credentialEntries.length === 0) return url;
  const all = [...url.searchParams];
  const kept = all.filter(
    ([name, value]) =>
      !credentialEntries.some(
        ([cName, cValue]) => cName === name && cValue === value,
      ),
  );
  if (kept.length === all.length) return url;
  const stripped = new URL(url);
  stripped.search = new URLSearchParams(kept).toString();
  return stripped;
}

/**
 * Fetch 표준의 리다이렉트 method 규칙. 303 은 GET · HEAD 가 아니면, 301 · 302 는 POST 일 때 GET 으로 바꾼다. 307 · 308 과
 * 그 밖의 조합은 method 와 본문을 그대로 둔다.
 */
function switchesToGet(status: number, method: string | undefined): boolean {
  const upper = (method ?? 'GET').toUpperCase();
  if (status === 303) return upper !== 'GET' && upper !== 'HEAD';
  if (status === 301 || status === 302) return upper === 'POST';
  return false;
}

function asBodylessGet(init: RequestInit): RequestInit {
  return {
    ...init,
    method: 'GET',
    body: null,
    headers: headersWithout(init.headers, new Set(BODY_HEADERS)),
  };
}

/** {@link prepareRedirectHop} 의 입력. `crossedOrigin` 은 앞선 홉에서 이미 출처가 바뀌었는지다. */
interface RedirectHopInput {
  status: number;
  target: URL;
  origin: URL;
  crossedOrigin: boolean;
  init: RequestInit;
  credentials: Pick<
    HttpCredentials,
    'headers' | 'defaultHeaders' | 'queryParams'
  >;
}

/**
 * 리다이렉트 홉 하나의 요청 변환(순수 함수). 출처가 처음 바뀌는 홉이면 자격 증명 헤더를 빼고, 출처가 바뀐 뒤의 모든 홉
 * 에서는 대상 URL 의 자격 증명 query 를 빼며, {@link switchesToGet} 이 참이면 본문 없는 GET 으로 바꾼다. 입력은 바꾸지 않는다.
 */
function prepareRedirectHop(input: RedirectHopInput): {
  target: URL;
  init: RequestInit;
  crossedOrigin: boolean;
} {
  const { status, origin, credentials } = input;
  let { target, init, crossedOrigin } = input;
  if (!crossedOrigin && !isSameOrigin(origin, target)) {
    crossedOrigin = true;
    init = withoutCredentialHeaders(init, credentials);
  }
  if (crossedOrigin) {
    target = withoutCredentialQuery(target, credentials.queryParams);
  }
  if (switchesToGet(status, init.method)) init = asBodylessGet(init);
  return { target, init, crossedOrigin };
}

/**
 * `redirect: 'manual'` 로 받은 첫 응답에서 시작해 리다이렉트를 최대 {@link MAX_REDIRECT_HOPS} 홉 따라간다. 홉마다 대상
 * URL 을 {@link outboundBlockReason} 으로 다시 검사한다 — 공개 host 가 내부 host 로 리다이렉트해 첫 검사를 우회하지
 * 못하게. `Location` 은 직전 URL 기준 상대 경로를 허용한다. 따라간 응답의 본문은 읽지 않고 취소한다.
 *
 * **자격 증명은 첫 요청의 출처에만 보낸다** — 홉 대상의 출처(scheme · host · port)가 `firstUrl` 과 다르면 그 홉부터
 * 통합 자격 증명 헤더 · 공용 헤더 · `Authorization` · `Proxy-Authorization` · `Cookie` 를 빼고, 대상 URL 에서 자격 증명
 * query 를 뺀다. 한 번 출처가 바뀌면 원래 출처로 돌아와도 다시 싣지 않는다. 노드와 연결 테스트가 같은 `credentials` 를
 * 넘겨 같은 규칙을 쓴다. 303 과 301 · 302 의 POST 는 본문과 본문 헤더 없는 GET 으로 바꾼다({@link switchesToGet}).
 * 호출자의 `init` 은 바꾸지 않고 홉마다 새 객체를 만든다.
 *
 * @param credentials 통합 자격 증명 묶음. 출처가 바뀐 홉에서 뺄 헤더 이름(`headers` · `defaultHeaders`)과 query(`queryParams`)를
 *   정하는 데 쓴다. 헤더 · query 값 자체는 요청에 싣지 않는다(첫 요청은 호출자가 이미 만들었다).
 *
 * 차단(대상 가드 실패 · 홉 초과)은 던지지 않고 `{ blocked: true, reason }` 으로 돌려준다 — `reason` 에는 차단된 host/IP 가
 * 들어 있을 수 있으므로 호출자는 서버 로그에만 남기고 클라이언트에는 `SSRF_BLOCKED_CLIENT_MESSAGE` 를 준다.
 *
 * **던지는 것 둘**: `fetch` 의 전송 오류, 그리고 홉 검사 중 가드가 낸 **판정 아닌 오류**(가드의 고장 —
 * {@link outboundBlockReason} 이 그것만 전파한다). 즉 이 함수 밖으로 나온 예외가 곧 전송 실패는 아니다.
 */
export async function followRedirectsSafely(
  first: Response,
  firstUrl: string,
  init: RequestInit,
  credentials: HttpCredentials,
): Promise<RedirectOutcome> {
  const origin = new URL(firstUrl);
  let response = first;
  let url = firstUrl;
  let hopInit = init;
  let crossedOrigin = false;
  for (let hops = 0; isRedirectWithLocation(response); hops++) {
    await discardBody(response);
    if (hops >= MAX_REDIRECT_HOPS) {
      return {
        blocked: true,
        reason: `redirect chain exceeded ${MAX_REDIRECT_HOPS} hops`,
      };
    }
    const hop = prepareRedirectHop({
      status: response.status,
      target: new URL(response.headers.get('location') as string, url),
      origin,
      crossedOrigin,
      init: hopInit,
      credentials,
    });
    const { target } = hop;
    crossedOrigin = hop.crossedOrigin;
    hopInit = hop.init;
    const next = target.toString();
    const reason = await outboundBlockReason(next);
    if (reason !== null) return { blocked: true, reason };
    url = next;
    response = await fetch(url, hopInit);
  }
  return { blocked: false, response, url };
}
