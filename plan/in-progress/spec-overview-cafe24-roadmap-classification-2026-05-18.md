---
worktree: TBD
started: 2026-05-18
owner: project-planner
---

# spec/0-overview.md §6.2 Cafe24 분류 정합화

## 배경

`spec-overview-ui-patterns-followup-2026-05-16` PR 의 consistency-check (`review/consistency/2026/05/18/17_22_08`) I-1 로 발견.

- `spec/0-overview.md §6.2` 섹션 제목은 **"백엔드만 존재 / 부분 구현 (🚧)"**.
- 그러나 §6.2 안의 Cafe24 통합 항목 본문은 **"모두 구현 완료 (PR #20-#67)"** 로 명시.
- 분류와 본문 텍스트가 직접 모순. 다른 항목(Parallel 노드 P1, 조직 레벨 Integration 공유) 은 §6.2 분류와 부합하나 Cafe24 만 어긋남.
- 사용자/외부 reader 가 §6.2 만 보고 "Cafe24 는 부분 구현" 으로 오해할 수 있어 로드맵 신뢰성 영향.

## 작업 범위

- [ ] 새 worktree 생성 (`spec-overview-cafe24-classification-<slug>`)
- [ ] 결정: 다음 두 안 중 택일
  - **(A)** Cafe24 항목을 §6.2 → §6.1 (구현 완료 ✅) 로 이동. §6.3 로드맵에 남은 확장 (Internal MCP Bridge 패턴 확장) 만 별도로 유지.
  - **(B)** §6.2 안에서 Cafe24 항목의 분류 컬럼을 "구현 완료 — 남은 확장은 §6.3 참조" 로 명시. 다른 §6.2 항목과 시각적으로 구분.
- [ ] 선택안에 따라 `spec/0-overview.md §6.1`·§6.2·§6.3 정합화
- [ ] §6 안의 다른 항목들도 함께 점검 (같은 분류 혼동이 있는지)
- [ ] consistency-check --spec 통과
- [ ] PR + merge → complete 이동

## 위험

- 작은 분류 작업이지만 §6 전체 구조에 손대면 다른 항목 분류도 재검토 필요. scope 가 §6 전체 정리로 번지면 별 plan 으로 다시 분리.
- (A) 안이 더 깨끗하지만 §6.1 표 행이 길어짐. (B) 안은 §6.2 안에 "예외 행" 을 두는 셈이라 표 의미가 약해질 수 있음. 결정 시점에 spec 작성자 판단.
