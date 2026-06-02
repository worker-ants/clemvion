import { describe, it, expect } from "vitest";
import {
  refreshDelayMs,
  TOKEN_REFRESH_LEAD_MS,
  TOKEN_REFRESH_MIN_DELAY_MS,
} from "./use-widget";

describe("refreshDelayMs — 토큰 자동 갱신 지연(3-auth-session §3 step7)", () => {
  const now = Date.parse("2026-06-02T00:00:00.000Z");

  it("만료 2시간 후 → (만료-30분-now) 시점에 갱신 예약", () => {
    const expiresAt = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const delay = refreshDelayMs(expiresAt, now);
    // 2h - 30m = 90m
    expect(delay).toBe(90 * 60 * 1000);
  });

  it("이미 만료 30분 이내 → 최소 지연(즉시 갱신)", () => {
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString(); // 10분 후
    const delay = refreshDelayMs(expiresAt, now);
    expect(delay).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });

  it("이미 만료된 토큰 → 최소 지연", () => {
    const expiresAt = new Date(now - 60 * 1000).toISOString();
    expect(refreshDelayMs(expiresAt, now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });

  it("정확히 lead 경계 → 최소 지연으로 클램프", () => {
    const expiresAt = new Date(now + TOKEN_REFRESH_LEAD_MS).toISOString();
    expect(refreshDelayMs(expiresAt, now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });

  it("파싱 불가 expiresAt → null", () => {
    expect(refreshDelayMs("not-a-date", now)).toBeNull();
  });
});
