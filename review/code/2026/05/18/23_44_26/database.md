### 발견사항

- **[WARNING]** V058 마이그레이션 — LoginHistory CHECK 제약 DROP+ADD 패턴의 락 위험
  - 위치: `review/consistency/2026/05/18/23_02_30/cross_spec.md` 발견 6 / `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 2 / plan §3 V058 기술
  - 상세: plan 및 consistency 리뷰가 `V058__login_history_webauthn_failed_event.sql` 에서 `chk_login_history_event` CHECK 제약을 `DROP CONSTRAINT + ADD CONSTRAINT` 패턴으로 갱신한다고 명시한다. PostgreSQL 에서 `ALTER TABLE … DROP CONSTRAINT` 와 `ALTER TABLE … ADD CONSTRAINT CHECK (…)` 는 기본적으로 `ACCESS EXCLUSIVE` 락을 획득하며, `NOT VALID` 없이 실행하면 마이그레이션 실행 중 해당 테이블에 대한 읽기·쓰기가 모두 차단된다. `login_history` 테이블은 로그인 이벤트가 발생할 때마다 INSERT 되는 고빈도 테이블이므로, 무중단 배포 환경에서 이 패턴을 사용할 경우 잠깐의 락이라도 커넥션 대기 폭증 또는 타임아웃을 유발할 수 있다. plan 본문이 "단일 트랜잭션 (CONCURRENTLY 없음) → `.conf` 불필요" 로 기술하여 트랜잭션 안에서 실행함을 명시했으나, DROP+ADD가 하나의 트랜잭션 안에 묶이면 오히려 락 보유 시간이 증가한다.
  - 제안: CHECK 제약 변경을 무중단으로 수행하려면 (1) `ADD CONSTRAINT … NOT VALID` 로 먼저 추가(기존 행 검증 생략)하고, (2) 별도 마이그레이션에서 `VALIDATE CONSTRAINT` 를 실행하는 2-step 전략을 적용한다. 또는 enum 컬럼을 PostgreSQL 네이티브 `ENUM` 타입이 아닌 `VARCHAR + CHECK` 로 관리한다면 `NOT VALID` 를 허용하는 경로가 가장 안전하다. `CONCURRENTLY` 는 인덱스 생성에만 적용 가능하므로 CHECK 제약에는 사용할 수 없음을 유의한다.

- **[WARNING]** V057 마이그레이션 — `webauthn_credential` 테이블에 인덱스 명시 여부 불확실
  - 위치: `review/consistency/2026/05/18/23_02_30/cross_spec.md` 발견 4, `review/consistency/2026/05/18/23_11_17/cross_spec.md` 발견사항, naming_collision 발견사항 1
  - 상세: consistency 리뷰 cross_spec 문서(`23_02_30`)의 발견 4에서 `spec/1-data-model.md §3` 인덱스 표에 `webauthn_credential (user_id)`, `webauthn_credential (credential_id) UNIQUE` 를 추가해야 한다고 제안하고 있다. 그러나 이 인덱스들이 V057 마이그레이션 SQL에 실제로 포함되는지 여부가 분석 대상 변경 코드에서 확인되지 않는다. `credential_id` 는 WebAuthn 인증 시 조회 키가 되며, `user_id` 는 사용자별 credential 목록 조회에 사용된다. 두 인덱스가 누락된 채 마이그레이션이 실행되면 credential 조회 쿼리가 테이블 풀스캔을 유발한다.
  - 제안: V057 마이그레이션에 `CREATE UNIQUE INDEX ON webauthn_credential (credential_id)` 및 `CREATE INDEX ON webauthn_credential (user_id)` 를 명시적으로 포함한다. 무중단 배포를 위해 `CREATE INDEX CONCURRENTLY` 사용을 권장하며, 이 경우 `.conf` 파일에 `singleTransaction=false` 설정이 필요하다(Flyway 기준).

- **[WARNING]** `user` 테이블 컬럼 추가(`webauthn_recovery_codes TEXT[]`) 마이그레이션의 락 영향
  - 위치: `review/consistency/2026/05/18/23_02_30/cross_spec.md` 발견 2, plan §3 V057
  - 상세: V057에서 `user` 테이블에 `webauthn_recovery_codes TEXT[]` 컬럼을 추가한다. PostgreSQL 에서 `DEFAULT NULL` 없이 `ALTER TABLE … ADD COLUMN` 을 실행하면 PostgreSQL 11+ 에서는 메타데이터 변경만으로 처리되어 빠르게 완료된다. 그러나 `DEFAULT` 값이 있는 경우 PostgreSQL 11 이전 버전에서는 전체 테이블 리라이트가 발생한다. `user` 테이블은 인증 경로에서 매우 자주 조회되는 테이블이므로, 마이그레이션 실행 환경의 PostgreSQL 버전 및 DEFAULT 값 유무를 확인해야 한다.
  - 제안: `webauthn_recovery_codes TEXT[]` 컬럼 추가 시 `DEFAULT NULL` 을 명시하여 fast path를 보장한다. PostgreSQL 버전이 11 미만인 경우 별도 조치가 필요하다.

- **[INFO]** WebAuthn counter 역행 시 row 삭제 — 트랜잭션 원자성 확인 필요
  - 위치: `review/consistency/2026/05/18/23_11_17/cross_spec.md` 발견사항 1
  - 상세: spec이 counter 역행 탐지 시 해당 credential row를 "즉시 삭제" 하고 LoginHistory에 `webauthn_failed(WEBAUTHN_COUNTER_REGRESSION)` 을 기록하도록 정의한다. 두 작업(DELETE webauthn_credential + INSERT login_history)이 단일 트랜잭션으로 묶이지 않으면 credential 삭제 후 LoginHistory 기록 실패 시 감사 로그 누락이 발생하거나, LoginHistory 기록 후 credential 삭제 실패 시 보안 이벤트 불일치가 생긴다. consistency 리뷰에서 이 두 작업의 원자성에 대한 명시적 검토가 없었다.
  - 제안: `WebAuthnService.verifyAuthentication` 에서 counter 역행 처리 시 DELETE + INSERT를 명시적으로 동일 데이터베이스 트랜잭션(`@Transaction()` 데코레이터 또는 TypeORM `EntityManager.transaction()`)으로 래핑한다. NestJS TypeORM 환경에서 서비스 메서드가 트랜잭션 없이 두 개의 독립 쿼리를 실행하지 않도록 구현 시 주의한다.

- **[INFO]** `LoginHistoryEvent` TypeScript 타입과 DB CHECK 제약 간 동기화 — 마이그레이션 안전성 연계
  - 위치: `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 2
  - 상세: consistency 리뷰가 `login-history.entity.ts` 의 `LoginHistoryEvent` 타입 유니온에 `webauthn_failed` 가 없음을 CRITICAL로 지적했다. DB 관점에서 추가로 주목할 점은 V058 마이그레이션이 CHECK 제약을 갱신하는 시점과 애플리케이션 배포 순서다. 마이그레이션이 먼저 실행되고 구 버전 애플리케이션이 아직 실행 중인 경우, 새로운 CHECK 제약은 이미 적용되었으므로 기존 코드가 정의되지 않은 event 값을 INSERT 하려 하면 DB 레벨에서 거부된다. 반대로 새 코드가 배포되었지만 마이그레이션이 아직 실행되지 않은 경우, TypeScript 타입은 `webauthn_failed` 를 허용하지만 DB CHECK 제약이 이를 거부한다. 두 경우 모두 무중단 배포 시나리오에서 일시적 장애가 발생할 수 있다.
  - 제안: 마이그레이션과 엔티티 변경을 동일 배포 단위에 묶는다. 무중단 배포 전략으로는 (1) 마이그레이션을 `NOT VALID` 로 먼저 적용해 기존 CHECK는 유지하되 신규 값 삽입을 허용하는 CHECK를 추가하거나, (2) 블루/그린 배포에서 마이그레이션을 그린 서버 기동 직전에 실행하는 방식을 검토한다.

