# Database Review

### 발견사항

- **[INFO]** V049 마이그레이션: `ADD COLUMN ... NOT NULL DEFAULT 0` 는 PostgreSQL 11+ 에서 테이블 재작성 없이 즉시 완료됨 — 무중단 배포 안전
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql`
  - 상세: `INT NOT NULL DEFAULT 0` 컬럼 추가는 PostgreSQL 11 이상에서 metadata-only 변경으로 처리되어 전체 테이블 scan/lock 없이 완료된다. 기존 행은 DEFAULT 값으로 논리적으로 채워지며 실제 데이터 백필 없이 빠르게 적용된다. 운영 환경이 PostgreSQL 11+ 임을 전제할 때 안전하다.
  - 제안: 현재 구현 유지. PostgreSQL 버전 요구사항이 스펙/인프라 문서에 명시되어 있다면 재확인 권장.

- **[INFO]** V050 마이그레이션: `CREATE INDEX CONCURRENTLY` 사용으로 무중단 인덱스 생성 — 올바른 접근
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql`, `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`
  - 상세: `CONCURRENTLY` 옵션으로 배타 락 없이 인덱스를 생성한다. `IF NOT EXISTS` 로 멱등성도 확보했다. `.conf` 파일에 `executeInTransaction=false` 설정이 있는데, 이는 `CONCURRENTLY`가 트랜잭션 내부에서 실행될 수 없는 PostgreSQL 제약 때문에 Flyway가 트랜잭션을 비활성화하도록 지시하는 올바른 구성이다. 부분 인덱스 (`WHERE service_type = 'cafe24' AND status = 'connected'`)로 인덱스 크기를 최소화한 설계도 적절하다.
  - 제안: 현재 구현 유지.

- **[INFO]** `enqueueCafe24BackgroundRefresh` 쿼리에 `Or(LessThan(cutoff), IsNull())` 추가 — NULL 시맨틱 처리
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts`, 라인 446
  - 상세: PostgreSQL에서 `NULL < cutoff` 는 NULL(FALSE)로 평가되어 `lastRotatedAt IS NULL` 인 레거시 행이 조회에서 누락된다. `Or(IsNull(), LessThan(cutoff))` 로 명시적 처리가 정확하다. 해당 쿼리는 V050의 부분 인덱스(`WHERE service_type='cafe24' AND status='connected'`)를 활용할 수 있고, `last_rotated_at`이 인덱스 키 컬럼이라 범위 스캔도 지원된다. 단, `lastRotatedAt IS NULL` 인 레거시 행은 인덱스에 포함되지만(PostgreSQL 부분 인덱스에 NULL 포함) NULLS LAST 정렬 위치에 배치되어 인덱스 범위 스캔의 끝에서 별도로 처리됨을 인지해야 한다.
  - 제안: 현재 구현 유지. 레거시 NULL 행은 최초 1회 refresh 처리 후 `lastRotatedAt`이 설정되므로 장기적으로 IS NULL 분기 경유 비율은 감소한다.

- **[INFO]** `integrations.service.ts`에서 `create()` 시 `lastRotatedAt: new Date()` 명시 초기화 추가
  - 위치: `backend/src/modules/integrations/integrations.service.ts`, 라인 629
  - 상세: 신규 통합 생성 시 `lastRotatedAt`을 발급 시점으로 초기화해 background refresh 대상 판단 쿼리의 cutoff 비교가 의도대로 동작하도록 수정했다. 올바른 수정이다.
  - 제안: 현재 구현 유지.

- **[INFO]** `integration-expiry-scanner.service.ts`에서 만료 대상 쿼리에 `pending_install` 상태 제외 추가
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts`, 라인 461
  - 상세: `Not(In(['expired', 'error', 'pending_install']))` 필터 추가로 `pending_install` 상태의 통합이 만료 알림 대상에서 제외된다. 이 쿼리는 기존 `idx_integration_workspace_status`와 같은 `status` 컬럼 인덱스를 활용한다. `tokenExpiresAt` 조건과 함께 복합 조건이므로 쿼리 플래너가 적절한 인덱스를 선택할 것으로 예상된다.
  - 제안: 현재 구현 유지.

### 요약

이번 변경에서 데이터베이스 관련 핵심 변경은 세 곳이다. (1) V049 마이그레이션의 `NOT NULL DEFAULT 0` 컬럼 추가는 PostgreSQL 11+ metadata-only 변경으로 무중단 배포에 안전하다. (2) V050의 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`와 `.conf`의 `executeInTransaction=false` 조합은 Flyway + PostgreSQL의 올바른 무중단 인덱스 생성 패턴이다. (3) `enqueueCafe24BackgroundRefresh`의 `Or(LessThan, IsNull)` 처리와 `create()` 시 `lastRotatedAt` 명시 초기화는 PostgreSQL의 NULL 비교 시맨틱을 정확히 이해하고 수정한 결과다. 마이그레이션 안전성, 인덱스 설계, NULL 처리 모두 적절하며 중대한 문제는 발견되지 않았다. 나머지 변경(schema 메시지 영문화, 노드 handler 수정 등)은 데이터베이스 관점과 무관하다.

### 위험도
LOW
