import {
  DEPTH_MASK_MARKER,
  isMaskedMarker,
  KEY_MASK_MARKER,
  MASKED_MARKERS,
  MAX_MASK_DEPTH,
  VALUE_MASK_MARKER,
} from "../index";

/**
 * 이 패키지가 지키는 것은 **두 스택이 같은 집합을 본다**는 사실 하나다. 값이 바뀌면 그
 * 사실이 깨지는 게 아니라 *양쪽이 함께* 바뀌므로, 여기 단언들은 "값을 고정" 하는 게 아니라
 * **집합의 성질**(정확 일치·불변성·깊이 계약)을 고정한다.
 */
describe("@workflow/masked-markers", () => {
  /**
   * **리터럴을 직접 못박는다** (`11_27_29` testing W2). 아래 "집합을 이룬다" 단언은 상수들의
   * **상호** 정합만 보므로, 세 값이 함께 바뀌면 GREEN 을 유지한다 — 자기참조적이다.
   * 이 값들은 backend 가 생산하고 frontend 가 판정하는 **관측 가능한 계약**이라 실수로 바뀌면
   * 이미 저장된 마스킹 값이 인식되지 않는다.
   */
  it.each([
    ["VALUE_MASK_MARKER", VALUE_MASK_MARKER, "***"],
    ["KEY_MASK_MARKER", KEY_MASK_MARKER, "[REDACTED]"],
    ["DEPTH_MASK_MARKER", DEPTH_MASK_MARKER, "[REDACTED_DEPTH]"],
  ])("[캐너리] %s 리터럴 고정", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("마커 세 개가 집합을 이룬다", () => {
    expect([...MASKED_MARKERS]).toEqual([
      VALUE_MASK_MARKER,
      KEY_MASK_MARKER,
      DEPTH_MASK_MARKER,
    ]);
  });

  /**
   * **`Object.freeze(new Set(...))` 은 플라시보다** — `Set` 의 데이터는 own property 가
   * 아니라 내부 슬롯에 있어 freeze 가 닿지 않고 `.add()` 가 그대로 성공한다. 이전 구현이
   * 실제로 그 함정에 빠졌고, "런타임 불변화" 라고 문서까지 적혀 있었다.
   *
   * 이 집합은 egress 마스킹과 재제출 거부 **두 판정기가 공유**하므로 변형이 파급되면 양쪽이
   * 동시에 오염된다. 그래서 보장을 기계에 맡긴다 — `Set` 으로 되돌리면 여기가 RED 다.
   */
  it("[캐너리] MASKED_MARKERS 는 실제로 불변이다", () => {
    expect(Object.isFrozen(MASKED_MARKERS)).toBe(true);
    expect(() => {
      (MASKED_MARKERS as string[]).push("injected");
    }).toThrow(TypeError);
    expect(isMaskedMarker("injected")).toBe(false);
  });

  it.each([VALUE_MASK_MARKER, KEY_MASK_MARKER, DEPTH_MASK_MARKER])(
    "%s 는 마커로 판정된다",
    (marker) => {
      expect(isMaskedMarker(marker)).toBe(true);
    },
  );

  /**
   * **정확 일치만 본다.** 부분 포함을 잡으면 사용자가 실제로 쓸 수 있는 값(`a***b`)을 막게
   * 되고, 그 거짓양성 비용이 거짓음성 비용보다 크다는 것이 이 계약의 결정이다.
   */
  it.each([
    ["부분 포함", "a***b"],
    ["접두", "***b"],
    ["접미", "a***"],
    ["공백 포함", " *** "],
    ["빈 문자열", ""],
    ["유사 리터럴", "[REDACTED_OTHER]"],
  ])("[캐너리] %s 는 마커가 아니다", (_kind, value) => {
    expect(isMaskedMarker(value)).toBe(false);
  });

  it.each([
    ["number", 0],
    ["null", null],
    ["undefined", undefined],
    ["object", {}],
    ["array", []],
  ])("[캐너리] 비문자열 %s 는 마커가 아니다", (_kind, value) => {
    expect(isMaskedMarker(value)).toBe(false);
  });

  /**
   * 깊이 상한은 **마스커가 치환하는 자리**이자 **스캐너가 닿아야 하는 자리**다. 두 소비처가
   * 이 하나의 수를 공유하는 것이 계약의 전부이므로, 값 자체보다 "둘이 같은 것을 본다" 가
   * 중요하다. 여기서는 타입·부호만 고정한다.
   */
  it("MAX_MASK_DEPTH 는 양의 정수다", () => {
    expect(Number.isInteger(MAX_MASK_DEPTH)).toBe(true);
    expect(MAX_MASK_DEPTH).toBeGreaterThan(0);
  });
});
