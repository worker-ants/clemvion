# Rationale 연속성 검토 — spec/data-flow/ (impl-done, raw-update-guard-scope)

## 검토 범위 요약

diff 는 `spec/data-flow/*.md` 를 한 줄도 바꾸지 않는다(코드 전용). 변경 대상은:

- `codebase/backend/src/common/__test-utils__/source-scan.ts` (+`countRawUpdateReturning`/`hasRawUpdateReturning`) 및 그 테스트
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 손으로 고른 3파일(`EXPECTED`) 대신 `src/**` 전수 발견형 회귀 가드(`findUnguarded` + `ALLOWED` 4-항목 예외목록) 신설
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`/`.spec.ts` — raw `UPDATE … RETURNING` 반환 타입을 행 배열(`{...}[]`)에서 실제 드라이버 shape 인 튜플(`[{...}[], number]`)로 정정

이 PR 은 `plan/in-progress/update-returning-tuple-shape.md` (worktree `raw-update-guard-scope-0e154c`, 오늘 2026-08-30 완료 배너)의 후속 하드닝 단계로, "raw UPDATE/DELETE…RETURNING 은 `[rows, count]` 튜플인데 8곳이 행 배열로 다뤘다"는 더 큰 결함 트래커의 꼬리다.

## 발견사항

- **[INFO]** 이 PR 이 속한 트래커가 요구하는 spec Rationale 소급 각주 5건이 아직 미반영
  - target 위치: 코드 diff 전체(특히 `kb-stats.helper.ts` 타입 정정, `update-returning-rows.spec.ts` 신규 발견형 가드) — 이들은 4개월간 조용히 깨져 있던 raw-RETURNING 소비 버그의 수정/봉인이다.
  - 과거 결정 출처: `spec/data-flow/2-auth.md ## Rationale` "OAuth state 의 one-shot DELETE"(단일 원자 `DELETE ... RETURNING` 으로 "정확히 한 요청만 state 를 얻게" 보장한다고 서술) · `spec/5-system/4-execution-engine.md ## Rationale` "동시성 cap admission gate"(조건부 UPDATE(`RETURNING`)로 카운트→비교→전이) · `spec/5-system/8-embedding-pipeline.md §7.3`(KB 재임베딩 CAS 락) · `spec/5-system/10-graph-rag.md` 동시 호출 표(KB 재추출 CAS 락) · `spec/conventions/node-cancellation.md §2.4`.
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 실측에 따르면 위 5곳의 spec 서술이 "설계상 보장"을 정확히 기술하고 있음에도, 실제 구현은 `.query()` 의 UPDATE/DELETE 반환이 `[rows, count]` 튜플이 아니라 행 배열이라고 (잘못) 가정해 그 보장이 최대 4개월간(예: 소셜 로그인 OAuth 콜백은 **상시 실패**) 작동하지 않았다. 그 plan 은 이 사실을 각 spec 파일에 "소급 각주"로 남기라고 `[planner 위임]` 항목 3건(raw SQL shape 규약 승격, 5개 문서 소급 각주, invariant 의 `spec/conventions/` 승격)으로 명시했지만, `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 반영하지 못했다(정당한 절차 — CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"). 즉 지금 이 순간 spec Rationale 은 틀린 내용을 담고 있지는 않지만(설계 의도는 정확했다), "그 설계가 4개월간 실제로는 지켜지지 않았다"는 이력이 어디에도 남아있지 않다.
  - 제안: 이번 PR(또는 상위 트래커) merge 후 `project-planner` 턴으로 위 5개 문서에 소급 각주(간단히 "구현이 raw RETURNING 결과를 행 배열로 오인해 YYYY-MM 까지 이 보장이 깨져 있었다 — `updateReturningRows` 로 정정")를 추가하고, `spec/conventions/` 에 "raw `UPDATE`/`DELETE … RETURNING` 소비는 `updateReturningRows` 경유" 불변식을 정식 규약으로 승격할 것. 해당 plan 이 `complete/` 로 이동하기 전에 이 planner 턴이 실행됐는지 확인 필요.

## 그 외 확인한 사항 (문제 없음, 기록용)

- `source-scan.ts` 의 `countRawUpdateReturning` 새 docstring은 "엔진 §7.4·§7.5 의 의도된 조건부 UPDATE(경합 판정용 `affected` 기반)가 전부 QueryBuilder `.execute()`(`UpdateResult{raw, affected}`) 형태라 이 가드에 구조적으로 안 걸린다"고 주장한다. 실제 코드(`claimResumeEntry`/`claimSpawnedRetryRow`/`reclaimStuckRunningExecution` — 모두 `.createQueryBuilder().update(...).execute()`)를 대조 확인한 결과 이 주장은 정확하다. spec Rationale 의 "raw UPDATE"라는 표현(`4-execution-engine.md` §7.5 "raw conditional UPDATE")은 `updateExecutionStatus` choke-point 를 우회한다는 뜻이지 `.query()` 리터럴 SQL 이라는 뜻이 아니어서 처음엔 상충으로 보였으나, 실제로는 두 서술이 양립한다 — Rationale 위반 아님.
- `동시성 cap admission gate`(§8, PR2b)는 실제로 raw `.query()` + `RETURNING` 패턴이지만 §7.4/§7.5 범위 밖(§8)이라 위 docstring 의 "§7.4·§7.5" 한정과 충돌하지 않는다. 해당 raw 지점은 `updateReturningRows` 를 거치며(`update-returning-rows.spec.ts` 기존 `EXPECTED` 커버리지), 이번 diff 의 `ALLOWED` 4-항목 예외목록에도 없다 — 정상.
- `spec/data-flow/6-knowledge-base.md ## WebSocket §2.5` 는 "`kb:graph_stats_updated` 는 spec 폐기 + dead-path 코드 제거 완료"라고 명시한다. `kb-stats.helper.ts` diff 는 이 dead-path 관련 기존 주석("RETURNING 절은 향후 호출자가 활용할 수 있도록 유지")을 건드리지 않고 타입만 정정 — 이 Rationale과 충돌하지 않는다.
- 새 발견형 가드가 "래퍼(DataSource/EntityManager 확장으로 호출 즉시 언랩 강제)" 대안을 채택하지 않고 discovery-scan 방식을 택한 것은, 같은 plan 문서의 "**착수 전 비용을 볼 것**" 지시를 따른 것으로 명시적으로 정당화되어 있다(전수 이관 비용 대비 발견형 가드가 같은 축을 더 싸게 지킨다는 근거) — 기각된 대안의 무근거 재도입이 아니라, 대안을 검토 후 명시적 근거로 다른 안을 선택한 정상적 설계 기록이다.

## 요약

target(`spec/data-flow/`)은 이번 diff 로 텍스트 변경이 없고, diff 자체는 guard/test 인프라 강화 + `kb-stats.helper.ts` 타입 정정으로 순수 코드 영역이다. 조사한 범위에서 기각된 대안의 무근거 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회는 발견되지 않았다 — 오히려 이 PR 은 spec Rationale 이 이미 선언한 보장(OAuth state one-shot 소비, admission-gate 카운트 기반 전이, CAS 락 등)을 실제로 작동하게 **복원**하는 성격이다. 유일한 보완점은 그 복원의 배경(4개월간의 실패 이력)을 5개 spec 문서에 소급 각주로 남기는 작업이 아직 미집행 상태라는 것인데, 이는 이미 plan 에 `[planner 위임]` 으로 정확히 추적되고 있어 절차 위반은 아니다.

## 위험도

LOW
