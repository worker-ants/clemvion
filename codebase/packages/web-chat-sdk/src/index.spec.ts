import { boot, validateBootConfig, WC_MESSAGE_PREFIX } from "./index";
import type { BootConfig } from "./types";

const valid: BootConfig = {
  apiBase: "https://api.example.com",
  triggerEndpointPath: "a1b2c3",
};

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

describe("boot (스캐폴딩 stub)", () => {
  it("유효 config 로 인스턴스를 반환", () => {
    const chat = boot(valid);
    expect(typeof chat.open).toBe("function");
    expect(typeof chat.shutdown).toBe("function");
  });

  it("invalid config 는 boot 단계에서 throw", () => {
    expect(() => boot({ ...valid, apiBase: "" })).toThrow();
  });

  it("미구현 메서드는 NotImplemented 로 명확히 throw", () => {
    const chat = boot(valid);
    expect(() => chat.open()).toThrow(/미구현/);
  });
});

describe("postMessage 규약", () => {
  it("wc: namespace prefix 상수", () => {
    expect(WC_MESSAGE_PREFIX).toBe("wc:");
  });
});
