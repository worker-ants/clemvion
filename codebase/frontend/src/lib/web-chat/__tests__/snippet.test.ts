import { describe, it, expect } from "vitest";
import { buildBootConfig, buildWebChatSnippet } from "../snippet";

describe("buildBootConfig — undefined/빈 값 정리", () => {
  it("필수 필드(apiBase, triggerEndpointPath)만 남기고 빈 옵션 제거", () => {
    const cfg = buildBootConfig({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc-123",
      headerTitle: "",
      welcome: { text: "", suggestions: [] },
      launcher: { suggestions: [] },
      appearance: {},
    });
    expect(cfg).toEqual({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc-123",
    });
  });

  it("정의된 외형/콘텐츠 필드는 보존, 빈 suggestions 는 제거", () => {
    const cfg = buildBootConfig({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc-123",
      locale: "ko",
      appearance: { primaryColor: "#5B4FE9", position: "bottom-right", zIndex: 2147483000 },
      headerTitle: "AI 어시스턴트",
      welcome: { text: "안녕하세요", suggestions: ["제품 소개"] },
      launcher: { suggestions: [] },
      disclaimer: "AI 응답",
    });
    expect(cfg).toEqual({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc-123",
      locale: "ko",
      appearance: { primaryColor: "#5B4FE9", position: "bottom-right", zIndex: 2147483000 },
      headerTitle: "AI 어시스턴트",
      welcome: { text: "안녕하세요", suggestions: ["제품 소개"] },
      disclaimer: "AI 응답",
    });
    // launcher 는 빈 suggestions 라 제거됨
    expect(cfg).not.toHaveProperty("launcher");
  });
});

describe("buildWebChatSnippet", () => {
  const snippet = buildWebChatSnippet("https://app.example.com/_widget/web-chat/v1/loader.js", {
    apiBase: "https://api.example.com",
    triggerEndpointPath: "abc-123",
    locale: "ko",
  });

  it("loader script 에 정확한 loaderUrl 을 포함", () => {
    expect(snippet).toContain(
      'j.src="https://app.example.com/_widget/web-chat/v1/loader.js"',
    );
  });

  it("ClemvionChat('boot', {...}) 호출과 boot 설정을 포함", () => {
    expect(snippet).toContain("ClemvionChat('boot',");
    expect(snippet).toContain('"apiBase": "https://api.example.com"');
    expect(snippet).toContain('"triggerEndpointPath": "abc-123"');
    expect(snippet).toContain('"locale": "ko"');
  });

  it("두 개의 <script> 블록을 생성", () => {
    expect(snippet.match(/<script>/g)).toHaveLength(2);
    expect(snippet.match(/<\/script>/g)).toHaveLength(2);
  });

  it("XSS — boot 값의 </script> 시퀀스를 이스케이프해 조기 종료 방지", () => {
    const evil = buildWebChatSnippet("https://x/loader.js", {
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc",
      headerTitle: "</script><script>alert(1)</script>",
    });
    expect(evil).not.toContain("</script><script>alert(1)");
    expect(evil).toContain("<\\/script>");
  });

  it("XSS — U+2028/U+2029 라인 구분자를 이스케이프", () => {
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const evil = buildWebChatSnippet("https://x/loader.js", {
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc",
      headerTitle: `a${LS}b${PS}c`,
    });
    expect(evil).not.toContain(LS);
    expect(evil).not.toContain(PS);
    expect(evil).toContain("\\u2028");
    expect(evil).toContain("\\u2029");
  });
});

describe("buildBootConfig — 공백 외형 값 prune", () => {
  it("primaryColor 가 공백뿐이면 appearance 전체 제거", () => {
    const cfg = buildBootConfig({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "abc",
      appearance: { primaryColor: "  " },
    });
    expect(cfg).not.toHaveProperty("appearance");
  });
});
