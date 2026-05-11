### 발견사항

- **[HIGH]** `CREATE INDEX` without `CONCURRENTLY` — 트랜잭션 내 블로킹 인덱스 생성
  - 위치: `V037__kb_retry_failed_status.sql`, 마지막 `CREATE INDEX` 구문
  - 상세: `executeInTransaction=true` 환경에서 `CREATE INDEX CONCURRENTLY` 사용이 불가능한 점은 이해되나, 트랜잭션 없이 진행하는 별도 마이그레이션으로 분리하지 않는 한 `SHARE` 락이 인덱스 빌드 완료까지 `document` 테이블 쓰기를 전면 차단함. `document` 테이블 행 수가 많을수록 무중단 배포 SLA 위반 가능성이 있음.
  - 제안: 인덱스 생성만 별도 마이그레이션(`V037b__...`) + `executeInTransaction=false` 로 분리하거나, 배포 전 maintenance window 를 통해 오프-피크 시간대에 적용.

- **[WARNING]** CHECK 제약 추가 시 테이블 스캔 락
  - 위치: `V037__kb_retry_failed_status.sql` — `ADD CONSTRAINT chk_doc_embedding_status`
  - 상세: PostgreSQL 은 `ADD CONSTRAINT CHECK` 실행 시 기존 행을 전량 검증하며 `ACCESS EXCLUSIVE` 락을 획득함. `NOT VALID` 옵션을 사용하면 기존 데이터 검증을 생략하고 신규 삽입/수정에만 적용할 수 있어 락 시간이 줄어듦.
  - 제안: 대규모 테이블이라면 `ADD CONSTRAINT ... CHECK (...) NOT VALID` 후 `VALIDATE CONSTRAINT` 를 분리된 마이그레이션 단계로 수행.

- **[WARNING]** `retryFailedDocuments` — UPDATE와 큐 add 가 트랜잭션 밖
  - 위치: `knowledge-base.service.ts`, `retryFailedDocuments()` 메서드
  - 상세: `UPDATE document SET embedding_status = 'pending' ... RETURNING id` 성공 후 `this.embeddingQueue.addBulk(...)` 가 실패하면 문서가 `pending` 상태로 변경되었지만 큐에 진입하지 못함. `StuckDocumentRecoveryService` 는 `processing` 상태만 회수하므로 `pending` stuck 은 감지되지 않아 영구적으로 처리 불가 상태가 됨.
  - 제안: BullMQ Outbox 패턴 또는 큐 add 실패 시 status 를 다시 `failed` 로 롤백하는 명시적 예외 처리 추가. 단기 방안으로 `StuckDocumentRecoveryService` 에 오래된 `pending` (예: `created_at < NOW() - 30min AND embedding_status = 'pending' AND embedding_last_attempted_at IS NOT NULL`) 회수 로직 추가.

- **[WARNING]** `StuckDocumentRecoveryService` — N+1 UPDATE 패턴
  - 위치: `stuck-document-recovery.service.ts`, `recoverStuckEmbedding()` / `recoverStuckGraphExtraction()` for 루프
  - 상세: 회수 대상 문서마다 개별 `UPDATE ... WHERE id = $1` 을 실행. 부팅 시 회수 대상이 수십 건 이상일 경우 DB 왕복 횟수가 선형 증가함.
  - 제안: `UPDATE document SET ... WHERE id = ANY($1::uuid[]) AND embedding_status = 'processing'` 단일 쿼리로 일괄 처리 후 큐 add 도 `addBulk` 로 통합.

- **[WARNING]** `error → failed` 일괄 UPDATE 가 새 인덱스 생성 이전에 실행됨
  - 위치: `V037__kb_retry_failed_status.sql`, UPDATE 구문 순서
  - 상세: `embedding_status = 'error'` 조건 UPDATE 가 `idx_document_kb_embedding_status` 인덱스 생성보다 먼저 실행되어 풀 시퀀셜 스캔으로 처리됨. `error` 상태 행이 많은 프로덕션 환경에서는 쿼리 시간과 락 보유 시간이 길어질 수 있음.
  - 제안: 기존 `embedding_status` 컬럼에 인덱스가 없다면 UPDATE 전에 임시 인덱스를 생성하거나, `error` 상태 행이 소수임을 확인하고 진행. 현 구조에서는 트랜잭션 분리 없이는 순서 변경이 어려움.

- **[INFO]** 인터벌 산술 방식 — `($1::text || ' ms')::interval`
  - 위치: `stuck-document-recovery.service.ts`, SQL 쿼리
  - 상세: 밀리초 값을 문자열 연결로 interval 로 변환하는 방식은 동작하지만 가독성이 낮음. PostgreSQL `make_interval(secs => $1::float / 1000)` 또는 `$1 * INTERVAL '1 ms'` 가 더 표준적임.
  - 제안: `NOW() - make_interval(secs => $1::float / 1000)` 또는 바인딩 값을 초 단위로 전달해 `NOW() - ($1 || ' seconds')::interval` 로 변경.

- **[INFO]** `idx_document_kb_graph_status` (V026 partial index) — stuck 회수 쿼리 커버리지 미확인
  - 위치: `stuck-document-recovery.service.ts`, `recoverStuckGraphExtraction()`
  - 상세: V026 의 graph partial index 가 `WHERE graph_extraction_status = 'processing' AND graph_last_attempted_at < ...` 필터를 커버하는지 정의를 확인해야 함. partial index 가 특정 값만 인덱싱하거나 `graph_last_attempted_at` 을 포함하지 않으면 시퀀셜 스캔 발생 가능.
  - 제안: V026 인덱스 정의를 확인하고 부팅 쿼리가 인덱스를 타는지 `EXPLAIN` 으로 검증.

---

### 요약

마이그레이션 SQL 자체의 로직(컬럼 추가, enum 확장, `error → failed` 데이터 변환)은 정확하고 롤백 스크립트도 `DOWN` 주석으로 문서화되어 있어 관리 품질이 높다. 다만 **트랜잭션 내 `CREATE INDEX` (락 블로킹)** 와 **`retryFailedDocuments`의 UPDATE·큐잉 비원자성(stuck pending 가능성)** 두 가지가 프로덕션에서 실질적인 영향을 줄 수 있는 구조적 약점이다. `StuckDocumentRecoveryService`의 N+1 패턴은 부팅 시점에만 실행되는 특성상 즉각적 위험은 낮지만 개선 여지가 있다. 전반적으로 스키마 설계, 파라미터화 쿼리 사용, CHECK 제약 명세는 양호하다.

### 위험도

**MEDIUM**