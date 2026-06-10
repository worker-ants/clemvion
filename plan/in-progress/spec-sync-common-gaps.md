---
worktree: spec-sync-audit-998544
started: 2026-06-03
owner: planner
---

# common (Flow 노드 공통 규약) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/2-flow/0-common.md

## 미구현 항목
- [x] §4 캔버스 요약: workflow 노드 `summaryTemplate` 정의 (`{workflowName 또는 workflowId} · {mode}`). — 완료: `workflow.schema.ts` `workflowNodeMetadata.summaryTemplate` (`{{workflowName|fallback:workflowId}} · {{mode|default:sync}}`) 구현 (커밋 ae149dc6, #448).
- [x] §4 워크플로우 삭제 시 `⚠ Missing workflow` 캔버스 텍스트. — 완료: `summaryTemplate.warnWhen: 'workflowId && !workflowName'` + `warnMessage: 'Missing workflow'` 구현 (커밋 ae149dc6, #448).
- [ ] §2 `meta` 확장: Sync 모드 `meta` 에 `recursionDepth` / `subExecutionId` / `mode` 노출, Async 모드 `meta` 반환. 현재 sync 는 `meta.{durationMs}` 1필드만, async 는 meta 미반환 (`workflow.handler.ts:158-169,115-123`).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__2-flow__0-common.md 참조.
- §2.1/§2.2 에러 컨트랙트·재귀 깊이 10 은 코드와 일치 확인 → 본문만 세분 코드 반영, 강등 사유 아님.
