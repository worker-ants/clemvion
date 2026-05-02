// V022 마이그레이션의 partial HNSW 인덱스가 존재하는 차원만 RAG 검색이 인덱스를 활용한다.
// 새 차원 모델을 도입할 때는 ① 신규 마이그레이션으로 인덱스 추가 ② 본 상수에 차원 추가 ③
// EmbeddingService 가 새 차원으로 채울 수 있는 모델을 허용 — 이 세 가지를 한 쌍으로 다룬다.
export const SUPPORTED_EMBEDDING_DIMS: ReadonlySet<number> = new Set([
  768, // Google text-embedding-004
  1536, // OpenAI text-embedding-3-small, ada-002
  3072, // OpenAI text-embedding-3-large
]);

// embeddingModel 식별자에 허용되는 문자 집합.
// Provider 가 부여하는 모델 ID 는 영문/숫자/하이픈/점/슬래시(예: models/text-embedding-004)/콜론 구성.
// 100자 이내 길이 제한은 컬럼 정의(VARCHAR(100))와 동기화.
export const EMBEDDING_MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/;
