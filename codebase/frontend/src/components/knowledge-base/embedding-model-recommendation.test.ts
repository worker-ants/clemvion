import { describe, it, expect } from "vitest";
import {
  formatEmbeddingOptionLabel,
  isKoreanRecommendedEmbeddingModel,
} from "./embedding-model-recommendation";

describe("isKoreanRecommendedEmbeddingModel", () => {
  it.each([
    "nlpai-lab/KURE-v1",
    "snowflake-arctic-embed-l",
    "BAAI/bge-m3",
    "bge-m3",
    "intfloat/multilingual-e5-large",
    "multilingual-e5-base",
  ])("추천 모델로 식별: %s", (modelId) => {
    expect(isKoreanRecommendedEmbeddingModel(modelId)).toBe(true);
  });

  it.each([
    // text-embedding-3 는 한국어 검색 벤치마크 하위라 추천 배지 제외(product 결정).
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002", // 구형 OpenAI
    "text-embedding-004", // Gemini (한국어 강세 아님 — 보수적 제외)
    "e5-small", // 영어 e5 (multilingual 아님)
    "some-random-model",
    "bge-large-en-v1.5", // 영어 전용 bge
  ])("추천 아님: %s", (modelId) => {
    expect(isKoreanRecommendedEmbeddingModel(modelId)).toBe(false);
  });

  it("빈 값 / null / undefined → false", () => {
    expect(isKoreanRecommendedEmbeddingModel("")).toBe(false);
    expect(isKoreanRecommendedEmbeddingModel(null)).toBe(false);
    expect(isKoreanRecommendedEmbeddingModel(undefined)).toBe(false);
  });
});

describe("formatEmbeddingOptionLabel", () => {
  const BADGE = "한국어 추천";

  it("추천 모델이면 배지 suffix 를 ' · ' 구분자로 덧붙인다", () => {
    expect(
      formatEmbeddingOptionLabel(
        { id: "multilingual-e5-large", name: "multilingual-e5-large" },
        BADGE,
      ),
    ).toBe(`multilingual-e5-large · ${BADGE}`);
  });

  it("비추천 모델이면 배지 없이 라벨만 반환", () => {
    expect(
      formatEmbeddingOptionLabel(
        { id: "text-embedding-3-small", name: "text-embedding-3-small" },
        BADGE,
      ),
    ).toBe("text-embedding-3-small");
  });

  it("name 이 id 와 다르면 'name (id)' 형태로 결합", () => {
    expect(
      formatEmbeddingOptionLabel(
        { id: "intfloat/multilingual-e5-large", name: "E5 Large" },
        BADGE,
      ),
    ).toBe(`E5 Large (intfloat/multilingual-e5-large) · ${BADGE}`);
  });

  it("name 이 id 와 같으면 id 만 사용(중복 표기 회피)", () => {
    expect(
      formatEmbeddingOptionLabel({ id: "bge-m3", name: "bge-m3" }, BADGE),
    ).toBe(`bge-m3 · ${BADGE}`);
  });

  it("name 이 비어 있으면 id 로 폴백", () => {
    expect(
      formatEmbeddingOptionLabel({ id: "some-model", name: "" }, BADGE),
    ).toBe("some-model");
  });

  it("배지 문구는 호출자 주입값을 그대로 사용(i18n 비의존)", () => {
    expect(
      formatEmbeddingOptionLabel(
        { id: "bge-m3", name: "bge-m3" },
        "Recommended for Korean",
      ),
    ).toBe("bge-m3 · Recommended for Korean");
  });
});
