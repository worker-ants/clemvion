// template presentation 의 html/markdown 을 **sanitize 후** 안전 렌더하기 위한 유틸.
// 임베드 위젯은 타 사이트(공개)에서 동작하고 template.output.rendered 는 백엔드에서 sanitize 되지 않으므로
// (spec 4-nodes/6-presentation/5-template "HTML sanitize caveat"), 클라이언트에서 DOMPurify 로 정화한다.
// XSS(script·이벤트 핸들러·javascript: href 등)는 DOMPurify 가 제거한다.
// DOMPurify 는 MPL-2.0 OR Apache-2.0 듀얼 라이선스 — 본 프로젝트는 Apache-2.0 를 선택한다.

import DOMPurify from "dompurify";
import { marked } from "marked";

export type TemplateFormat = "html" | "markdown" | "text";

// 04 m-1 — deny-by-default 화이트리스트. 임베드 위젯은 XSS 성공 시 피해가 호스트
// 사이트로 전파되므로, 블랙리스트(FORBID)로 알려진 위험만 거르는 대신 채팅 렌더에
// 실제 필요한 태그/속성만 허용한다. 미지·신규 벡터(svg/math 기반 mXSS 등)는 기본 차단.
// 목록은 `marked`(GFM) 가 산출하는 태그를 audit 해 확정 — 새 렌더 요소가 필요하면
// 여기에 추가한다. (task-list 의 <input> 체크박스는 의도적으로 제외 — 기존 FORBID 정책 유지.)
const ALLOWED_TAGS = [
  "a", "p", "br", "hr", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "del", "s", "ins", "mark", "sub", "sup", "small",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "code", "pre", "kbd", "samp", "var",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "img",
];

// href/src 등 URL 속성 + 링크 훅이 설치하는 target/rel + 테이블 정렬/병합 속성만 허용.
const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "target", "rel", "align", "colspan", "rowspan",
];

// 04 m-1 — href/src scheme 을 http(s)/mailto 와 relative/anchor 로 한정 (javascript:·
// data: 등 이중 방어). DOMPurify 기본 정규식에서 tel/sms/ftp 등을 제거한 형태.
const ALLOWED_URI_REGEXP =
  /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

// hookInstalled: 모듈 레벨 1회 설치 플래그. 테스트 격리용으로 _resetHookForTest() 제공.
// DOMPurify.addHook 은 전역 상태에 누적되므로 재호출 없이 Boolean 으로 가드한다.
let hookInstalled = false;

/** 링크는 새 탭 + noopener 로 강제(임베드 컨텍스트 보안). window 존재 시 1회만 설치. */
function ensureLinkHook(): void {
  if (hookInstalled || typeof window === "undefined") return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
  hookInstalled = true;
}

/**
 * 테스트 격리용 hook 리셋. 프로덕션 코드에서 호출 금지.
 * `vi.resetModules()` 대신 이 함수를 afterEach 에서 호출하면 hookInstalled 상태를 초기화할 수 있다.
 * @internal
 */
export function _resetHookForTest(): void {
  DOMPurify.removeHooks("afterSanitizeAttributes");
  hookInstalled = false;
}

/**
 * template rendered 문자열을 포맷에 따라 **sanitize 된 HTML 문자열**로 변환.
 * - `markdown`: marked 로 HTML 변환 후 sanitize.
 * - `html`: 그대로 sanitize.
 * - `text`: null 반환(호출자가 plain text 로 렌더 — 태그 미해석).
 *
 * **클라이언트 전용(`window` 필수)** — SSR/static-export build 컨텍스트에서는 null 을 반환하며
 * 호출자는 plain text 폴백으로 렌더해야 한다. Storybook/테스트 환경에서도 jsdom 없이 실행 시 null.
 */
export function renderTemplateHtml(rendered: string, format: TemplateFormat): string | null {
  if (format === "text") return null;
  if (typeof window === "undefined") return null; // SSR/static export 단계 → plain text 폴백.
  ensureLinkHook();
  let rawHtml: string;
  if (format === "markdown") {
    // marked.parse with { async: false } always returns string synchronously — but we guard
    // at runtime to prevent [object Promise] reaching DOMPurify if the API ever changes.
    const parsed = marked.parse(rendered, { async: false });
    if (typeof parsed !== "string") {
      // Unexpected Promise (future marked version or misconfiguration) — fall back to null.
      return null;
    }
    rawHtml = parsed;
  } else {
    rawHtml = rendered;
  }
  return DOMPurify.sanitize(rawHtml, {
    // 04 m-1 — deny-by-default 화이트리스트. ALLOWED_TAGS/ALLOWED_ATTR 에 없는 태그·
    // 속성(script/style/iframe/object/svg/math/이벤트 핸들러 등)은 모두 제거되고,
    // ALLOWED_URI_REGEXP 가 href/src scheme 을 http(s)/mailto/relative 로 제한한다.
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  });
}
