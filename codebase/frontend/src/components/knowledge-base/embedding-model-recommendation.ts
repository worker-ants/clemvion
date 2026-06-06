// 한국어 임베딩 추천 모델 패턴.
//
// provider 의 listModels 응답은 동적이라 고정 카탈로그가 없다. 따라서 모델 ID
// 패턴으로 "한국어 추천" 메타 배지를 **비강제** 표시한다 — 선택을 강제하거나
// 제한하지 않으며, 자유 입력도 허용하지 않는다(select-only, R-1). 이 함수는
// option 라벨에 덧붙는 표시용 메타데이터일 뿐이다.
//
// 근거: spec/2-navigation/5-knowledge-base.md §2.2 한국어 임베딩 추천 모델 목록
//   (KURE / arctic-ko > BGE-M3 > multilingual-e5 > text-embedding-3).
// 패턴 추가·변경 시 spec §2.2 와 이 파일을 함께 갱신한다.
// 보수적으로 잘 알려진 다국어/한국어 강세 모델만 화이트리스트한다.
const KOREAN_RECOMMENDED_PATTERNS: RegExp[] = [
  /kure/i, // nlpai-lab/KURE-v1 등
  /arctic-embed/i, // Snowflake arctic-embed (ko 변형 포함)
  /(?:^|[/_-])bge-m3/i, // BAAI/bge-m3 (대칭, 다국어)
  /multilingual-e5/i, // intfloat/multilingual-e5-*
  /text-embedding-3/i, // OpenAI text-embedding-3-{small,large}
];

export function isKoreanRecommendedEmbeddingModel(
  modelId: string | undefined | null,
): boolean {
  if (!modelId) return false;
  return KOREAN_RECOMMENDED_PATTERNS.some((re) => re.test(modelId));
}
