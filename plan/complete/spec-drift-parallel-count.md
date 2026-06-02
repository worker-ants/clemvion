---
worktree: pending-assignment
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

## 해소 (2026-06-03, worktree `spec-drift-resolve-efb608`)

- **결정 B 채택** (사용자) — Parallel `done` 출력에 `count` 복원. (A) 가 아닌 (B): 실제 엔진 구현(`execution-engine.service.ts` 가 `{ branches, count }` 방출) + 공통 규약 3곳 + 다른 컨테이너 3종이 모두 count 를 방출하므로, `10-parallel.md §5.2` 의 "count 제거됨" 노트가 유일한 drift 였음이 코드 재검증으로 확인됨. (A) 는 코드·공통규약·다른 노드를 모두 바꿔야 하고 downstream `output.count` 를 깨뜨려 기각.
- **적용**: `spec/4-nodes/1-logic/10-parallel.md` §5.2 JSON·필드표·노트·expression 예시·§5.7·Rationale 에 count 복원. `0-common.md`·`node-output.md` Principle 9.2 는 이미 정확 — 변경 없음.
- **side-effect**: `plan/in-progress/node-output-redesign/parallel.md` 진단 항목 1·횡단 일관성 §7 에 stale 노트 추가 (count 비대칭 해소).
- **잔여 advisory (비차단)**: W1 (`container_id` Enum 에 parallel 포함 여부), W2 (Parallel `errorPolicy.skip`) — 별도 추적 미생성. core drift 와 독립한 trivial 권고로, 차후 Parallel 노드 실작업 시 함께 확인.
