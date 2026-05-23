---
worktree: (TBD — project-planner 가 신규 worktree 에서 spec 갱신)
started: 2026-05-23
owner: project-planner
---

# spec drift: Parallel `count` 필드 — 공통 규약과 노드 스펙 간 직접 모순

## 발견 출처

- 검토 세션: `review/consistency/2026/05/23/10_28_45/SUMMARY.md` (BLOCK: YES, C1)
- consistency-check `--impl-prep spec/4-nodes/` 결과 — 본 worktree (`render-presentation-button-click-fix-683f3a`) 와 직접 무관해 분리 plan 으로 격리.

## 위배 요지

- `spec/4-nodes/1-logic/10-parallel.md §5.2` — "`count` 필드는 제거됨 (P1.1 직교성)"
- `spec/4-nodes/1-logic/0-common.md §5·§9.1·§11` — 모든 컨테이너 (loop/foreach/map/parallel) 가 `{ <컬렉션>, count }` 방출 명시
- `spec/conventions/node-output.md Principle 9.2` — 동일

두 진실 병존. 구현자가 두 spec 을 동시에 따를 수 없음.

## 해결 방향 (project-planner 결정 필요)

1. (A) 공통 규약 §5·§9.1·§11 에 Parallel 예외 명시 + `node-output.md Principle 9.2` 동기화
2. (B) Parallel 스펙에서 `count` 복원

(A) 가 자연스러움 — Parallel 은 포트 기반 분기라 `count` 의 의미가 약함.

## 관련 후속

- 동일 SUMMARY 의 W1 (`container_id` Enum 에 parallel 미포함), W2 (Parallel `errorPolicy.skip`) 도 함께 정합화 권고.

## 처리 우선순위

LOW — 본 worktree 와 직접 무관. Parallel 노드 실 구현 / 사용자 신규 신고가 발생할 때 우선 진입.
