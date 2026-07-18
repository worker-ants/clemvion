---
name: ie-endmultiturn-errorpayload-contract
worktree: nice-archimedes-d9af7e
status: in-progress
started: 2026-07-18
owner: developer
spec_impact:
  - spec/4-nodes/3-ai/3-information-extractor.md
  - spec/4-nodes/3-ai/1-ai-agent.md
---

# IE `endMultiTurnConversation` — 엔진 errorPayload 계약 정합 (선재 갭 판정)

## 배경

`ResumableNodeHandler` 제네릭화(#975) 코드 리뷰에서 반복 지적된 선재 갭.
엔진의 범용 종결 경로(`ai-turn-orchestrator.service.ts::handleAiTurnError`)는
`endMultiTurnConversation(state, 'error', errorPayload, failedUserMessage, failedUserMessageSource)`
로 5개 인자를 넘긴다. AI Agent 는 뒤 3개를 소비(errorPayload → `output.error` verbatim,
failedUserMessage/source → `_retryState`)하지만 **IE 는 `(stateRaw, endReason)` 2개만 받아
뒤 3개를 조용히 버린다**. 계약 시그니처(3 optional 인자)와 IE 구현의 불일치가 혼란 유발.

## 판정 (측정 결과)

### Q1: IE 도 오류 종결 시 errorPayload 를 받아 output.error 를 채워야 하는가? → **아니오**

1. **`max_retries` 는 엔진 errorPayload 경로를 아예 타지 않는다.** handler 가 스스로 결정하는
   `forcedEnd` → `buildMultiTurnFinalOutput(state,'max_retries')` 가 self-fill (§5.6.4:
   `MAX_COLLECTION_RETRIES_EXCEEDED` + `output.result` 병존). errorPayload 는 §5.6 에 구조적 무관.
2. **`error` endReason(§5.3)은 IE `processMultiTurnMessage` 의 *uncaught throw* 에서만 도달**하는
   safety net. 실제 LLM 오류(429/timeout 포함)는 `runTurnWithCollectionRetries` 가 내부 catch →
   `{kind:'error'}` → `buildErrorOutput` 로 IE 가 self-fill (throw 안 함). uncaught 는 turn 이전
   `resolveConfig`/`hydrateState` 실패 등뿐.

### Q2: 현행 IE error 종결 경로가 §5.6 을 충족하는가? → **완전 충족**

- §5.6 4종(completed/user_ended/max_turns/max_retries) 전부 self-fill 로 정확.
- **결정적 근거 — spec §5.3(line 304) invariant**: IE 의 retryable 은 **code 기반**으로 고정
  (`LLM_CALL_FAILED`/`LLM_RATE_LIMIT` → true, `LLM_RESPONSE_INVALID`/`MAX_COLLECTION_RETRIES_EXCEEDED`
  → false). 즉 IE 의 하드코딩 `retryable:true`(LLM_CALL_FAILED)는 **버그가 아니라 spec 규정**.
  AI Agent 의 HTTP-status 기반 분류(§7.9/§10)와 **의도적으로 다르다**.
- 따라서 엔진 errorPayload(status 기반, LLM_CALL_FAILED 도 retryable:false 가능)를 verbatim
  relay 하면 **IE 의 §5.3 invariant 를 위반**한다. 부분 소비도 dominant 내부 경로(429→LLM_CALL_FAILED)
  와 rare 경로만 불일치하게 만든다. IE 는 `LLM_RATE_LIMIT` 를 어디서도 생산하지 않는 것이 일관 설계.
- `failedUserMessage`/`source`: IE 는 `_retryState`/`retry_last_turn` 미지원(grep 확인) → 무관.

### Q3: → **문서화 (behavior 무변경)**

계약이 준수 상태이므로 소비 구현 대신 "IE 의 의도적 self-fill" 을 SoT 로 명시해 혼란·반복 오탐 제거:

- [ ] IE `endMultiTurnConversation` 시그니처에 무시 인자 3개를 `_` prefix 로 명시 + 이유 주석
      (self-fill / §5.3 code-기반 invariant / retry_last_turn 미지원)
- [ ] `node-handler.interface.ts` 의 `endMultiTurnConversation` docblock 정정 — 현재
      "핸들러는 그 값을 output.error 에 그대로 set 해야" 가 범용처럼 서술됨 → AI Agent 는 verbatim relay,
      IE 는 self-fill 로 분기 명시
- [ ] pinning 테스트: `endMultiTurnConversation(state,'error',<임의 errorPayload>)` 가 errorPayload
      와 무관하게 IE self-synthesized shape(LLM_CALL_FAILED + retryable:true + output.result 병존)를
      유지 — 미래의 잘못된 "fix"(§5.3 invariant 위반) 회귀 가드

## impl-prep 결과 (2026-07-18 11:19, BLOCK:YES — out-of-scope bypass, 사용자 승인)

`review/consistency/2026/07/18/11_19_02/SUMMARY.md`. Critical 3건 **전부 내 task(§5.3/§5.6) 범위 밖의 선재 spec-drift** — INFO #5 가 내 plan 을 target §5.3 정합으로 명시 clear. 사용자가 "문서화 진행" 선택(2026-07-18).

**project-planner 후속 위임 (out-of-scope, 이미 각각 plan 추적 중):**
- C1: AI Agent Multi-turn `out` 포트 자기모순(§3.2 ↔ ND-AG-24) — `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`, 4회 연속 durable.
- C2: AI Agent §7.3 single-turn error 포트 미구현 + pending_plans — `node-output-redesign/ai-agent.md`.
- C3: IE §5.5 `resumed` 스냅샷 status:implemented 부정확 — `node-output-redesign/information-extractor.md`. (§5.5 는 내 §5.3/§5.6 과 별 surface)
- WARNING: `0-common.md §5`/§9 "(Principle 11)" 오귀속 → "(Principle 1.1/3.2/4.4/8.2)" 정정.

## 워크플로 체크리스트

- [x] 3. `/consistency-check --impl-prep spec/4-nodes/3-ai` (BLOCK:YES=out-of-scope, 사용자 승인 bypass)
- [ ] 5-7. 테스트 선작성 + 구현 + 보강
- [ ] 8. TEST WORKFLOW (lint·unit·build·e2e)
- [ ] 9. `/ai-review` + fix
- [ ] 9. `/consistency-check --impl-done spec/4-nodes/3-ai` (spec-linked 코드 변경)
