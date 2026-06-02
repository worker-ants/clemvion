// template presentation 의 html/markdown 을 **sanitize 후** 안전 렌더하기 위한 유틸.
// 임베드 위젯은 타 사이트(공개)에서 동작하고 template.output.rendered 는 백엔드에서 sanitize 되지 않으므로
// (spec 4-nodes/6-presentation/5-template "HTML sanitize caveat"), 클라이언트에서 DOMPurify 로 정화한다.
// XSS(script·이벤트 핸들러·javascript: href 등)는 DOMPurify 가 제거한다.

import DOMPurify from "dompurify";
import { marked } from "marked";

export type TemplateFormat = "html" | "markdown" | "text";

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
 * template rendered 문자열을 포맷에 따라 **sanitize 된 HTML 문자열**로 변환.
 * - `markdown`: marked 로 HTML 변환 후 sanitize.
 * - `html`: 그대로 sanitize.
 * - `text`: null 반환(호출자가 plain text 로 렌더 — 태그 미해석).
 * DOM(window) 미가용(SSR/build prerender) 시에도 null → plain text 폴백(정적 export 안전).
 */
export function renderTemplateHtml(rendered: string, format: TemplateFormat): string | null {
  if (format === "text") return null;
  if (typeof window === "undefined") return null; // SSR/static export 단계 → plain text 폴백.
  ensureLinkHook();
  const rawHtml =
    format === "markdown" ? (marked.parse(rendered, { async: false }) as string) : rendered;
  return DOMPurify.sanitize(rawHtml, {
    // 안전한 표현용 태그 집합 — script/style/iframe/object 등은 기본적으로 제외된다.
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style"],
  });
}
