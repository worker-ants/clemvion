# 데이터베이스(Database) 리뷰 결과

## 발견사항

### 마이그레이션 안전성

- **[WARNING]** V094 ALTER TABLE DROP COLUMN 은 PostgreSQL 에서 AccessExclusiveLock 을 획득한다
  - 위치: `codebase/backend/migrations/V094__kb_drop_legacy_embedding_columns.sql` 전체
  - 상세: `ALTER TABLE knowledge_base DROP COLUMN embedding_llm_config_id` 및 `DROP COLUMN embedding_model` 은 각각 테이블 전체에 AccessExclusiveLock 을 획득한다. `knowledge_base` 가 대용량 테이블이라면 DDL 실행 중 해당 테이블에 대한 모든 읽기/쓰기가 블로킹된다. `embedding_model` 컬럼은 DEFAULT 값('text-embedding-3-small')이 설정되어 있어 PostgreSQL 12 이상에서는 메타데이터만 변경하므로 빠르나, `embedding_llm_config_id` 는 FK(`fk_kb_embedding_llm_config`)가 있어 constraint DROP 후 컬럼 DROP 2단계가 각각 락을 잡는다. 운영 환경 row 수가 많다면 짧은 LOCK 이라도 대기 쿼리가 쌓인다.
  - 제안: 배포 전 `knowledge_base` 의 row 수와 트래픽 패턴을 확인한다. 필요하다면 `lock_timeout` + `statement_timeout` 을 설정하거나 low-traffic 배포 윈도우에 적용한다. PostgreSQL 12+ 환경에서 `embedding_model` 은 실제 rewrite 없이 처리되므로 주요 위험은 FK/constraint 제거 단계다.

- **[INFO]** V094 의 `DROP CONSTRAINT IF EXISTS` 사용은 적절하나 선행 V093 의존성 명시가 코드 주석에만 존재한다
  - 위치: `V094__kb_drop_legacy_embedding_columns.sql` 주석 섹션
  - 상세: Flyway 순차 적용 보장으로 V093 → V094 순서는 강제되므로 기능 정확성은 문제 없다. 그러나 V093 fail-loud 검증 통과가 전제됨을 코드 외부 문서(plan)에서만 추적할 수 있다.
  - 제안: 현 구조(Flyway 순차, fail-loud RAISE)로 충분하다. 추가 조치 불필요.

### 마이그레이션 안전성 — V093 데이터 정합성

- **[INFO]** V093 UPDATE 쿼리 1번째 단계(step-2)는 `embedding_model_config_id IS NULL AND d.is_default = TRUE` 조건으로 실행되는데, 동일 workspace 에 kind=embedding is_default=TRUE 인 config 가 복수 존재하면 임의의 1개로 pin 된다
  - 위치: `V093__kb_embedding_repoint.sql` 라인 63-69
  - 상세: PostgreSQL UPDATE … FROM 에서 조인 결과가 복수 행이면 마지막으로 매칭된 행이 적용되는 게 아니라 동작이 정의되지 않는다(non-deterministic). 실제로는 `is_default = TRUE` 인 row 가 workspace 당 1개만 허용되는 unique 제약이 있을 가능성이 높지만, 마이그레이션 자체는 이를 가정만 할 뿐 검증하지 않는다.
  - 제안: `model_config` 테이블에 `(workspace_id, kind, is_default)` 에 partial unique index(`WHERE is_default = TRUE`)가 이미 있는지 확인한다. 없다면 마이그레이션 상단에 `ASSERT`/`DO` 블록으로 중복 체크를 추가하거나, 서브쿼리에 `LIMIT 1` 을 추가해 결정론적으로 만든다.

- **[INFO]** V093 CTE `created` 의 INSERT RETURNING 후 UPDATE 조인 키 `(workspace_id, provider, api_key, base_url, default_model, dimension)` 에서 `api_key` 와 `base_url` 이 NULL 일 수 있고, `IS NOT DISTINCT FROM` 으로 NULL 안전 비교를 사용하고 있어 올바르다
  - 위치: `V093__kb_embedding_repoint.sql` 라인 118-123
  - 상세: NULL 안전 비교(`IS NOT DISTINCT FROM`)를 올바르게 사용하고 있어 NULL api_key 또는 NULL base_url 을 가진 config 도 정상 매핑된다. 문제 없음.
  - 제안: 해당 없음.

### N+1 쿼리 방지

- **[INFO]** `attachEffectiveEmbeddingModel` 에서 N+1 을 명시적으로 회피하는 배치 조회 패턴이 올바르게 구현됨
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 라인 917-948
  - 상세: `findManyByIds`(TypeORM `In()` 연산자) + `findDefault` 단 1회 호출로 N개 KB 의 embeddingModel 을 일괄 resolve 한다. `list` 와 `findOne` 양 경로 모두 이 메서드를 경유하므로 N+1 위험 없음.
  - 제안: 해당 없음.

