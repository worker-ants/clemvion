---
worktree: .claude/worktrees/webchat-polish-batch-99e2ed
started: 2026-06-28
owner: project-planner + developer
spec_impact:
  - spec/0-overview.md
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/5-admin-console.md
---

# Channel Web Chat — 선택 spec polish + 섹션 C 메모 batch

> backlog 종결 후 비차단 INFO/메모 묶음. spec polish(planner) + code(developer) 혼합 → 한 PR(코드 게이트 적용).

## 변경 (spec)
- [x] `0-overview §6.2`(🚧) → `§6.1`(✅) webchat 이동 — 영역 종결·라이브 미리보기(#690) 완료 반영, stale "증분 2" 제거.
- [x] `2-sdk §1` 메서드 열거에 `resetSession` 추가(§1 Overview·§3 테이블과 정렬).
- [x] `1-widget-app §2` 입력창 행 — 텍스트 표면 = ai_conversation 또는 pending=null(과도) 명시(isTextInputSurface SoT). SPEC-DRIFT 해소.
- [x] `5-admin-console` `## Overview (제품 정의)` → `## Overview` 표준 정렬(영역 5문서와 일치).

## 변경 (code)
- [x] `EmbedConfigDto` allowlist·enforce 필드 JSDoc 병기(swagger.md §1-1 패턴).
- [x] `configFromQuery` apiBase 하드닝 — `safeApiBaseFromQuery`(http(s) 스킴만 허용, javascript:/data:/상대경로 거름) + export + 단위 5케이스.
- [x] phase=blocked 테스트: **이미 widget-app.test.tsx:85("임베드 불허 host → 렌더 거부")로 커버**(Panel 은 blocked 시 미렌더라 Panel 테스트 무의미) — 무조치.

## 절차
- [ ] /consistency-check --impl-prep → BLOCK: NO.
- [ ] TEST WORKFLOW (lint·unit·build·e2e).
- [ ] /ai-review + Critical/Warning 0.
- [ ] /consistency-check --impl-done → BLOCK: NO.
