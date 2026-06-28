# 데이터베이스(Database) 코드 리뷰

## 발견사항

### INFO 1: pre-flight COUNT(*) 쿼리 — `endpoint_path` 인덱스 유무 확인 권장
- **위치**: `/codebase/backend/migrations/V103__trigger_endpoint_path_uuid_validate.sql` 라인 21-24
- **상세**: pre-flight DO 블록이 `trigger.endpoint_path` 에 대해 `WHERE endpoint_path IS NOT NULL AND endpoint_path !~* ...` 정규식 스캔을 수행한다. `endpoint_path` 에 인덱스가 없으면 테이블 시퀀셜 스캔이 발생한다. 주석에 "row 4건"이라고 명시되어 있어 현재 데이터 규모에서는 즉시 완료되므로 실질적 위험은 없다. 다만 인덱스 존재 여부를 명시하지 않은 점은 향후 대용량화 시 참고용으로 기록한다.
- **제안**: 마이그레이션 주석에 `endpoint_path` 인덱스 유무(예: `CREATE INDEX IF EXISTS ... ON trigger(endpoint_path)` 여부)를 한 줄 언급하면 운영 이력이 명확해진다. 데이터 규모가 현재 수준(수 건~수백 건)이라면 현행 유지도 무방하다.

### INFO 2: `VALIDATE CONSTRAINT` 와 Flyway 트랜잭션 경계 확인
- **위치**: `/codebase/backend/migrations/V103__trigger_endpoint_path_uuid_validate.sql` 라인 32
- **상세**: Flyway 기본 설정은 각 마이그레이션을 단일 트랜잭션으로 감싼다(`executeInTransaction=true`). `VALIDATE CONSTRAINT` 자체는 트랜잭션 내에서 실행 가능하며 PostgreSQL 에서 정상 동작한다. 단, `ALTER TABLE ... VALIDATE CONSTRAINT` 가 Flyway 설정에 따라 `executeInTransaction=false` 로 분리해야 하는 프로젝트 컨벤션이 있다면 해당 설정을 점검해야 한다. 주석에 lock 종류(SHARE UPDATE EXCLUSIVE)가 명시되어 있어 설계 의도는 명확하다.
- **제안**: 프로젝트의 다른 `ALTER TABLE VALIDATE CONSTRAINT` 마이그레이션(예: V102)이 `executeInTransaction` 설정을 어떻게 처리하는지 확인하고 일관성을 유지한다. 현행 DO 블록 + VALIDATE 순서 자체는 올바르다.

## 요약

V103 마이그레이션은 NOT VALID CHECK 제약을 VALIDATE 로 승격하는 단일 목적 파일로, 데이터베이스 안전성 측면에서 전반적으로 양호하게 작성되어 있다. SHARE UPDATE EXCLUSIVE lock 사용으로 무중단 배포 안전성을 확보했고, pre-flight DO 블록으로 배포 직전 데이터 정합성을 재확인하는 이중 방어 구조가 적용되어 있다. 정규식 패턴(`!~*`)은 v4 UUID 형식에 부합하며 파라미터화 우려도 없다. 지적된 두 항목은 모두 INFO 수준으로, 현재 데이터 규모(4건)에서는 실질적 위험이 없다. plan/complete 및 plan/in-progress 의 markdown 파일 3개는 DB 코드와 무관한 계획 문서이므로 별도 DB 검토 대상이 아니다.

## 위험도

LOW

---

STATUS=success ISSUES=0
