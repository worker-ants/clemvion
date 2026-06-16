import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer } from "../markdown-renderer";

/**
 * 마크다운 렌더러 sanitize 동등성 (07-dependency m-4).
 *
 * 위젯(channel-web-chat)의 `safe-html.test.ts` 와 **동일한 XSS 페이로드 셋**으로
 * 메인 앱 측 react-markdown 경로를 검증한다. 두 렌더러는 구현이 다르지만
 * (위젯 = marked + DOMPurify allowlist / 메인 = react-markdown, rehype-raw 미사용)
 * 동일 위협(스크립트 주입·이벤트 핸들러 속성·`javascript:` 링크)에 대해
 * 보안 동등성을 보장해야 한다. 정책 매트릭스 SoT: spec/7-channel-web-chat/4-security.md §sanitize.
 */
describe("MarkdownRenderer — XSS sanitize (위젯 safe-html 과 페이로드 정렬)", () => {
  it("raw <script> 주입 → script 엘리먼트로 렌더되지 않음 (rehype-raw 미사용, escape)", () => {
    const { container } = render(
      <MarkdownRenderer content={"안전\n\n<script>alert(1)</script>"} />,
    );
    expect(container.querySelector("script")).toBeNull();
    // 원문은 텍스트로 escape 되어 그대로 보인다 (실행 아님)
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("이벤트 핸들러 속성(onerror) → img 엘리먼트/onerror 속성 미생성", () => {
    const { container } = render(
      <MarkdownRenderer content={'<img src=x onerror="alert(2)">'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    // onerror 가 실제 DOM 속성으로 존재하지 않음 (escape 된 리터럴 텍스트는 무해)
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.textContent).toContain('onerror="alert(2)"');
  });

  it("javascript: 링크 → href 에 javascript: scheme 유지 안 됨 (urlTransform 차단)", () => {
    const { container } = render(
      <MarkdownRenderer content={"[클릭](javascript:alert(3))"} />,
    );
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href") ?? "").not.toContain("javascript:");
  });

  it("정상 링크 → 새 탭 + rel=noopener (위젯 링크 훅과 동등)", () => {
    const { container } = render(
      <MarkdownRenderer content={"[사이트](https://example.com)"} />,
    );
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel") ?? "").toContain("noopener");
  });
});
