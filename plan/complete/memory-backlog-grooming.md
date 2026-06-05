---
title: 메모리 후속 백로그 그루밍 (저위험 코드전용)
status: complete
worktree: memory-backlog-a2-fe9c8f
branch: claude/memory-backlog-a2-fe9c8f
started: 2026-06-05
owner: developer
spec_impact:
  - spec/5-system/17-agent-memory.md
spec:
  - spec/5-system/17-agent-memory.md
code:
  - codebase/backend/src/modules/agent-memory/**
  - codebase/backend/src/nodes/ai/ai-agent/**
---

# 메모리 후속 백로그 그루밍

A1/A3/B3 PR(머지됨)의 RESOLUTION 백로그 중 **코드 전용·저위험·고가치** 항목만 picking.
마이그레이션 신설·대형 리팩토링은 제외(별도 백로그 유지).

## 항목
- [x] A1 `listScopes` 데이터+COUNT 이중 집계 → CTE + `COUNT(*) OVER()` 단일 쿼리(perf). spec §6 에 over-page total=0 동작 명시.
- [x] A3 `embeddingModel` widget 검토 — consistency-check 결과 **`'text'` 유지** 결정. summary/extraction 은 stateless 라 expression 무해하나, embeddingModel 은 scope 의 전 저장 메모리와 **차원 일관성 불변식**(17-agent-memory §3)이라 per-execution expression 평가가 차원 불일치(recall 무음 실패) footgun → 정적 text 로 차단(의도적 차이, 코드 주석).
- [x] B3 경계 테스트 보강(runningSummary≠undefined bit-identical sweep, budget==currentTokens no-op).

## 보류(백로그 유지)
- `(workspace_id, scope_key, updated_at)` 인덱스 마이그레이션(filesort), AgentMemoryAdminService 분리, page.tsx 분해, pagination offset→page, clearScope toast, fallback 주석 dedup.
- A2(text_classifier/information_extractor 자동주입 확장) — 별도 feature PR.
