# 데이터베이스(Database) 리뷰 — 연결 테스트(Database · HTTP) 구현

## 발견사항

- **[CRITICAL]** MySQL 연결 테스트의 쿼리 타임아웃이 드라이버 커맨드 큐를 해제하지 않아, 응답 없는(black-hole) 서버를 대상으로 하면 정리(cleanup) 단계가 영구히 멎고 전역 동시성 슬롯을 영원히 점유한다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:52-68` (`probeMysql`, 특히 64~66행)
  - 상세: `connection.query({ sql: 'SELECT 1', timeout: DB_TEST_TIMEOUT_MS })` 가 타임아웃하면 `mysql2` 는 `Query` 커맨드 객체에 `onResult(err)`/`emit('error')` 만 호출할 뿐(`lib/commands/query.js` `_handleTimeoutError`), 커넥션의 내부 커맨드 슬롯(`Connection._command`)은 해제하지 않는다 — `_command` 는 오직 서버로부터 실제 패킷이 도착해 `handlePacket()` 이 `execute()` 의 `done` 을 받을 때만 큐의 다음 커맨드로 넘어간다(`lib/base/connection.js:554-561`). 이후 `finally` 블록의 `connection.end()` 는 `Commands.Quit` 을 커맨드 큐에 **추가**할 뿐(`lib/base/connection.js:1089-1103`, `lib/promise/connection.js:67-69`)이고, 이미 멈춰 있는 이전 `Query` 커맨드 뒤에 줄을 선다 — 서버가 그 뒤로 아무 패킷도 보내지 않으면(TCP 연결은 살아 있는데 응답만 없는 상태, 방화벽의 silent drop 등) `Quit` 은 영원히 실행되지 않고 `connection.end()` 의 Promise 는 **결코 resolve 되지 않는다**. `.catch(() => {})` 는 reject 만 삼킬 뿐 이 hang 자체는 막지 못한다.
    이 `probeMysql` 호출은 `IntegrationsService.dispatchTest` 가 `this.connectionTestLimit(() => tester(...))` 로 감싸는데(`integrations.service.ts:1542`), `connectionTestLimit` 은 프로세스 전체(싱글턴 서비스 인스턴스)에서 `mcp · email · database · http` 네 서비스가 공유하는 `pLimit(2)` 다. `probeMysql` 이 위 시나리오로 영원히 반환하지 않으면 그 슬롯 하나는 **영구히** 반환되지 않는다 — 두 번만 반복되면(공개 host 를 향한 사설 host 가 아니므로 SSRF 가드도 막지 못한다) 프로세스 안의 모든 연결 테스트(Database·HTTP 뿐 아니라 MCP·Email 도)가 큐에서 영원히 대기하게 된다. 재기동 전까지 복구 불가능하다.
    참고로 PostgreSQL 경로(`probePostgres`)는 이 위험이 없다 — `pg` 의 `Client.prototype.end()` 는 활성 쿼리가 있으면 graceful shutdown 대신 `connection.stream.destroy()` 로 강제 종료한다(`node_modules/.pnpm/pg@8.23.0/.../lib/client.js:804-809`), 즉 서버 응답을 기다리지 않는다. `mysql2` 쪽에는 이런 force-close 분기가 `query` 타임아웃 경로에 없다(오직 `connectTimeout`(연결 단계)만 `stream.destroy()` 를 호출한다, `lib/base/connection.js:240-245`).
    이 위험은 이 PR 이 새로 연 것이다 — 이전에는 `database` service_type 에 transport tester 가 아예 없어 실제 소켓을 열지 않았다(`dispatchTest` 가 구조 검증만 하고 통과시켰다).
  - 제안: `probeMysql` 의 `finally` 에서 무조건 graceful `connection.end()` 를 기다리지 말 것. (a) 쿼리/연결이 이미 실패한 경로에서는 내부 `Connection` 의 `destroy()`(동기, `stream.end()` 만 호출하고 서버 응답을 기다리지 않는다 — `mysql2/promise` 의 `PromiseConnection` 은 이를 직접 노출하지 않으므로 `(connection as any).connection.destroy()` 혹은 export 되는 동급 API로 접근)를 쓰거나, (b) `Promise.race([connection.end(), delay(짧은 상한)])` 로 정리 자체에도 상한을 걸어 `connectionTestLimit` 슬롯이 반드시 돌아오게 한다. 이미 이 PR 의 docstring(`integrations.service.ts` `CONNECTION_TEST_MAX_CONCURRENCY` 주석)이 "응답하지 않는 DNS" 시나리오를 명시적으로 경계했던 것과 같은 성격의 위험이 정리 경로에 남아 있다.

- **[INFO]** `rotate()` 의 부분 저장이 `logUsage()` 의 원자적 `update()` 와 달리 숨은 존재-확인 `SELECT` 를 한 번 더 낸다 (정확성 문제는 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1124` (`await this.integrationRepository.save({ id: entity.id, ...changes });`)
  - 상세: TypeORM 소스 확인 결과(`SubjectDatabaseEntityLoader.js`) `save()` 는 식별자가 있는 subject 에 대해 항상 DB 로우를 먼저 `SELECT` 해 `databaseEntity` 로 로드한 뒤 diff 를 계산한다 — `logUsage()`(바로 위, `integrations.service.ts:1048`)가 쓰는 `repository.update()` 는 이 조회 없이 바로 `UPDATE` 를 낸다. 다만 `SubjectChangedColumnsComputer.js` 를 확인한 결과 diff 계산은 입력 객체에 **명시적으로 존재하는(undefined 가 아닌) 컬럼만** 반영하므로(`entityValue === undefined` 인 컬럼은 SET 절에서 완전히 제외), 방금 로드한 `databaseEntity` 의 `lastUsedAt` 이 이 partial 객체에 없다는 이유로 SET 절에 섞여 들어가는 일은 없다 — 즉 이번 fix(전체 엔티티 저장 → 바뀐 컬럼만 저장)는 **의도대로 정확하다**, 실측 회귀 테스트(`integrations.service.spec.ts:2075` "rotate 는 바꾸는 컬럼만 저장한다…")도 SET 절 컬럼 목록을 직접 단언해 이를 검증한다. 다만 매 `rotate()` 호출마다 불필요한 `SELECT` 1회가 더 나가는 것 자체는 사실이다 — 이미 연결 테스트로 수 초가 걸리는 호출이라 체감 영향은 무시할 만하지만, `logUsage()` 와 같은 패턴(`repository.update({id}, changes)`)을 썼다면 이 추가 왕복도 없앨 수 있었다.
  - 제안: 필요하면 `save({id, ...changes})` 를 `repository.update({ id: entity.id }, changes)` 로 바꿔 불필요한 조회를 없앤다(응답은 이미 `Object.assign(entity, changes)` 로 만들고 있어 `save()` 의 반환값에 의존하지 않으므로 대체가 안전하다). 지금 상태로도 정확성 문제는 없어 필수는 아니다.

