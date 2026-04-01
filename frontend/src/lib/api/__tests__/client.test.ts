import { describe, it, expect, beforeEach, vi } from "vitest";

let setAccessToken: typeof import("../client").setAccessToken;
let getAccessToken: typeof import("../client").getAccessToken;

describe("client token management", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../client");
    setAccessToken = mod.setAccessToken;
    getAccessToken = mod.getAccessToken;
  });

  it("stores and retrieves token in memory", () => {
    setAccessToken("test-token");
    expect(getAccessToken()).toBe("test-token");
  });

  it("returns null when no token is set", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("clears token when set to null", () => {
    setAccessToken("test-token");
    expect(getAccessToken()).toBe("test-token");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("does not use sessionStorage", () => {
    setAccessToken("test-token");
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });
});
