import type { ModelInfo } from "@/lib/api/llm-configs";

// 한국어 임베딩 추천 모델 패턴.
//
// provider 의 listModels 응답은 동적이라 고정 카탈로그가 없다. 따라서 모델 ID
// 패턴으로 "한국어 추천" 메타 배지를 **비강제** 표시한다 — 선택을 강제하거나
// 제한하지 않으며, 자유 입력도 허용하지 않는다(select-only, R-1). 이 함수는
// option 라벨에 덧붙는 표시용 메타데이터일 뿐이다.
//
// 근거: spec/2-navigation/5-knowledge-base.md §2.2 한국어 임베딩 추천 모델 목록
//   (KURE / arctic-ko > BGE-M3 > multilingual-e5).
// 패턴 추가·변경 시 spec §2.2 와 이 파일을 함께 갱신한다.
// 보수적으로 잘 알려진 다국어/한국어 강세 모델만 화이트리스트한다.
//
// text-embedding-3 (OpenAI 대칭) 는 한국어 검색 벤치마크에서 위 모델 대비 하위라
// "추천" 배지 대상에서 제외한다 — select 자체는 막지 않으므로 사용은 여전히
// 가능하지만 "한국어 추천" 으로 오인되지 않게 한다.
//
// 입력 전처리(query:/passage: prefix·Gemini taskType) 는 목적이 다른 별도 책임으로
// 백엔드 codebase/backend/src/modules/llm/embedding-input-type.ts 가 담당한다. 이
// 파일은 UI 표시용 힌트만, 그 파일은 런타임 입력 변형만 — 의도적 분리(공유 안 함).
const KOREAN_RECOMMENDED_PATTERNS: RegExp[] = [
  /kure/i, // nlpai-lab/KURE-v1 등
  /arctic-embed/i, // Snowflake arctic-embed (ko 변형 포함)
  /(?:^|[/_-])bge-m3/i, // BAAI/bge-m3 (대칭, 다국어)
  /multilingual-e5/i, // intfloat/multilingual-e5-*
];

/**
 * 모델 ID 가 한국어 검색에 추천되는 패턴(KURE / arctic-embed / bge-m3 /
 * multilingual-e5)에 매칭되는지 판정. 비강제 표시용 메타데이터 — 선택을 막거나
 * 강제하지 않는다(select-only, R-1).
 *
 * @param modelId - 임베딩 모델 ID. `undefined` / `null` / 빈 문자열 허용 → false.
 * @returns 한국어 추천 패턴 매칭 여부.
 */
export function isKoreanRecommendedEmbeddingModel(
  modelId: string | undefined | null,
): boolean {
  if (!modelId) return false;
  return KOREAN_RECOMMENDED_PATTERNS.some((re) => re.test(modelId));
}

// option 라벨 생성에 필요한 모델 최소 형태 — `formatEmbeddingOptionLabel` 입력과
// combobox renderOption 콜백 파라미터가 공유하는 named type (장황한
// `Parameters<typeof ...>` 추론 결합 제거).
export type EmbeddingOptionModel = Pick<ModelInfo, "id" | "name">;

/**
 * 임베딩 모델 select option 라벨 생성(순수함수).
 *
 * `<option>` 은 텍스트만 허용하므로 JSX 배지가 아닌 문자열 suffix 로 표시한다.
 * 추천 모델이면 `recommendedBadge` 문구를 ` · ` 구분자로 덧붙인다. i18n 의존을
 * 끊기 위해 배지 문구(이미 번역된 텍스트)는 호출자가 주입한다(테스트 용이성).
 *
 * @param model - 모델 정보(id·name).
 * @param recommendedBadge - 추천 모델에 덧붙일 배지 문구.
 * @returns option 에 표시할 라벨 문자열.
 */
export function formatEmbeddingOptionLabel(
  model: EmbeddingOptionModel,
  recommendedBadge: string,
): string {
  const base =
    model.name && model.name !== model.id
      ? `${model.name} (${model.id})`
      : model.id;
  return isKoreanRecommendedEmbeddingModel(model.id)
    ? `${base} · ${recommendedBadge}`
    : base;
}