- **[INFO]** `rotate()` 의 자격증명 저장 · 감사 로그 기록 · 캐시 무효화 브로드캐스트가 하나의 DB 트랜잭션으로 묶여 있지 않다 (이 diff 가 새로 만든 상태는 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1124-1135`
  - 상세: `integrationRepository.save(...)` 성공 후 `auditLogsService.record(...)` 가 실패하면(별도 테이블 쓰기) 자격증명 교체는 이미 커밋된 채 감사 로그만 누락된다. 이 구조는 이번 diff 이전에도 (`saved = await integrationRepository.save(entity); ... audit ... broadcast`) 동일했으므로 이번 변경이 새로 만든 정합성 갭은 아니다 — 다만 이번에 손댄 자리이니 참고로 남긴다.
  - 제안: 별도 트래킹 대상(트랜잭션으로 묶거나 outbox 패턴 도입)이며 이번 PR 의 스코프로 요구하지는 않는다.

## 정합성 확인 (문제 없음으로 확인된 것들)

- Database 연결 테스트는 앱의 공용 TypeORM/`pg` 커넥션 풀과 별개인 **일회성** 클라이언트를 매번 새로 만들고, `finally` 에서 항상 닫는다(`probePostgres`/`probeMysql` 모두 `connect()`/`createConnection()` 실패 여부와 무관하게 정리를 시도) — 노드 실행 경로의 풀에 영향을 주지 않는다는 문서화된 설계 의도와 일치한다.
- `dispatchTest` 에 새로 걸린 `connectionTestLimit = pLimit(CONNECTION_TEST_MAX_CONCURRENCY /* =2 */)` 는 DB·HTTP·MCP·Email 네 트랜스포트 테스트가 동시에 열 수 있는 소켓/DNS lookup 수를 프로세스 단위로 제한해, 반복 호출로 인한 커넥션·스레드풀 고갈을 억제한다(다만 위 CRITICAL 이 이 상한 자체를 무력화할 수 있다).
- `SELECT 1` 은 리터럴이며 사용자 입력이 쿼리 문자열에 삽입되지 않는다 — SQL 인젝션 경로 없음.
- 이번 diff 에는 스키마·마이그레이션·인덱스·페이지네이션 관련 변경이 없다. 반복문 안에서 개별 쿼리를 실행하는 N+1 패턴도 없다(테스트당 연결 1회·쿼리 1회).
- `rotate()` 의 전체 엔티티 저장 → 변경 컬럼만 저장 전환은 `logUsage()` 의 원자적 `update()` 와의 경쟁(lost update)을 정확히 겨냥해 고친 것이고, 전용 회귀 테스트(`integrations.service.spec.ts:2075`)로 SET 절 컬럼 목록까지 검증된다 — 정합성 관점에서 개선이다.

## 요약

이번 PR 은 스키마·마이그레이션·인덱스 변경이 없는 순수 애플리케이션 로직 추가라 대부분의 데이터베이스 관점 항목(인덱스·N+1·마이그레이션·스키마 설계·대량 데이터)은 해당 사항이 없다. 다만 "커넥션 관리" 관점에서 실제 결함을 하나 발견했다 — MySQL 연결 테스트가 쿼리 타임아웃 뒤에도 드라이버 내부 커맨드 큐를 해제하지 않아 응답 없는 서버를 상대로 정리(`connection.end()`) 자체가 영구히 멎을 수 있고, 이는 새로 도입된 프로세스 전역 동시성 상한(2)의 슬롯 하나를 영영 반환하지 않아 반복되면 Database·HTTP 뿐 아니라 MCP·Email 연결 테스트 전체를 process 재기동 전까지 마비시킬 수 있다(`pg` 경로는 라이브러리가 강제 종료를 이미 처리해 이 위험이 없다). 반대로 `rotate()` 의 부분 저장 전환은 TypeORM 소스와 회귀 테스트로 검증한 결과 의도대로 정확하며 기존 lost-update 위험을 실제로 없앤 개선이다. 그 밖에 불필요한 추가 `SELECT` 왕복, 트랜잭션 미적용은 경미하거나 기존부터 있던 패턴이라 INFO 로만 남긴다.

## 위험도
HIGH
