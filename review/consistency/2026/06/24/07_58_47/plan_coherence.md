# Plan 정합성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)  
**Target 영역**: `spec/3-workflow-editor/` (0-canvas.md, 1-node-common.md, 2-edge.md, 3-execution.md)  
**검토 일시**: 2026-06-24

---

## 발견사항

- **[WARNING]** `spec/3-workflow-editor/0-canvas.md §12` AI Agent Tool Area — 미해결 결정 진행 중인 plan 과의 표기 불일치 가능성
  - target 위치: `spec/3-workflow-editor/0-canvas.md §12` (AI Agent Tool Area 전체 섹션, "재작성 예정" 박스)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 (도구 등록 모델 TBD, 도구 시그니처 위치 TBD, 도구 호출 실행 컨텍스트 TBD, 도구 결과 라우팅 TBD, ND-AG-21 우선순위 TBD — 모두 미결정)
  - 상세: `ai-agent-tool-connection-rewrite.md` 의 §결정 기록이 전 항목 "TBD" 로 남아 있고, plan §1 "디자인 결정(사용자 합의 필요)" 체크박스 5개가 모두 미완료 상태다. `spec/3-workflow-editor/0-canvas.md §12` 는 "재작성 예정(현재 제거됨)" 박스로 섹션을 비활성화하고 있어, target spec 자체가 미해결 결정이 내려진 뒤에야 갱신될 수 있음을 명시하고 있다. 구현 착수 시 §12 의 Tool Area 시각·인터랙션을 건드리는 코드를 작성하거나 spec 을 갱신하려면 plan §1 의 5개 결정이 선행돼야 한다. 단, 현 spec 의 `0-canvas.md §3.3 Table` 에 "Tool Area에 드래그 (제거됨)" 행이 존재하며, 이는 plan 의 미결정 범위를 명확히 표시하고 있으므로 구현자가 인지하는 상태다.
  - 제안: 구현 작업이 §12 Tool Area 영역을 건드리지 않는다면 현행 유지 가능. 만약 본 impl-prep 의 구현 범위에 §12 관련 코드가 포함된다면, `ai-agent-tool-connection-rewrite.md` §1 결정이 확정될 때까지 해당 범위를 제외하고 착수해야 한다.

- **[WARNING]** `spec/3-workflow-editor/0-canvas.md §11.4` 컨테이너 중첩 시각 틴트 — 미결정 선행 조건이 plan 에 등재됐으나 구현 준비 확인 필요
  - target 위치: `spec/3-workflow-editor/0-canvas.md §11.4` (중첩 최대 깊이 3, 레벨별 배경 틴트, 초과 토스트)
  - 관련 plan: `plan/in-progress/spec-sync-canvas-gaps.md` 항목 "§11.4 중첩 최대 깊이(3) 제한 enforcement + 초과 토스트 + 레벨별 배경 틴트 (단, §11.2 '시각 containment 미사용' 과의 정합성 재정의 선행 필요)"
  - 상세: spec `§11.4` 는 "미구현 (Planned) + §11.2 와 정합 주의" 박스로 표기되어 있으며, spec 자체에 "시각 containment 도입 시 재정의 대상"임을 명시하고 있다. `spec-sync-canvas-gaps.md` 도 "구현 전 시각 containment 도입 여부 결정이 선행되어야 한다"고 기록했다. 시각 containment 도입 여부에 대한 결정이 어느 plan·spec 에도 명시적으로 내려져 있지 않아, §11.4 구현을 착수할 경우 §11.2 와 충돌하는 방향으로 구현될 위험이 있다.
  - 제안: §11.4 항목 구현을 착수하기 전에, 시각 containment 도입 여부를 `spec-sync-canvas-gaps.md` 또는 별도 spec 결정으로 먼저 확정해야 한다. 본 impl-prep 범위에서 §11.4 를 제외하거나, plan 에 "시각 containment 결정 선행 필요" 를 BLOCKER 로 명시할 것을 권장한다.

- **[INFO]** `spec/3-workflow-editor/0-canvas.md` — `pending_plans` frontmatter 에 `ai-agent-tool-connection-rewrite.md` 와 `spec-sync-canvas-gaps.md` 가 등재되어 있으며, 두 plan 이 in-progress 상태로 미완료임
  - target 위치: `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans`
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (worktree: unstarted), `plan/in-progress/spec-sync-canvas-gaps.md` (worktree: spec-sync-audit)
  - 상세: `0-canvas.md` frontmatter 의 `pending_plans` 에 두 plan 이 명시되어 있고, 두 plan 모두 in-progress 상태로 미완료 체크박스가 남아 있다. `ai-agent-tool-connection-rewrite.md` 는 worktree 도 "unstarted" 이다. 구현 착수 시 이 미완료 항목들과 겹치는 영역(특히 Tool Area, 컨테이너 시각, 단축키 등)을 수정할 경우 plan 추적이 부정확해질 수 있다.
  - 제안: 구현 범위가 pending_plans 가 추적하는 미구현 항목과 겹친다면, 해당 plan 의 체크박스를 함께 갱신하거나 plan 을 완료 이동할 준비를 해두어야 한다.

- **[INFO]** `spec/3-workflow-editor/2-edge.md` — `pending_plans` 에 `ai-agent-tool-connection-rewrite.md` 와 `spec-sync-edge-gaps.md` 가 등재됨
  - target 위치: `spec/3-workflow-editor/2-edge.md` frontmatter `pending_plans`
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` (도구 연결 결정 미완료), `plan/in-progress/spec-sync-edge-gaps.md` (엣지 생성/유효성/데이터미리보기 갭 추적)
  - 상세: `2-edge.md §7 Tool Area 연결 규칙` 은 `ai-agent-tool-connection-rewrite.md` 결정 이후 재검토 대상이지만, 현재 plan 은 미착수(unstarted)이다. `spec-sync-edge-gaps.md` 의 미구현 항목들(DFS 사이클 검사, onConnectEnd 핸들러, 데이터 미리보기 툴팁 등)은 본 impl-prep 구현 범위와 관련이 없는 한 INFO 수준이다.
  - 제안: 구현 범위가 엣지 연결 규칙, Tool Area 엣지, 사이클 검사 영역과 겹치는지 확인. 겹친다면 해당 plan 항목을 갱신한다.

---

## 요약

`spec/3-workflow-editor/` 영역은 전반적으로 미해결 결정 사항이 spec 내 "재작성 예정" / "미구현 (Planned)" 박스와 plan `pending_plans` 를 통해 투명하게 추적되고 있다. 주요 위험은 두 가지다: (1) `ai-agent-tool-connection-rewrite.md` 의 5개 디자인 결정이 모두 TBD 인 상태에서 `0-canvas.md §12` Tool Area 또는 `2-edge.md §7` 관련 코드를 건드릴 경우 미결정 우회가 발생한다. (2) `0-canvas.md §11.4` 의 시각 containment 관련 구현은 §11.2 모델과 충돌 가능하며, 도입 여부 결정이 선행되지 않은 상태다. 이 두 영역을 구현 범위에서 제외하거나 결정 확정 후 착수하면 CRITICAL 위험은 없다. 나머지 항목(단축키, 에디터 UI 세부 기능 등)은 plan 추적과 정합하며 착수 가능한 상태다.

---

## 위험도

LOW
