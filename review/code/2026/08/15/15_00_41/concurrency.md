# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `finalizeCancelledExecution` — guarded UPDATE 실패 후 재조회(`findOneBy`)의 정합성은 Postgres 행 잠금 직렬화에 암묵 의존
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4929` (`finalizeCancelledExecution`)
  - 상세: `updateExecutionStatus`(단일 `UPDATE ... WHERE status IN (non-terminal) RETURNING id`, 8660-8712행)가 0행이면 `!persisted` 분기에서 별도 `findOneBy` 로 재조회해 `live.status === CANCELLED` 일 때만 emit 한다. 이 재조회는 SELECT-then-decide 이지 SELECT-then-UPDATE 가 아니므로 앱 레벨 쓰기 TOCTOU는 아니다. 정합성 근거는 Postgres 의 단일 행 UPDATE 직렬화다 — 두 트랜잭션이 동시에 같은 행을 겨냥한 guarded UPDATE 를 실행하면, 먼저 잠금을 얻은 쪽이 커밋할 때까지 나머지는 블록되고, 블록 해제 후 WHERE 조건을 재평가하므로 `persisted=false` 가 반환되는 시점엔 승자의 status/finished_at/duration_ms 가 **이미 커밋**돼 있다(같은 단일 UPDATE 문이 세 컬럼을 원자적으로 함께 쓴다, 8666-8676행). 따라서 뒤이은 `findOneBy` 는 stale 값을 볼 수 없다. 다만 이 보장은 (a) `updateExecutionStatus` 의 else 분기가 계속 "한 문장에 status+finished_at+duration_ms 를 함께 쓴다"는 것과 (b) 종결 상태에서 나가는 전이가 없다는 상태 머신 불변식 두 가지에 암묵적으로 의존하며, 코드 주석에는 "DB 가 실제로 뭐라고 하는가" 라고만 서술되어 있고 이 직렬화 근거 자체는 명시되어 있지 않다.
  - 제안: 조치 불요(현재 구현은 안전) — 다만 향후 `updateExecutionStatus` else 분기를 다중 문장(예: 상태만 먼저 쓰고 별도 문장으로 finished_at/duration_ms 갱신)으로 쪼개는 리팩터가 들어오면 이 재조회의 정합성 전제가 조용히 깨진다. 재조회 지점 근처에 "단일 UPDATE 문 원자성에 의존" 이라는 한 줄 캐비엇을 남겨 두면 향후 회귀를 예방할 수 있다(권장, 비긴급).

- **[INFO]** `retry-turn.service.ts` CANCELLED 재진입 분기 — `RETURNING` readback 은 같은 UPDATE 문 내 원자 스냅샷이라 안전
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-676` (`finalizeGuarded`, `target === ExecutionStatus.CANCELLED` 분기)
  - 상세: `COALESCE(finished_at, :newFinishedAt)` / `COALESCE(duration_ms, :newDurationMs)` 로 값을 정하는 UPDATE 에 `.returning(['duration_ms', 'finished_at'])` 을 추가해 `result.raw[0]` 을 곧바로 `toFiniteNumber`/`toPersistedDate` 로 좁혀 `execution` 파라미터에 되쓴다. `RETURNING` 은 같은 원자적 문장의 일부로 실행되므로 별도 라운드트립에 의한 창(window)이 생기지 않는다 — `COALESCE` 가 실제로 어떤 값을 골랐는지와 100% 일치한다. `(result.affected ?? 0) > 0` 가드 뒤에서만 `row` 를 읽어 0행(동시 다른 종결자가 먼저 선점) 케이스의 undefined 역참조도 없다.
  - 제안: 조치 불요.

- **[INFO]** `interaction.service.ts` / DTO `durationMs` 추가 — 순수 read 경로, 동시성 표면 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:78`(`STATUS_PROJECTION_COLUMNS`), `codebase/backend/src/modules/external-interaction/interaction.service.ts:435`(`durationMs: execution.durationMs ?? null`)
  - 상세: 이미 로드된 컬럼값을 그대로 응답에 싣는 단일 SELECT projection 확장으로, 추가 쓰기·재계산·공유 가변 상태 접근이 없다.

## 요약

이번 diff 의 동시성 관련 핵심 변경 둘(`finalizeCancelledExecution` 의 guarded UPDATE 반환값 소비 + 재조회, `retry-turn.service.ts` CANCELLED 분기의 `RETURNING` readback)은 모두 기존에 이미 검증된 "단일 원자 SQL 문 + WHERE 가드" 패턴을 그대로 따르며, 새로운 경쟁 조건이나 SELECT-then-write 형 TOCTOU 창을 만들지 않는다. `finalizeCancelledExecution` 의 재조회 분기는 앱 레벨 쓰기가 아니라 읽기이므로 데드락·락 순서 문제와도 무관하고, 그 정합성은 Postgres 행 잠금 직렬화(먼저 커밋한 쪽만 다음 UPDATE 의 WHERE 재평가를 허용)에 근거한다 — 현재 구현에선 안전하지만 그 전제가 코드에 명시되어 있지 않아 향후 리팩터 시 조용히 깨질 수 있는 INFO 수준 관찰을 남긴다. 나머지 변경(DTO 필드 추가·REST projection·문서)은 read-only 이거나 코드와 무관해 동시성 위험이 없다. 이 코드는 이미 두 차례(13_58_27, 14_47_14) 리뷰를 거쳤고 그 라운드들의 concurrency 리뷰 결과(LOW, INFO-only)와 이번 재검토 결과가 일치한다.

## 위험도

LOW