### 인덱스

- **[INFO]** V093 step-1 UPDATE 의 조인 조건 `d.workspace_id = kb.workspace_id AND d.kind = 'embedding' AND d.is_default = TRUE` 이 효율적으로 실행되려면 `model_config(workspace_id, kind, is_default)` 인덱스가 필요하다
  - 위치: `V093__kb_embedding_repoint.sql` 라인 65-69, 그리고 `model-config.service.ts` `findDefault` 메서드
  - 상세: 마이그레이션 1회성 쿼리이므로 인덱스 누락이 운영 성능에 직접 영향을 주지는 않는다. 그러나 `resolveEmbedding` / `findDefault` 는 런타임 hotpath 이므로 해당 인덱스가 없다면 운영 성능 위험이 있다.
  - 제안: `model_config` 테이블에 `(workspace_id, kind)` 복합 인덱스 또는 `(workspace_id, kind, is_default) WHERE is_default = TRUE` partial index 가 존재하는지 기존 마이그레이션을 확인한다. 이미 있다면 문제 없음.

### SQL 인젝션

- **[INFO]** `rag-search.service.ts` 의 raw SQL(`dataSource.query`)에서 테이블/컬럼명은 하드코딩되고 파라미터는 `$1` 바인딩으로 처리되어 SQL 인젝션 위험 없음
  - 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` 라인 151-166
  - 상세: `knowledge_base` SELECT 쿼리에서 `embedding_model` / `embedding_llm_config_id` 컬럼이 제거됐고 나머지 파라미터화 패턴은 변경 없음. 문제 없음.
  - 제안: 해당 없음.

### 스키마 설계

- **[INFO]** `knowledge-base.entity.ts` 에서 `embeddingModel` 이 `@Column` 데코레이터 없이 `embeddingModel?: string` 으로 선언되어 transient 필드로 처리된다
  - 위치: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` 라인 654-656
  - 상세: TypeORM 에서 `@Column` 없는 프로퍼티는 영속화되지 않는다. 응답 직렬화 전용 transient 필드로 사용하는 의도는 명확하고 코드 주석에 설명되어 있다. DB 스키마에는 영향 없음. V094 로 컬럼을 DROP 한 후 잔존 `@Column` 이 없으므로 ORM-DDL mismatch 위험 없음.
  - 제안: 해당 없음.

### 트랜잭션

- **[INFO]** V093 전체가 Flyway 의 Postgres 단일 트랜잭션 내에서 실행되므로 fail-loud RAISE 시 모든 INSERT/UPDATE 가 원자적으로 롤백된다
  - 위치: `V093__kb_embedding_repoint.sql` 주석 및 DO 블록
  - 상세: Flyway `outOfOrder=false` 환경에서 단일 트랜잭션 보장이 명시되어 있고, 코드도 이에 의존한다. 외부에서 Flyway 트랜잭션을 비활성화(`runInTransaction=false`)하지 않는 한 안전하다.
  - 제안: Flyway 설정에서 해당 마이그레이션 파일에 대해 `runInTransaction` 이 기본값(true)인지 확인한다.

---

## 요약

이번 변경의 데이터베이스 관련 핵심은 V093(repoint) + V094(DROP) 두 단계 마이그레이션이다. V093 은 legacy 임베딩 컬럼에 의존하는 모든 KB 를 1급 `embedding_model_config_id` 로 repoint 하고, fail-loud RAISE 로 orphan KB 가 0건임을 보증한 뒤 V094 가 비가역 DROP 을 수행한다. Flyway 단일 트랜잭션 보증과 순차 적용 강제로 데이터 정합성은 확보되어 있다. 주요 위험은 V094 의 `DROP COLUMN` 이 운영 테이블에 AccessExclusiveLock 을 잡는다는 점으로, 테이블 row 수와 트래픽에 따라 배포 윈도우를 고려해야 한다(WARNING). V093 step-1 에서 workspace 당 is_default=TRUE kind=embedding config 가 복수일 경우 비결정론적 UPDATE 가 발생할 수 있으나, 실제 데이터 제약으로 1개임이 보장된다면 문제 없다(INFO). 런타임 N+1 은 `attachEffectiveEmbeddingModel` 배치 패턴으로 올바르게 해소되었다.

---

## 위험도

**MEDIUM**

(V094 DDL Lock 위험이 운영 환경 테이블 크기에 따라 현실화될 수 있으므로 MEDIUM. 데이터 손실 위험 없음, V093 fail-loud 로 정합성 보장됨.)
