import { afterEach, describe, it, expect, vi } from "vitest";
import { refreshDelayMs, safeApiBaseFromQuery, shouldAbortAfterSeed, sseErrorDetail, TOKEN_REFRESH_MIN_DELAY_MS, type SeedOutcome } from "./use-widget";

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
  it("javascript: 스킴 → 무시(undefined) + console.warn 호출", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery("javascript:alert(1)")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[widget]"), "javascript:alert(1)");
  });
  it("data: 스킴 → 무시(undefined) + console.warn 호출", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery("data:text/html,<script>")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[widget]"), "data:text/html,<script>");
  });
  it("상대 경로(파싱 불가) → 무시 + console.warn 호출", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery("/api")).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
  it("빈 문자열 → undefined(경고 없음 — !raw 선처리)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery("")).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
  it("null → undefined(경고 없음)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeApiBaseFromQuery(null)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * SSE `error` 로그의 **내용**을 직접 겨냥한다.
 *
 * 통합 쪽 회귀(`use-widget-eager-start.test.ts`)는 "토큰이 안 나온다" 만 본다. 그래서
 * `readyState` 추출을 통째로 `return "error"` 로 뭉개도 위젯 스위트 75건이 전부 GREEN 이었다
 * (실측, ai-review `10_24_54` testing) — **없애려던 결함(진단 정보 0)이 그대로 돌아와도
 * 아무도 모른다.** 두 축(토큰 미노출 / 진단 정보 보존)은 서로 다른 테스트가 잡아야 한다.
 */
describe("sseErrorDetail — 토큰 없이 진단 정보만", () => {
  it("`readyState` 를 담는다 — 일시적 끊김과 확정 실패를 가르는 유일한 신호", () => {
    expect(sseErrorDetail({ type: "error", target: { readyState: 0 } })).toContain("readyState=0");
    expect(sseErrorDetail({ type: "error", target: { readyState: 2 } })).toContain("readyState=2");
  });

  it("URL·토큰은 담지 않는다 — `target.url` 이 있어도", () => {
    const out = sseErrorDetail({
      type: "error",
      target: { readyState: 0, url: "https://api.test/stream?token=iext_secret" },
    });
    expect(out).not.toContain("iext_secret");
    expect(out).not.toContain("token=");
  });

  /**
   * **키는 있는데 값이 `undefined`** — `"readyState" in target` 존재검사를 `?? null` 로 바꾸는
   * 리팩터가 이 축 없이는 조용히 통과한다(ai-review `10_41_08` testing INFO).
   */
  it("`readyState` 키가 있고 값이 undefined 면 그 사실을 담는다", () => {
    expect(sseErrorDetail({ type: "error", target: { readyState: undefined } })).toContain("readyState=undefined");
  });

  it("`readyState` 가 없으면 담지 않는다(문자열은 여전히 반환)", () => {
    expect(sseErrorDetail({ type: "error" })).toBe("error");
    expect(sseErrorDetail(null)).toBe("error");
    expect(sseErrorDetail("boom")).toBe("error");
  });
});

/**
 * `SeedOutcome` 네 갈래의 **진리표를 직접** 단언한다.
 *
 * 통합 테스트만으로는 이 함수의 오판정을 못 가른다 — `"stale"` 을 `"continue"` 로 바꾸는
 * 뮤턴트가 위젯 스위트 **418건을 전부 통과**했다(실측, ai-review `10_41_08` testing).
 * `start()` 호출부는 후행 `isStale(gen)` 재검사가 우연히 덮어 주지만 `applyConfig` 는 다른
 * 축(`isAttemptStale`)이라 같은 동치가 서지 않는다. `sseErrorDetail` 이 겪은 것과 같은 형태다.
 */
describe("shouldAbortAfterSeed — 중단 판정 진리표", () => {
  it("`ended`·`stale` 은 중단, `continue`·`refresh_deferred` 는 진행", () => {
    expect(shouldAbortAfterSeed("ended")).toBe(true);
    expect(shouldAbortAfterSeed("stale")).toBe(true);
    expect(shouldAbortAfterSeed("continue")).toBe(false);
    expect(shouldAbortAfterSeed("refresh_deferred")).toBe(false);
  });

  /**
   * **fail-closed 축** — 화이트리스트라 갈래가 늘면 자동으로 "중단" 이 된다. 이 단언은 타입을
   * 우회해야만 쓸 수 있는데(그게 요점이다) 다섯 번째 갈래가 생겼을 때 기본값이 어느 쪽인지를
   * 고정한다.
   */
  it("모르는 갈래는 중단으로 떨어진다(fail-closed)", () => {
    expect(shouldAbortAfterSeed("something_new" as SeedOutcome)).toBe(true);
  });
});
