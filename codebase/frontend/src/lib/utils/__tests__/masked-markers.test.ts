import { describe, it, expect } from "vitest";
import {
  MASKED_MARKERS,
  isMaskedMarker,
  hasMaskedMarkerLeaf,
} from "../masked-markers";

/**
 * 공용 유틸의 **직접** 단위 테스트. 종전엔 컴포넌트 렌더를 통한 간접 검증만 있어
 * non-string 입력 경로가 한 번도 행사되지 않았다 (`14_08_45` INFO-6).
 */
describe("masked-markers", () => {
  it("마커 집합이 backend SoT 의 리터럴과 일치한다", () => {
    expect([...MASKED_MARKERS]).toEqual([
      "***",
      "[REDACTED]",
      "[REDACTED_DEPTH]",
    ]);
  });

  it.each([...MASKED_MARKERS])("`%s` 를 마커로 판별한다", (m) => {
    expect(isMaskedMarker(m)).toBe(true);
  });

  it.each([123, null, undefined, true, {}, []])(
    "non-string %s 는 마커가 아니다",
    (v) => {
      expect(isMaskedMarker(v)).toBe(false);
    },
  );

  it("[캐너리] 마커를 포함만 하는 문자열은 마커가 아니다 — 정확 일치 경계", () => {
    expect(isMaskedMarker("a***b")).toBe(false);
    expect(isMaskedMarker("***bold***")).toBe(false);
    expect(isMaskedMarker("postgres://***@db/prod")).toBe(false);
  });

  describe("hasMaskedMarkerLeaf", () => {
    it("중첩 객체·배열의 leaf 를 찾는다", () => {
      expect(hasMaskedMarkerLeaf({ a: { b: [{ c: "***" }] } })).toBe(true);
      expect(hasMaskedMarkerLeaf([1, [2, ["[REDACTED]"]]])).toBe(true);
    });

    it("마커가 없으면 false — 깊어도 마찬가지", () => {
      expect(hasMaskedMarkerLeaf({ a: { b: [{ c: "ok" }] } })).toBe(false);
      expect(hasMaskedMarkerLeaf(null)).toBe(false);
      expect(hasMaskedMarkerLeaf(42)).toBe(false);
    });

    it("[캐너리] 부분 포함은 잡지 않는다 — substring 구현으로 넓히면 RED", () => {
      expect(hasMaskedMarkerLeaf({ note: "***bold*** text" })).toBe(false);
    });
  });
});
