---
title: 메모리 후속 백로그 그루밍 (저위험 코드전용)
status: in-progress
worktree: memory-backlog-a2-fe9c8f
branch: claude/memory-backlog-a2-fe9c8f
started: 2026-06-05
owner: developer
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
- [x] A3 `embeddingModel` ui.widget `'text'`→`'expression'` (summary/extraction 과 일관, #467 선존 불일치 해소).
- [x] B3 경계 테스트 보강(runningSummary≠undefined bit-identical sweep, budget==currentTokens no-op).

## 보류(백로그 유지)
- `(workspace_id, scope_key, updated_at)` 인덱스 마이그레이션(filesort), AgentMemoryAdminService 분리, page.tsx 분해, pagination offset→page, clearScope toast, fallback 주석 dedup.
- A2(text_classifier/information_extractor 자동주입 확장) — 별도 feature PR.
