### 발견사항

---

**[CRITICAL] `ALTER TABLE document_chunk ALTER COLUMN embedding TYPE vector` — 전체 테이블 잠금**
- 위치: `V021__variable_embedding_dimension.sql:6`
- 상세: PostgreSQL은 `ALTER COLUMN TYPE`에 대해 **AccessExclusiveLock**을 획득하고 테이블 전체를 다시 씁니다. `document_chunk`에 수백만 건의 고차원 벡터가 저장된 운영 환경에서는 이 작업이 완료될 때까지 **모든 읽기·쓰기가 차단**됩니다. 사실상 서비스 다운 구간이 생깁니다.
- 제안: `vector(1536)` → untyped `vector` 타입 변환은 pgvector 내부적으로 단순 메타데이터 변경에 가깝습니다. 실제 운영 테이블 크기에 따라 `pg_catalog.pg_type`을 직접 수정하거나(`UPDATE pg_attribute ...` 방식, 단 비공식), 또는 신규 컬럼 추가 → 배치 복사 → 컬럼 교체하는 **long-running 무중단 패턴**으로 마이그레이션을 분리해야 합니다. 최소한 배포 전 `document_chunk` 예상 크기와 잠금 시간을 사전에 측정하고 유지보수 창을 확보해야 합니다.

---

**[CRITICAL] `CREATE INDEX` without `CONCURRENTLY` — 쓰기 차단**
- 위치: `V021__variable_embedding_dimension.sql:18–28`
- 상세: `CREATE INDEX` (비 CONCURRENTLY)는 **ShareLock**을 획득하여 인덱스 빌드가 완료될 때까지 **모든 INSERT/UPDATE/DELETE를 차단**합니다. HNSW 인덱스는 빌드 비용이 높아 대규모 테이블에서는 수십 분이 걸릴 수 있습니다. 인덱스 3개가 순차적으로 실행되므로 잠금 구간이 누적됩니다.
- 제안: `CREATE INDEX CONCURRENTLY`를 사용해야 합니다. 단, `CONCURRENTLY`는 트랜잭션 블록 내에서 실행 불가합니다. Flyway를 사용하는 경우 `outOfOrder=false`로 설정하거나 해당 마이그레이션 파일에 `flyway:executeInTransaction=false` 주석을 추가하는 방식으로 별도 처리가 필요합니다. 마이그레이션을 인덱스 생성 전/후로 분리하는 것도 검토하세요.

---

**[WARNING] `reEmbedAll` — 트랜잭션 부재로 인한 부분 실패 가능성**
- 위치: `knowledge-base.service.ts:112–135` (`reEmbedAll` 메서드)
- 상세: `embedding_dimension = NULL` 업데이트와 문서 목록 조회가 트랜잭션 없이 순차 실행됩니다. 서버가 NULL 초기화 직후 재시작되면 KB는 `embedding_dimension = NULL`이지만 청크는 이전 차원값으로 남아 있는 불일치 상태가 됩니다. 이 상태에서 검색이 들어오면 KB를 건너뛰어 검색 불능이 됩니다.
- 제안: `embedding_dimension = NULL` 초기화와 문서 재임베딩 큐잉을 atomic하게 처리하거나, `reEmbedStatus` 컬럼을 추가하여 'pending'→'processing'→'completed' 상태를 추적해야 합니다. 최소한 KB에 `lastReEmbedRequestedAt` 타임스탬프를 기록하여 운영 모니터링을 가능하게 하는 것을 권장합니다.

---