- **[INFO]** spec에 마이그레이션 번호 V057/V058 고정 기재 — DB 스키마 버전 관리 위험
  - 위치: `review/consistency/2026/05/18/23_11_17/cross_spec.md` 발견사항(INFO) V058 표기 관련
  - 상세: consistency 리뷰가 spec에 V058 번호가 고정 기재된 점을 INFO로 지적했다. DB 관점에서 Flyway/Liquibase 기반 마이그레이션은 버전 번호 중복 시 실행을 거부하므로, 다른 브랜치에서 같은 번호의 마이그레이션이 생성되면 충돌이 발생한다. 특히 병렬 worktree 환경에서 `replay-rerun.md` plan이 V057 이상 번호를 선점했을 가능성이 consistency plan_coherence 리뷰에서 WARNING으로 지적되었다.
  - 제안: 마이그레이션 파일을 실제로 작성할 때 `python3 guards script` 또는 `ls migrations/` 로 현재 max(V)를 재확인하고, spec에는 번호를 고정하지 않는 것이 안전하다. plan의 착수 조건 체크리스트가 이를 이미 명시하고 있으므로 절차적 안전장치는 있으나, 두 worktree가 동시에 착수 조건 확인 없이 진행하면 번호 충돌이 발생한다.

### 요약

이번 변경 파일들은 모두 리뷰·일관성 검토 결과 문서(review/consistency, plan 분석 마크다운, JSON 메타데이터)로, 실제 마이그레이션 SQL 코드나 ORM 쿼리 코드가 직접 포함되어 있지 않다. 그러나 문서 내 WebAuthn 구현 계획 기술에서 데이터베이스 관점의 위험 요소를 식별했다. 가장 주목할 사항은 V058의 `DROP CONSTRAINT + ADD CONSTRAINT` 패턴이 고빈도 테이블인 `login_history` 에 `ACCESS EXCLUSIVE` 락을 유발해 무중단 배포 안전성에 위험을 줄 수 있다는 점(WARNING)이다. 또한 `webauthn_credential` 테이블에 대한 인덱스(`credential_id UNIQUE`, `user_id`)가 마이그레이션에 포함되는지 명확하지 않으며(WARNING), counter 역행 시 credential 삭제와 LoginHistory 기록이 트랜잭션으로 묶이는지 확인이 필요하다(INFO). 마이그레이션 번호 충돌 가능성 및 TypeScript 엔티티 타입과 DB CHECK 제약 간 배포 순서 불일치 문제도 INFO 수준으로 기록한다. 실제 SQL 코드가 작성되는 구현 단계에서 이 항목들을 다시 검토해야 한다.

### 위험도

MEDIUM
