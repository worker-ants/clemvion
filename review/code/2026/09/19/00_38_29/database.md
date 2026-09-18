# 데이터베이스(Database) 리뷰

대상: `trigger.endpoint_path` 유일성 범위를 워크스페이스 단위 → 전역으로 바꾸는 변경
(V131 dedupe 마이그레이션 + V132 인덱스 교체 마이그레이션 + 관련 서비스/컨트롤러/테스트).

## 발견사항

- **[INFO]** V131 dedupe 는 중복 그룹마다 행 단위로 개별 `UPDATE` 를 실행한다 (루프 내 N+1 형태) — 마이그레이션 한정, 정상 트래픽 경로 아님
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40` (`UPDATE trigger SET endpoint_path = gen_random_uuid()::text, updated_at = now() WHERE id = r.id;`)
  - 상세: `FOR r IN ... LOOP` 안에서 중복 묶음의 "나머지" 행마다 개별 `UPDATE` 문을 실행한다. 애플리케이션 코드의 반복문 내 쿼리(N+1)와 같은 모양이지만, 대상은 상시 API 경로가 아니라 1회성 마이그레이션이고 파일 헤더에 실측(옛 스키마에 중복을 심은 프로브: 묶음 2개, 중복 3건)이 남아 있어 매치 행 수가 정상 운영에서는 매우 작을 것으로(복사-등록 공격의 흔적만) 전제하고 있다. 행마다 `RAISE NOTICE` 로 id·workspace·chat 여부를 남겨야 해서 집합 연산(단일 `UPDATE ... FROM (subquery)`)으로 대체하면 그 개별 로깅을 잃는다 — 트레이드오프가 문서화돼 있다.
  - 제안: 현재 설계로 충분하다고 판단되나, 만약 실제 운영 DB에 예상보다 많은(수천 단위 이상) 중복 그룹이 존재할 가능성이 있다면 배포 전에 `SELECT count(*) FROM (SELECT endpoint_path, count(*) FROM trigger WHERE endpoint_path IS NOT NULL GROUP BY endpoint_path HAVING count(*) > 1) d` 로 건수를 먼저 확인해, 트랜잭션 하나로 묶인 전체 UPDATE 가 락을 오래 쥐지 않는지 사전 점검을 권장.

- **[INFO]** V131→V132 사이에 새 복사-등록이 끼어들면 `CREATE UNIQUE INDEX CONCURRENTLY` 가 실패해 invalid 인덱스가 남는 경쟁(TOCTOU) 구간이 존재 — 이미 문서화·복구 절차 존재, 새 결함 아님
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:13-15` (운영 절차 ① 주석)
  - 상세: 두 마이그레이션이 별도 파일(트랜잭션/비트랜잭션 분리 제약 때문)로 나뉘어 있어 원자적으로 이어지지 않는다. 그 사이 윈도우에 다른 워크스페이스가 같은 경로를 다시 등록하면 V132 의 `CREATE UNIQUE INDEX CONCURRENTLY` 가 중복 키로 실패하고, 새 인덱스 이름이 invalid 상태로 점유된 채 남는다. 다만 (a) 옛 인덱스(`idx_trigger_workspace_endpoint`)는 `CREATE` 실패 시 Flyway 가 다음 문장(`DROP`)으로 진행하지 않아 valid 상태로 그대로 남고(보호 유지), (b) 파일의 "0) DROP 새 이름" 단계가 재실행 시 invalid 잔재를 치우도록 `migrations/README.md` §5 "인덱스 교체는 DROP-먼저" 규약을 정확히 따른다. 이 구간의 결함은 실패를 **자동 감지**하지 못하고 사람이 Flyway 실패 로그를 보고 수동으로 V131 DO 블록을 재실행해야 한다는 점(README §6 절차 의존)뿐이다.
  - 제안: 현재로도 안전하지만, CI/배포 파이프라인에 V132 적용 후 `SELECT indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='idx_trigger_endpoint_path'` 검증 스텝을 추가하면 사람이 Flyway 실패 로그를 놓치는 경우까지 자동으로 잡을 수 있다 (이미 e2e B6 이 이 술어를 검증하지만 배포 파이프라인 자체에는 없다).

- **[INFO]** UNIQUE 가 named constraint 가 아니라 plain 인덱스로만 존재 — README 일반 문구와 표면적 불일치, 기능적 결함 아님
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21-24`
  - 상세: `migrations/README.md` 는 "`UNIQUE` 제약은 `CREATE UNIQUE INDEX CONCURRENTLY` 후 `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX` 패턴을 사용" 이라고 적지만, V132 는 이 변환 단계 없이 `CREATE UNIQUE INDEX` 로 끝낸다. 다만 이 UNIQUE 는 원래(V002)부터 named constraint 가 아니라 plain unique index 였고, 저장소의 동종 선례(V002·V005·V013·V017·V043·V046·V071·V072·V081·V089·V109) 전부 같은 패턴이라 이 파일만의 새로운 편차가 아니다. 강제력·에러(SQLSTATE 23505)·UNIQUE VIOLATION 판정 로직(`isEndpointPathUniqueViolation`, 인덱스 이름으로 판별)에는 차이가 없다.
  - 제안: 조치 불필요. README 문구 자체의 일반 서술과 기존 관행 사이의 오래된 drift이므로 이 PR 책임이 아니다.

- **[INFO]** V132 가 dedupe(V131) 로 경로가 바뀐 chat-channel 트리거의 provider 재등록을 SQL 로는 수행하지 못함 — 이미 헤더에 명시, DB 리뷰 관점의 새 결함 아님
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:16-18`
  - 상세: dedupe UPDATE 는 순수 SQL이라 `TriggersService.setupChannel()`/`rotateBotToken()` 같은 애플리케이션 부수효과(Telegram/Slack/Discord provider 재등록)를 동반하지 못한다. chat-channel 트리거가 dedupe 로 경로를 새로 받으면 provider 쪽 콜백 URL 은 옛 경로를 계속 가리켜 그 채널이 조용히 끊길 수 있다. 이는 SQL 마이그레이션의 근본적 한계(외부 API 호출 불가)이며 파일 헤더가 이미 명시적으로 인정하고 NOTICE + 소유자 재저장 운영 절차로 우회하도록 설계했다. 트랜잭션/정합성 관점에서 DB 자체는 일관 상태를 유지하지만, "DB 밖 정합성"(provider 등록 상태)은 이 마이그레이션만으로 보장되지 않는다는 점은 이미 `review/consistency/.../cross_spec.md` 가 WARNING 으로 별도 지적했다.
  - 제안: 중복 없음 — 이미 다른 리뷰어가 다룬 항목이므로 추가 조치 요구하지 않음 (참고로만 병기).

