# 데이터베이스(Database) 코드 리뷰 — `durationMs` 종결 이벤트 배관 (7차 라운드)

## 방법론 노트

프롬프트 번들이 핵심 소스 파일(`execution-engine.service.ts`, `retry-turn.service.ts`,
`terminal-duration.ts`)의 diff 를 크기 제한으로 생략했다. `git diff origin/main -- <path>`
로 전문을 직접 대조했고, 이 세션에서 이미 6차례(`09_58_24`/`10_18_38`/`10_34_51`/
`10_52_08`/`11_09_44`/`11_29_02`/`11_44_10`) DB 리뷰가 수행됐다. 직전 DB 리뷰
(`review/code/2026/08/15/11_44_10/database.md`)는 CRITICAL(int4 오버플로 — SQL 경로만
클램프하고 JS 경로가 무방비였던 결함)이 양쪽 경로 모두에 적용돼 해소됐음을 확인했고
"발견 없음(LOW)"으로 종결했다.

이번 라운드는 그 이후 신규 커밋 `777698bbe`("같은 vacuous mock 을 두 라운드 연속 겪었다 —
마지막 경로 고정") 하나만 추가됐다. `git show 777698bbe --stat` 로 변경 파일을 확인한 결과:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (테스트 mock)
- `codebase/backend/src/shared/utils/terminal-duration.spec.ts` (테스트 리터럴→상수 보간 통일)
- `codebase/backend/src/shared/utils/terminal-duration.ts` (JSDoc 주석의 "4곳"→"5곳" 숫자 정정, 프로덕션 로직 변경 없음)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (문서 포맷)

프로덕션 SQL·트랜잭션·스키마·쿼리 로직에 대한 변경은 이 델타에 없다. `codebase/backend/migrations/**`
diff 도 0건(`git diff origin/main --stat -- codebase/backend/migrations` 결과 없음)이라
마이그레이션 표면도 여전히 없다.

## 발견사항

새로 발견한 Critical/Warning 없음.

- **[INFO]** 이번 델타(`777698bbe`)는 테스트 mock 보강과 주석 숫자 정정뿐, DB 표면(SQL·트랜잭션·스키마)에 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (`execute: jest.fn().mockResolvedValue({ affected, raw: affected > 0 ? [{ id: 'e3', duration_ms: 600000 }] : [] })` 로 `RETURNING` mock 값 보강), `codebase/backend/src/shared/utils/terminal-duration.ts` (JSDoc 문구 "4곳"→"5곳")
  - 상세: mock 이 이전엔 `raw: []`(빈 배열)를 항상 반환해 `markQueueWaitTimeout` 의 `RETURNING → toFiniteNumber → emit` 스레딩이 실제로 실행되지 않은 채 테스트가 통과하고 있었다(vacuous). 이번 커밋은 프로덕션 SQL/쿼리 자체가 아니라 **그 경로를 검증하는 테스트의 신뢰도**를 올린 것이다. `codebase/backend/src/shared/utils/terminal-duration.spec.ts` 도 `LEAST(2147483647` 리터럴 단언을 `` `LEAST(${PG_INT4_MAX}` `` 상수 보간으로 바꿔, 상수 값이 바뀔 때 리터럴 쪽만 거짓 GREEN 을 내던 이중 검증 갭을 닫았다 — DB 관점에서는 int4 클램프 회귀 테스트의 견고성이 개선된 것으로, 순방향 개선이다.
  - 제안: 없음.

- **[INFO]** 직전 라운드가 확인한 CRITICAL 해소 상태 — 재확인, 변경 없음
  - 상세: `PG_INT4_MAX`(`terminal-duration.ts`) 단일 export 상수를 JS 경로(`resolveTerminalDurationMs` 의 `Math.min(span, PG_INT4_MAX)`)와 SQL 경로(`TERMINAL_DURATION_MS_SQL` 의 `` LEAST(${PG_INT4_MAX}, …) ``)가 공유하는 구조는 이번 델타에서 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** SQL 인젝션·트랜잭션·N+1·인덱스·대량 데이터 — 이번 델타에 해당 코드 변경 없어 재점검 대상 없음
  - 상세: 5개 raw UPDATE 호출부(`cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)의 SQL·파라미터 바인딩·트랜잭션 경계는 `11_44_10` 라운드가 이미 실측 확인했고 이번 델타에 diff 가 없다.
  - 제안: 없음.

## 이미 등재된 항목 (이번 델타의 신규 결함 아님, 참고용 재확인)

다음은 이전 라운드들이 실측·근거와 함께 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재해 둔 DB 관련 후속 항목이며, 이번 델타는 이들을 건드리지 않았다.

- `retry-turn.service.ts` 재진입 시 `stop()` 이 커밋한 DB 값(`COALESCE`)과 in-memory emit 값이 어긋날 수 있는 경로 (`10_34_51` W1)
- `duration_ms` 의 의미 혼재(실행 시간 vs 대기 시간)로 인해 status 필터 없는 AVG 집계 소비처(대시보드·통계·목록)가 오염될 수 있는 문제 (`10_34_51` W3) — 이 PR 범위 밖 다른 모듈
- raw SQL 문자열의 컬럼명(`started_at`) 하드코딩 + SQL 식의 값 수준 e2e 검증 부재 (`09_58_24`/`10_18_38` W)
- REST `GET /api/external/executions/:id` 에 `durationMs` 가 아직 없는 push/재조회 비대칭 (`09_58_24` W4)

## 요약

7차 라운드 시점 기준, 직전 라운드(`11_44_10`)까지 확인된 DB 표면(5개 엔티티-미로드 raw UPDATE + `RETURNING`, JS/SQL 공유 int4 클램프, 파라미터 바인딩, 트랜잭션 경계, 마이그레이션 부재)에 이번 신규 커밋(`777698bbe`)은 변경을 가하지 않았다. 이 커밋은 테스트 mock 이 `RETURNING` 값을 반환하지 않아 threading 검증이 vacuous 했던 문제를 고치고, int4 클램프 회귀 테스트의 리터럴/상수 이중 검증 갭을 닫은 것으로, 오히려 기존 DB 관련 방어(int4 오버플로 클램프)의 테스트 신뢰도를 높이는 방향이다. 프로덕션 SQL·스키마·트랜잭션 로직 변경이 없어 신규 위험이 없고, 남아 있는 항목(재진입 DB↔emit 불일치, AVG 집계 오염, e2e 값 검증 부재)은 전부 이전 라운드가 근거와 함께 트래커에 등재해 둔 기지의 out-of-scope 항목이다.

## 위험도

NONE
