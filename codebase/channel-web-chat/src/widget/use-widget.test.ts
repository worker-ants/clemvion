import { describe, it, expect } from "vitest";
import { refreshDelayMs, TOKEN_REFRESH_MIN_DELAY_MS } from "./use-widget";

// refreshDelayMs 본 검증은 use-token-refresh.test.ts 로 이관(God hook 분리, §B). 여기서는 use-widget 의
// 하위호환 re-export 가 살아있는지만 smoke-check — 기존 import 경로 `./use-widget` 사용처 보호.
describe("use-widget — 토큰 갱신 헬퍼 re-export (하위호환 smoke)", () => {
  it("refreshDelayMs·TOKEN_REFRESH_MIN_DELAY_MS 가 use-widget 에서 re-export 됨", () => {
    const now = Date.parse("2026-06-02T00:00:00.000Z");
    expect(refreshDelayMs(new Date(now + 2 * 60 * 60 * 1000).toISOString(), now)).toBe(90 * 60 * 1000);
    expect(refreshDelayMs(new Date(now + 10 * 60 * 1000).toISOString(), now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });
});
