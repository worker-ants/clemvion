---
title: AI Agent 메모리 가시화/삭제 admin surface (A1)
status: in-progress
worktree: .claude/worktrees/agent-memory-admin-ui-455467
branch: claude/agent-memory-admin-ui-455467
spec:
  - spec/5-system/17-agent-memory.md
  - spec/2-navigation/16-agent-memory.md
  - spec/2-navigation/_product-overview.md
  - spec/5-system/_product-overview.md
code:
  - codebase/backend/src/modules/agent-memory/**
  - codebase/frontend/src/**
---

# AI Agent 메모리 가시화/삭제 (A1)

`memoryStrategy: persistent` 로 누적된 메모리를 워크스페이스 멤버가 scope 별로 조회/삭제하는
admin surface. 기존 백엔드(저장·회수·forgetting)만 있고 사용자 가시화 경로가 없던 것을 보완.
`17-agent-memory.md` 로드맵의 "메모리 가시화 UI" 항목 실현.

## 범위

- 조회: scope 목록(건수·최신시각) + scope별 메모리 행(content/kind/시각, embedding 제외), kind 필터, 페이지네이션.
- 삭제: 단건 hard delete + scope 전체 삭제 (forgetting evict 과 동형 영구 삭제, editor+).
- 격리: 모든 경로 workspace_id 강제 (AGM-07 연장).

## Phase

- A (spec): 17-agent-memory.md 메모리 관리 API + AGM-12/13, 로드맵 가시화 항목 실현 표기.
  2-navigation/16-agent-memory.md 신규(NAV-AM-01~). _product-overview 메뉴·맵·AGM 등재. -> consistency-check --spec.
- B (backend): AgentMemoryController + service(listScopes/listMemories/deleteMemory/clearScope) + DTO + 인가 + unit/e2e.
- C (frontend): 사이드바 surface + 페이지(scope 탐색->메모리 list->삭제) + api client + react-query + i18n + 유저 가이드.
- D (review/test): consistency-check --impl-done, /ai-review + fix, lint/unit/build/e2e, PR.

## 요구사항

- AGM-12: scope별 메모리 조회 API (workspace 격리, embedding 제외, kind 필터).
- AGM-13: 메모리 삭제 API (단건 + scope 전체, editor+, hard delete).
- NAV-AM-01~: 사이드바 surface, scope 탐색, 메모리 조회/삭제 UI (editor+ 삭제).
