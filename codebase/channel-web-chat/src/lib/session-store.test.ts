import { describe, it, expect, beforeEach } from "vitest";
import { saveSession, loadSession, clearSession, type PersistedSession } from "./session-store";

const endpoints = {
  stream: "/s",
  submit: "/i",
  status: "/st",
  cancel: "/c",
  refresh: "/r",
};

function session(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    executionId: "exec-1",
    token: "iext_abc",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    endpoints,
    ...overrides,
  };
}

beforeEach(() => localStorage.clear());

describe("session-store", () => {
  it("save → load 라운드트립", () => {
    saveSession("trig-1", session());
    const loaded = loadSession("trig-1");
    expect(loaded?.executionId).toBe("exec-1");
    expect(loaded?.token).toBe("iext_abc");
  });

  it("trigger 별 격리", () => {
    saveSession("trig-1", session({ executionId: "a" }));
    saveSession("trig-2", session({ executionId: "b" }));
    expect(loadSession("trig-1")?.executionId).toBe("a");
    expect(loadSession("trig-2")?.executionId).toBe("b");
  });

  it("미존재 → null", () => {
    expect(loadSession("none")).toBeNull();
  });

  it("만료 토큰 → null + 폐기", () => {
    saveSession("trig-1", session({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(loadSession("trig-1")).toBeNull();
    expect(localStorage.getItem("clemvion-web-chat:session:trig-1")).toBeNull();
  });

  it("clear 후 null", () => {
    saveSession("trig-1", session());
    clearSession("trig-1");
    expect(loadSession("trig-1")).toBeNull();
  });

  it("손상된 JSON → null", () => {
    localStorage.setItem("clemvion-web-chat:session:trig-1", "{bad");
    expect(loadSession("trig-1")).toBeNull();
  });
});
