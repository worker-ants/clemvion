/**
 * 웹채팅 위젯용 경로-스코프 CORS (단일 CORS 레이어, 이중 ACAO 회피).
 * SoT: spec/7-channel-web-chat/4-security §2, spec/5-system/14-external-interaction-api §8.5.
 *
 * - `/api/hooks/*`     : 무제한(origin 반영, credentials 없음). 위젯/BYO 는 credential 없이 POST.
 * - `/api/external/*`  : 워크스페이스 단위 allowlist(`interactionAllowedOrigins`) ∪ 빌트인 위젯 CDN origin.
 *                        execution id 로 워크스페이스 역인덱스(preflight 포함).
 * - 그 외             : 기존 동작(frontend allowlist + credentials) 그대로.
 */

export const HOOKS_PATH_RE = /^\/api\/hooks\//;
export const EXTERNAL_EXEC_PATH_RE = /^\/api\/external\/executions\/([^/?]+)/;

/** cors 패키지 옵션의 최소 형태. */
export interface CorsOptionsLike {
  origin?:
    | boolean
    | string
    | ((
        origin: string | undefined,
        cb: (e: Error | null, allow?: boolean) => void,
      ) => void);
  credentials?: boolean;
}

export type CorsCallback = (
  err: Error | null,
  options?: CorsOptionsLike,
) => void;

export interface CorsRequestLike {
  path?: string;
  url?: string;
  headers: { origin?: string };
}

export type CorsDelegate = (
  req: CorsRequestLike,
  callback: CorsCallback,
) => void;

function normOrigin(o: string): string {
  return o.replace(/\/$/, '');
}

/** `/api/external/executions/:id/...` 에서 execution id 추출. 매칭 안 되면 null. */
export function extractExternalExecutionId(path: string): string | null {
  const m = EXTERNAL_EXEC_PATH_RE.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
}

/** external 표면 origin 허용 판정 — 빌트인 위젯 origin ∪ 워크스페이스 allowlist. origin 없으면(non-browser) 허용. */
export function isExternalOriginAllowed(
  origin: string | undefined,
  widgetOrigins: string[],
  workspaceAllowlist: string[],
): boolean {
  if (!origin) return true;
  const allow = new Set(
    [...widgetOrigins, ...workspaceAllowlist].map(normOrigin),
  );
  return allow.has(normOrigin(origin));
}

export interface WebChatCorsDeps {
  /** 빌트인 위젯 CDN origin (모든 워크스페이스 공통, 배포 env). */
  widgetOrigins: string[];
  /** execution id → 워크스페이스 interactionAllowedOrigins. */
  resolveAllowlist: (executionId: string) => Promise<string[]>;
  /** 비-웹채팅 경로의 기존 CORS 옵션(frontend allowlist + credentials). */
  defaultOptions: () => CorsOptionsLike;
}

export function createWebChatCorsDelegate(deps: WebChatCorsDeps): CorsDelegate {
  return (req, cb) => {
    const path = req.path ?? req.url ?? '';

    if (HOOKS_PATH_RE.test(path)) {
      // 무제한: origin 반영, credentials 없음(EIA §8.5 hooks 무제한 유지).
      cb(null, { origin: true, credentials: false });
      return;
    }

    const executionId = extractExternalExecutionId(path);
    if (executionId) {
      const origin = req.headers?.origin;
      deps
        .resolveAllowlist(executionId)
        .then((allowlist) => {
          const allowed = isExternalOriginAllowed(
            origin,
            deps.widgetOrigins,
            allowlist,
          );
          cb(null, {
            origin: allowed ? (origin ?? true) : false,
            credentials: false,
          });
        })
        .catch(() => cb(null, { origin: false, credentials: false }));
      return;
    }

    cb(null, deps.defaultOptions());
  };
}

/** env(`WEB_CHAT_WIDGET_ORIGINS`, 콤마 구분) → 빌트인 위젯 origin 목록. */
export function parseWidgetOrigins(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