## 검증 확인 (문제 없음)

- **인덱스**: V132 의 `(endpoint_path) WHERE endpoint_path IS NOT NULL` 는 `hooks.service`·`public-webhook-throttle.guard`·`embed-config.service` 세 조회 지점의 `WHERE endpoint_path = ?` (workspace 미필터) 패턴에 정확히 부합 — 헤더 실측(5만 행에서 0.200ms→0.025ms) 근거 있음. 옛 `(workspace_id, endpoint_path)` UNIQUE 는 이 조회의 선두 컬럼이 아니라 전체 스캔을 유발하던 것이었고, 새 인덱스가 이를 해소.
- **트랜잭션**: V131 은 `DO $$ ... $$` 블록으로 Flyway 기본 트랜잭션 안에서 실행(전체 성공/실패가 원자적). V132 는 `CONCURRENTLY` 제약상 비트랜잭션(`.conf executeInTransaction=false`)이 맞고, `migrations/README.md` §5 규약·V110 선례와 일치. 두 명령을 한 파일에 섞지 않은 것도 README 의 "mixed 판정" 실측(2026-09-05)에 정확히 부합.
- **마이그레이션 안전성**: `DROP(새 이름, invalid 잔재 정리) → CREATE CONCURRENTLY(새 이름) → DROP(옛 이름)` 순서가 README "인덱스 교체는 DROP-먼저" 정책과 완전히 일치 — 재실행 시 인덱스 0개가 되는 함정을 피한다. `CREATE UNIQUE INDEX CONCURRENTLY` 는 무거운 락(ACCESS EXCLUSIVE)을 잡지 않아 무중단 배포에 안전. 옛 인덱스 삭제는 새 인덱스가 성공적으로 만들어진 뒤 마지막 문장으로 배치돼, 실패 시에도 보호가 줄어들지 않는다.
- **SQL 인젝션**: V131 의 `RAISE NOTICE` 는 `%` 플레이스홀더로 파라미터화됐고, e2e 테스트(`db.query('... WHERE id = $1', [executionId])`)도 파라미터 바인딩을 사용 — 문자열 연결 없음.
- **커넥션 관리**: 이번 변경 범위에서 커넥션 풀 획득/해제 로직 변경 없음. 서비스 코드의 `save()` 호출·e2e 의 `db.query()` 호출 모두 기존 pool/repository 경유.
- **대량 데이터**: 대상 테이블(`trigger`, 웹훅 트리거 실측 규모 1.25만~5만 행)에서 조회 성능은 선형(0.049ms→0.200ms)으로 실측돼 있고, 마이그레이션 자체도 인덱스 개수를 유지(교체)하므로 쓰기 비용 증가가 없다.
- **N+1 (일반 애플리케이션 경로)**: `triggers.service.ts` 의 `rethrowEndpointPathConflict` 호출부(`save().catch(...)`, 라인 497·723)는 기존과 동일한 단일 `save()` 콜, 반복문 내 쿼리 없음.

## 요약

핵심 변경은 `trigger.endpoint_path` 의 UNIQUE 범위를 워크스페이스 단위에서 전역으로 좁히는(엄밀히는 넓히는) 인덱스 교체이며, 실제 조회 패턴(workspace 모르는 3개 조회 지점)에 정확히 들어맞는 인덱스 설계이고, CONCURRENTLY 기반 무중단 교체 절차·트랜잭션 분리·DROP-먼저 순서·SQL 파라미터화 모두 저장소의 기존 마이그레이션 컨벤션과 선례(V110)를 충실히 따른다. 유일한 구조적 잔여 리스크는 V131(dedupe)과 V132(제약 추가) 사이의 비원자적 갭(TOCTOU)인데, 실패 시 옛 인덱스가 그대로 보호를 유지하고 재실행 절차가 문서화돼 있어 심각도는 낮다. dedupe 루프의 행 단위 UPDATE(N+1 형태)와 chat-channel provider 재등록 갭은 각각 1회성 마이그레이션·SQL 의 구조적 한계로 이미 헤더 주석과 별도 consistency 리뷰가 인지·문서화한 사안이라 추가 차단 사유로 보지 않는다. 데이터베이스 관점에서 이 변경은 안전하게 설계됐다.

## 위험도

LOW
