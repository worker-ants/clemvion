// template presentation 의 html/markdown 을 **sanitize 후** 안전 렌더하기 위한 유틸.
// 임베드 위젯은 타 사이트(공개)에서 동작하고 template.output.rendered 는 백엔드에서 sanitize 되지 않으므로
// (spec 4-nodes/6-presentation/5-template "HTML sanitize caveat"), 클라이언트에서 DOMPurify 로 정화한다.
// XSS(script·이벤트 핸들러·javascript: href 등)는 DOMPurify 가 제거한다.
// DOMPurify 는 MPL-2.0 OR Apache-2.0 듀얼 라이선스 — 본 프로젝트는 Apache-2.0 를 선택한다.

import DOMPurify from "dompurify";
import { marked } from "marked";

export type TemplateFormat = "html" | "markdown" | "text";

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
    // USE_PROFILES.html:true 使用DOMPurify 기본 안전 정책 (script/style/iframe/object 등은 제외).
    // 미래 하드닝 옵션: ALLOWED_TAGS 화이트리스트로 전환 가능.
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style"],
  });
}
