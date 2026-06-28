### 발견사항

- **[WARNING]** V103 pre-flight DO $$ 블록: 위반 row 존재 시 RAISE EXCEPTION 으로 마이그레이션을 중단하지만, 트랜잭션 롤백 경계가 Flyway/마이그레이션 도구의 실행 컨텍스트에 따라 달라진다. PostgreSQL DO 블록 내 RAISE EXCEPTION 은 현재 트랜잭션을 abort 상태로 만들며 이후 DDL(ALTER TABLE … VALIDATE CONSTRAINT)은 실행되지 않는다. 이는 의도된 동작이지만, 마이그레이션 도구가 abort 상태 커넥션으로 추가 SQL 을 실행하려 하면 "ERROR: current transaction is aborted" 가 연쇄 발생할 수 있다. Flyway 는 기본적으로 각 마이그레이션을 단일 트랜잭션으로 래핑하므로 안전하나, `outOfOrder=true` 환경이나 트랜잭션 밖(transactional=false) 실행 설정이 있다면 상태 전이가 달라진다.
  - 위치: `codebase/backend/migrations/V103__trigger_endpoint_path_uuid_validate.sql` L49-62
  - 상세: RAISE EXCEPTION 이 발생하면 해당 트랜잭션은 완전 롤백되고 Flyway 는 마이그레이션 실패로 기록한다. 재실행 시 pre-flight 가 다시 동작하므로 idempotent 하다. 그러나 예외 발생 후 마이그레이션 도구의 오류 핸들링 경로(스키마 히스토리 테이블 업데이트 순서)를 확인할 필요가 있다.
  - 제안: Flyway 설정에서 해당 마이그레이션의 `transactional` 플래그(기본값 true)가 변경된 적 없는지 확인. 변경 없다면 현재 구조는 안전하다.

- **[INFO]** V103 의 pre-flight 정규식이 V102 의 CHECK 제약 정규식과 정확히 동일한지 확인 필요.
  - 위치: V103 L56 vs V102 L32
  - 상세: 두 정규식 모두 `'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'` 로 일치하며 `~*`(대소문자 무시) 플래그도 동일하다. 불일치 없음.

- **[INFO]** `plan/complete/webchat-usewidget-split.md`: `spec_impact: []` → `spec_impact: none` 변경은 YAML 시맨틱 상 빈 리스트에서 bare scalar 로의 타입 변경이다. Gate C 파서가 `none` 을 "없음"으로 해석하도록 설계되어 있어야 한다. 메모리(`feedback_spec_impact_gate_c_list.md`)에 따르면 빈 리스트는 Gate C 실패를 유발하므로 이 변경은 의도된 수정이며 부작용이 아니다.
  - 위치: `plan/complete/webchat-usewidget-split.md` L4
  - 상세: 파서가 `none` 문자열을 `null`/absent 로 처리하는지, 혹은 bare string 으로 읽어 경로 리스트로 오인하는지 여부가 관건이다. 메모리 기록상 bare string 경로가 Gate C 실패를 유발했던 전례가 있으나, 해당 사례는 실제 파일 경로 문자열이었고 `none` 은 관례적 null-sentinel 이다. Gate C 코드에서 `none`/`null` 처리를 명시적으로 허용하는지 확인 권장.
  - 제안: Gate C 파서 코드에서 `spec_impact: none` 케이스가 명시적으로 처리되는지 확인. 이미 통과한 lint/unit 결과가 있다면(체크리스트 [x]) 실제 부작용 없음으로 판단 가능.

- **[INFO]** `plan/complete/webchat-spec-polish-followups.md` 에 `spec_impact` 리스트 5건 추가는 plan 파일 메타데이터 변경으로 DB/코드/API 에 직접 부작용 없음. Gate C 가 이 파일을 읽어 spec 파일 접촉 여부를 추적한다면 의도된 정보 추가다.

- **[INFO]** `plan/in-progress/trigger-endpoint-path-uuid-validate.md` 신규 생성은 worktree 파일시스템에 새 파일을 추가하지만, 이는 plan 추적 파일로 의도된 파일시스템 부작용이다. 코드나 DB 에 영향 없음.

- **[INFO]** V103 의 `ALTER TABLE trigger VALIDATE CONSTRAINT` 는 SHARE UPDATE EXCLUSIVE lock 을 획득한다. 이 lock 은 다른 `SHARE UPDATE EXCLUSIVE`(예: `VACUUM`, `CREATE INDEX CONCURRENTLY`, `ALTER TABLE … VALIDATE CONSTRAINT` 동시 실행)와 충돌한다. 운영 환경에서 동시 마이그레이션이나 VACUUM 이 해당 테이블에 실행 중이면 lock 대기가 발생할 수 있다. 댓글에 "사실상 즉시 완료"로 명시되어 있으나, lock wait timeout 설정이 없으면 이론상 대기가 길어질 수 있다.
  - 위치: V103 L64
  - 제안: Flyway 실행 전 `lock_timeout = '5s'` 등을 세션 레벨로 설정하는 관례가 있다면 동일하게 적용 고려. 없다면 현재 구조도 허용 가능.

### 요약

이번 변경의 핵심인 V103 마이그레이션은 DB 스키마의 제약 검증 상태만 변경하며(NOT VALID → VALID), 전역 변수·환경 변수·외부 네트워크 호출·이벤트/콜백 변경이 전혀 없다. pre-flight DO 블록이 RAISE EXCEPTION 으로 트랜잭션을 중단시키는 구조는 의도된 방어적 설계로, Flyway 기본 트랜잭션 모드에서 안전하다. plan 파일 변경 2건(spec_impact 수정/추가)은 Gate C 회귀를 수정하기 위한 메타데이터 변경이며 코드·DB·API 에 부작용이 없다. `spec_impact: none` 의 파서 해석 여부를 확인하는 것이 유일한 실질 리스크이나, 체크리스트상 lint/unit 이 이미 통과했으므로 실제 문제 가능성은 낮다.

### 위험도

LOW
