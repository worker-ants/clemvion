/**
 * HTTP/REST 통합 자격증명 → 요청에 붙일 헤더 · query.
 *
 * 노드 실행(`http-request.handler.ts`)과 통합 연결 테스트(`modules/integrations/http-connection-tester.ts`)가
 * **같은 방식으로** 자격증명을 붙이도록 한 곳에 둔다 — 테스트가 노드와 다르게 붙이면 테스트 통과가 실행 성공을 뜻하지 않는다.
 *
 * 이 모듈은 의존성이 없어야 한다. 핸들러와 `IntegrationError` 가 있는 `integration-handler-base.ts` 는
 * `IntegrationsService` 를 import 하므로, 통합 모듈의 테스터가 그쪽을 가져오면 순환 import 가 된다. 그래서 여기서는
 * 예외를 던지지 않고 실패를 값으로 돌려준다 — 핸들러가 그것을 `IntegrationError` 로 바꾼다.
 */

export interface HttpCredentials {
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  defaultHeaders?: Record<string, string>;
}

export type HttpCredentialsResult =
  | { ok: true; credentials: HttpCredentials; baseUrl: string | undefined }
  | {
      ok: false;
      code: 'INTEGRATION_INCOMPLETE' | 'INTEGRATION_AUTH_UNSUPPORTED';
      message: string;
    };

export function resolveHttpCredentials(
  authType: string,
  raw: Record<string, unknown>,
): HttpCredentialsResult {
  const defaultHeaders =
    typeof raw.default_headers === 'object' && raw.default_headers !== null
      ? (raw.default_headers as Record<string, string>)
      : undefined;
  const baseUrl =
    typeof raw.base_url === 'string' && raw.base_url.length > 0
      ? raw.base_url
      : undefined;

  switch (authType) {
    case 'api_key': {
      const location = raw.location as 'header' | 'query' | undefined;
      const keyName = raw.key_name as string | undefined;
      const value = raw.value as string | undefined;
      if (!location || !keyName || !value) {
        return {
          ok: false,
          code: 'INTEGRATION_INCOMPLETE',
          message:
            'HTTP integration (api_key) is missing location/key_name/value',
        };
      }
      if (location === 'header') {
        return {
          ok: true,
          credentials: { headers: { [keyName]: value }, defaultHeaders },
          baseUrl,
        };
      }
      return {
        ok: true,
        credentials: { queryParams: { [keyName]: value }, defaultHeaders },
        baseUrl,
      };
    }
    case 'bearer_token': {
      const token = raw.token as string | undefined;
      if (!token) {
        return {
          ok: false,
          code: 'INTEGRATION_INCOMPLETE',
          message: 'HTTP integration (bearer) is missing token',
        };
      }
      return {
        ok: true,
        credentials: {
          headers: { Authorization: `Bearer ${token}` },
          defaultHeaders,
        },
        baseUrl,
      };
    }
    case 'basic': {
      const username = raw.username as string | undefined;
      const password = raw.password as string | undefined;
      if (!username || !password) {
        return {
          ok: false,
          code: 'INTEGRATION_INCOMPLETE',
          message: 'HTTP integration (basic) is missing username/password',
        };
      }
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      return {
        ok: true,
        credentials: {
          headers: { Authorization: `Basic ${encoded}` },
          defaultHeaders,
        },
        baseUrl,
      };
    }
    default:
      return {
        ok: false,
        code: 'INTEGRATION_AUTH_UNSUPPORTED',
        message: `HTTP integration auth type "${authType}" is not supported`,
      };
  }
}
