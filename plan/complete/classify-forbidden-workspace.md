---
worktree: classify-forbidden-ws-3673c8
status: complete
started: 2026-06-19
owner: developer
parent: plan/complete/c1-dev-followups-1b.md (PR #641 후속 — chat-channel 분류 명시화)
spec_impact:
  - spec/conventions/chat-channel-adapter.md
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

- [x] TEST WORKFLOW (lint·unit·build·e2e) — lint·unit·build PASS · **e2e 35 suites/205 PASS** (classifier 격리 46 passed)
- [x] /ai-review + SUMMARY — **NONE · C0 · W0 clean** (`review/code/2026/06/19/23_57_37`). INFO 7건 전부 범위 밖/현행 유지
- [x] /consistency-check --impl-done — **BLOCK:NO** (`review/consistency/2026/06/19/23_57_38`). Cross-Spec NONE(완전 정합). WARNING 2 = 무관 cafe24 도메인 pre-existing(별도 트랙)
- [x] RESOLUTION.md — 불요(양 review clean)

## 후속(권장, 별도 소 PR)

- impl-done INFO-1: `SUB_WORKFLOW_NOT_FOUND` · `SUB_WORKFLOW_TIMEOUT` · `SUB_WORKFLOW_QUEUE_FAILED` 3종도 `INTERNAL_CODES`/`§3.1` 미등재(동일 CCH-ERR-04 warn 노이즈 gap, pre-existing). 본 PR 은 사용자 지정 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 한정 — 3종은 동일 패턴 별도 소 PR 로 마저 등재 검토.

## 결정·근거

- impl-prep 생략: 기존 W1 패턴(명시 등재로 warn 제거)의 1:1 복제 + spec §3.1 동반(신규 구현 vs spec 충돌 아님). 사후 impl-done 으로 검증.
- e2e: 코드 변경이라 default 수행(분류는 execution.failed 경로지만 multi-actor 무관 — 그래도 면제 자가판단 회피).
