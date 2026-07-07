import { describe, it, expect } from "vitest";
import { nextHighlightedIndex, clampHighlightedIndex } from "../quick-add-nav";

describe("nextHighlightedIndex (§4.3)", () => {
  it("down 은 다음 인덱스, 끝에서 0 으로 순환", () => {
    expect(nextHighlightedIndex(0, "down", 3)).toBe(1);
    expect(nextHighlightedIndex(2, "down", 3)).toBe(0);
  });

  it("up 은 이전 인덱스, 처음에서 마지막으로 순환", () => {
    expect(nextHighlightedIndex(1, "up", 3)).toBe(0);
    expect(nextHighlightedIndex(0, "up", 3)).toBe(2);
  });

  it("빈 리스트는 0 유지 (크래시 없음)", () => {
    expect(nextHighlightedIndex(0, "down", 0)).toBe(0);
    expect(nextHighlightedIndex(3, "up", 0)).toBe(0);
  });

  it("범위 밖 current 는 먼저 clamp 후 이동", () => {
    // 리스트가 2개로 줄었는데 current=5 → clamp(1) 후 down → 0
    expect(nextHighlightedIndex(5, "down", 2)).toBe(0);
    expect(nextHighlightedIndex(5, "up", 2)).toBe(0);
  });
});

describe("clampHighlightedIndex (§4.3)", () => {
  it("범위 안이면 그대로", () => {
    expect(clampHighlightedIndex(1, 3)).toBe(1);
  });
  it("범위 밖이면 마지막 인덱스로 clamp", () => {
    expect(clampHighlightedIndex(5, 3)).toBe(2);
  });
  it("음수는 0", () => {
    expect(clampHighlightedIndex(-1, 3)).toBe(0);
  });
  it("빈 리스트는 0", () => {
    expect(clampHighlightedIndex(2, 0)).toBe(0);
  });
});