**[WARNING] DB 레벨 차원 일관성 보장 제거**
- 위치: `V021__variable_embedding_dimension.sql:6`, `knowledge-base.entity.ts:35`
- 상세: `vector(1536)` 제약이 제거되고 애플리케이션 레벨 검증(`EmbeddingService`의 `expectedDim` 체크)으로만 차원 일관성을 강제합니다. 애플리케이션 버그 또는 직접 DB INSERT 경로(예: 운영 스크립트, 마이그레이션)에서 잘못된 차원의 벡터가 삽입될 경우 DB는 이를 거부하지 않습니다. Partial HNSW 인덱스 쿼리는 `vector_dims(embedding) = N` 조건으로 필터링되므로 잘못된 차원의 벡터는 조용히 검색에서 제외됩니다(silent failure).
- 제안: `document_chunk` 테이블에 `CHECK (embedding IS NULL OR vector_dims(embedding) = (SELECT embedding_dimension FROM knowledge_base WHERE id = document_chunk.knowledge_base_id))` 같은 제약을 DB 레벨에서 추가하는 것이 이상적이나 성능 비용이 있습니다. 대안으로 INSERT 트리거로 차원 검증을 추가하거나, 현 설계를 유지하되 운영 모니터링 쿼리(`SELECT knowledge_base_id, COUNT(DISTINCT vector_dims(embedding)) FROM document_chunk GROUP BY 1 HAVING COUNT(DISTINCT vector_dims(embedding)) > 1`)를 주기적으로 실행하는 것을 권장합니다.

---

**[WARNING] `dim` 값의 SQL 직접 인라인**
- 위치: `rag-search.service.ts:102–114`
- 상세: `dim`이 SQL 쿼리 문자열에 직접 보간됩니다(`vector(${dim})`, `WHERE vector_dims(dc.embedding) = ${dim}`). `SUPPORTED_DIMS` 화이트리스트(`new Set([768, 1536, 3072])`)를 통과한 값이므로 현재는 SQL 인젝션이 불가능합니다. 하지만 `SUPPORTED_DIMS` 수정 또는 우회 시 취약점이 됩니다.
- 제안: `dim`은 이미 정수임이 보장되므로 `Number.isInteger(dim) && dim > 0` 가드를 추가하거나, pgvector가 `::vector($1)` 형태의 파라미터 바인딩을 지원하지 않는 제약을 코드 주석에 명시하고 현행 whitelist 방식의 불변성을 `assert`로 강화하세요.

---

**[INFO] `EmbeddingService` - `embedding_dimension` 동시 업데이트 경합**
- 위치: `embedding.service.ts:195–203`
- 상세: 같은 KB의 여러 문서가 동시에 처리될 때, `kb.embeddingDimension`을 트랜잭션 외부에서 읽고 트랜잭션 내 `AND embedding_dimension IS NULL` 조건부 UPDATE로 보호합니다. 같은 모델을 사용하면 동일 차원이 쓰이므로 결과적으로 안전합니다. 단, `kb` 객체는 트랜잭션 시작 전에 로드되어 있어 MVCC 상에서는 stale read일 수 있습니다. 실질적 위험은 낮습니다.

---

**[INFO] `reEmbedAll` - 문서 전체 로드 후 N개 비동기 디스패치**
- 위치: `knowledge-base.service.ts:126–133`
- 상세: KB의 모든 문서 ID를 메모리에 적재 후 N개 비동기 태스크를 한꺼번에 디스패치합니다. `EmbeddingService`의 `MAX_CONCURRENT = 3` 세마포어로 실제 DB/API 부하는 제한되나, KB에 수천 건 문서가 있으면 메모리 내 Promise 큐가 커집니다. 현 규모에서는 문제없으나, 초대형 KB를 지원할 경우 큐 기반(BullMQ 등) 처리로 전환을 검토하세요.

---

### 요약

이번 변경은 가변 차원 임베딩 지원을 위한 스키마 확장과 검색 로직 개선을 포함하며, 전반적으로 설계가 체계적입니다. 핵심 위험은 **마이그레이션 잠금**입니다. `ALTER COLUMN TYPE vector`의 AccessExclusiveLock과 `CREATE INDEX`의 ShareLock이 운영 환경에서 읽기·쓰기를 수 분~수십 분 차단할 수 있습니다. 이는 반드시 배포 전 운영 테이블 크기를 기준으로 잠금 시간을 추정하고 무중단 전략(CONCURRENTLY, 컬럼 분리 마이그레이션)으로 재설계해야 합니다. 애플리케이션 로직 측면에서는 차원 일관성 검증을 DB 레벨이 아닌 애플리케이션 레벨에서만 강제하는 구조와, `reEmbedAll` 의 트랜잭션 부재로 인한 부분 실패 시나리오가 주의를 요합니다.

### 위험도

**HIGH**