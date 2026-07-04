# Plan 정합성 검토 — orphan-pending-backstop

## Payload 스코프 보정

`_prompts/plan_coherence.md` 의 "Target 문서" 블록에는 `spec/5-system/1-auth.md` 전문이 실려 있으나, 실제 구현 대상은 `plan/in-progress/orphan-pending-backstop.md` 이 명시한 대로 `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.4/§7.5/§8(`recoverStuckExecutions`, orphan pending 회수)이다 (plan frontmatter `spec_impact: spec/5-system/4-execution-engine.md` 와도 일치). auth spec 은 이번 작업과 무관 — `exec-intake-followups.md` 자체가 "auth Critical 2건은 exec-intake `--impl-prep spec/5-system/` 광범위 scope 가 걸러낸 별개 이슈, execution-engine 과 무관, project-planner 트랙 위임" 이라고 명시적으로 분리해뒀다. 이하 검토는 `spec/5-system/4-execution-engine.md` §7/§8 및 관련 in-progress plan 을 직접 읽어 수행했다.

## 발견사항

- **[INFO] 설계 결정 1개("wait-timeout cancel, re-enqueue 아님")는 spec §8 결정과 정합, 미해결 결정 우회 없음**
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` "설계 결정" 1~3
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` "orphan pending backstop" 항목, spec §8 마지막 문단("job 자체가 소실된 orphan `pending` … 회수는 후속 … 본 PR 스코프 아님")
  - 상세: exec-intake-followups 는 이 항목을 "낮은 확률 엣지, best-effort" 로만 남겨뒀고 구체적 회수 방식(cancel vs re-enqueue)에 대한 결정을 명시적으로 유보하지 않았다. orphan-pending-backstop plan 의 결정 1("이미 queue-wait timeout 을 초과한 pending 만 대상, cancel 로 마감, RUNNING 부활 없음")은 §8 의 기존 정책("큐 대기 5분 초과 → cancelled + EXECUTION_QUEUE_WAIT_TIMEOUT")을 그대로 확장한 것이며 새로운 상충 결정을 도입하지 않는다. 결정 2(`markQueueWaitTimeout` 재사용, 조건부 UPDATE 로 admit/cancel race 에 멱등)·결정 3(`recoverStuckExecutions` 트리거·lock 재사용, early-return 제거 후 `recoverOrphanPendingExecutions()` 호출)도 §7.4 Recovery 절의 기존 분산 lock·"boot + 테스트훅" 트리거 모델과 합치한다.
  - 제안: 없음 — 정합 확인 목적의 기록.

- **[INFO] `recoverStuckExecutions` 인접 plan(exec-park-durable-resume.md) 의 "umbrella 잔여" 항목은 stale — orphan-pending-backstop 과 무관하니 혼동 주의**
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 결정 3 ("같은 lock·트리거 재사용")
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` L273 "umbrella 잔여(분리): PR3 rehydration 일반화(ai_agent → 일반 노드 + 멱등 재개, --impl-done I9 재검토) ← exec-park 마지막 실질 미구현 표면"
  - 상세: 이 문구는 PR3 가 아직 ai_agent 한정이라고 전제하지만, spec §7.2 는 이미 "일반화(PR3 핵심): point 3 재구동은 `ai_agent` 한정이 아니라 임의 노드 타입을 커버" 라고 명시하며 PR3(2026-07-04)·PR4(2026-07-04) 가 모두 구현 완료로 기록돼 있다. 즉 exec-park-durable-resume.md 의 이 라인은 이미 해소된 항목을 미해결로 잘못 남겨둔 stale 상태다. orphan-pending-backstop 은 이 stale 항목을 전제로 삼지 않고 이미 완료된 §7.1/§7.4 lock·트리거(boot backstop `recoverStuckExecutions` + 테스트훅)를 그대로 재사용하므로 target 자체에는 문제가 없으나, 같은 `recoverStuckExecutions` 함수를 손대는 작업이라 리뷰어가 "PR3 미완료" 로 오인해 스코프를 혼동할 위험이 있다.
  - 제안: target 문서(orphan-pending-backstop plan) 쪽 변경은 불필요. exec-park-durable-resume.md L273 라인을 별도로 정리(완료 처리 또는 삭제)하는 것을 권장하되, 이는 본 작업의 선행조건이 아니라 별개의 plan hygiene 이슈다.

- **[INFO] "후속 항목 누락" 없음 — exec-intake-followups.md 체크박스 정합**
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 전체
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` "orphan pending backstop" 항목 (완료 표시 `- [x]` 전환은 본 작업 완료 후 필요)
  - 상세: target 작업이 완료되면 `exec-intake-followups.md` 의 해당 미체크 항목을 체크(`- [x]`)로 전환해야 정합이 유지된다. 현재는 진행 중이므로 결함 아님 — 완료 시점에 반영 필요한 후속 조치로만 기록.
  - 제안: 구현 완료 커밋에 `exec-intake-followups.md` 체크박스 갱신 포함.

## 요약

Target 은 `spec/5-system/4-execution-engine.md` §7/§8 영역이며(payload 의 auth 문서 노출은 orchestrator 측 스코프 오기), `exec-intake-followups.md` 가 명시적으로 남긴 "orphan pending backstop" 미결 항목을 그 SoT 문구("재큐 대신 cancelled 로 마감") 및 §7.4 Recovery 의 기존 lock·트리거 모델과 합치하는 방식으로 설계했다. 새로운 미해결 결정 우회나 선행 plan 미해소는 발견되지 않았고, 유일한 주의점은 인접 plan(exec-park-durable-resume.md)의 stale 문구가 리뷰어 혼동을 유발할 수 있다는 INFO 수준 메모뿐이다. 완료 후 exec-intake-followups.md 체크박스 갱신을 잊지 않아야 한다.

## 위험도
NONE

BLOCK: NO

STATUS: SUCCESS
