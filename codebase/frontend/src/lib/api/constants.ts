// API 관련 URL 상수의 단일 정의처 (lib/api 전용).
// 비-API 전역 상수는 lib/constants/ 에 둔다 (예: a11y.ts).
//
// canonical SoT 는 codebase/frontend/.env.example:
//   NEXT_PUBLIC_API_URL="http://localhost:3011/api"
//   NEXT_PUBLIC_WS_URL="http://localhost:3011"
// fallback 값은 env 미설정 로컬 dev 전용이며 .env.example 과 동일한 :3011 을 쓴다
// (백엔드 docker-compose APP_PORT 와 일치). NEXT_PUBLIC_* 는 빌드 타임에 인라인 치환된다.

/**
 * 브라우저·클라이언트 컴포넌트에서 쓰는 REST API base URL.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api";

/**
 * WebSocket(socket.io) 서버 base URL.
 */
export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3011";

/**
 * 서버 컴포넌트(Next.js Server Components) 전용 API base URL.
 *
 * 우선순위: `INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → 로컬 fallback.
 * `INTERNAL_API_URL` 은 클러스터 내부 service DNS(예: `http://backend:3011/api`)로,
 * 외부 호스트명으로 해석될 수 있는 `NEXT_PUBLIC_API_URL` 보다 우선한다.
 * `INTERNAL_API_URL` 은 NEXT_PUBLIC_* 가 아니므로 클라이언트 번들에서는 undefined 로
 * 치환되어 자동으로 public URL fallback 으로 degrade 한다 (서버 전용 호출용).
 */
export function getServerApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3011/api"
  );
}
