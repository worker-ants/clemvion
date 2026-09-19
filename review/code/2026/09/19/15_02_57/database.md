# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `rotate()` 의 부분 `save()` 전환은 lost-update 경합을 올바르게 제거한 것으로 보인다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` (diff 게이트 `1117`~`1128` 부근, 전체 파일 기준 약 1100행대)
  - 상세: 기존에는 `entity.credentials = merged; ...; await this.integrationRepository.save(entity)` 로 **엔티티 전체**를 저장했다. `dispatchTest`(실제 외부 접속, 최대 10초) 가 도는 동안 다른 요청이 `logUsage()` 의 원자적 `update({id}, {lastUsedAt, ...})` 로 `lastUsedAt` 을 먼저 갱신하면, 뒤늦게 끝나는 `rotate()` 의 전체 `save(entity)` 가 로드 시점의 옛 `lastUsedAt` 으로 덮어써 **lost update** 가 난다. 이번 diff 는 `await this.integrationRepository.save({ id: entity.id, ...changes })` 로 **바뀌는 컬럼만** 저장하도록 바꿔 그 경합을 없앴고, 응답용 엔티티는 `Object.assign(entity, changes)` 로 메모리에서만 갱신한다.
  - 근거: `Integration` 엔티티(`entities/integration.entity.ts`)에는 `@BeforeUpdate`/`@BeforeInsert`/구독자(subscriber)가 없어 부분 객체 저장이 다른 컬럼(특히 Cafe24 전용 `mallId` — oauth2 authType 이라 애초 `rotate()` 앞단에서 차단됨, `credentials`/`lastError` 의 `encryptedJsonTransformer`)에 부작용을 주지 않는 것을 확인했다. `credentials` 컬럼의 JSONB 암호화 transformer 가 부분 객체 저장 경로에서도 걸리는지는 새로 추가된 e2e `integration-connection-test.e2e-spec.ts` 테스트 E 가 실제 DB로 `credentials::text` 를 재조회해 암호문이 바뀌었는지 직접 검증하고 있어(추측이 아니라 실측), 이 전환이 안전함을 뒷받침한다.
  - 제안: 없음(개선 확인 목적의 기록). 다만 `save()` 대신 이미 프로젝트 관례인 `.update({id}, changes)` + 반환값 없이 `Object.assign` 을 쓰면 TypeORM 이 엔티티 존재 여부를 다시 판단하는 내부 분기를 타지 않아 더 명시적이다 — 현재도 정상 동작하므로 스타일 제안 수준.

- **[INFO]** Database 연결 테스트는 애플리케이션 자체의 커넥션 풀과 무관한 일회성 연결이며, 정상/실패 경로 모두 닫는다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` — `probePostgres`/`probeMysql`/`closeWithin` (게이트 69~102, 34~50)
  - 상세: `pg.Client`/`mysql2` connection 을 매 호출마다 새로 만들고 `try/finally` 로 반드시 닫으며, graceful close 가 `DB_TEST_CLOSE_GRACE_MS`(1초) 를 넘기면 소켓을 강제 `destroy()` 한다 — 응답 없는 서버가 동시 실행 상한(`CONNECTION_TEST_MAX_CONCURRENCY = 2`, `integrations.service.ts`) 슬롯을 영구히 쥐는 것을 막는다(직전 커밋 `edd468476` 이 실제로 이 문제를 고쳤고, `database-connection-tester.spec.ts` 가 fake timer 로 grace-then-destroy 경로를 단위 검증한다). Postgres/MySQL 드라이버 모두 커넥션 실패 시에도 finally 블록이 실행되어 리소스 누수가 없다.
  - 제안: 없음(정상 설계 확인).

- **[INFO]** SQL 인젝션 관점 — 신규 코드에 동적 SQL 조립 없음
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` (`probePostgres`/`probeMysql`), `codebase/backend/test/integration-connection-test.e2e-spec.ts` (e2e 헬퍼 쿼리)
  - 상세: 연결 테스트는 리터럴 `'SELECT 1'` 만 실행하며 사용자 입력을 SQL 문자열에 넣지 않는다(자격증명은 연결 파라미터로만 쓰인다). 신규 e2e 테스트의 검증 쿼리도 `$1` 파라미터 바인딩을 사용한다.
  - 제안: 없음.

- **[INFO]** 마이그레이션/스키마 변경 없음
  - 위치: 해당 diff 범위 전체 (`codebase/backend/src/migrations` 등 스키마 파일 변경 없음, `git diff --stat` 확인)
  - 상세: 이번 변경은 신규 테스트 로직·서비스 배선·DTO 필드(`code?: string`, 이미 optional) 추가이며 테이블 구조·인덱스·컬럼 변경이 없다.
  - 제안: 없음.

- **[INFO]** N+1·대량 데이터·페이지네이션 관점 — 해당 없음
  - 상세: 변경된 코드 경로 어디에도 루프 안에서 개별 쿼리를 실행하는 패턴이나 목록 조회 API가 없다. `rotate()`/`dispatchTest()` 는 단건 엔티티 기준으로 동작한다.
  - 제안: 없음.

## 뮤테이션/재현 절차
가설 검증을 위한 코드 변경 없이 `Read`/`Bash`(cat, sed, grep)만으로 저장소를 읽었다. 저장소 트리에 어떤 파일도 쓰거나 수정하지 않았으며 `git status --short` 로 리뷰 시작·종료 시점의 상태가 동일함을 확인했다(review/ 산출물 외 변경 없음).

## 요약
이번 변경은 애플리케이션 자체 데이터베이스(Postgres, TypeORM)에 대한 스키마·마이그레이션·쿼리 패턴 변경이 아니라, 사용자가 등록한 외부 Database/HTTP 통합에 실제로 접속해보는 "연결 테스트" 기능 추가가 핵심이다. 외부 DB로의 연결은 애플리케이션 커넥션 풀과 분리된 일회성 연결로, 정상/타임아웃/에러 경로 모두에서 확실히 닫히도록 구현되어 있고(직전 커밋에서 닫기 자체의 무한 대기 문제도 이미 수정됨), 동시 실행 상한으로 자원 고갈을 방지한다. 유일하게 애플리케이션 DB에 영향을 주는 변경은 `rotate()` 의 저장 방식을 전체 엔티티 `save()`에서 변경 컬럼만 반영하는 부분 `save()`로 바꾼 것인데, 이는 느린 연결 테스트 도중 발생할 수 있던 lost-update 경합(동시 `logUsage` 의 원자적 `update` 와 충돌)을 제거하는 개선이며, 파생 컬럼(`mallId`)이나 컬럼 transformer(암호화)에 부작용이 없음을 코드와 신규 e2e 테스트로 확인했다. SQL 인젝션·N+1·인덱스·페이지네이션·마이그레이션 안전성 관점에서 지적할 결함은 발견되지 않았다.

## 위험도
NONE
