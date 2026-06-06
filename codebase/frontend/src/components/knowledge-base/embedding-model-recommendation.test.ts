import { describe, it, expect } from "vitest";
import { isKoreanRecommendedEmbeddingModel } from "./embedding-model-recommendation";

describe("isKoreanRecommendedEmbeddingModel", () => {
  it.each([
    "nlpai-lab/KURE-v1",
    "snowflake-arctic-embed-l",
    "BAAI/bge-m3",
    "bge-m3",
    "intfloat/multilingual-e5-large",
    "multilingual-e5-base",
    "text-embedding-3-small",
    "text-embedding-3-large",
  ])("추천 모델로 식별: %s", (modelId) => {
    expect(isKoreanRecommendedEmbeddingModel(modelId)).toBe(true);
  });

  it.each([
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
