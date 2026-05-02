// RAG 검색이 처리하는 임베딩 차원 화이트리스트.
// 768/1536 은 V022 의 partial HNSW 인덱스를 타고, 3072 는 pgvector HNSW 의
// vector 타입 차원 제한(≤ 2000) 때문에 인덱스 없이 partial 조건 시퀀셜 스캔으로
// 동작한다. (halfvec 도입 시 인덱스 부착 가능 — 후속 작업.)
//
// 새 차원 모델을 도입할 때:
//   - 차원 ≤ 2000: ① 본 상수에 추가 ② V0xx 마이그레이션으로 partial HNSW 인덱스 추가
//   - 차원 > 2000: ① 본 상수에 추가 (인덱스는 부착 불가, 시퀀셜)
export const SUPPORTED_EMBEDDING_DIMS: ReadonlySet<number> = new Set([
  768, // Google text-embedding-004 (HNSW indexed)
  1536, // OpenAI text-embedding-3-small, ada-002 (HNSW indexed)
  3072, // OpenAI text-embedding-3-large (no HNSW index — sequential scan)
]);

// embeddingModel 식별자에 허용되는 문자 집합.
// Provider 가 부여하는 모델 ID 는 영문/숫자/하이픈/점/슬래시(예: models/text-embedding-004)/콜론 구성.
// 100자 이내 길이 제한은 컬럼 정의(VARCHAR(100))와 동기화.
export const EMBEDDING_MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/;
