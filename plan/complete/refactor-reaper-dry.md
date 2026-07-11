---
title: Reaper/engine DRY 리팩터 (behavior-preserving)
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-11
owner: developer
branch: claude/reaper-dry-refactor
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/data-flow/0-overview.md
  - spec/data-flow/15-external-interaction.md
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

## 스코프 참고 (리뷰 후 명시)

- **spec_impact 는 naming sync 뿐**: 5개 spec 문서 변경은 `WebchatIdleReaperService` 등
  **구현 클래스/메서드명 언급의 대소문자 정합**(코드 rename 미러)일 뿐, 의미·요구사항·상태전이
  변경 0. wire 계약(`WEBCHAT_IDLE_TIMEOUT`·큐명·env)은 불변이라 spec 의 규범적 내용은 그대로다.
  frontmatter `spec_impact` 는 실제 touch 한 5파일을 나열(리뷰 W2 — 완료 이동 시 Gate C 정합).
- **incidental**: `interaction-token.service.ts verifyPerExecution` 의 redundant `as { sub?;
  aud?; jti? }` 캐스트가 `eslint --fix`(no-unnecessary-type-assertion, `payload` 가 이미 동일
  타입 `let` 선언)로 제거됨. tsc-clean·런타임 무영향. 되돌리면 린터가 재-플래그하므로 유지하며
  본 항목으로 추적성 확보(리뷰 W1 scope-drift 대응 — 문서화 옵션 채택).

## 워크플로

- [x] TEST WORKFLOW (lint·unit·build·e2e) — 리팩터라 기존 테스트 그린 유지 + processInBatches unit 신설
      (unit: 4 spec 462 tests + full suite PASS · build PASS · e2e 253 tests PASS)
- [x] `/ai-review` (회귀·behavior-change 초점) + SUMMARY — risk LOW, Critical 0, Warning 3.
      W1(스코프 캐스트 문서화)·W2(spec_impact frontmatter)·W3(emit error-생략 테스트) 조치 +
      INFO 6/9 opportunistic fix. RESOLUTION.md 기록. fix 후 TEST WORKFLOW 전량 재통과
      (unit PASS · build PASS · e2e 253 tests PASS)
- [x] `/consistency-check --impl-done spec/5-system/14-external-interaction-api.md` — **BLOCK: NO**,
      5 checker 전원 NONE, Critical/Warning 0, INFO 5(전부 조치불요/저우선: WebChat casing 규약
      명문화·message? 완화·.util.ts 네이밍·타 plan stale 표기 — 본 refactor 스코프 밖 별건)
- [x] push + PR — https://github.com/worker-ants/clemvion/pull/920
