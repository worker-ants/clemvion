# Plan 정합성 검토 — `spec/5-system/` (--impl-done, diff-base origin/main)

## 발견사항

- **[WARNING]** `finalizeCancelledExecution` 을 "영향 없음"으로 분류해 둔 `update-returning-tuple-shape.md` 의 §2.4 caveat 초안 표가, 이번 PR 의 변경으로 stale 해졌다
  - target 위치: `spec/conventions/node-cancellation.md` §2.4 (신규 행 "top-level 취소 종결 경로 terminal 가드") + 근거 diff `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution` — `const persisted = await this.updateExecutionStatus(...)` 를 새로 추가해 반환값을 소비하도록 바꿈(항목 ①)
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` §후속 "[planner 위임] 소급 각주 — 대상이 한 문서가 아니다" 블록의 호출부 분류 표. 이 표는 `updateExecutionStatus`(구 `persisted`/`updated.length>0`) 반환값을 실제로 소비하는 호출부 11곳/3파일을 "영향 있음"으로, 반환값을 버리는 9곳을 "영향 없음"으로 나열하고 있으며, `finalizeCancelledExecution(:4781)`(당시 라인) 은 "반환값을 버리는 호출이라 shape 과 무관" 이라며 **영향 없음** 목록에 들어 있다. 이 표는 project-planner 가 `spec/conventions/node-cancellation.md` §2.4 에 소급 caveat 을 넣을 때 그대로 근거로 쓰일 예정인 미완료(`[planner 위임]`, 미체크) 항목이다.
  - 상세: 이번 PR(item ①)이 정확히 그 함수를 고쳐 **이제는 `updateExecutionStatus` 의 반환값(`persisted`)을 읽고 분기한다.** 즉 update-returning-tuple-shape.md 가 "shape 과 무관"이라고 못박아 둔 전제가 더 이상 사실이 아니다 — `finalizeCancelledExecution` 은 "영향 없음 9곳"에서 "영향 있음" 목록으로 옮겨져야 한다. 이 표는 그 plan 이 세 번째로 지적한 바로 그 패턴("각자 지점만 고치고 지식이 전파 안 됨")의 재현 후보다: `eia-db-wire-invariant.md` 의 "다른 plan 과의 관계" 절은 `spec-sync-external-interaction-api-gaps.md` 와 `retry-turn-terminal-guard.md` 만 언급하고 `update-returning-tuple-shape.md` 는 전혀 언급하지 않는다 — 같은 worktree(`eia-r8-cache-scope-4ae434`)에서 진행된, 같은 `updateExecutionStatus`/`persisted` 호출부를 다루는 자매 plan인데도 교차 확인이 안 됐다.
  - 제안: `update-returning-tuple-shape.md` 의 해당 분류 표(§후속 [planner 위임] 블록)에 `finalizeCancelledExecution` 을 "영향 있음"으로 재분류하는 각주를 추가하거나, project-planner 가 §2.4 caveat 을 실제로 집행하기 전 재실측하라는 안내를 남길 것. `eia-db-wire-invariant.md`/`spec-sync-external-interaction-api-gaps.md` 쪽에는 정정을 요구하지 않는다 — 두 문서의 서술 자체는 정확하다.

## 요약

target(`spec/5-system/14-external-interaction-api.md` + `spec/conventions/node-cancellation.md`)은 이번 PR 의 정본 트래커인 `spec-sync-external-interaction-api-gaps.md`("retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다" 절)와 `eia-db-wire-invariant.md`(작업 단위 plan) 양쪽 모두와 항목·체크 상태가 정확히 동기화돼 있고, `retry-turn-terminal-guard.md` #2(`cancelledBy`) 와의 리베이스 마찰도 명시적으로 인지·기록돼 있다. §5.4 부재 표현 컨벤션 준수, §2.4 매트릭스 신규 행과 코드 diff 의 대응도 정확하다. 유일한 갭은 같은 worktree 에서 진행된 자매 plan(`update-returning-tuple-shape.md`)의 미완료 planner 위임 항목이 이번 PR 의 코드 변경으로 인해 분류 전제(`finalizeCancelledExecution`=반환값 미소비)가 깨졌는데도 그 plan 쪽에 갱신 신호가 남지 않은 것 — 결정 충돌은 아니고 후속 계획 문서의 stale 화 위험이다.

## 위험도
LOW
