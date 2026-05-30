/**
 * @jest-environment jsdom
 */
import { boot, validateBootConfig, setWidgetBase, resolveIframeTarget } from "./index";
import type { BootConfig } from "./types";

const valid: BootConfig = {
  apiBase: "https://api.example.com",
  triggerEndpointPath: "a1b2c3",
};

beforeEach(() => {
  document.body.innerHTML = "";
  setWidgetBase("https://cdn.example.com");
});

describe("validateBootConfig", () => {
  it("유효한 config 는 통과", () => {
    expect(() => validateBootConfig(valid)).not.toThrow();
  });
  it("apiBase 누락 시 throw", () => {
    expect(() => validateBootConfig({ ...valid, apiBase: "" })).toThrow(/apiBase/);
  });
  it("triggerEndpointPath 누락 시 throw", () => {
    expect(() => validateBootConfig({ ...valid, triggerEndpointPath: "" })).toThrow(
      /triggerEndpointPath/,
    );
  });
});

describe("resolveIframeTarget", () => {
  it("widgetBase + config 로 iframe URL·origin 해석", () => {
    const t = resolveIframeTarget({ ...valid, locale: "ko" }, "https://cdn.example.com/");
    expect(t.widgetOrigin).toBe("https://cdn.example.com");
    expect(t.iframeSrc).toContain("https://cdn.example.com/web-chat/v1/app/?");
    expect(t.iframeSrc).toContain("apiBase=https%3A%2F%2Fapi.example.com");
    expect(t.iframeSrc).toContain("trigger=a1b2c3");
    expect(t.iframeSrc).toContain("locale=ko");
  });
});

describe("boot", () => {
  it("iframe 을 body 에 주입하고 인스턴스 반환", () => {
    const chat = boot(valid);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-same-origin");
    expect(typeof chat.open).toBe("function");
  });

  it("invalid config 는 throw + iframe 미생성", () => {
    expect(() => boot({ ...valid, apiBase: "" })).toThrow();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("widgetBase 미해석 시 명확한 에러", () => {
    setWidgetBase("");
    // override 빈 문자열 → falsy → build 상수/script 도 없음 → throw
    expect(() => boot(valid)).toThrow(/위젯 CDN base/);
  });

  it("shutdown 은 iframe 제거", () => {
    const chat = boot(valid);
    expect(document.querySelector("iframe")).not.toBeNull();
    chat.shutdown();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
