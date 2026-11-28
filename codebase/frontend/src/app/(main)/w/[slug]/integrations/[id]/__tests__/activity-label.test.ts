import { describe, it, expect } from "vitest";
import { resolveActivityApiLabel, tryTranslateLabel } from "../activity-label";

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
      tryTranslateLabel("cafe24.application.scripttags_list", "ko"),
    ).toBe("스크립트태그 목록 조회");
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

// 카탈로그가 없는 통합의 라벨(외부 MCP 서버의 도구 이름)은 그대로 보인다.
// 카탈로그 키는 사전 라벨로 바꾸고, 사전에 없으면 endpoint 한 줄로 넘긴다(CLE-T-22PSME).
describe("resolveActivityApiLabel", () => {
  it("카탈로그 키 + dict hit → 사전 라벨", () => {
    expect(resolveActivityApiLabel("makeshop.shop.get-authority", "ko")).toBe(
      "상점 권한 조회",
    );
  });

  it("카탈로그 키 + dict miss → null (endpoint fallback)", () => {
    expect(
      resolveActivityApiLabel("cafe24.__nonexistent__.__op__", "ko"),
    ).toBeNull();
  });

  it("카탈로그 키가 아닌 라벨(MCP 도구 이름) → 그대로", () => {
    expect(resolveActivityApiLabel("search_docs", "ko")).toBe("search_docs");
  });
});
