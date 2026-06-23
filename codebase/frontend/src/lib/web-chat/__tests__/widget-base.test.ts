import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getWidgetBase,
  getWidgetLoaderUrl,
  getWidgetAppUrl,
  getWidgetOrigin,
  isWidgetHostingConfigured,
} from "../widget-base";

// NEXT_PUBLIC_* 는 빌드타임 인라인이지만 테스트에서는 process.env 를 직접 stub.
const ENV_KEY = "NEXT_PUBLIC_WIDGET_CDN_BASE";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("widget-base — self-origin 기본 (co-deploy)", () => {
  it("env 미설정 시 base = <origin>/_widget (동봉 prefix)", () => {
    vi.stubEnv(ENV_KEY, "");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    expect(getWidgetBase()).toBe("https://app.example.com/_widget");
  });

  it("env 미설정 시 loader/app URL 이 동봉 경로", () => {
    vi.stubEnv(ENV_KEY, "");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    expect(getWidgetLoaderUrl()).toBe(
      "https://app.example.com/_widget/web-chat/v1/loader.js",
    );
    expect(getWidgetAppUrl()).toBe(
      "https://app.example.com/_widget/web-chat/v1/app",
    );
  });
});

describe("widget-base — NEXT_PUBLIC_WIDGET_CDN_BASE override (엣지 CDN)", () => {
  it("env 설정 시 그 origin 을 base 로 (root 서빙), 후행 슬래시 제거", () => {
    vi.stubEnv(ENV_KEY, "https://cdn.example.com/");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    expect(getWidgetBase()).toBe("https://cdn.example.com");
    expect(getWidgetLoaderUrl()).toBe(
      "https://cdn.example.com/web-chat/v1/loader.js",
    );
  });

  it("override 시 동봉 prefix(_widget) 를 붙이지 않는다", () => {
    vi.stubEnv(ENV_KEY, "https://cdn.example.com");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    expect(getWidgetBase()).not.toContain("_widget");
  });
});

describe("widget-base — getWidgetOrigin", () => {
  it("env override 시 CDN origin 을 추출", () => {
    vi.stubEnv(ENV_KEY, "https://cdn.example.com/some/path");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    expect(getWidgetOrigin()).toBe("https://cdn.example.com");
  });

  it("동봉 self-origin(env 미설정) 시 배포 origin", () => {
    vi.stubEnv(ENV_KEY, "");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    // base = https://app.example.com/_widget → origin = https://app.example.com
    expect(getWidgetOrigin()).toBe("https://app.example.com");
  });

  it("해석 불가(SSR + env 미설정) 시 빈 문자열", () => {
    vi.stubEnv(ENV_KEY, "");
    vi.stubGlobal("window", undefined);
    expect(getWidgetOrigin()).toBe("");
  });

  it("SSR + env override 면 그 origin", () => {
    vi.stubEnv(ENV_KEY, "https://cdn.example.com");
    vi.stubGlobal("window", undefined);
    expect(getWidgetOrigin()).toBe("https://cdn.example.com");
  });
});

describe("widget-base — isWidgetHostingConfigured", () => {
  it("브라우저 컨텍스트(window 존재)면 동봉 self-origin 으로 항상 true", () => {
    vi.stubEnv(ENV_KEY, "");
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    expect(isWidgetHostingConfigured()).toBe(true);
  });

  it("env override 가 있으면 true", () => {
    vi.stubEnv(ENV_KEY, "https://cdn.example.com");
    vi.stubGlobal("window", undefined);
    expect(isWidgetHostingConfigured()).toBe(true);
  });

  it("SSR(window 없음) + env 미설정이면 false (해석 불가)", () => {
    vi.stubEnv(ENV_KEY, "");
    vi.stubGlobal("window", undefined);
    expect(isWidgetHostingConfigured()).toBe(false);
  });
});
