### 발견사항

- **[INFO]** `mapDbError` 및 분류 함수들 — 완전한 순수 함수, 동시성 위험 없음
  - 위치: `database-query.handler.ts` L419–572 (신규 추가 전체)
  - 상세: `mapDbError`, `extractDriverCode`, `classifyDbError`, `classifyPostgresSqlState`, `classifyMysqlCode` 는 모두 순수 함수. 모듈 초기화 시 1회만 생성되는 `const Set`(`CONNECTION_ERRNOS`, `MYSQL_CONNECTION_CODES` 등)을 읽기 전용으로 참조하며, 내부 변경 가능한 공유 상태가 없음.
  - 제안: 현행 유지. 문제 없음.

- **[INFO]** `catch` 블록 내 `errorEnvelope` 지역 변수 — 동시성 위험 없음
  - 위치: `database-query.handler.ts` L170–188
  - 상세: `const driver = creds.driver ?? 'postgres'` 와 `const errorEnvelope = ...mapDbError(err, driver)` 는 스택 지역 변수이므로 콜 간 공유되지 않음. `await` 포인트도 없어 인터리빙 불가.
  - 제안: 현행 유지.

- **[WARNING]** `shutdown()` + 진행 중인 `execute()` 간 경쟁 조건 — 신규 코드가 아닌 기존 설계 문제, 이번 diff로 악화되지 않음
  - 위치: `database-query.handler.ts` `shutdown()` / `executePostgres()` / `resolvePgPool()`
  - 상세: `shutdown()` 은 `this.pools.clear()` (동기) 후 `await Promise.allSettled(entries.map(e => e.pool.end()))` (비동기) 를 호출함. 이 `await` 사이에 동시 `execute()` 호출이 재진입하면 빈 맵에서 새 풀을 생성하지만 `shutdown()` 은 해당 풀을 종료하지 못해 커넥션이 누수됨. 반대로 `executePostgres` 내부에서 `const pool = this.resolvePgPool(...)` 으로 풀 참조를 얻은 뒤 `await pool.connect()` 전에 `shutdown()` 이 `pool.end()` 를 완료하면 `connect()` 가 예외를 던져 `error` 포트로 라우팅됨 — 크래시는 아니지만 의도치 않은 거짓 오류 반환임.
  - 제안: 이번 변경 범위 밖이지만, `shutdown()` 에서 `clear()` 를 `await pool.end()` 완료 이후로 미루거나, in-flight 카운터를 두어 모든 `execute()` 완료 대기 후 종료하는 drain 패턴 도입을 권장함. 테스트에서는 `await handler.shutdown()` 이 각 it-block 말미에 호출되어 문제 없음.

---

### 요약

이번 diff의 핵심 변경인 `mapDbError` 함수군과 분류 Set 상수는 순수 함수 + 불변 모듈 상수로 구성되어 동시성 관점에서 완전히 안전하다. `catch` 블록의 리팩터링 역시 지역 변수만 사용하므로 공유 상태 접근이 없다. 기존 `this.pools` 맵 관리(`shutdown` vs 진행 중 `execute`)에 이론적 경쟁 조건이 존재하나, 이는 Node.js 단일 스레드 이벤트 루프 특성상 실운영 영향이 제한적이고, 이번 diff가 도입한 문제가 아니다.

### 위험도
LOW