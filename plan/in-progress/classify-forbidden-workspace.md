---
worktree: classify-forbidden-ws-3673c8
status: in-progress
started: 2026-06-19
owner: developer
parent: plan/complete/c1-dev-followups-1b.md (PR #641 후속 — chat-channel 분류 명시화)
---

# chat-channel 에러 분류에 WORKFLOW_FORBIDDEN_WORKSPACE 명시 등재

> PR #641 에서 `WORKFLOW_FORBIDDEN_WORKSPACE` 가 Sub-Workflow error-port 신규 surface 코드가 됐으나
> `execution-failure-classifier.ts` 명시 Set 에 미등재 → unknown-fallback(CCH-ERR-04) warn 로그 노이즈.
> error-handling spec 상시 규약("enum 확장 시 분류 표 행 추가 검토 의무") 이행. 기능상 이미 internal 로
> 분류되므로 UX 무변 — 변경은 warn 노이즈 제거 + 명시 등재(기존 W1 패턴: CODE_MEMORY_LIMIT/HTTP_BLOCKED 동일).

## 작업

- [x] `execution-failure-classifier.ts` `INTERNAL_CODES` 에 `WORKFLOW_FORBIDDEN_WORKSPACE` 등재 (SUB_WORKFLOW_FAILED 인접 그룹).
- [x] `execution-failure-classifier.spec.ts`: internal 파라미터 배열 + "no CCH-ERR-04 warn" 배열에 추가.
- [x] `spec/conventions/chat-channel-adapter.md §3.1` internal 카테고리 행에 등재 (coupled SoT).

## 워크플로

- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + SUMMARY
- [ ] /consistency-check --impl-done (spec-linked: chat-channel-adapter §3.1)
- [ ] RESOLUTION.md (Critical/Warning 시)

## 결정·근거

- impl-prep 생략: 기존 W1 패턴(명시 등재로 warn 제거)의 1:1 복제 + spec §3.1 동반(신규 구현 vs spec 충돌 아님). 사후 impl-done 으로 검증.
- e2e: 코드 변경이라 default 수행(분류는 execution.failed 경로지만 multi-actor 무관 — 그래도 면제 자가판단 회피).
