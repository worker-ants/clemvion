// RAG 검색이 처리하는 임베딩 차원 화이트리스트.
//
// 차원별 인덱스 / cast 정책:
//   - 384, 512, 768, 1024, 1536: V022 / V030 partial HNSW (vector 타입).
//     pgvector vector 의 HNSW 차원 제한(≤ 2000) 안쪽이라 그대로 사용.
//   - 3072: V023 partial HNSW (halfvec 타입, requires pgvector >= 0.7).
//     vector HNSW 는 2000 초과를 못 다루므로 fp16 halfvec 으로 cast 해 부착.
//     검색 SQL 도 동일한 cast (`embedding::halfvec(3072)`) 를 사용해야 인덱스를 탄다.
//
// 새 차원 모델을 도입할 때:
//   - 차원 ≤ 2000:    SUPPORTED_EMBEDDING_DIMS 에 추가 + V0xx vector partial HNSW 마이그레이션
//   - 2000 < 차원 ≤ 4000: SUPPORTED_EMBEDDING_DIMS 에 추가 + V0xx halfvec partial HNSW 마이그레이션
//   - 차원 > 4000:    별도 전략 필요 (binary quantization, 시퀀셜 스캔 등)
export const SUPPORTED_EMBEDDING_DIMS: ReadonlySet<number> = new Set([
  384, // sentence-transformers all-MiniLM-L6-v2, BGE small (vector HNSW, V030)
  512, // sentence-transformers paraphrase-multilingual-MiniLM 류 (vector HNSW, V030)
  768, // Google text-embedding-004 (vector HNSW, V022)
  1024, // text-embedding-3-small dimensions:1024 / BGE 다국어 / Cohere embed-multilingual-v3 / voyage-3 (vector HNSW, V030)
  1536, // OpenAI text-embedding-3-small, ada-002 (vector HNSW, V022)
  3072, // OpenAI text-embedding-3-large (halfvec HNSW, V023)
]);

// embeddingModel 식별자에 허용되는 문자 집합.
// Provider 가 부여하는 모델 ID 는 영문/숫자/하이픈/점/슬래시(예: models/text-embedding-004)/콜론 구성.
// 100자 이내 길이 제한은 컬럼 정의(VARCHAR(100))와 동기화.
export const EMBEDDING_MODEL_PATTERN = /^[A-Za-z0-9._:/-]{1,100}$/;

// pgvector vector 타입의 HNSW/IVFFlat 인덱스 차원 상한.
// 이 값을 초과하면 halfvec(fp16, 최대 4000) 으로 fallback.
const VECTOR_INDEX_MAX_DIM = 2000;

export type EmbeddingCastType = 'vector' | 'halfvec';

// RAG 검색 SQL 이 cast 와 partial 조건에 사용할 타입을 결정한다.
// 본 함수가 반환하는 타입과 V0xx 마이그레이션의 인덱스 정의가 같은 차원에서
// 일치해야 partial HNSW 인덱스를 탄다.
export function getEmbeddingCastType(dim: number): EmbeddingCastType {
  return dim > VECTOR_INDEX_MAX_DIM ? 'halfvec' : 'vector';
}
