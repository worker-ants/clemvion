import { Logger } from '@nestjs/common';

import {
  appendQueryParams,
  resolveHttpCredentials,
} from '../../nodes/integration/http-request/http-credentials';
import {
  discardBody,
  followRedirectsSafely,
  outboundBlockReason,
} from '../../nodes/integration/http-request/http-redirect';
import { SSRF_BLOCKED_CLIENT_MESSAGE } from '../../nodes/integration/http-request/http-safety';
import { clampMessage } from './clamp-message';
import type { IntegrationTestResult } from './integrations.service';

const logger = new Logger('HttpConnectionTester');

/** HTTP 연결 테스트의 대기 상한(ms) — spec/2-navigation/4-integration.md §5.3. */
export const HTTP_TEST_TIMEOUT_MS = 10_000;

/** 차단 결과 — 호출마다 새 객체(호출 사이에 참조를 공유하지 않는다). 차단 원문은 서버 로그에만 남긴다. */
function blocked(reason: string): IntegrationTestResult {
  logger.warn(`SSRF block (http connection test): ${reason}`);
  return {
    success: false,
    code: 'HTTP_BLOCKED',
    message: SSRF_BLOCKED_CLIENT_MESSAGE,
  };
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

/**
 * HTTP/REST 통합 연결 테스트(spec/2-navigation/4-integration.md §5.3). HTTP Request 노드와 같은 방식으로 자격증명을
 * 붙여 `GET base_url` 을 보내고, 리다이렉트는 노드와 같은 `followRedirectsSafely` 로 최대 5홉 따라가며 홉마다 SSRF 를
 * 다시 검사한다 — 판정은 마지막 응답으로 한다. 응답 본문은 읽지 않는다.
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
  // 노드와 같은 함수로 query 자격증명을 붙인다 — 같은 URL 문자열이 나가야 테스트 통과가 실행 성공을 뜻한다.
  const url = appendQueryParams(resolved.baseUrl, queryParams);
  const preflight = await outboundBlockReason(url);
  if (preflight !== null) return blocked(preflight);

  // 대기 신호 하나가 리다이렉트 체인 전체에 걸린다 — 홉이 늘어도 10초를 넘지 않는다.
  const init: RequestInit = {
    method: 'GET',
    headers: requestHeaders,
    redirect: 'manual',
    signal: AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS),
  };
  try {
    const followed = await followRedirectsSafely(
      await fetch(url, init),
      url,
      init,
    );
    if (followed.blocked) return blocked(followed.reason);
    await discardBody(followed.response);
    return classify(followed.response.status);
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
