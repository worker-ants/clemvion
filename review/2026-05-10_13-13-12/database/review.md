## 발견사항

- **[INFO]** PostgreSQL SQLSTATE 클래스 `28xxx` (invalid_authorization_specification) → `DB_PERMISSION_DENIED` 분류
  - 위치: `database-query.handler.ts` — `classifyPostgresSqlState()`, `if (klass === '28') return 'DB_PERMISSION_DENIED'`
  - 상세: SQLSTATE `28xxx` (`28000` invalid authorization, `28P01` wrong password) 는 쿼리 실행 중이 아닌 **연결 핸드셰이크 시점**에 발생한다. 잘못된 비밀번호로 인한 연결 실패가 `DB_PERMISSION_DENIED` 로 분류되면, 재시도 정책에서 "영구 오류"로 판단하여 credential rotation 재시도가 트리거되지 않을 수 있다. MySQL 의 `ER_ACCESS_DENIED_ERROR` 는 명시적으로 `DB_CONNECTION_ERROR` 로 처리한 것(코드 주석 참조)과 비교했을 때 일관성이 없다.
  - 제안: `28xxx` 를 `DB_CONNECTION_ERROR` 로 분류하거나, 코드 주석에 "연결 시점 인증 실패이므로 재시도 가능하지만 permission 분류"임을 명시해 의도를 문서화한다.

- **[INFO]** 대용량 결과셋 메모리 위험 — LIMIT 미적용
  - 위치: `database-query.handler.ts` — `executePostgres()` / `executeMysql()`
  - 상세: `SELECT *` 같은 무제한 쿼리를 실행하면 수백만 행이 Node.js 프로세스 메모리에 한꺼번에 로드된다. 핸들러 자체에는 행 수 제한 로직이 없다.
  - 제안: spec 또는 UI 에서 `LIMIT` 가이드를 명시하거나, 설정에 `maxRows` 옵션을 추가해 서버 사이드에서 truncate 후 `meta.truncated: true` 를 반환하는 방어 로직을 고려한다.

- **[INFO]** `pool.on('error', () => {})` — PostgreSQL idle client 에러 무음 처리
  - 위치: `database-query.handler.ts` — `resolvePgPool()` 내부
  - 상세: idle 연결이 네트워크 단절을 겪을 때 발생하는 pool-level 에러를 완전히 삼킨다. 프로세스 크래시는 방지하나, 반복적인 연결 불안정 상태가 로그에 전혀 기록되지 않아 운영 가시성이 없다.
  - 제안: `pool.on('error', (err) => logger.warn('pg pool idle client error', err))` 처럼 최소한 경고 로그를 남겨 silent failure 상황을 탐지 가능하게 한다.

- **[INFO]** 트랜잭션 미지원
  - 위치: 핸들러 전체 설계
  - 상세: 각 execute 호출은 단일 쿼리만 처리하며 트랜잭션 경계를 제공하지 않는다. 여러 INSERT/UPDATE 가 원자성을 필요로 하는 워크플로우에서는 사용자가 단일 쿼리에 다중 DML (CTE / 저장 프로시저 등)을 직접 작성해야 한다. spec 에 이 제약이 명시되어 있지 않다.
  - 제안: spec `§4` 실행 로직에 "단일 쿼리 단위 실행 / 트랜잭션 미지원" 제약을 명시해 사용자 기대치를 맞춘다.

- **[INFO]** 풀 교체 경쟁 조건 (credential rotation 시)
  - 위치: `database-query.handler.ts` — `resolvePgPool()` / `resolveMysqlPool()`
  - 상세: 기존 풀을 `void existing.pool.end().catch(() => {})` 로 백그라운드 종료하는 동안, 동시 실행 중인 다른 워크플로우가 해당 풀에서 꺼낸 connection 을 여전히 사용 중일 수 있다. 풀이 닫히면 in-flight 쿼리가 실패하고 에러 포트로 라우팅된다.
  - 제안: 운용상 허용 가능한 트레이드오프이나, `shutdown()` 시에도 동일 패턴이 있으므로 graceful shutdown 시퀀스에서 in-flight 쿼리가 완료될 때까지 대기하는 로직(drain) 추가를 장기적으로 검토한다.

---

## 요약

이번 변경의 핵심인 드라이버 에러 코드 분류 로직(`mapDbError`)과 커넥션 풀 관리는 전반적으로 올바르게 구현되어 있다. 파라미터화 쿼리로 SQL 인젝션을 방지하고, `client.release()` 는 `finally` 블록에서 보장되며, 커넥션 풀 캐싱과 credential hash 기반 eviction 전략도 적절하다. 주요 개선 여지는 버그보다 설계 수준의 사항들이다: PostgreSQL `28xxx` 인증 실패의 연결 에러 vs. 권한 에러 분류 일관성, 대용량 결과셋에 대한 방어 부재, idle 에러 무음 처리의 운영 가시성 부족이 그것이다.

## 위험도

**LOW**