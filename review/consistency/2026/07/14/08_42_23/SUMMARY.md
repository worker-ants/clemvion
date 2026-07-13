# Consistency SUMMARY — `--impl-done` (F-1 종결 라운드)

- 모드: `--impl-done` scope=`spec/5-system/4-execution-engine.md`, diff-base=origin/main
- checker 5/5 완료

## BLOCK: NO

| checker | Critical | Warning | Info |
|---|---|---|---|
| cross_spec | 0 | 0 | 0 |
| rationale_continuity | 0 | 0 | 2 |
| convention_compliance | 0 | 1 | 0 |
| plan_coherence | 0 | 0 | 2 |
| naming_collision | 0 | 0 | 0 |
| **합계** | **0** | **1** | 4 |

## Critical: 없음 → 차단 없음

## Warning 처분 (1건 — fix, commit `3fdeca96a`)

- **[convention_compliance]** `interaction.controller.ts` `@ApiConflictResponse` 설명이 F-1 로 새로
  발생하는 nodeId 불일치 STATE_MISMATCH 사유를 미반영(PROJECT.md doc-sync 매트릭스 "백엔드 API 변경
  →swagger jsdoc"). → **fix**: 설명에 "명령의 nodeId 가 실제 대기 노드와 불일치" 추가.

## Info (4건)
- rationale INFO 2: 기존 관례 계승, 신규 위반 아님.
- plan_coherence INFO 2: F-6 이 spec frontmatter `pending_plans` 미등재 — F-6 은 별도 plan 파일이
  아니라 기존 plan 의 backlog 섹션(enhancement, 미구현 promised surface 아님)이라 등재 대상 아님.
  payload 코퍼스 누락은 워킹트리 직접 대조로 보완됨(비차단).
