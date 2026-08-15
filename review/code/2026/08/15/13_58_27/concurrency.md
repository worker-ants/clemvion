# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `finalizeCancelledExecution` — 사후 오시그널(post-hoc mis-signal) 결함을 정확히 닫음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4891-4902` (`finalizeCancelledExecution`)
  - 상세: 종전에는 `updateExecutionStatus`(guarded UPDATE, `status IN (non-terminal)`)의 반환값을 읽지 않고 무조건 `EXECUTION_CANCELLED` 를 emit 했다. 동시 writer(예: 자연 실패 경로의 `finalizeFailedExecution`)가 먼저 terminal 로 커밋해 0행 매칭(`persisted=false`)이어도 emit 이 나가, DB=FAILED / wire=cancelled 불일치(EIA §6 종결 계약 위반)가 발생했다. 이번 변경은 `persisted` 를 확인해 `false` 면 재마킹·emit 을 모두 skip 하고 warn 로그를 남긴다. 자매 함수 `finalizeFailedExecution`(4933-4992) 과 동일한 guarded 패턴으로 정확히 대칭을 이뤘다.
  - 검증: `updateExecutionStatus` else 분기(8611-8679)는 `UPDATE ... WHERE status IN (...) RETURNING id` 를 단일 SQL 문으로 실행하므로 SELECT-then-UPDATE 형 TOCTOU 창이 없다(원자적 조건부 쓰기). 반환된 `persisted` 를 그대로 신뢰하는 것이 맞다. 회귀 테스트(`execution-engine.service.spec.ts:1069-1098`)도 0행 시나리오를 `mockExecutionRepo.query.mockResolvedValueOnce([])` 로 정확히 모사해 `emitSpy` 미호출을 단언한다.
  - 제안: 없음 — 수정이 결함을 정확히 닫았다.

- **[INFO]** `finalizeGuarded` CANCELLED 분기 — `COALESCE` 결과를 `RETURNING` 으로 되읽어 DB=wire 일치시킴
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:640-679` (`finalizeGuarded`)
  - 상세: `stop()` 이 먼저 커밋한 `duration_ms`/`finished_at`(T1)을 `COALESCE(col, :new)` 로 보존하는 UPDATE 를 쓰는데, 종전에는 `RETURNING` 이 없어 caller(`failRetryExecution`)가 로컬 재계산값(T2, 재진입 시점 기준이라 더 큼)을 그대로 emit 했다. "retry-turn 처리 중 Stop" 이라는 일반 흐름에서 **결정적으로**(희귀 레이스가 아니라) DB≠emit 이 발생하던 지점이다. `.returning(['duration_ms', 'finished_at'])` 추가 + `result.raw[0]` 을 `execution` 객체에 되쓰는 것으로, 이후 `resolveTerminalDurationMs(execution)` 호출(1000행, `failRetryExecution` emit 직전)이 영속값을 그대로 돌려주게 됐다.
  - 검증: `RETURNING` 은 같은 UPDATE 문 내에서 실행되므로 COALESCE 가 실제로 어떤 값을 골랐는지와 100% 일치하는 원자적 스냅샷이다 — 추가적인 SELECT-then-write 창이 생기지 않는다. `(result.affected ?? 0) > 0` 가드 뒤에서만 `row` 를 읽어 0행(동시 cancel 선점) 케이스에서 undefined 접근도 없다. 회귀 테스트(`retry-turn.service.spec.ts:1308-1346`)가 "로컬 T2 ≠ 영속 T1" 이 실제로 갈리는 fixture(`startedAt` 을 10분 전으로 설정해 로컬 재계산값이 크게 벌어지게 함)로 정확히 이 회귀를 고정한다.
  - 제안: 없음. 다만 `row` 가 `undefined`(affected>0 인데 `raw` 배열이 비정상적으로 비어 있는 드라이버 edge case)면 `execution.durationMs` 가 조용히 로컬 값(수정 전 상태)으로 남는 방어적 fallback 경로가 있다 — 현재 PostgreSQL/TypeORM `.returning()` 조합에서는 발생하지 않는 이론적 케이스이며, 이 저장소의 다른 `toFiniteNumber` 소비 지점과 동일한 관용구라 별도 조치 불요.

- **[INFO]** `interaction.service.ts` `durationMs` projection 추가 — 동시성 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:434-438`, `STATUS_PROJECTION_COLUMNS` (75-80행 부근)
  - 상세: 이미 로드된 컬럼값을 그대로 응답에 실을 뿐 재계산·추가 쓰기가 없는 순수 read-path 라 경쟁 조건 표면이 없다.

## 요약

이번 변경분의 핵심은 두 곳의 **진짜 동시성 결함**(guarded UPDATE 반환값 미확인으로 인한 사후 오시그널, `COALESCE` 보존값을 되읽지 않아 DB와 emit 값이 갈리는 문제)을 정확히 닫는 수정이다. 두 수정 모두 원자적 단일 SQL 문(`UPDATE ... WHERE ... RETURNING`)에 의존해 SELECT-then-write 형 TOCTOU 창을 새로 만들지 않았고, 반환값을 신뢰해 재마킹·emit 을 함께 skip/반영하는 기존 저장소 관용구(guarded choke point)를 정확히 따랐다. 회귀 테스트도 0행(동시 선점) 시나리오와 "DB 보존값 vs 로컬 재계산값이 실제로 갈리는" fixture 를 갖춰 각 결함을 결정적으로 재현·고정한다. 새로 도입된 경쟁 조건이나 미해결 동기화 이슈는 발견되지 않았다. DTO/CHANGELOG/plan 문서 변경분은 동시성과 무관하다.

## 위험도
LOW
