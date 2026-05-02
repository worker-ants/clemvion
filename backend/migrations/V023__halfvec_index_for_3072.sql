-- V023: 3072 차원용 halfvec partial HNSW 인덱스
-- requires pgvector >= 0.7 (halfvec)
--
-- 배경: V022 에서 vector 타입의 HNSW 차원 제한(≤ 2000) 때문에 3072 차원
-- (text-embedding-3-large) 에는 인덱스를 부착하지 못해 시퀀셜 스캔으로
-- 동작했다. pgvector 0.7+ 의 halfvec(fp16) 타입은 차원 제한이 4000 이라
-- 3072 도 인덱스 가능하다. 정밀도가 fp32 → fp16 으로 떨어지지만, RAG
-- top-K 검색에서는 cosine score 의 미세 차이가 문제되지 않는다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 본 파일은
-- 동봉된 V023__halfvec_index_for_3072.conf (executeInTransaction=false)
-- 와 함께 비-트랜잭션 모드로 실행한다.
--
-- RagSearchService 의 검색 SQL 도 3072 차원에 대해 동일한 cast 표현식
-- (`embedding::halfvec(3072)`) 과 차원 조건을 사용해야 본 인덱스를 탄다.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_3072_halfvec
  ON document_chunk USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
  WHERE vector_dims(embedding) = 3072;
