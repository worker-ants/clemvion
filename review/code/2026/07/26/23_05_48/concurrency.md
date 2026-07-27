# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** `updateExecutionStatus` 의 짝 전이(`false` 반환) 계약 변경이 미소비 호출부 4곳에 그대로 남아있음
  - 위치: `codebase/backend/src/modules/execution-engine/form-interaction.service.ts:110`, `:325`; `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:395`, `:567` (본 diff 미포함 파일 — 실제 라인은 현재 소스 기준)
  - 상세: 이번 변경으로 `updateExecutionStatus` 의 `linkedNodeExec` 분기가 "항상 `true`" 에서 "동시 cancel 시 `false` 가능" 으로 계약이 바뀌었다(`execution-engine.service.ts:8164` JSDoc, `engine-driver.interface.ts:48` JSDoc 에 명시). DB 레벨 무결성(Execution 이 CANCELLED 에서 되살아나지 않음)은 choke point 자체의 `FOR UPDATE` 가드로 전역 보장되므로 안전하지만, form/button 4개 호출부는 반환값을 여전히 `await` 만 하고 버린다 — 동시 Stop 이 가드를 선점하면 짝 `NodeExecution` 이 terminal 마킹되지 않아 **영구 RUNNING/WAITING_FOR_INPUT 로 잔류**하고, 클라이언트는 이미 취소된 실행에 대해 park/재개류 이벤트를 계속 받을 수 있다. AI 경로(`ai-turn-orchestrator.service.ts`) 는 `assertLinkedTransitionApplied` 로 4곳 모두 소비하도록 이번 PR 에서 닫았으나 form/button 은 그대로다.
  - 제안: 이미 `plan/in-progress/ie-resume-turn-boundary-cancel.md` "## 후속 (본 PR 밖)" 절에 추적되고 있음(ai-review WARNING #1/#2, 2026-07-26) — 별도 조치 불요, 다만 독립 검토자로서 확인차 재기재. `assertLinkedTransitionApplied` 절차를 순수 헬퍼로 추출해 form/button 후속 PR 이 재사용하도록 하는 안이 이미 plan 에 있음.

- **[INFO]** `recordRunningSegmentStart`/`segmentStartMs` 정리가 "진입" 쪽만 가드되고 "이탈" 쪽은 무조건 수행
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8195-8207` (`enteringRunning` 계산 및 "이탈" 분기), 대비 `:8250`/`:8294`(진입 기록은 `persisted===true` 로 가드)
  - 상세: WARNING #9 fix 는 "RUNNING 진입" 기록(`recordRunningSegmentStart`)을 각 분기의 `persisted===true` 확인 이후로 옮겨 거부된 재claim 의 유령 항목을 막았다. 그런데 "RUNNING 이탈"(`segmentStartMs.delete` + `activeRunningMs` 누적)은 여전히 아래 트랜잭션의 성공 여부와 무관하게 먼저 실행된다(트랜잭션이 나중에 `live.length===0` 으로 no-op 되어도 in-memory `activeRunningMs` 증가분은 저장되지 않아 DB 오염은 없음). 다만 그 시점에 `segmentStartMs` 맵 항목이 결과와 무관하게 삭제되어, 진입 쪽 가드와 대칭적이지 않다.
  - 제안: 실질적 위험은 낮음(DB 비오염, in-process 카운터 정합성 문제일 뿐이고 대상 실행은 이미 종결 경로로 향한다) — 다만 일관성을 위해 "이탈" 쪽도 `persisted` 확인 이후로 옮기는 것을 고려할 수 있음. 필수 아님.

## 요약

이번 변경의 핵심은 `updateExecutionStatus` 의 `linkedNodeExec`(park 짝 전이) 분기가 무가드 full-entity save 였던 살아있는 lost-update 결함(AI multi-turn 턴 진행 중 Stop 이 DB 를 CANCELLED 로 마감해도 re-park 의 stale in-memory 엔티티 save 가 이를 덮어쓰던 문제)을 트랜잭션 내 `SELECT ... FOR UPDATE` + non-terminal 재확인으로 닫은 것이다. 같은 트랜잭션 안에서 행을 잠그고 커밋까지 유지하므로 검사-후-사용(TOCTOU) 창이 완전히 닫히며, `stop()` 의 guarded UPDATE 와 동일 행에 대해 자연스럽게 직렬화되어 데드락 위험도 없다(단일 테이블 `execution` 행만 `FOR UPDATE`, 락 순서 일관). `assertActiveExecutionAndSaveNodeExec` 신설로 `finalizeAiNode` 의 "이미 RUNNING 유지" 분기(정상 multi-turn 종료 주경로)도 동일한 원자적 관측+save 패턴으로 통일해, 3차 라운드까지 지적된 잔여 TOCTOU 창을 구조적으로 제거했다. `false` 반환 계약은 AI 경로 4개 소비처(`assertLinkedTransitionApplied` 로 단일화) 모두에서 짝 `NodeExecution` terminal 마킹 + `ExecutionCancelledError` 전파로 일관되게 처리된다. `segmentStartMs` in-memory 맵의 유령 항목 방지(진입 기록을 `persisted` 확인 이후로 이동)도 부수적으로 올바르게 반영됐다. 남은 리스크는 이미 plan 에 명시적으로 추적 중인 두 항목뿐이다: (1) form/button interaction 4개 호출부가 바뀐 반환 계약을 아직 소비하지 않아 DB 는 안전하지만 짝 `NodeExecution` 이 영구 non-terminal 로 잔류할 수 있음(범위 밖으로 명시적 이연), (2) 원자적 가드 통과와 WS 이벤트 emit 사이의 미세한 창(표시 계층, DB 무결성과 무관, 별도 후속 추적 중). 두 항목 모두 신규 결함이 아니라 이번 PR 이 스스로 문서화하고 이연한 잔여 항목이며, 코드 검증 결과 서술과 실제 구현이 일치한다. 새로운 경쟁 조건·데드락·await 누락은 발견되지 않았다.

## 위험도

LOW
