# Plan 정합성 검토 — impl-done (spec/5-system/4-execution-engine.md, exec-park PR3 / exec-intake PR3-PR4 / G2)

## 검토 범위 메모

프롬프트 payload 의 "진행 중 plan 문서 모음" 섹션에는 `exec-park-durable-resume.md`·
`exec-intake-queue-impl.md`·`execution-engine-residual-gaps.md` 가 포함되어 있지 않았다
(payload 에 6개 plan 만 alphabetical 로 첨부됨 — truncation 으로 추정). 본 검토는 이
누락을 보완하기 위해 워크트리 절대경로에서 세 plan 을 직접 Read 했다:
- `/Volumes/project/private/clemvion/.claude/worktrees/awesome-benz-2abe0f/plan/in-progress/exec-park-durable-resume.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/awesome-benz-2abe0f/plan/in-progress/exec-intake-queue-impl.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/awesome-benz-2abe0f/plan/in-progress/execution-engine-residual-gaps.md`
- 부수 확인: `plan/in-progress/refactor/06-concurrency.md`(C-2 claimResumeEntry, 이미 main 머지), `plan/in-progress/node-cancellation-inflight-followups.md`(node-cancellation §2 후속, 무관 확인)

## 발견사항

검토 관점 1(미해결 결정 우회)·2(선행 plan 미해소)·3(후속 항목 누락) 전부에서
**충돌·누락을 발견하지 못했다.** 상세 근거:

### 확인 1 — PR3 스코프(Q1/Q2)가 plan·spec 양쪽에서 정합
`exec-park-durable-resume.md` §"PR3 — 크래시 RUNNING 세그먼트 멱등 재개"의 2026-07-03
사용자 결정(Q1=제어된 re-drive 채택/BullMQ stalled 유지 OFF, Q2=`errorPolicy='continue'`
분리·defer)이 diff 의 코드 주석(`reclaimStuckRunningExecution`/`recoverStuckExecutions`
JSDoc)과 target spec 본문(§7.1/§7.5 case B/§Rationale "크래시/재시작 RUNNING 세그먼트
제어된 re-drive")에 문구까지 일치하게 반영되어 있다. `exec-intake-queue-impl.md` PR3
항목("→ exec-park-durable-resume 로 이관, 2026-06-06")·`execution-engine-residual-gaps.md`
G2("PR3 로 부분 해소, `continue` 분기는 별개")도 동일한 Q1/Q2 경계를 그대로 인용한다.
세 문서·target spec 이 서로 다른 시점에 작성됐음에도 "PR3=인프라 토대, G2 본질(errorPolicy
schema 노출 선행 미해소 + 용어 매핑)은 미해소"라는 동일한 결론을 일관되게 유지한다 —
target 이 미해결 결정을 일방적으로 재정의한 흔적 없음.

### 확인 2 — PR3/PR4 경계 재확인 (선행 plan 미해소 여부)
target spec(§7.1/§7.2 point3/§7.4/§Rationale)은 "PR4(BullMQ stalled 자동 재배달·
`WORKER_HEARTBEAT_TIMEOUT` 의미 재정의·관측성)는 Planned 로 유지"라고 반복 명시하며,
diff 의 JSDoc 도 동일 경계("BullMQ stalled-job 자동 재배달은 PR4 로 유지")를 코드 레벨에서
재확인한다. `exec-intake-queue-impl.md` PR4 항목("recoverStuckExecutions 절대 30분 일괄
fail → BullMQ stalled 재배달로 대체")은 여전히 미착수(`[ ]`)로 정합 — target 이 PR4 선행
조건을 우회 완료 처리하지 않았다.

### 확인 3 — C-2(claimResumeEntry)와의 관계 (naming/decision 충돌 없음)
최근 머지된 `refactor/06-concurrency.md` C-2(`claimResumeEntry`, waiting_for_input→running,
case A, PR #791/#792)와 본 PR3 의 `reclaimStuckRunningExecution`(running→running, case B)은
서로 다른 상태 전이·다른 함수다. target spec §7.5 본문과 diff JSDoc 모두 "§1.3 `_retryState`
'affected=1 인 쪽만 진행' 패턴의 **일반화**"라고 C-2 패턴 위에 명시적으로 쌓는 방식으로
기술되어 있어 충돌이 아니라 의도된 확장이다.

### 확인 4 — plan 갱신 체크박스 미완료는 예상된 in-flight 상태 (누락 아님)
`exec-park-durable-resume.md` §PR3 "구현 시퀀싱" 3번 "plan 갱신"(본 섹션 체크박스 +
`exec-intake-queue-impl.md` PR3 상태 + `execution-engine-residual-gaps.md` G2 표기)은 아직
`[ ]`. 이는 결함이 아니라 동일 plan 의 2번 항목("`/ai-review` … 진행 중", "`--impl-done`
BLOCK:NO → PR" 미완료)이 아직 안 끝났기 때문 — 즉 본 검토(`--impl-done`)가 그 다음 단계다.
`--impl-done` 통과 후 developer 가 위 plan 갱신 체크박스를 마저 체크하면 되므로, 지금
시점에 WARNING 으로 볼 누락은 아니다(추적 메모 수준의 INFO).

### 확인 5 — node-cancellation §2 직렬화 순서는 이미 완료·무관
exec-park plan Phase 0 이 다뤘던 `node-cancellation-infrastructure.md §2`(재개/dispatch
경로 공유 직렬화)는 이미 2026-06-06 확정 + 해당 plan 자체가 `plan/complete/` 로 이동
완료됐다. 현재 `plan/in-progress/node-cancellation-inflight-followups.md`(in-flight cancel
best-effort 후속)는 driver-level cancel 얘기로 본 PR3 crash-redrive 표면과 겹치지 않는다.

## 요약

`exec-park-durable-resume.md` PR3 섹션, `exec-intake-queue-impl.md` PR3/PR4 항목,
`execution-engine-residual-gaps.md` G2 항목, target spec(`4-execution-engine.md`)
§7.1/§7.2/§7.4/§7.5/§Rationale 네 위치가 "Q1=제어된 re-drive 완료, Q2=errorPolicy
continue(G2 본질)는 별건 defer, PR4=BullMQ stalled 완전 대체는 별도"라는 동일한 결정
경계를 문구 수준까지 일관되게 공유한다. 최근 머지된 refactor 06 C-2(`claimResumeEntry`)
와도 상태 전이·함수가 분리되어 있고 spec/diff 양쪽이 "패턴의 일반화"로 명시적으로
연결해 충돌이 없다. 유일하게 눈에 띄는 것은 exec-park plan 자체의 "plan 갱신" 체크박스가
아직 미완료라는 점인데, 이는 `--impl-done`(본 검토) 통과 후 수행될 다음 단계로 이미
plan 본문에 명시되어 있어 정합성 결함이 아니라 단순 진행 순서다.

## 위험도
NONE
