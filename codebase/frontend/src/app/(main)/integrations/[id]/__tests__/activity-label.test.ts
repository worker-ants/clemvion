import { describe, it, expect } from "vitest";
import { tryTranslateLabel } from "../activity-label";

// V-08: Activity 탭 API 컬럼이 catalog key 를 사람 친화 라벨로 변환할 때
// flat dotted-key dict 를 직접 lookup 하는지 (i18n t() nested 순회 우회) 검증.
describe("tryTranslateLabel", () => {
  it("makeshop prefix + dict hit → 사람 친화 라벨 (ko)", () => {
    expect(tryTranslateLabel("makeshop.shop.get-authority", "ko")).toBe(
      "상점 권한 조회",
    );
  });

  it("makeshop prefix + dict hit → label (en)", () => {
    expect(tryTranslateLabel("makeshop.shop.get-authority", "en")).toBe(
      "Get Authority",
    );
  });

  it("cafe24 prefix + dict hit → 사람 친화 라벨 (ko)", () => {
    expect(
      tryTranslateLabel("cafe24.application.applications_list", "ko"),
    ).toBe("설치된 앱 목록 조회");
  });

  it("makeshop prefix + dict miss → null (endpoint fallback)", () => {
    expect(
      tryTranslateLabel("makeshop.shop.__nonexistent_op__", "ko"),
    ).toBeNull();
  });

  it("cafe24 prefix + dict miss → null (endpoint fallback)", () => {
    expect(
      tryTranslateLabel("cafe24.__nonexistent__.__op__", "ko"),
    ).toBeNull();
  });

  it("알 수 없는 provider prefix → null", () => {
    expect(tryTranslateLabel("http.something.else", "ko")).toBeNull();
  });

  it("prefix 없는 임의 문자열 → null", () => {
    expect(tryTranslateLabel("not-a-catalog-key", "ko")).toBeNull();
  });
});
