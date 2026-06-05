---
title: agent_memory scope-list 정렬 인덱스 (A1 backlog)
status: complete
worktree: agent-memory-scope-index-6b4a98
branch: claude/agent-memory-scope-index-6b4a98
started: 2026-06-05
owner: developer
spec_impact:
  - spec/5-system/17-agent-memory.md
  - spec/1-data-model.md
spec:
  - spec/5-system/17-agent-memory.md
  - spec/1-data-model.md
code:
  - codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql
---

# agent_memory scope-list 정렬 인덱스

A1 backlog (PR #471 RESOLUTION·database reviewer W1): `listScopes`(admin 메모리 가시화,
`GET /agent-memories/scopes`) 의 `GROUP BY scope_key → ORDER BY MAX(updated_at) DESC` 가
기존 `(workspace_id, scope_key, created_at)` 인덱스로 커버되지 않아 heap fetch + filesort 발생.

## 변경
- [x] `V086__agent_memory_scope_updated_index.sql` (+`.conf` executeInTransaction=false):
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_memory_scope_updated
       ON agent_memory(workspace_id, scope_key, updated_at)` — MAX(updated_at) index-only 커버,
      대용량 무중단(CONCURRENTLY) 배포. 회수/evict 의 created_at 인덱스와 직교(둘 다 유지).
- [x] spec `17-agent-memory.md §1`/AGM-02 + `1-data-model.md §3` 인덱스 표 갱신.

## 비고
SQL(listScopes) 자체는 무변경 — 인덱스만 추가해 기존 쿼리 플랜 가속. 동작·결과 불변.
