---
worktree: exec-park-b2b-04a2f8
started: 2026-06-06
owner: resolution-applier
---
# Spec Update Draft — exec-park D6 Rehydration §7.5 step 2 (SPEC-DRIFT)

## 분류

SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현이 spec 보다 안전한 경로를 채택해 spec 문구가 낡아졌다. 코드는 그대로 유지; spec 만 갱신한다.

## 원본 발견사항

### INFO #16 (SPEC-DRIFT)
SUMMARY#16: [SPEC-DRIFT] spec §7.5 step 2 "각 프레임의 이미 완료된 노드는
`execution_node_log`에서 seed" vs 구현의 rehydrate 단계 in-memory Set 재사용 —
기능 동등하나 문면 불일치.
위치: `spec/5-system/4-execution-engine.md §7.5 step 2`

### INFO #17 (SPEC-DRIFT)
SUMMARY#17: [SPEC-DRIFT] spec §7.5 step 2 "executeInline 재호출" vs 구현의
`driveResumeFrame` 직접 그래프 구동 — 구현이 re-entrancy 문제 회피를 위해
더 안전한 경로 채택.
위치: `spec/5-system/4-execution-engine.md §7.5 step 2`

## 제안 변경

### 대상 파일
`spec/5-system/4-execution-engine.md §7.5` — 중첩 sub-workflow 재개 step 2

### Before (현재 spec 문구 — 낡음)

```
step 2. 각 frame 의 이미 완료된 노드를 execution_node_log 에서 읽어
  executedNodes Set 에 seed 한다.
  innermost frame 에서 waiting 노드를 찾아 executeInline 을 재호출한다.
  outer frame 은 순서대로 나머지 그래프를 executeInline 으로 재구동한다.
```

### After (제안 — 구현 동작과 정합)

```
step 2. 이미 완료된 노드 집합(executedNodes)은 context._executedNodes in-memory
  Set 을 재사용한다. rehydrateContext 단계에서 execution_node_log 를 읽어
  Set 을 복원하므로 기능적으로 동등하다.

  driveCallStackResume 이 frame-by-frame 재진입을 담당한다:
    a. 최내(innermost) frame: driveResumeFrame 을 호출해 waiting 노드의 turn 을
       처리하고(form payload 전달 / AI processAiResumeTurn / button interaction),
       그 frame 의 나머지 그래프를 runNodeDispatchLoop 로 forward 한다.
       fresh park 발생 시 {parked:true} 를 반환하고 driveCallStackResume 은 종료한다.
    b. 외곽 frame (bubble-up): innermost 가 완료({parked:false})이면 invoker
       (Workflow) 노드 출력을 injectInvokerOutput 으로 주입한 뒤 driveResumeFrame
       으로 외곽 frame 의 나머지 그래프를 forward 한다. i = frames.length-2 에서
       i=0 까지 반복.
    c. top-level forward: 모든 frame 이 완료되면 frames[0].invokerNodeId 노드 출력
       을 주입하고 top-level 그래프의 나머지를 forward 한다.
       완료 시 Execution 을 COMPLETED 로 마감한다.

  ※ executeInline 재호출 방식은 채택하지 않는다 — re-entrancy 문제(중첩 park
    snap-shot 시점 race) 회피를 위해 driveResumeFrame 이 직접 그래프를 구동한다.
```

### Rationale 추가 제안 (§7.5 Rationale 또는 §Rationale(D6))

driveResumeFrame 이 executeInline 대신 직접 그래프를 구동하는 이유:
- executeInline 은 _callStack push/pop + DB 조회 + 재귀 깊이 증분 등
  초기화 비용이 있고 재진입 시 callStack 상태 불일치 위험이 있다.
- driveResumeFrame 은 이미 rehydrate 된 context + 영속된 call-stack 프레임
  정보를 그대로 사용해 그래프만 구동하므로 안전하고 단순하다.
- 기능 동등성: 완료된 노드 seed 는 rehydrateContext 의 _executedNodes
  복원이 담당한다.

## 작업 방법

`project-planner` 가 `consistency-check --spec` 통과 후 위 변경을
`spec/5-system/4-execution-engine.md §7.5 step 2` 에 반영.
Rationale 섹션에도 위 근거 추가 권장.
