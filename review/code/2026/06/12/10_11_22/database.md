### 발견사항

이번 변경은 모두 spec 문서(`spec/`, `review/`) 파일이며 실제 DB 코드(마이그레이션 SQL, ORM 쿼리, 트랜잭션, 커넥션 관리 코드)를 포함하지 않는다. 그러나 spec 문서 자체가 V093/V094 마이그레이션 설계를 기술하고 있어, 마이그레이션 안전성 및 스키마 설계 관점에서 다음 사항을 지적한다.

- **[WARNING]** V094(DROP 컬럼) 비가역성 — 무중단 배포 안전성 미검증
  - 위치: `spec/5-system/8-embedding-pipeline.md` §5.5 및 Rationale 섹션; `spec/1-data-model.md` 구현 상태 주석
  - 상세: spec 은 "V093 repoint 로 `embedding_model_config_id IS NULL` KB 0건 확인 후 V094 가 `embedding_llm_config_id`·`embedding_model` 컬럼을 비가역 DROP 한다"고 기술한다. `ALTER TABLE … DROP COLUMN` 은 PostgreSQL 에서 `AccessExclusiveLock` 을 획득하므로, 테이블 크기가 크거나 트래픽이 있는 환경에서 무중단 배포 시 짧은 lock wait 이라도 발생할 수 있다. spec 에 "Flyway forward-only 비가역" 설명은 있으나, 배포 중 lock 부하 완화 절차(점진 배포, 유지보수 윈도우, `NOT VALID` 우선 패턴 등)에 대한 명시가 없다.
  - 제안: V094 마이그레이션 SQL 작성 시 `knowledge_base` 테이블의 현재 행 수 및 배포 전략(Blue/Green, 롤링)을 고려해 lock 시간을 평가하고, 필요 시 `pg_try_advisory_lock` 혹은 배포 윈도우 지침을 spec Rationale 에 명시한다.

- **[WARNING]** V093 fail-loud RAISE 조건의 트랜잭션 원자성 미기술
  - 위치: `spec/5-system/8-embedding-pipeline.md` §5.5; `review/consistency/2026/06/12/00_23_39/plan_coherence.md` §INFO "마이그레이션 번호 append-only 확인"
  - 상세: spec 은 "V093 commit(검증 통과) 후에만 V094 진행"이라고 기술하며 V093 내에 `fail-loud RAISE` 가 있다고 암시한다. Flyway 에서 V093 내의 RAISE 가 트랜잭션 내에서 실행되는지(롤백 보장), 아니면 DDL + DML 혼재로 암묵적 커밋이 발생하는지에 대한 설명이 없다. PostgreSQL DDL 은 트랜잭션 가능하므로 단일 migration 파일 내에서 RAISE 후 ROLLBACK 이 가능하지만, 이를 명시하지 않으면 구현자가 DML-only migration 으로 잘못 작성할 위험이 있다.
  - 제안: V093 migration 설계 문서 또는 spec Rationale 에 "검증 쿼리 + RAISE + repoint DML 은 단일 트랜잭션 내에서 수행하며, RAISE 시 전체 V093 롤백 보장" 을 명시한다.

- **[INFO]** `embedding_model_config_id` 인덱스 언급 부재
  - 위치: `spec/data-flow/6-knowledge-base.md` Sink 표 — `knowledge_base` 행의 "인덱스 / 제약" 컬럼
  - 상세: V093 repoint 쿼리(`UPDATE knowledge_base SET embedding_model_config_id = … WHERE embedding_model_config_id IS NULL`)는 전체 테이블 스캔이 필요하다. `embedding_model_config_id` 컬럼에 인덱스가 없으면 마이그레이션 시 seq-scan 이 발생한다. 또한 resolveEmbedding 의 "1급 경로" 조회(`WHERE kb.embedding_model_config_id = ?`) 및 "워크스페이스 default" 경로는 `model_config` 테이블에 `(workspace_id, kind, is_default)` 인덱스가 필요한데, spec 데이터 모델 표에서 `knowledge_base.embedding_model_config_id` FK 에 대한 인덱스 명시가 없다.
  - 제안: `spec/data-flow/6-knowledge-base.md` Sink 표 및 `spec/1-data-model.md` §2.11 에 `knowledge_base(embedding_model_config_id)` 인덱스(또는 이미 존재하는 경우 마이그레이션 버전)를 명시한다. V093 migration 내에서 IS NULL 스캔 성능을 고려해야 한다.

---

### 요약

이번 PR4b 변경은 spec 문서 전용이며 실제 SQL/ORM/트랜잭션 코드를 포함하지 않는다. DB 관점에서 중요한 것은 spec 이 기술하는 마이그레이션 설계(V093 repoint + V094 DROP)다. 핵심 우려 사항은 두 가지다: (1) V094의 `DROP COLUMN`이 `AccessExclusiveLock`을 획득하므로 무중단 배포 시 lock 부하 완화 절차가 spec에 명시되지 않았다; (2) V093의 fail-loud RAISE 가 단일 트랜잭션 내에서 rollback-safe 하게 동작하는지 spec이 명시하지 않아 구현 시 트랜잭션 원자성 위반 위험이 있다. 인덱스 누락은 migration 성능에 영향을 줄 수 있으나 blocking 수준은 아니다. 실제 마이그레이션 SQL 파일이 PR4b에 포함될 때 이 사항들을 재검토해야 한다.

### 위험도

MEDIUM
