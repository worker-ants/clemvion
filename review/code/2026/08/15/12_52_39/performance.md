# 성능(Performance) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (누적 diff, `origin/main` 대비)

## 방법론 노트

프롬프트 번들이 예산 초과로 다수 파일(`execution-engine.service.ts`/`.spec.ts`,
`terminal-duration.ts` 등)의 diff 를 생략했으므로, 저장소를 `Read`/`Bash grep -n` 으로 직접
열어 대조했다. `git log --oneline -20` 로 현재 HEAD(`f9e8c7b03`)가 직전 성능 리뷰 라운드
(`review/code/2026/08/15/12_26_36/performance.md`)가 검토한 시점과 **동일한 코드 상태**임을
확인했다(그 사이 커밋은 그 라운드 자신의 RESOLUTION 문서뿐). 이 세션은 이미 6차례
(`09_58_24`~`12_26_36`) 성능 라운드를 거쳤고, 매 라운드 결론이 LOW 로 수렴했다. 이번 라운드는
그 결론이 현재 코드에도 유효한지를 핵심 파일 직접 열람으로 재검증했다:

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규 헬퍼) — 전문 확인
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 호출부 전수 `grep`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — 호출부 전수 `grep`
- `codebase/backend/src/modules/executions/executions.service.ts` `stop()` — 전문 확인 (`12_26_36` W7 로 새로 클램프된 자리)
- `codebase/backend/src/modules/dashboard/dashboard.service.ts`, `statistics/statistics.service.ts` — 집계 쿼리 전문 확인

## 발견사항

- **[INFO]** `resolveTerminalDurationMs` 를 completed 경로 다수에서 같은 인자로 두 번 호출한다 — 대입 시점과 emit 시점.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:639`(대입, 가드 `if (row.startedAt)` 있음)/`:668`(emit)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2415`/`:2426`, `:2579`/`:2595`, `:3566`/`:3577`, `:4756`/`:4769`, `:4884`/`:4888`, `:4945`/`:4967`
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:714`/`:730`, `:896`/`:907`, `:949`/`:971`
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 값을 확정한 직후, 몇 줄 뒤 emit payload 에서 `durationMs: resolveTerminalDurationMs(savedExecution)` 로 동일 인자를 재계산한다. `resolveTerminalDurationMs` 내부는 `typeof`+`Number.isFinite` 검사 후 이미 확정된 값을 즉시 반환하는 얕은 분기(`terminal-duration.ts:42-44`)라 실질 비용은 O(1)이며 노드 순회·배치 루프 밖, execution 1건 종결당 최대 2회 호출로 유계다. 6차례째 라운드에서도 코드 변화 없이 그대로 남아 있다.
  - 제안: `durationMs: savedExecution.durationMs`(대입 결과 재사용)로 바꾸면 중복 호출 제거 가능. 실질 성능 영향이 없어 우선순위는 낮고, 이 PR 을 막을 사유는 아니다.

## 그 외 점검 결과 (문제 없음으로 판정)

- **알고리즘 복잡도**: `resolveTerminalDurationMs`/`toFiniteNumber`(`terminal-duration.ts:37`, `:71`) 모두 원시값에 대한 O(1) 순수 함수. `TERMINAL_DURATION_MS_SQL`(`terminal-duration.ts:102`)도 단일 행 `WHERE id = :id` UPDATE 문 안에서 DB 가 계산하는 O(1) 표현식.
- **N+1 쿼리/호출**: 엔티티를 로드하지 않는 raw UPDATE 5경로(`cancelParkedExecution`, `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`, `finalizeStalledExhausted`)는 전부 `.returning(['id', 'duration_ms'])` 로 **같은 UPDATE 문장 안에서** 값을 되받는다 — 값 재조회용 별도 SELECT 왕복을 추가하지 않는다. `grep -n "resolveTerminalDurationMs\|TERMINAL_DURATION_MS_SQL\|\.returning(\["` 로 확인한 모든 호출부가 execution 1건당 1회 호출되는 종결 경로이며, 여러 execution 을 순회하는 배치 루프 내부에서 호출되는 자리는 없다.
- **메모리 할당**: 대규모 배열·객체 적재 없음. `RETURNING` 결과는 단일 행만 참조.
- **캐싱**: `durationMs` 는 실행 1건의 종결 시점에만 계산되는 파생값이라 캐싱 대상이 아니다.
- **블로킹 I/O**: 전부 기존과 동일한 `await` 기반 TypeORM 비동기 호출. 신규 동기 I/O 없음. `executions.service.ts` `stop()` (`:788`-`800`) 도 마찬가지로 `resolveTerminalDurationMs` 순수 계산 뒤 기존 `await ... .execute()` 흐름을 그대로 유지한다.
- **불필요한 연산**: `dashboard.service.ts:96`(`avg7d` FILTER), `statistics.service.ts:92`/`:220`(`avgDurationMs` FILTER) 에 추가된 `AND e.status = :completedStatus`(또는 리터럴 `'completed'`)는 기존 단일 집계 쿼리 안의 FILTER 조건 하나를 추가한 것으로, 쿼리 왕복 횟수·풀스캔 범위를 늘리지 않는다. 기존 `w.workspace_id`/`started_at` 조건과 함께 동일 인덱스로 스캔되는 단일 쿼리다.
- **데이터 구조**: 기존 QueryBuilder 체인에 `setParameter`/`returning`/`FILTER` 조건을 추가한 것뿐, 자료구조 변경 없음.
- **지연 로딩**: 해당 없음.
- **테스트 파일(`*.spec.ts`) mock 확장**: `setParameter`/`returning`/`groupBy` 등 mock 을 다수 QueryBuilder 리터럴에 반복 추가했다. 프로덕션 런타임과 무관하고 테스트 스위트 실행 비용 증가도 무시할 수준.

## 요약

이번 changeset(origin/main 대비 누적 diff, 이 라운드 시점 코드는 직전 성능 라운드가 검토한 시점과 동일)은 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs` 를 채우는 배관 작업이다. 계산을 가능한 한 SQL(`LEAST`+`EXTRACT EPOCH` 클램프)로 밀어넣고 `RETURNING` 으로 같은 UPDATE 문장에서 값을 되받는 설계를 유지해 추가 SELECT 왕복(N+1)을 만들지 않는다. 신규 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`)는 O(1) 순수 함수이고, 호출 지점 전부가 execution 1건당 1회(최대 2회)뿐인 종결 경로라 노드 수·행 수에 비례하는 반복 호출 패턴이 없다. `dashboard`/`statistics`/`executions.stop()` 의 SQL 변경도 기존 단일 쿼리에 조건 하나를 얹거나 순수 함수 호출을 추가한 것으로 왕복·스캔 비용을 늘리지 않는다. 유일하게 지적할 점은 완료 경로 다수에서 같은 인자로 `resolveTerminalDurationMs` 를 두 번 호출하는 사소한 중복 계산(INFO)이며, 6차례 리뷰 라운드에 걸쳐 실질 영향이 무시할 수준으로 확인된 채 우선순위 낮음으로 남아 있다. 신규 CRITICAL/WARNING 성능 이슈는 발견되지 않았다.

## 위험도

LOW
