import { describe, expect, it } from "vitest";
import {
  buildBootConfig,
  defaultDemoForm,
  isBootReady,
  isDemoEnabled,
  parseSuggestions,
  type DemoFormState,
} from "./demo-config";

describe("parseSuggestions", () => {
  it("splits on newline and comma, trims, drops empties", () => {
    expect(parseSuggestions("a\nb, c\n\n , d")).toEqual(["a", "b", "c", "d"]);
  });
  it("returns [] for blank input", () => {
    expect(parseSuggestions("   \n , ")).toEqual([]);
  });
  it("trims tab-padded entries", () => {
    expect(parseSuggestions("\ta\t,\tb\t")).toEqual(["a", "b"]);
  });
});

describe("isBootReady", () => {
  it("requires both apiBase and triggerEndpointPath", () => {
    expect(isBootReady({ ...defaultDemoForm, triggerEndpointPath: "t1" })).toBe(true);
    expect(isBootReady({ ...defaultDemoForm, triggerEndpointPath: "  " })).toBe(false);
    expect(
      isBootReady({ ...defaultDemoForm, apiBase: "", triggerEndpointPath: "t1" }),
    ).toBe(false);
  });
  it("treats whitespace-only apiBase as not ready", () => {
    expect(isBootReady({ ...defaultDemoForm, apiBase: "   ", triggerEndpointPath: "t1" })).toBe(
      false,
    );
  });
});

describe("buildBootConfig", () => {
  const form: DemoFormState = {
    ...defaultDemoForm,
    apiBase: "  http://localhost:3011/api  ",
    triggerEndpointPath: "  abc-123  ",
    locale: "en",
    primaryColor: "#ff0000",
    position: "bottom-left",
    headerTitle: " 봇 ",
    welcomeText: " 안녕 ",
    welcomeSuggestions: "q1\nq2",
    launcherSuggestions: "L1",
    disclaimer: " 주의 ",
  };

  it("trims required fields and carries locale", () => {
    const cfg = buildBootConfig(form);
    expect(cfg.apiBase).toBe("http://localhost:3011/api");
    expect(cfg.triggerEndpointPath).toBe("abc-123");
    expect(cfg.locale).toBe("en");
  });

  it("assembles appearance, welcome, launcher, header, disclaimer", () => {
    const cfg = buildBootConfig(form);
    expect(cfg.appearance).toEqual({ primaryColor: "#ff0000", position: "bottom-left" });
    expect(cfg.headerTitle).toBe("봇");
    expect(cfg.welcome).toEqual({ text: "안녕", suggestions: ["q1", "q2"] });
    expect(cfg.launcher).toEqual({ suggestions: ["L1"] });
    expect(cfg.disclaimer).toBe("주의");
  });

  it("omits empty optional fields", () => {
    const cfg = buildBootConfig({
      ...defaultDemoForm,
      apiBase: "http://x/api",
      triggerEndpointPath: "t",
      headerTitle: "",
      welcomeText: "",
      welcomeSuggestions: "",
      launcherSuggestions: "",
      disclaimer: "",
    });
    expect(cfg.headerTitle).toBeUndefined();
    expect(cfg.welcome).toBeUndefined();
    expect(cfg.launcher).toBeUndefined();
    expect(cfg.disclaimer).toBeUndefined();
    // appearance still carries position even when nothing else set
    expect(cfg.appearance?.position).toBe("bottom-right");
  });

  it("omits whitespace-only primaryColor", () => {
    const cfg = buildBootConfig({
      ...defaultDemoForm,
      apiBase: "http://x/api",
      triggerEndpointPath: "t",
      primaryColor: "   ",
    });
    expect(cfg.appearance?.primaryColor).toBeUndefined();
    expect(cfg.appearance?.position).toBe("bottom-right");
  });
});

describe("isDemoEnabled", () => {
  it("enabled in non-production regardless of flag", () => {
    expect(isDemoEnabled({ nodeEnv: "development" })).toBe(true);
    expect(isDemoEnabled({ nodeEnv: "test" })).toBe(true);
  });
  it("disabled in production unless opt-in flag is 1", () => {
    expect(isDemoEnabled({ nodeEnv: "production" })).toBe(false);
    expect(isDemoEnabled({ nodeEnv: "production", enableFlag: "0" })).toBe(false);
    expect(isDemoEnabled({ nodeEnv: "production", enableFlag: "1" })).toBe(true);
  });
  it("enabled when nodeEnv is unset (treated as non-production)", () => {
    expect(isDemoEnabled({})).toBe(true);
  });
});
