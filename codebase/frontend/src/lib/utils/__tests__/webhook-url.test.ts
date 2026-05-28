import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWebhookBaseUrl, getWebhookUrl } from "../webhook-url";

const PATH = "abc-123";

describe("webhook-url", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  describe("getWebhookBaseUrl", () => {
    it("uses NEXT_PUBLIC_WEBHOOK_BASE_URL when set (trailing slash trimmed)", () => {
      process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL = "https://hooks.example.com/";
      expect(getWebhookBaseUrl()).toBe("https://hooks.example.com");
    });

    it("prefers the explicit override over NEXT_PUBLIC_API_URL", () => {
      process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL = "https://hooks.example.com";
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api";
      expect(getWebhookBaseUrl()).toBe("https://hooks.example.com");
    });

    it("derives the origin from NEXT_PUBLIC_API_URL by stripping the /api suffix", () => {
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:3011/api";
      expect(getWebhookBaseUrl()).toBe("http://localhost:3011");
    });

    it("handles NEXT_PUBLIC_API_URL with a trailing slash", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://app.example.com/api/";
      expect(getWebhookBaseUrl()).toBe("https://app.example.com");
    });

    it("falls back to window.location.origin when no env var is set", () => {
      vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
      expect(getWebhookBaseUrl()).toBe("https://app.example.com");
    });

    it("never appends a hardcoded port to the browser origin", () => {
      vi.stubGlobal("window", { location: { origin: "https://staging.example.com" } });
      expect(getWebhookBaseUrl()).toBe("https://staging.example.com");
    });

    it("treats a whitespace-only override as unset and falls through", () => {
      process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL = "   ";
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:3011/api";
      expect(getWebhookBaseUrl()).toBe("http://localhost:3011");
    });

    it("uses NEXT_PUBLIC_API_URL as-is when it has no /api suffix", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
      expect(getWebhookBaseUrl()).toBe("https://api.example.com");
    });
  });

  describe("getWebhookUrl", () => {
    it("builds {base}/api/hooks/{path} per WH-EP-02", () => {
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:3011/api";
      expect(getWebhookUrl(PATH)).toBe("http://localhost:3011/api/hooks/abc-123");
    });

    it("uses the production service domain in staging/prod (no :3011)", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://app.example.com/api";
      expect(getWebhookUrl(PATH)).toBe("https://app.example.com/api/hooks/abc-123");
    });

    it("does not double the slash when endpointPath has a leading slash", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://app.example.com/api";
      expect(getWebhookUrl("/abc-123")).toBe("https://app.example.com/api/hooks/abc-123");
    });

    it("strips multiple leading slashes from endpointPath", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://app.example.com/api";
      expect(getWebhookUrl("//abc-123")).toBe("https://app.example.com/api/hooks/abc-123");
    });

    it("composes the full URL from the explicit override (priority 1)", () => {
      process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL = "https://hooks.example.com";
      process.env.NEXT_PUBLIC_API_URL = "https://app.example.com/api";
      expect(getWebhookUrl(PATH)).toBe("https://hooks.example.com/api/hooks/abc-123");
    });
  });
});
