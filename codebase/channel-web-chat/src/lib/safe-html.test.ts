/**
 * safe-html.ts 단위 테스트 (W5/W6 — 테스트 누락 보완)
 *
 * 커버리지:
 *  - text 포맷 → null
 *  - markdown 포맷 → sanitize 된 HTML string (typeof === "string" 단언, W7)
 *  - html with <script>/onerror/javascript: href → 제거
 *  - link → target=_blank rel=noopener (hookInstalled 경로)
 *  - SSR 분기 (typeof window === "undefined") → null
 *  - hookInstalled 멱등성 (여러 번 호출해도 hook 중복 등록 안 됨)
 *  - FORBID_TAGS: form/input/style 제거 (I10)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderTemplateHtml, _resetHookForTest } from "./safe-html";

afterEach(() => {
  _resetHookForTest();
  vi.unstubAllGlobals();
});

describe("renderTemplateHtml — text 포맷", () => {
  it("text → null (태그 미해석 폴백)", () => {
    expect(renderTemplateHtml("<b>hi</b>", "text")).toBeNull();
  });
});

describe("renderTemplateHtml — SSR 분기 (W5)", () => {
  it("typeof window === undefined → null (SSR/build 폴백)", () => {
    vi.stubGlobal("window", undefined);
    expect(renderTemplateHtml("<b>hello</b>", "html")).toBeNull();
    expect(renderTemplateHtml("# heading", "markdown")).toBeNull();
  });
});

describe("renderTemplateHtml — html 포맷", () => {
  it("안전 태그 → sanitize 된 HTML string 반환", () => {
    const result = renderTemplateHtml("<b>굵게</b>", "html");
    expect(typeof result).toBe("string"); // W7: runtime type check
    expect(result).not.toBeNull();
    expect(result).toContain("굵게");
  });

  it("script 태그 제거 (XSS 방어)", () => {
    const result = renderTemplateHtml('<p>안전</p><script>alert(1)</script>', "html");
    expect(result).not.toBeNull();
    expect(result).not.toContain("<script");
    expect(result).toContain("안전");
  });

  it("onerror 속성 제거", () => {
    const result = renderTemplateHtml('<img src=x onerror="alert(2)">', "html");
    expect(result).not.toContain("onerror");
  });

  it("javascript: href 제거", () => {
    const result = renderTemplateHtml('<a href="javascript:alert(3)">링크</a>', "html");
    expect(result).not.toBeNull();
    expect((result ?? "").includes("javascript:")).toBe(false);
  });

  it("FORBID_TAGS: form/input/style 제거 (I10)", () => {
    const result = renderTemplateHtml(
      '<form><input type="text" value="x"></form><style>*{display:none}</style><b>남음</b>',
      "html",
    );
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).not.toContain("<style");
    expect(result).toContain("남음");
  });
});

describe("renderTemplateHtml — markdown 포맷 (W7)", () => {
  it("markdown → sanitize 된 HTML string (typeof === string 단언)", () => {
    const result = renderTemplateHtml("# 제목\n\n**굵게**", "markdown");
    expect(typeof result).toBe("string"); // W7 핵심 단언
    expect(result).not.toBeNull();
    expect(result).toContain("굵게");
  });

  it("markdown link → target=_blank rel=noopener (hookInstalled 경로)", () => {
    const result = renderTemplateHtml("[링크](https://example.com)", "markdown");
    expect(typeof result).toBe("string");
    expect(result).toContain('target="_blank"');
    expect(result).toContain("noopener");
  });

  it("markdown XSS 제거 — script/onerror/javascript:", () => {
    const result = renderTemplateHtml(
      '**안전**<script>alert(1)</script><img src=x onerror=alert(2)>',
      "markdown",
    );
    expect(result).not.toContain("<script");
    expect(result).not.toContain("onerror");
    expect(result).toContain("안전");
  });
});

describe("hookInstalled 멱등성 (W4/W6)", () => {
  it("여러 번 renderTemplateHtml 호출해도 link 훅이 중복 적용되지 않음", () => {
    // hook 은 1회 설치. afterEach 에서 _resetHookForTest 로 정리.
    const result1 = renderTemplateHtml("[링크](https://a.test)", "markdown");
    const result2 = renderTemplateHtml("[링크](https://a.test)", "markdown");
    // 두 결과 모두 target=_blank 를 정확히 1번 포함해야 한다.
    expect((result1 ?? "").split('target="_blank"').length - 1).toBe(1);
    expect((result2 ?? "").split('target="_blank"').length - 1).toBe(1);
  });
});
