/**
 * 임베드 웹채팅 위젯의 서빙 위치 해석.
 *
 * 위젯은 제품과 **동봉(co-deploy)** 되어 기본적으로 배포 자신의 origin 에서
 * same-origin 으로 서빙된다(`<origin>/_widget/web-chat/v1/`). 셀프호스팅·버전
 * 다양성 하에서 미리보기·설치 스니펫이 그 배포의 위젯 버전과 항상 일치하도록.
 * SaaS·별도 엣지 CDN 운영 시에만 `NEXT_PUBLIC_WIDGET_CDN_BASE` 로 override.
 *
 * SoT: spec/7-channel-web-chat/0-architecture.md §4·§4.1,
 *      spec/7-channel-web-chat/5-admin-console.md §5·§6.
 */

/** 위젯 버전 path (major 고정 — 0-architecture §4 버전 전략). */
export const WIDGET_VERSION_PATH = "/web-chat/v1";

/** 동봉(co-deploy) 서빙 prefix — frontend `public/_widget/...` 아래. app route 충돌 방지. */
export const WIDGET_CODEPLOY_PREFIX = "/_widget";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * 위젯이 서빙되는 base (이 뒤에 `WIDGET_VERSION_PATH/...` 가 붙는다).
 * - `NEXT_PUBLIC_WIDGET_CDN_BASE` 설정 시: 그 origin (전용 CDN, root 서빙).
 * - 미설정 시: `<배포 origin>/_widget` (동봉 same-origin).
 * - SSR(window 없음) + 미설정: 빈 문자열(해석 불가 — `isWidgetHostingConfigured` 로 가드).
 */
export function getWidgetBase(): string {
  const explicit = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${WIDGET_CODEPLOY_PREFIX}`;
  }
  return "";
}

/** 설치 스니펫의 `loader.js` 절대 URL. */
export function getWidgetLoaderUrl(): string {
  return `${getWidgetBase()}${WIDGET_VERSION_PATH}/loader.js`;
}

/** 라이브 미리보기 iframe `src` (위젯 SPA app). */
export function getWidgetAppUrl(): string {
  return `${getWidgetBase()}${WIDGET_VERSION_PATH}/app`;
}

/**
 * 위젯 서빙 위치를 해석할 수 있는지. 브라우저 컨텍스트면 동봉 self-origin 으로
 * 항상 가능. SSR + env 미설정일 때만 false(스니펫/미리보기 UI 비활성 안내).
 */
export function isWidgetHostingConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_WIDGET_CDN_BASE?.trim()) {
    return true;
  }
  return typeof window !== "undefined";
}
