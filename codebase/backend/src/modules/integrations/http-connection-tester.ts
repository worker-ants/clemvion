import { Logger } from '@nestjs/common';

import { resolveHttpCredentials } from '../../nodes/integration/http-request/http-credentials';
import {
  SSRF_BLOCKED_CLIENT_MESSAGE,
  assertSafeOutboundHostResolved,
  assertSafeOutboundUrl,
} from '../../nodes/integration/http-request/http-safety';
import { clampMessage } from './clamp-message';
import type { IntegrationTestResult } from './integrations.service';

const logger = new Logger('HttpConnectionTester');

/** HTTP 연결 테스트의 대기 상한(ms) — spec/2-navigation/4-integration.md §5.3. */
export const HTTP_TEST_TIMEOUT_MS = 10_000;

/** 리다이렉트 추종 상한 — HTTP Request 노드와 같다(spec/4-nodes/4-integration/1-http-request.md §4). */
export const HTTP_TEST_MAX_REDIRECTS = 5;

const BLOCKED: IntegrationTestResult = {
  success: false,
  code: 'HTTP_BLOCKED',
  message: SSRF_BLOCKED_CLIENT_MESSAGE,
};

/** SSRF 가드 — 노드와 같은 두 단계(URL 리터럴 · DNS 해석). 차단 원문은 서버 로그에만 남긴다. */
async function isSafeTarget(url: string): Promise<boolean> {
  try {
    assertSafeOutboundUrl(url);
    await assertSafeOutboundHostResolved(new URL(url).hostname);
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.warn(`SSRF block (http connection test): ${detail}`);
    return false;
  }
}

function withQuery(
  baseUrl: string,
  query: Record<string, string> | undefined,
): string {
  if (!query || Object.keys(query).length === 0) return baseUrl;
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url.toString();
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function classify(status: number): IntegrationTestResult {
  if (status === 401 || status === 403) {
    return {
      success: false,
      code: 'HTTP_AUTH_FAILED',
      message: `The server rejected the credentials (HTTP ${status}).`,
    };
  }
  if (status >= 500) {
    return {
      success: false,
      code: 'HTTP_SERVER_ERROR',
      message: `The server returned HTTP ${status}.`,
    };
  }
  if (status >= 400) {
    // base_url 은 대개 API 의 뿌리라 그 자체가 자원이 아니다 — 서버에는 닿았다(spec §5.3).
    return {
      success: true,
      message: `Reached the server, but base_url answered HTTP ${status} — the credentials could not be verified.`,
    };
  }
  return { success: true, message: 'Connection successful' };
}

function describeFailure(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as Error & { cause?: unknown }).cause;
  return cause instanceof Error
    ? `${err.message}: ${cause.message}`
    : err.message;
}

async function discardBody(res: Response): Promise<void> {
  await res.body?.cancel().catch(() => {});
}

/**
 * HTTP/REST 통합 연결 테스트(spec/2-navigation/4-integration.md §5.3). HTTP Request 노드와 같은 방식으로 자격증명을
 * 붙여 `GET base_url` 을 보내고, 리다이렉트는 노드처럼 최대 5홉 따라가며 홉마다 SSRF 를 다시 검사한다 — 판정은 마지막
 * 응답으로 한다. 응답 본문은 읽지 않는다.
 *
 * - 2xx(또는 `Location` 없는 3xx) → 성공
 * - 401 · 403 → `HTTP_AUTH_FAILED`
 * - 그 밖의 4xx → 성공이되 «자격증명은 확인하지 못했다» 안내
 * - 5xx → `HTTP_SERVER_ERROR`
 * - SSRF 차단(첫 요청 · 리다이렉트 대상) · 5홉 초과 → `HTTP_BLOCKED`(차단된 host 는 메시지에 싣지 않는다)
 * - 네트워크 · 타임아웃 · TLS → `HTTP_CONNECT_FAILED`
 *
 * `base_url` 이 비어 있으면(노드가 URL 전체를 적는 통합) 호출하지 않는다. 던지지 않는다.
 */
export async function testHttpConnection(
  authType: string,
  credentials: Record<string, unknown>,
): Promise<IntegrationTestResult> {
  const resolved = resolveHttpCredentials(authType, credentials);
  if (!resolved.ok) {
    return { success: false, code: resolved.code, message: resolved.message };
  }
  if (!resolved.baseUrl) {
    return {
      success: true,
      message:
        'base_url is empty, so the connection was not checked — this integration relies on nodes to set the full URL.',
    };
  }
  if (!isValidUrl(resolved.baseUrl)) {
    return {
      success: false,
      code: 'HTTP_CONNECT_FAILED',
      message: 'base_url is not a valid URL.',
    };
  }

  const { headers, queryParams, defaultHeaders } = resolved.credentials;
  // 노드와 같은 병합 순서 — 공용 헤더 위에 자격증명 헤더.
  const requestHeaders = { ...(defaultHeaders ?? {}), ...(headers ?? {}) };
  let url = withQuery(resolved.baseUrl, queryParams);
  if (!(await isSafeTarget(url))) return BLOCKED;

  const init: RequestInit = {
    method: 'GET',
    headers: requestHeaders,
    redirect: 'manual',
    signal: AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS),
  };
  try {
    let res = await fetch(url, init);
    let hops = 0;
    while (
      res.status >= 300 &&
      res.status < 400 &&
      res.headers.get('location')
    ) {
      await discardBody(res);
      if (hops >= HTTP_TEST_MAX_REDIRECTS) {
        logger.warn(
          `SSRF block (http connection test): redirect chain exceeded ${HTTP_TEST_MAX_REDIRECTS} hops`,
        );
        return BLOCKED;
      }
      const next = new URL(
        res.headers.get('location') as string,
        url,
      ).toString();
      if (!(await isSafeTarget(next))) return BLOCKED;
      url = next;
      hops++;
      res = await fetch(url, init);
    }
    await discardBody(res);
    return classify(res.status);
  } catch (err) {
    const name = (err as { name?: unknown } | null)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      return {
        success: false,
        code: 'HTTP_CONNECT_FAILED',
        message: `The request timed out after ${HTTP_TEST_TIMEOUT_MS / 1000} seconds.`,
      };
    }
    return {
      success: false,
      code: 'HTTP_CONNECT_FAILED',
      message: clampMessage(describeFailure(err)),
    };
  }
}
