---
worktree: chat-channel-form-native-modal-c021b9
started: 2026-05-28
owner: developer
status: done
---

# Form modal hardening — 후속 (chat-channel-form-native-modal v2 review deferred)

`chat-channel-form-native-modal` (2026-05-28 완료, PR branch `claude/chat-channel-form-native-modal-c021b9`) 의 impl-done `/ai-review` 에서 식별된 **비-blocking 강화 항목**. 본 plan 으로 분리해 추적 (기능 자체는 v2 에서 동작·테스트 완료).

> **완료 (2026-05-28, 동일 branch)**: 항목 1~4 모두 반영. 1) `ChannelConversationService.acquire/releaseLock` + form_submission per-conversation lock. 2) `NativeFormAdapter` 서브인터페이스 + `isNativeFormAdapter` 가드. 3) slack.md §6 `private_metadata` 위험 수용 명시. 4) `validateFormSubmission` client-side 게이트 (required/email/number/select; pattern·minLength preset 은 EIA server 검증 위임 유지). TEST WORKFLOW 통과 (lint·unit 5075·build·e2e 127).

## 항목

1. **동시성 — `pendingFormModal` RMW race (concurrency review, MEDIUM)**
   - `HooksService.form_submission` 처리: `lookup` → `await interact(submit_form)` → `pendingFormModal=undefined` → `upsert` 사이 await 구간에 동일 사용자 중복 제출이 interleave 되면 EIA `submit_form` 이중 호출 가능.
   - 제안: `conversationKey` 단위 Redis 분산 락 또는 낙관적 버전 필드로 선점 clear.
   - 완화 (현 상태): DM-only 1:1 provider (R-S-4 / R-D-4) 라 동일 사용자 동시 제출 확률 낮음 + EIA 가 이미 advance 된 execution 의 submit_form 을 reject. v1 수용 가능, hardening 으로 분리.

2. **아키텍처 — `NativeFormAdapter` 서브인터페이스 분리 (architecture review)**
   - `supportsNativeForm=true` 어댑터가 `openFormModal?`/`buildFormSubmissionResponse?` 미구현해도 컴파일 통과 (옵션 메서드). type-level 강제 부재.
   - 제안: `interface NativeFormAdapter extends ChatChannelAdapter { openFormModal(...); buildFormSubmissionResponse(...) }` 도입 + `supportsNativeForm` 을 discriminant 로 type-guard 단일화.

3. **보안 INFO — Slack `private_metadata` 평문 `conversationKey` 위험 수용 문서화 (security review)**
   - `openFormModal` 가 modal `private_metadata` 에 내부 채널 ID 평문 포함 → Slack 서버 측 열람 가능.
   - 제안: 위험 모델을 `slack.md §6` 또는 `15-chat-channel.md` 보안 절에 "수용" 으로 명시 (project-planner).

4. **값 타입 검증 (security INFO)**
   - `form_submission.fields` 는 allowlist (key) 필터까지만 적용. 값의 pattern/email/숫자 범위 검증은 EIA `submit_form` → Form 노드 server-side 검증에 위임 중. client-side(어댑터) 사전 검증 (spec §4.1 step 4) 은 미구현.
   - 제안: 어댑터가 `pendingFormModal.fields` schema 로 submit 직전 1차 검증 후 실패 시 §4.1 step 5 재표시.

## 참조
- 리뷰 산출물: `review/code/2026/05/29/07_53_25/SUMMARY.md` + `RESOLUTION.md`
- spec: `spec/conventions/chat-channel-adapter.md §4.1 / R-CCA-8`
