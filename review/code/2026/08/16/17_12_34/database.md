# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 이번 diff는 쿼리·트랜잭션·스키마를 바꾸지 않는다 — 순수 egress 마스킹
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:922-928` (`toResponseExecution`), `:886-888` (`toExecutionDto`), `:603-611` (`findById` 내부 `reconciledNodeExecutions`)
  - 상세: 변경분은 이미 DB에서 조회한 `Execution.error` / `NodeExecution.error` 값을 응답 직전 `redactStoredErrorForResponse()`(`codebase/backend/src/shared/utils/redact-stored-error.ts:57-64`)로 감싸는 것이 전부다. `SELECT`/`UPDATE` 절, `WHERE` 조건, `createQueryBuilder` 체인, `manager.transaction('REPEATABLE READ', ...)` 경계는 손대지 않았다. 새 인덱스가 필요한 신규 필터/정렬 조건도 없다.
  - 제안: 조치 불필요. 참고용 확인 사항.

- **[INFO]** N+1 미도입 — 마스킹은 이미 fetch된 배열에 대한 in-memory `.map()`
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:603-611` (`nodeExecutions` 배열 map), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:285-304` (`toNodeExecutionDto`, `buildPage`의 `slice.map` 경유 호출)
  - 상세: `redactStoredErrorForResponse` 호출은 반복문 안에 있지만 각 호출은 순수 함수(정규식 기반 `deepRedactSecrets` 위임)이고 DB 왕복이 없다. `background-runs.service.ts`는 `NODE_EXECUTIONS_MAX_LIMIT=200`으로 페이지 크기가 이미 상한돼 있어 대량 데이터에서도 반복 비용이 유계다.
  - 제안: 조치 불필요.

- **[INFO]** `findById`의 기존 `REPEATABLE READ` 트랜잭션 경계는 그대로 유지됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:555-638`
  - 상세: `reconciledNodeExecutions` 계산(재조정 + 마스킹)이 트랜잭션 콜백 내부에서 일어나지만 추가 DB 호출이 없는 순수 변환이라 트랜잭션 보유 시간에 실질적 영향이 없다. `Execution`/`NodeExecution`/`ExecutionNodeLog` 세 SELECT의 일관 스냅샷 보장(§Carousel stuck 방지 주석)은 이번 diff로 훼손되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 파라미터화 쿼리 유지 — SQL 인젝션 신규 표면 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 전역 (`createQueryBuilder(...).where('e.id = :id', { id })` 패턴), `background-runs.service.ts:75-81`(JSONB `#>>` 연산자도 값은 바인딩 파라미터 `:backgroundRunId`)
  - 상세: 변경분은 쿼리 조립 코드를 건드리지 않는다. 기존 코드 모두 named parameter 바인딩을 쓰고 있어 인젝션 위험이 없다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/complete/eia-stalled-atomicity.md` (파일 8) — 별도 PR(#1173)에서 이미 반영된 트랜잭션 하드닝의 이력 문서일 뿐, 이번 diff의 실제 소스 변경이 아님
  - 위치: `plan/complete/eia-stalled-atomicity.md` (신규 생성, 기존 `plan/in-progress/eia-stalled-atomicity.md`에서 이동)
  - 상세: 문서는 `finalizeStalledExhausted`의 두 UPDATE(Execution + NodeExecution cascade)를 `dataSource.transaction()`으로 묶은 작업을 기록한다. 이 PR의 diff에는 `execution-engine`/stalled 관련 서비스 소스 파일이 포함돼 있지 않으므로 — 이미 병합된 이전 작업의 plan 라이프사이클 이동(`in-progress` → `complete`)일 뿐, 지금 새로 검토할 트랜잭션 코드는 없다.
  - 제안: 조치 불필요 (문서 이동만 확인).

## 요약

이번 변경 집합에서 데이터베이스 접근 계층에 실질적으로 닿는 코드는 `executions.service.ts`와 `background-runs/background-runs.service.ts` 두 곳뿐이며, 둘 다 이미 DB에서 조회를 마친 `Execution.error`/`NodeExecution.error` 컬럼 값을 응답 직전 `redactStoredErrorForResponse`로 마스킹하는 순수 egress 변환만 추가한다. 쿼리 조건·인덱스 사용·트랜잭션 경계·페이지네이션·파라미터 바인딩 방식은 변경 전과 동일하며, 새 쿼리·마이그레이션·스키마 변경도 없다. 반복문 내 마스킹 호출은 이미 상한이 걸린(cursor pagination, `NODE_EXECUTIONS_MAX_LIMIT=200`) 배열에 대한 in-memory 연산이라 N+1이나 대량 데이터 성능 문제로 이어지지 않는다. `plan/complete/eia-stalled-atomicity.md`는 별도 병합 완료 PR의 트랜잭션 하드닝 이력 문서 이동일 뿐 이번 diff의 코드 변경이 아니다. 데이터베이스 관점에서 CRITICAL/WARNING에 해당하는 발견사항은 없다.

## 위험도

NONE
