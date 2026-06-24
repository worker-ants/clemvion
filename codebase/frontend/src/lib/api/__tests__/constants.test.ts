import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// API_BASE_URL / WS_BASE_URL 은 모듈 로드 시점에 평가되는 상수이므로, env 별
// 동작을 검증하려면 env 를 세팅한 뒤 vi.resetModules() 로 모듈을 다시 import 한다.
// getServerApiBaseUrl() 은 호출 시점에 env 를 읽으므로 직접 호출로 검증한다.
async function importConstants() {
  vi.resetModules();
  return import("../constants");
}

describe("lib/api/constants", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.INTERNAL_API_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("API_BASE_URL", () => {
    it("uses NEXT_PUBLIC_API_URL when set", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api";
      const { API_BASE_URL } = await importConstants();
      expect(API_BASE_URL).toBe("https://api.example.com/api");
    });

    it("falls back to canonical port 3011 when unset (regression guard: never 3001)", async () => {
      const { API_BASE_URL } = await importConstants();
      expect(API_BASE_URL).toBe("http://localhost:3011/api");
      expect(API_BASE_URL).not.toContain("3001");
    });
  });

  describe("WS_BASE_URL", () => {
    it("uses NEXT_PUBLIC_WS_URL when set", async () => {
      process.env.NEXT_PUBLIC_WS_URL = "https://ws.example.com";
      const { WS_BASE_URL } = await importConstants();
      expect(WS_BASE_URL).toBe("https://ws.example.com");
    });

    it("falls back to canonical port 3011 when unset (regression guard: never 3001)", async () => {
      const { WS_BASE_URL } = await importConstants();
      expect(WS_BASE_URL).toBe("http://localhost:3011");
      expect(WS_BASE_URL).not.toContain("3001");
    });
  });

  describe("getServerApiBaseUrl", () => {
    it("prefers INTERNAL_API_URL over NEXT_PUBLIC_API_URL", async () => {
      process.env.INTERNAL_API_URL = "http://backend:3011/api";
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api";
      const { getServerApiBaseUrl } = await importConstants();
      expect(getServerApiBaseUrl()).toBe("http://backend:3011/api");
    });

    it("uses NEXT_PUBLIC_API_URL when INTERNAL_API_URL is unset", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api";
      const { getServerApiBaseUrl } = await importConstants();
      expect(getServerApiBaseUrl()).toBe("https://api.example.com/api");
    });

    it("falls back to canonical port 3011 when both unset (regression guard: never 3001)", async () => {
      const { getServerApiBaseUrl } = await importConstants();
      expect(getServerApiBaseUrl()).toBe("http://localhost:3011/api");
      expect(getServerApiBaseUrl()).not.toContain("3001");
    });
  });
});
