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
  /**
   * **이 테스트가 지키는 것과 못 지키는 것** (`16_25_35` testing INFO-7).
   *
   * 지킨다: 프런트 상수가 **여기 적힌 리터럴**에서 조용히 바뀌는 것. 값을 지우거나
   * 오타를 내면 RED 다.
   *
   * 못 지킨다: **backend 가 바뀌는 것**. 같은 파일 안의 리터럴-대-리터럴 비교라 진짜
   * 크로스체크가 아니다 — backend jest 와 frontend vitest 가 갈려 있어 공유 패키지
   * 추출이 선행돼야 값싸다(트래커 "마커 미러 계약 테스트" 항목).
   *
   * 그래서 이름을 *"backend SoT 와 일치한다"* 로 쓰지 않는다. 지키지 못하는 것을 지키는
   * 것처럼 부르면 다음 사람이 이 자리에 방어가 있다고 믿는다.
   */
  it("마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend 미러는 트래커)", () => {
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

    /**
     * 깊이 상한 경계 (`16_25_35` performance W1).
     *
     * backend `deepRedactCore` 는 `depth >= MAX_REDACT_DEPTH(10)` 에서 서브트리를 통째로
     * 마커로 **치환**한다 — 즉 마스킹된 값에서 마커가 놓일 수 있는 **가장 깊은 자리가 정확히
     * depth 10** 이다. 프런트 상한이 그 자리를 못 보면 그게 곧 fail-open 이다.
     *
     * 두 방향을 함께 고정한다:
     * - depth 10 의 마커는 **검사된다** (값 검사가 깊이 검사보다 먼저여야 통과)
     * - depth 11 은 안 본다 (상한이 실재함 — 상한을 지우면 이 단언이 RED)
     */
    const nest = (depth: number, leaf: unknown): unknown => {
      let v = leaf;
      for (let i = 0; i < depth; i++) v = { n: v };
      return v;
    };

    /** 같은 깊이를 **배열로** 쌓는다 — 두 분기가 깊이를 같은 보폭으로 세는지 본다. */
    const nestArr = (depth: number, leaf: unknown): unknown => {
      let v = leaf;
      for (let i = 0; i < depth; i++) v = [v];
      return v;
    };

    it("[경계] 상한 깊이(10)에 놓인 마커는 잡는다 — backend 치환 지점", () => {
      expect(hasMaskedMarkerLeaf(nest(10, "***"))).toBe(true);
    });

    it("[경계] 상한보다 깊은 마커는 보지 않는다 — 상한이 실재한다", () => {
      expect(hasMaskedMarkerLeaf(nest(11, "***"))).toBe(false);
    });

    /**
     * **배열 분기도 같은 보폭이어야 한다** (`17_13_19` testing INFO-6 을 실측하다 찾았다).
     *
     * 리뷰어는 *"배열 분기의 `depth + 1` 누락 뮤테이션을 못 잡는다"* 고 했는데 **그건
     * 반증됐다** — 아래 깊은 회귀 테스트가 배열로 만들어져 있어 과소 계수는 스택이
     * 터지며 RED 가 된다. 하지만 그 자리를 실측하다 **반대 방향**이 비어 있는 걸 찾았다:
     * `depth + 2` 로 **과다 계수**하면 17개가 전부 GREEN 이다. 그러면 배열로 감싼 마커가
     * 상한의 절반 깊이에서 이미 안 보이게 된다 — fail-open 이다.
     *
     * 객체 경계 테스트는 이걸 못 잡는다(객체 분기는 정상이므로). 그래서 같은 경계를
     * **배열로도** 고정한다.
     */
    it("[경계] 배열로 쌓은 상한 깊이(10) 마커도 잡는다 — 두 분기 보폭 동일", () => {
      expect(hasMaskedMarkerLeaf(nestArr(10, "***"))).toBe(true);
      expect(hasMaskedMarkerLeaf(nestArr(11, "***"))).toBe(false);
    });

    /**
     * **스택 오버플로 회귀** — 상한을 지우면 `RangeError` 로 RED.
     *
     * 실측(node 24/V8): `JSON.parse` 는 depth 100,000 도 통과시키는데 상한 없는 재귀는
     * 5,000 에서 터진다. 에디터 "Run with Input" 은 사용자가 붙여넣은 임의 JSON 을 파싱해
     * 곧바로 이 함수에 넘기고, 그 호출부는 `useMemo`(렌더 경로)라 예외가 React 트리로
     * 전파돼 화면이 깨진다. 크기는 **옛 구현이 실제로 터지는 값**으로 골랐다 — 1,000 으로
     * 잡으면 상한 없는 구현도 통과해 vacuous 하다.
     */
    it("[회귀] 매우 깊은 입력에서도 던지지 않는다 (상한 제거 시 RangeError)", () => {
      const deep = JSON.parse("[".repeat(5000) + "0" + "]".repeat(5000));
      expect(() => hasMaskedMarkerLeaf(deep)).not.toThrow();
      expect(hasMaskedMarkerLeaf(deep)).toBe(false);
    });
  });
});
