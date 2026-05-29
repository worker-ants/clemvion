// Inbound webhook URL 합성 — spec WH-EP-02 `{base_url}/api/hooks/{endpoint_path}`.
//
// webhook 엔드포인트(`/api/hooks/:endpointPath`)는 백엔드(HooksController)가
// 서빙하므로, base URL 은 "프론트가 가리키는 백엔드 origin" 이어야 한다.
//
// 옛 코드는 `window.location.origin.replace(/:\d+$/, ":3011")` 로 개발 포트를
// 인라인 하드코딩했다 (ai-review W5). 프론트 dev 서버(:3012)와 백엔드(:3011)
// 포트가 달라 dev 에서만 동작하던 트릭이며, 스테이징·프로덕션에서는 실제
// 서비스 도메인에 `:3011` 을 덧붙여 잘못된 URL 을 생성했다.
//
// base URL 결정 우선순위:
//   1. NEXT_PUBLIC_WEBHOOK_BASE_URL — webhook ingress 가 API 와 다른 호스트인
//      배포를 위한 명시 override (선택).
//   2. NEXT_PUBLIC_API_URL 에서 도출 — 프론트가 이미 백엔드 위치의 SSOT 로
//      사용하는 값. 후행 `/api` 를 제거해 origin 만 취한다 (dev=:3011 자동 해결).
//   3. window.location.origin — SaaS 동일 도메인 배포의 안전한 fallback.
//      (SSR/window 부재 시 빈 문자열 → 상대경로.)

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** webhook URL 의 base origin (후행 슬래시·`/api` 제거). 끝에 슬래시 없음. */
export function getWebhookBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    // 후행 슬래시 먼저 제거한 뒤 trailing `/api` segment 만 제거 (`.env.example`
    // 컨벤션상 NEXT_PUBLIC_API_URL 은 `…/api` 로 끝남). `/api` 없이 origin 만
    // 설정된 값은 그대로 origin 으로 쓰여 `${origin}/api/hooks/…` 가 된다.
    return stripTrailingSlash(apiUrl).replace(/\/api$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

/** endpointPath 로 전체 webhook 호출 URL 을 합성한다. */
export function getWebhookUrl(endpointPath: string): string {
  const base = getWebhookBaseUrl();
  const path = endpointPath.replace(/^\/+/, "");
  return `${base}/api/hooks/${path}`;
}
