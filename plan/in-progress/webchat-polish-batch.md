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
- [~] ~~`0-overview §6.2`→`§6.1` webchat 이동~~ **revert(보류)** — `NAV-WC-06` 가 라이브 미리보기를 아직 `🚧`(증분 2)로 표기.
      ✅ 이동은 NAV-WC-06 와 동시 정합돼야 하므로(impl-prep I-4) 별도 planner 항목으로 분리. 본 PR 미포함.
- [x] `2-sdk §1` 메서드 열거에 `resetSession` 추가(§1 Overview·§3 테이블과 정렬).
- [x] `1-widget-app §2` 입력창 행 — 텍스트 표면 = ai_conversation 또는 pending=null(과도) 명시(isTextInputSurface SoT). SPEC-DRIFT 해소.
- [x] `5-admin-console` `## Overview (제품 정의)` → `## Overview` 표준 정렬(영역 5문서와 일치).
- [x] **`5-admin-console §2` `[0-architecture R5]` → `§R2`(client-consumer)** — impl-prep W-4: D-phase Rationale 재번호화(R5→R2) 누락 drift 정정(63·244행. §R5 carve-out 170·285행은 정확하므로 유지).

### impl-prep 검토 결과 (BLOCK: NO) — 별도 deferred
- W-1(0-architecture §3 EIA 매핑에 execution.message 행 누락)·W-2(EIA §6.2 wire 필드 drift)·W-3(embed-config.dto 파일명
  `*-response.dto.ts` 미준수) — **전부 pre-existing**(본 batch 무관), planner/별도 followup. W-3 은 DTO 리네임이라 범위·위험으로 비포함.

## 변경 (code)
- [x] `EmbedConfigDto` allowlist·enforce 필드 JSDoc 병기(swagger.md §1-1 패턴).
- [x] `configFromQuery` apiBase 하드닝 — `safeApiBaseFromQuery`(http(s) 스킴만 허용, javascript:/data:/상대경로 거름) + export + 단위 5케이스.
- [x] phase=blocked 테스트: **이미 widget-app.test.tsx:85("임베드 불허 host → 렌더 거부")로 커버**(Panel 은 blocked 시 미렌더라 Panel 테스트 무의미) — 무조치.

## 절차
- [ ] /consistency-check --impl-prep → BLOCK: NO.
- [ ] TEST WORKFLOW (lint·unit·build·e2e).
- [ ] /ai-review + Critical/Warning 0.
- [ ] /consistency-check --impl-done → BLOCK: NO.
