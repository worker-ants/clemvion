# 성능(Performance) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** `attachEffectiveEmbeddingModel` — N+1 완전 회피, 배치 패턴 올바름
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (신규 메서드, `list`·`findOne`·`create`·`update` 호출 경로)
  - 상세: `Set` + `findManyByIds(In(...))` 로 configId 중복 제거 후 1회 쿼리, `needsWsDefault` 분기로 `findDefault` 를 조건부 호출한다. 목록 페이지처럼 KB 수십 건이 동일 configId를 공유하는 경우에도 쿼리는 최대 2회(findManyByIds + findDefault)로 고정된다. 설계상 올바르다.
  - 제안: 없음 (현행 유지).

### 발견사항 2
- **[WARNING]** `attachEffectiveEmbeddingModel` — `create`·`update` 단건 경로에서 중복 DB 조회 가능성
  - 위치: `knowledge-base.service.ts` `create` 및 `update` 메서드
  - 상세: `create` 는 `embeddingModelConfigId` 가 지정된 경우 `modelConfigService.findEntity(...)` 로 유효성 검증 후 저장하고, 이후 `attachEffectiveEmbeddingModel([saved], workspaceId)` 를 호출해 동일 configId를 `findManyByIds` 로 한 번 더 조회한다. 즉, config 1개에 대해 DB 쿼리가 최대 2회 발생한다. `update` 도 동일 패턴. 목록 API와 달리 단건 경로이므로 절대 비용은 낮지만, findEntity 결과를 재사용하면 라운드트립을 1회 줄일 수 있다.
  - 제안: `create`/`update` 내부에서 이미 얻은 `embCfg.defaultModel` 을 사용해 `kb.embeddingModel` 을 직접 채우거나, `attachEffectiveEmbeddingModel` 에 이미 로드된 config 맵을 주입할 수 있도록 선택적 파라미터를 추가한다.

### 발견사항 3
- **[INFO]** V093 마이그레이션 SQL — 대규모 데이터 처리 시 인덱스 활용 여부
  - 위치: `codebase/backend/migrations/V093__kb_embedding_repoint.sql` (step-1 UPDATE, step-2 CTE UPDATE, fail-loud DO 블록)
  - 상세: 세 쿼리 모두 `knowledge_base.embedding_model_config_id IS NULL` 필터를 사용한다. `embedding_model_config_id` 에 인덱스가 없으면 테이블 전체를 풀스캔한다. 운영 환경에서 KB 수가 수만 건 이상이면 마이그레이션 시간이 늘어날 수 있다. Flyway 단일 트랜잭션이라 락이 길어질 위험도 있다.
  - 제안: 마이그레이션 전 `embedding_model_config_id` 에 부분 인덱스(`WHERE embedding_model_config_id IS NULL`)가 존재하는지 확인한다. 없다면 V093 앞에 `CREATE INDEX CONCURRENTLY` 마이그레이션을 별도 V로 추가하거나, `LOCK TABLE ... IN ROW EXCLUSIVE MODE` 시간을 모니터링한다. 소규모 운영이면 허용 가능.

### 발견사항 4
- **[INFO]** V093 CTE 내 `SELECT DISTINCT` — 메모리 정렬 비용
  - 위치: `V093__kb_embedding_repoint.sql` `distinct_src` CTE
  - 상세: `(workspace_id, provider, api_key, base_url, embedding_model, embedding_dimension)` 6컬럼에 대해 `SELECT DISTINCT` 를 수행한다. api_key는 암호화 ciphertext로 길이가 길 수 있다. KB 수가 수천 건 미만의 일반적 운영 규모에서는 문제없으나, 컬럼 너비가 넓어 정렬 메모리(work_mem) 사용량이 많을 수 있다.
  - 제안: 운영 DB의 KB 수를 사전 점검한다(`SELECT count(*) FROM knowledge_base WHERE embedding_model_config_id IS NULL`). 수천 건 이내이면 현행 유지; 수만 건이면 `work_mem` 임시 상향(`SET LOCAL work_mem = '64MB'`) 고려.

### 발견사항 5
- **[INFO]** `rag-search.service.ts` 그룹 키 단순화 → 불필요한 연산 제거
  - 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (그룹 키 생성 로직)
  - 상세: 이전 코드는 `legacyModel`·`embeddingLlmConfigId` 를 포함한 4-5개 필드 조합으로 키를 생성했으나, 변경 후 `(embeddingModelConfigId, dim)` 2필드로 단순화됐다. 동일 config ID를 가진 KB가 하나의 그룹으로 묶여 query 임베딩 호출이 줄어든다. 성능 개선이다.
  - 제안: 없음 (현행 유지).

### 발견사항 6
- **[INFO]** `resolveEmbedding` legacy step-3 제거 → DB 쿼리 최대 1회 감소
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts`
  - 상세: 이전 3-step 폴백은 step-3에서 `embeddingLlmConfigId` 또는 ws default chat config 를 추가로 조회했다(최대 쿼리 2회: kind=embedding 조회 + chat 조회). 제거 후 step-1/2만 남아 최대 쿼리 1회로 줄었다. 검색·임베딩 경로 전반의 레이턴시 개선에 기여한다.
  - 제안: 없음 (현행 유지).

### 발견사항 7
- **[INFO]** `findManyByIds` — `In()` 연산자 빈 배열 가드 처리됨
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `findManyByIds`
  - 상세: `ids.length === 0` 조기 반환으로 `WHERE id IN ()` 쿼리(일부 DB 드라이버에서 오류 또는 풀스캔 유발)를 방지한다. 올바른 방어 코드이다.
  - 제안: 없음 (현행 유지).

## 요약

이번 변경은 legacy 컬럼·폴백 경로를 제거하면서 전반적으로 DB 쿼리 수를 줄이는 방향으로 개선됐다. 가장 주목할 성능 포인트는 `attachEffectiveEmbeddingModel` 배치 조회 패턴(N+1 회피)과 RAG 검색 그룹 키 단순화(불필요한 embed 호출 감소)이며 모두 올바르게 구현됐다. 단, `create`·`update` 단건 경로에서 config 유효성 검증(`findEntity`)과 직후 `attachEffectiveEmbeddingModel`(`findManyByIds`)가 동일 configId를 두 번 조회하는 미미한 중복이 있다. V093 SQL은 `embedding_model_config_id IS NULL` 조건의 인덱스 존재 여부에 따라 마이그레이션 시 락 지속 시간이 달라질 수 있으므로 사전 점검이 권장된다. 전체적으로 성능 관점의 리스크는 낮다.

## 위험도

LOW
