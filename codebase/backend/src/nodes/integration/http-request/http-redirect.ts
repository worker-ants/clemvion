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
 * `redirect: 'manual'` 로 받은 첫 응답에서 시작해 리다이렉트를 최대 {@link MAX_REDIRECT_HOPS} 홉 따라간다. 홉마다 대상
 * URL 을 {@link outboundBlockReason} 으로 다시 검사한다 — 공개 host 가 내부 host 로 리다이렉트해 첫 검사를 우회하지
 * 못하게. `Location` 은 직전 URL 기준 상대 경로를 허용한다. 따라간 응답의 본문은 읽지 않고 취소한다.
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
): Promise<RedirectOutcome> {
  let response = first;
  let url = firstUrl;
  for (let hops = 0; isRedirectWithLocation(response); hops++) {
    await discardBody(response);
    if (hops >= MAX_REDIRECT_HOPS) {
      return {
        blocked: true,
        reason: `redirect chain exceeded ${MAX_REDIRECT_HOPS} hops`,
      };
    }
    const next = new URL(
      response.headers.get('location') as string,
      url,
    ).toString();
    const reason = await outboundBlockReason(next);
    if (reason !== null) return { blocked: true, reason };
    url = next;
    response = await fetch(url, init);
  }
  return { blocked: false, response, url };
}
