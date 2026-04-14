### 발견사항

- **[WARNING]** pgvector IVFFlat/HNSW 인덱스 누락
  - 위치: `V005__document_chunk_pgvector.sql`
  - 상세: `embedding` 컬럼에 대한 벡터 유사도 검색 인덱스가 없음. `idx_document_chunk_document`, `idx_document_chunk_kb` 등 일반 인덱스만 존재하며, `<=>` 코사인 거리 연산자를 사용하는 RAG 검색은 전체 테이블 시퀀셜 스캔을 수행하게 됨
  - 제안:
    ```sql
    CREATE INDEX idx_document_chunk_embedding_cosine
      ON document_chunk USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    ```

- **[WARNING]** N+1 쿼리 - 문서 임베딩 저장 루프
  - 위치: `embedding.service.ts` - `doProcess()` 내 chunk 저장 루프
  - 상세: `chunks.length`만큼 개별 INSERT 쿼리를 트랜잭션 내에서 반복 실행함. 청크 수가 수백 개일 경우 심각한 성능 저하 발생
  - 제안: `unnest` 또는 멀티-row INSERT로 배치 처리
    ```sql
    INSERT INTO document_chunk (document_id, knowledge_base_id, content, chunk_index, embedding, token_count, metadata)
    SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::int[], $5::vector[], $6::int[], $7::jsonb[])
    ```

- **[WARNING]** N+1 쿼리 - Knowledge Base 삭제 시 S3 파일 개별 삭제
  - 위치: `knowledge-base.service.ts` - `remove()` 메서드
  - 상세: 모든 문서를 한번에 로드 후 S3 삭제를 루프에서 순차 수행. 문서가 많을 경우 메모리 부담과 지연 발생. 단, S3 삭제 실패가 DB 삭제를 막지 않으므로 파일 누수 가능
  - 제안: S3 삭제는 별도 비동기 작업(queue)으로 분리하거나, `cascadeDelete`를 트리거로 처리

- **[INFO]** `document_count` 비정규화 컬럼 갱신 방식 불안정
  - 위치: `knowledge-base.service.ts` - `uploadDocument()`, `removeDocument()`
  - 상세: `documentCount`를 `COUNT` 쿼리로 재계산 후 저장하는 방식은 동시 요청 시 race condition 발생 가능 (두 업로드가 동시에 동일한 count를 읽어 +1 처리)
  - 제안: `UPDATE knowledge_base SET document_count = document_count + 1 WHERE id = $1` 방식의 원자적 업데이트 사용

- **[WARNING]** RAG 검색 쿼리에 `knowledge_base_id` 조건 미사용
  - 위치: `rag-search.service.ts` - SQL 쿼리
  - 상세: `document_chunk` 테이블에 `knowledge_base_id` 컬럼과 인덱스(`idx_document_chunk_kb`)가 있음에도 검색 쿼리는 `document` 테이블의 `knowledge_base_id`를 JOIN으로 필터링함. `dc.knowledge_base_id = ANY($2::uuid[])` 조건을 직접 추가하면 JOIN 없이 청크 테이블 인덱스를 활용 가능
  - 제안:
    ```sql
    WHERE dc.knowledge_base_id = ANY($2::uuid[])
      AND dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> $1::vector) >= $3
    ```

- **[INFO]** `embedding` 컬럼 NULL 허용이나 검색 시 NULL 필터 없음
  - 위치: `V005__document_chunk_pgvector.sql`, `rag-search.service.ts`
  - 상세: `embedding vector(1536)` 컬럼은 NULL 허용이지만, 검색 쿼리에서 `embedding IS NOT NULL` 조건이 없음. NULL 임베딩에 대해 `<=>` 연산 수행 시 오류 발생 가능
  - 제안: RAG 검색 WHERE 절에 `AND dc.embedding IS NOT NULL` 추가

- **[INFO]** `LlmConfig.apiKey` 컬럼 길이 제한이 암호화 이후 부족할 수 있음
  - 위치: `llm-config.entity.ts`
  - 상세: `api_key` 컬럼이 `length: 500`으로 정의되어 있으나, AES-256 암호화 후 Base64 인코딩 시 원문 길이의 ~1.37배 + IV/tag 오버헤드가 추가됨. 원문이 350자 이상이면 초과 가능
  - 제안: 컬럼 길이를 `1000`으로 확장하거나 `text` 타입으로 변경

- **[INFO]** 마이그레이션 `CREATE EXTENSION IF NOT EXISTS vector` - 권한 필요
  - 위치: `V005__document_chunk_pgvector.sql`
  - 상세: `CREATE EXTENSION`은 superuser 또는 `pg_extension_owner` 권한이 필요. 프로덕션 환경에서 앱 DB 사용자가 해당 권한이 없을 경우 마이그레이션 실패
  - 제안: 배포 가이드에 사전 권한 설정 명시, 또는 `CREATE EXTENSION IF NOT EXISTS vector` 실행을 DBA 태스크로 분리

---

### 요약

가장 중요한 문제는 두 가지입니다. **pgvector HNSW/IVFFlat 인덱스 누락**으로 인해 RAG 검색이 전체 테이블 스캔(Seq Scan)을 수행하여 데이터가 증가할수록 검색 성능이 급격히 저하되며, **임베딩 저장 시 N+1 INSERT 루프**로 인해 청크 수가 많은 문서 처리에서 DB 왕복 비용이 선형 증가합니다. 또한 `document_count` 비정규화 컬럼의 race condition, RAG 쿼리에서 `document_chunk.knowledge_base_id` 인덱스 미활용, `embedding IS NOT NULL` 필터 누락 등 운영 단계에서 문제로 드러날 사항들이 복수 존재합니다. 전반적인 스키마 설계는 적절하나, 벡터 검색 성능 최적화와 동시성 처리 부분에 보완이 필요합니다.

### 위험도
**HIGH**