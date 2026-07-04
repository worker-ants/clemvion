# Plan 정합성 Check — spec-draft-dataflow-exec-seq-3way.md

## 검토 대상
- target: `plan/in-progress/spec-draft-dataflow-exec-seq-3way.md`
- 변경 범위: `spec/data-flow/3-execution.md` §1.1 시퀀스 다이어그램 `alt` 블록을 2-way → 3-way(RUNNING stalled 재배달 arm 추가)로 갱신

## 검증한 사실관계

1. **§1.1 갭 실재 확인**: 현재 `3-execution.md` §1.1 mermaid(라인 38-61)는 `alt status !== pending / else pending` 2-way 그대로이며, PR4(#798) 로 도입된 `runExecutionFromQueue` 의 `RUNNING` 분기(`execution-engine.service.ts` L3151-3160, `recordRunningSegmentStart`+`redriveStuckExecution`)가 반영돼 있지 않다. target 의 before/after 는 코드와 정확히 일치한다.
2. **§2.2(BullMQ 표)·§3.1(상태 전이 다이어그램)·§3.3(비정상 종료 회수 표)는 이미 반영 완료**: §2.2 L204 는 `maxStalledCount:1`(PR4) 이미 반영. §3.1 L245/247/262 및 §3.3 L293-294 는 PR3(부팅 backstop)·PR4(운영 중 stalled) 둘 다 이미 정확히 서술. 이는 `exec-park-durable-resume.md` L198 이 "동반 갱신 W3 필수"로 요구했던 항목과 일치하며 그쪽에서 이미 BLOCK:NO 로 완료 확인됨. 따라서 `exec-intake-queue-impl.md` line 27 원문이 묶었던 "§1.1 + §2.2" 중 §2.2 는 더 이상 갭이 아니고, target 이 §1.1 만 다루는 스코핑은 타당하다.
3. **부팅 backstop(recoverStuckExecutions, PR3)은 `runExecutionFromQueue` 를 거치지 않음**: 코드상 `recoverStuckExecutions`(L2641)는 `redriveStuckExecution` 을 직접 호출하며 큐 재진입 경유가 아니다. 따라서 §1.1(큐 인입 시퀀스 다이어그램)에는 PR4 stalled arm 만 필요하고 PR3 부팅 backstop 은 별도 다이어그램(§3.1/§3.3, 이미 반영됨) 소관이 맞다 — target 의 3-way 구성(PENDING/RUNNING-stalled/terminal)이 스코프상 정확하다.

## 발견사항

- **[INFO] `spec-draft-crash-running-redrive.md` 의 미해소 side-effect 항목과 교차 확인 누락**
  - target 위치: target 문서 전체 (특히 "배경" 섹션)
  - 관련 plan: `plan/in-progress/spec-draft-crash-running-redrive.md` line 83 — "`spec/data-flow/3-execution.md` §1.x(재시작 resume 서술) — 크래시 fail→re-drive 정합 확인(필요 시 planner 후속)."
  - 상세: 이 side-effect 항목은 아직 체크되지 않은 채 남아 있고, target 은 이를 전혀 언급하지 않는다. 실질적으로는 이번 §1.1 변경이 이 항목을 완전히 해소한다(§3.1/§3.3 은 이미 별도로 완료, §1.1 은 본 PR 로 완료) — 내용 충돌은 없으나, target 이 이 cross-plan 참조를 인지하지 못한 채 독자적으로 "잔여 = `exec-intake-queue-impl.md` line 27" 이라고만 프레이밍하고 있어 두 plan 의 side-effect 추적이 서로 연결되지 않는다.
  - 제안: target 의 "side-effect" 절에 `spec-draft-crash-running-redrive.md` line 83 항목도 본 변경으로 해소됨을 추가 기재하거나, 해당 plan 문서의 그 줄을 체크 완료로 갱신 권장(plan-hygiene 차원 — 결정 충돌 아님이므로 INFO).

- **[INFO] `exec-intake-queue-impl.md` line 27 원문의 "§2.2 표" 갭 클로징 근거 미기재**
  - target 위치: target "배경" 섹션 (line 33)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` line 27
  - 상세: line 27 원문은 "§1.1 + §2.2 + `0-overview §4` + `16-system-status §1`" 4곳을 묶어 잔여로 남겼다. `0-overview §4`/`16-system-status §1` 은 PR2a 로, §2.2 는 이번 조사에서 확인한바 이미(PR4 반영 시점에) 갱신 완료 상태다. target 은 "잔여 = §1.1 뿐" 이라 전제하는데 이 전제가 맞긴 하나(§2.2 확인됨), target 본문에 §2.2 기완료 근거를 명시하지 않아 이후 검토자가 재확인해야 하는 부담이 남는다.
  - 제안: target 배경 섹션에 "§2.2 는 PR4 반영 시 이미 갱신 완료 확인(3-execution.md L204)" 한 줄 추가 권장. 내용상 오류는 아님.

미해결 결정 우회나 선행 plan 미해소로 볼 CRITICAL/WARNING 급 문제는 발견되지 않았다. `ai-agent-tool-connection-rewrite.md`(TBD 결정 다수), `cafe24-backlog-residual.md`(D-2 defer 등), `chat-channel-discord-gateway.md`(미착수 진입조건) 등 다른 in-progress plan 들은 본 target 의 §1.1 변경과 도메인이 겹치지 않아 충돌 없음을 확인했다.

## 요약
target 은 `exec-intake-queue-impl.md` line 27 이 남긴 "§1.1 시퀀스 다이어그램 잔여"를 코드(`execution-engine.service.ts` 의 실제 3-way `runExecutionFromQueue`)와 대조해 정확히 스코핑했고, 인접 plan(`exec-park-durable-resume.md`, `spec-draft-crash-running-redrive.md`)이 이미 완료한 §3.1/§3.3/§2.2 반영과 중복되지 않으면서 §1.1 만의 진짜 잔여 갭을 메운다. 미해결 결정을 일방적으로 뒤집는 부분은 없고, 다만 `spec-draft-crash-running-redrive.md` line 83 의 미체크 side-effect 항목이 이번 변경으로 사실상 해소됨을 target 이 언급하지 않아 plan 간 추적 연결이 느슨한 점(INFO 2건)만 확인됐다.

## 위험도
LOW
