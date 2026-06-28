import { afterEach, describe, it, expect, vi } from "vitest";
import { refreshDelayMs, safeApiBaseFromQuery, TOKEN_REFRESH_MIN_DELAY_MS } from "./use-widget";

// refreshDelayMs 본 검증은 use-token-refresh.test.ts 로 이관(God hook 분리, §B). 여기서는 use-widget 의
// 하위호환 re-export 가 살아있는지만 smoke-check — 기존 import 경로 `./use-widget` 사용처 보호.
describe("use-widget — 토큰 갱신 헬퍼 re-export (하위호환 smoke)", () => {
  it("refreshDelayMs·TOKEN_REFRESH_MIN_DELAY_MS 가 use-widget 에서 re-export 됨", () => {
    const now = Date.parse("2026-06-02T00:00:00.000Z");
    expect(refreshDelayMs(new Date(now + 2 * 60 * 60 * 1000).toISOString(), now)).toBe(90 * 60 * 1000);
    expect(refreshDelayMs(new Date(now + 10 * 60 * 1000).toISOString(), now)).toBe(TOKEN_REFRESH_MIN_DELAY_MS);
  });
});

// 쿼리 apiBase 하드닝 — http(s) 스킴만 허용(direct-load 외부 입력 방어).
describe("safeApiBaseFromQuery", () => {
  afterEach(() => vi.restoreAllMocks());

  it("https URL → 그대로 허용", () => {
    expect(safeApiBaseFromQuery("https://api.example.com/api")).toBe("https://api.example.com/api");
  });
  it("http URL(localhost 개발) → 허용", () => {
    expect(safeApiBaseFromQuery("http://localhost:3000/api")).toBe("http://localhost:3000/api");
  });
  it("javascript: 스킴 → 무시(undefined)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery("javascript:alert(1)")).toBeUndefined();
  });
  it("상대 경로(파싱 불가) → 무시", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery("/api")).toBeUndefined();
  });
  it("null → undefined(경고 없음)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery(null)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
