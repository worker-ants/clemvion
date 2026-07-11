---
title: Reaper/engine DRY 리팩터 (behavior-preserving)
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-11
owner: developer
branch: claude/reaper-dry-refactor
spec_impact:
  - none
---

# Reaper/engine DRY 리팩터 (behavior-preserving)

PR #918(webchat idle reaper)·#916 후속. `/ai-review` 가 W3/W4 중복 + naming collision 을
"백로그 충분(이번 PR 강제 아님)" 으로 남긴 것을 정리한다. **동작 무변경** — 순수 구조 정리.

조사(Explore agent) 판정 기반 스코프:

## 채택 (저위험·고효용)

- [x] **naming**: `Webchat` → `WebChat` (mixed-case 식별자 4종: `WebChatIdleReaperService`·
  `markWebChatIdleTimeout`·`findIdleWebChatExecutionIds`·`resolveWebChatIdleReapGraceMs`).
  frontend 정착 컨벤션(`WebChat`/`web-chat`/`WEB_CHAT_`)에 backend 정렬. **불변**: 파일명
  `webchat-idle-reaper.*`·큐 문자열 `webchat-idle-reaper`·env `WEBCHAT_IDLE_REAP_*`·wire
  `WEBCHAT_IDLE_TIMEOUT`(§R19 #916 잠금) 전부 유지 — 순수 c→C 치환, 계약 표면 0 변경.
- [x] **W4 (chunk loop)**: `common/utils/process-in-batches.ts` 신설 —
  `processInBatches(items, concurrency, worker)` bounded-concurrency 헬퍼. 호출처 2곳
  (`webchat-idle-reaper.service.reap`·`interaction-token.service.reconcileTerminalRevocations`)
  의 `for(i+=C){slice;allSettled;forEach}` 루프 통합. 집계/warn 은 호출처 유지(형태가 달라 —
  boolean count vs `.revoked` sum). 순서 보존 → 호출처는 `items[idx]` 로 warn.
- [x] **W3 (emit boilerplate)**: engine `emitCancellationEvent(id, {cancelledBy, error?, logContext})`
  private 헬퍼 — 4 cancel 메서드(`cancelParkedExecution`·`markExecutionCancelled`·
  `markQueueWaitTimeout`·`markWebChatIdleTimeout`)의 `try{emitExecution(EXECUTION_CANCELLED,…)}
  catch{warn}` 블록(4×중복) 통합. payload 동일 보존(`{status,result:{cancelledBy},...(error?{error}:{})}`),
  warn 은 "emit 실패" 부분문자열 유지(테스트 `stringContaining('emit 실패')` 호환).

## 기각 (marginal·위험 — 백로그 유지)

- **full W3 4-into-1** (`conditionallyCancelExecution` config-driven): 4메서드가 9축(status
  guard·error·cancelledBy·NodeExecution·transaction·routing·cleanup·반환형·가시성) 거의 전부
  발산 → 단일 헬퍼는 8-노브 config 로 발산이 헬퍼 내부 분기로 이동만. 특히 트랜잭션 vs
  비트랜잭션은 쿼리 API(`manager` vs `this.repo`) 자체가 달라 이중 경로. **효용/위험 낮음**.
- **`MinuteRepeatableSweepWorker` 추상클래스**: 두 sweep 워커의 Processor/OnModuleInit/scheduler
  wiring/process/fail-open 골격은 동일하나, NestJS `WorkerHost`+`@Processor`(subclass)+DI 조합에
  추상 base 를 끼우는 복잡도 대비 2-워커 한정 효용이 marginal. 워커 수 증가 시 재검토.

## 워크플로

- [x] TEST WORKFLOW (lint·unit·build·e2e) — 리팩터라 기존 테스트 그린 유지 + processInBatches unit 신설
      (unit: 4 spec 462 tests + full suite PASS · build PASS · e2e 253 tests PASS)
- [ ] `/ai-review` (회귀·behavior-change 초점) + SUMMARY
- [ ] `/consistency-check --impl-done` (spec-linked: engine §4·EIA §14/§3.4 — naming sync 검증)
- [ ] push + PR
