# Database 리뷰 결과

## 발견사항

- **[INFO]** NOT VALID CHECK 제약 — 신규 행만 보호, 레거시 행 미검증 (의도적)
  - 위치: `codebase/backend/migrations/V102__trigger_endpoint_path_uuid_check.sql` 전체
  - 상세: `NOT VALID` 옵션으로 추가된 CHECK 제약은 신규 INSERT/UPDATE 에만 적용되며 기존 행은 검증하지 않는다. 마이그레이션 주석에서 이 결정을 명시적으로 설명하고 있으며, 레거시 row 에 비-UUID 값이 존재할 수 있음을 인지한 의도적 선택이다. 무중단 배포 측면에서는 올바른 접근이다. 다만 운영에서 레거시 데이터 클린 후 `VALIDATE CONSTRAINT` 승격 계획을 추후 별도 마이그레이션으로 반드시 이행해야 한다.
  - 제안: plan 또는 별도 마이그레이션 파일(V103+)에 `VALIDATE CONSTRAINT chk_trigger_endpoint_path_uuid` 승격 태스크를 명시적으로 추적할 것. 현재로서는 차단 필요 없음.

- **[INFO]** DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT 패턴 — 재실행 안전
  - 위치: `V102__trigger_endpoint_path_uuid_check.sql` L61~L69
  - 상세: `DROP CONSTRAINT IF EXISTS` 후 `ADD CONSTRAINT` 를 수행하는 패턴은 부분 적용 복구(idempotent re-run) 를 보장한다. Flyway 환경에서 체크섬 불일치 없이 재실행 시나리오를 처리할 수 있다. 설계 적절.
  - 제안: 없음.

- **[INFO]** e2e 픽스처의 직접 DB INSERT — 파라미터화된 쿼리 일관 사용 확인
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` L1104~L1176
  - 상세: `db.query(sql, [params])` 형식의 파라미터화된 쿼리를 일관되게 사용하고 있어 SQL 인젝션 위험이 없다. `endpointPath = randomUUID()` 로 변경되어 DB CHECK 제약과 일치하도록 수정된 점도 적절하다.
  - 제안: 없음.

## 요약

이번 변경의 핵심 DB 관련 코드는 `V102__trigger_endpoint_path_uuid_check.sql` 마이그레이션이다. `NOT VALID` 옵션을 사용해 ACCESS EXCLUSIVE lock 시간을 최소화하고 레거시 비-UUID 행의 제약 위반을 회피하면서 신규 데이터에만 v4 UUID CHECK 를 강제하는 설계는 무중단 배포 안전성 측면에서 올바르다. e2e 픽스처(`external-interaction.e2e-spec.ts`)의 `endpointPath` 를 `randomUUID()` 로 교체한 것도 DB CHECK 제약과 일관성을 맞추는 필수 수정이다. N+1, 트랜잭션, 인덱스, 커넥션 풀, 대량 데이터 관련 이슈는 이번 변경 범위에 해당하지 않는다. 발견사항은 모두 INFO 수준의 참고 사항이며 차단 필요 없다.

## 위험도

LOW
