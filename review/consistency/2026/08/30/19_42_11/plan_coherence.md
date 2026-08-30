# Plan 정합성 리뷰 — `spec/data-flow/` (impl-done)

## 발견사항

- **[WARNING]** `updateExecutionStatus` 두 분기 마무리 블록 중복 — 다른 in-progress plan 의 후속 항목이 이번 diff 로 해소됐는데 반영되지 않음
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 이번 diff 가 신설한 `finishStatusTransition` private 헬퍼(else 분기도 `dataSource.transaction` 으로 감싸면서 `linkedNodeExec`/else 두 분기의 `recordRunningSegmentStart`+`emitTerminalExecutionMetrics`+`return persisted` 4줄을 공유 헬퍼로 추출). 이 변경은 `spec/data-flow/3-execution.md` §2.1 매핑 표·`spec/5-system/4-execution-engine.md` §1.1 원자성 보장 각주로 정확히 미러됐다.
  - 관련 plan: `plan/in-progress/ie-resume-turn-boundary-cancel.md` — "3차 라운드 추가 후속" 절(276행 이하), **"`updateExecutionStatus` 두 분기의 4줄 마무리 블록 중복 (ai-review WARNING #6)"** 항목(307~310행). 2026-07-26 에 등재되고 "후속: 공통 후처리를 함수 끝 단일 지점 또는 사설 헬퍼로 추출" 이라 명시된 채 **"코드 변경 없음"** 으로 그 PR 밖에 남겨졌다(120~135행 라운드 요약도 동일하게 "#6(4줄 마무리 블록 중복) … 후속(본 PR 밖) 절에 … 등재(코드 변경 없음)" 라고 기록). 이후 라운드(4~8차, 감사 메모)에서도 이 항목이 닫혔다는 기록이 없다 — 같은 파일 369행에 등장하는 또 다른 "WARNING #6" (트랜잭션/FOR UPDATE 비용, 별개 주제)과 라벨이 겹쳐 혼동되기 쉽지만 확인 결과 별개 항목이고 307행 항목은 미해소로 남아 있다.
  - 상세: 이번 PR 은 (완전히 독립적인 경로로) `review/code/2026/08/30/17_36_15/maintainability.md` 의 WARNING("`updateExecutionStatus` 두 분기의 트랜잭션 후처리가 거의 동일한 4줄로 중복된다… 헬퍼 추출을 제안")을 받아 `finishStatusTransition` 헬퍼로 정확히 그 리팩터를 수행했다. 결과적으로 `ie-resume-turn-boundary-cancel.md` WARNING #6 이 요구하던 것과 **동일한 코드 변경**이 이미 이뤄졌는데, 그 plan 문서는 이 사실을 모른 채 여전히 열린 후속 항목으로 남아 있다. 이대로면 다음 사람이 `ie-resume-turn-boundary-cancel.md` 를 읽고 이미 끝난 리팩터를 다시 착수하거나, 반대로 "체크 안 된 항목이니 아직 안 됐다" 는 잘못된 전제로 진행 상황을 오판할 수 있다(이 plan 자체가 §"감사 메모" 에서 "체크가 안 된 채 남아 있어 다음 사람이 끝난 감사를 다시 할 뻔했다" 는 동일한 실패 양상을 이미 한 차례 자인한 바 있다 — `backend-lint-gate-broken-on-main.md` 최근 diff 의 raw-query 감사 항목).
  - 제안: `ie-resume-turn-boundary-cancel.md` 307~310행의 WARNING #6 항목을 `[x]` 로 닫고, "완료 (2026-08-30) — `finishStatusTransition` 헬퍼로 해소, 커밋/PR 은 `execution-engine.service.ts` 이번 diff" 식으로 정정 각주를 추가할 것. (Gate C `spec_impact`/`체크리스트` 갱신은 이 plan 이 아직 `plan/complete/` 로 이동 전이므로 별도 조치는 불요 — 체크박스 정정만으로 충분.)

## 요약

이번 target(`spec/data-flow/`, impl-done)의 핵심 변경 — `updateExecutionStatus` else 분기(guarded UPDATE)를 `dataSource.transaction` 으로 감싸 shape 위반 throw 가 UPDATE 를 롤백하게 한 것 — 은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 명시적 후속 항목(`18_19_33` concurrency INFO 9)을 정확히 이행했고, 같은 plan 이 `spec_impact` 를 `none` → 두 spec 파일로 정정했으며, `spec/data-flow/3-execution.md`·`spec/5-system/4-execution-engine.md` 양쪽에 원자성 보장 서술이 미러됐다. `plan/in-progress/update-returning-tuple-shape.md` 의 항목 ② 도 같은 근거로 정확히 교차 참조되며 닫혔다. 미해결 결정과 충돌하는 대목이나 선행 plan 미해소는 발견되지 않았다. 다만 이 변경의 부수 효과로 발생한 `finishStatusTransition` 공유 헬퍼 추출이, 2026-07-26 에 이미 등재돼 있던 `ie-resume-turn-boundary-cancel.md` 의 별개 후속 항목(WARNING #6, 동일한 리팩터를 요구)을 사실상 완료시켰는데 그 plan 문서에는 반영되지 않았다 — 후속 항목 누락 1건(WARNING)으로 판정한다.

## 위험도

LOW
