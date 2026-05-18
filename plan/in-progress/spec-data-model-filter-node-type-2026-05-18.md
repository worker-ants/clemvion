---
worktree: TBD
started: 2026-05-18
owner: project-planner
---

# spec/1-data-model.md §2.6 Node.type enum 에 `filter` 추가

## 배경

`spec-overview-ui-patterns-followup-2026-05-16` PR 의 consistency-check (`review/consistency/2026/05/18/17_22_08`) W-2 로 발견된 정합 위배.

- `spec/0-overview.md §6.1` 와 `spec/4-nodes/0-overview.md` 는 Filter 노드를 구현 완료된 logic 노드로 명시.
- `spec/1-data-model.md §2.6` 의 `Node.type` enum **전체 목록에는 `filter` 가 누락**되어 있어 spec 간 직접 모순.
- DB enum 정의에 실질적 영향이 있을 수 있어 우선순위 높음 (consistency-check 보고서가 본 항목만 별도로 "우선순위 높음" 분류).

## 작업 범위

- [ ] 새 worktree 생성 (`spec-data-model-filter-<slug>`)
- [ ] `spec/1-data-model.md §2.6` Node.type 전체 목록 확인:
  - 현재 누락된 `filter` 가 split 행 다음에 배치되도록 `filter | 배열 필터링` 행 추가
  - 다른 누락 (Map / ForEach 등) 도 함께 점검해 한 번에 동기화
- [ ] `spec/4-nodes/_product-overview.md` §4.6~§4.7 사이 Filter 섹션 보완 (consistency-check 보고서 W-2 권고)
- [ ] DB / Prisma 측 검증:
  - `codebase/backend/prisma/schema.prisma` 의 Node.type enum 에 `filter` 가 이미 있는지 확인
  - 누락 시 별 migration 추가 (이미 운영 중인 enum 변경이라 backfill·downtime 검토 필요)
- [ ] consistency-check --spec 통과
- [ ] PR + merge → complete 이동

## 위험

- enum 변경은 DB migration 측면에서 비파괴적이지만 운영 환경에서의 적용 순서 (코드 배포 ↔ migration) 가 어긋나면 에러 응답 가능. 별 PR 본문에서 명시.
- `4-nodes/_product-overview.md` Filter 섹션이 어디까지 채워져 있는지 검토 필요 — 단순 enum 동기화로 끝나지 않을 수 있음.
