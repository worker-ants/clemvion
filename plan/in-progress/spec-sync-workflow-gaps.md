---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# workflow — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/2-flow/1-workflow.md

## 미구현 항목
- [ ] §2 Target Workflow 셀렉터 드롭다운 UI — config 스키마는 `widget: 'workflow-selector'` 선언하나 프론트엔드 `WIDGET_REGISTRY` 에서 `UnsupportedWidget` 스텁으로 매핑(`widget-registry.ts:49`). 전용 셀렉터 컴포넌트 미구현 (워크스페이스 워크플로우 후보 노출 / 현재 편집 중 워크플로우 제외 / 선택 시 workflowId+workflowName 동시 저장 / 직접입력 시 workflowName 초기화 포함).
- [ ] §2·§7 `⚠ Missing workflow` 캔버스 배지 — 삭제·비활성화된 대상 워크플로우 감지 배지 분기가 코드에 없음.
- [ ] §7 캔버스 요약 템플릿 `{workflowName 또는 workflowId} · {mode}` — `workflowNodeMetadata` 에 `summaryTemplate` 부재. 타 노드(parallel/http-request/map 등)는 보유. 현재 캔버스는 workflowId 미설정 blocking warning 외 본문 요약 미렌더.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__2-flow__1-workflow.md 참조.
- 핸들러 출력 4케이스(sync/async/error/pre-flight)·에러코드 4종·manual_trigger throw·런타임 워크스페이스 격리(assertSameWorkspace)는 구현 정확 일치 — 강등 대상 아님.
- 동일 템플릿/배지 claim 이 `spec/4-nodes/2-flow/0-common.md §4` 캔버스 요약 표(Workflow 행)에도 존재 — 함께 정정 필요(본 audit 스코프 밖, 별도 처리).

## 구현 상태 (branch claude/spec-sync-impl-644d19, 2026-06-03)
- 미구현 항목 **코드 구현 완료** — commit a96fac1. ai-review(13 reviewer)+resolution-applier 처리, build/lint/unit/e2e green. (workflow-selector 위젯 + missing-workflow badge + summaryTemplate)
- **미해결 follow-up**: spec marker flip / 본문 보강(planner) → `plan/in-progress/spec-fix-impl-marker-flips.md`. 그 완료 시 본 ticket 을 `complete/` 이동 (plan-lifecycle §2).
