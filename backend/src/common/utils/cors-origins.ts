/**
 * HTTP / WebSocket CORS allowlist 의 단일 진입점 (W-1).
 *
 * 옛 구성은 두 경로가 분리돼 있었다:
 * - HTTP: `app.enableCors({ origin: configService.get('app.frontendUrl') })`
 *   → 단일 도메인만 허용.
 * - WebSocket: `@WebSocketGateway({ cors: { origin: '*' } })`
 *   → 모든 도메인 무방어 허용 (브라우저 same-origin 우회 위험).
 *
 * 본 헬퍼는 두 경로를 동일한 allowlist 로 일원화하고 다중 도메인을 지원한다.
 *
 * 우선순위:
 * 1. `CORS_ORIGINS` env (콤마 구분, 후행 슬래시 제거)
 * 2. `FRONTEND_URL` env (단일 도메인 — 옛 단일 도메인 운영과의 호환)
 * 3. wildcard `['*']` (어떤 env 도 없는 dev/test fallback)
 *
 * 운영(`NODE_ENV=production`) 환경에서 1·2 가 모두 미설정이면 부팅 시
 * `assertCorsOriginsConfigured()` 가 fail-closed.
 */

const WILDCARD = '*';

let cachedRaw: string | undefined;
let cachedList: string[] | null = null;

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * 현재 설정된 CORS allowlist 를 반환. wildcard fallback 시 `['*']`.
 * env 변경 감지를 위해 raw 문자열이 바뀌면 캐시를 무효화한다.
 */
export function getAllowedOrigins(): string[] {
  const corsEnv = process.env.CORS_ORIGINS;
  const frontendEnv = process.env.FRONTEND_URL;
  const raw = corsEnv ?? frontendEnv ?? '';

  if (cachedList !== null && raw === cachedRaw) return cachedList;
  cachedRaw = raw;

  if (!raw) {
    cachedList = [WILDCARD];
    return cachedList;
  }

  const list = parseList(raw);
  cachedList = list.length === 0 ? [WILDCARD] : list;
  return cachedList;
}

/**
 * `origin` 헤더 값이 allowlist 에 속하는지 판정.
 * - `origin` 미지정 (same-origin / non-browser 도구) → 통과
 * - wildcard 모드 → 통과
 * - 정확히 매칭 (후행 슬래시 정규화) → 통과
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const list = getAllowedOrigins();
  if (list.includes(WILDCARD)) return true;
  const normalized = origin.replace(/\/$/, '');
  return list.includes(normalized);
}

/**
 * Socket.IO / `cors` 미들웨어의 함수형 `origin` 콜백. allowlist 외에서 온 요청은
 * 거부 (callback(null, false))되며, Socket.IO 는 connection 자체를 차단한다.
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, isOriginAllowed(origin));
}

/**
 * 부팅 시점 fail-closed 검증 — production 에서 allowlist 가 wildcard 면 throw.
 * dev/test 에서는 wildcard 허용 (편의).
 */
export function assertCorsOriginsConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const list = getAllowedOrigins();
  if (list.includes(WILDCARD)) {
    throw new Error(
      'CORS misconfiguration: NODE_ENV=production requires CORS_ORIGINS (or FRONTEND_URL) to be set. Wildcard origin is not allowed.',
    );
  }
}

/** test 전용 — env 변경 후 캐시 강제 무효화. */
export function __resetCorsOriginsCache(): void {
  cachedRaw = undefined;
  cachedList = null;
}
