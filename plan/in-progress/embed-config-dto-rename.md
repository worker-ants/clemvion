---
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-12
owner: developer
spec_area: spec/7-channel-web-chat
status: in-progress
---

# embed-config.dto.ts → embed-config-response.dto.ts rename

## 배경
consistency-check (`review/consistency/2026/07/12/01_41_42/`) 가 발견한 사전 결함(본 PR 무관, 별도 처리). 신규 응답 DTO 파일이 `spec/conventions/swagger.md §5-1` 의 `*-response.dto.ts` 파일명 컨벤션 미준수. `dto/responses/` 36개 중 33개는 패턴 준수, 이 파일만 위반.

## 컨벤션 재확인 (착수 전)
- swagger.md §5-1 원문: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` — 파일명이 `*-response.dto.ts` 여야 함. ✅ 적용 대상 확정.
- 클래스명 `EmbedConfigDto` 는 유지 — sibling 클래스는 `*Dto` 관례(`WebhookInteractionDto`, `SessionDto` 등). 컨벤션은 **파일명**에 관한 것.

## 변경 범위
- [x] `git mv embed-config.dto.ts → embed-config-response.dto.ts`
- [x] `hooks.controller.ts:37` import 경로 갱신
- [x] `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 경로 갱신 (line 10) — 강제 path mirror
- 그 외 spec `embed-config` 언급은 URL 엔드포인트(`/embed-config`)·`embed-config.service.ts` 로 DTO 파일 아님 → 무변경

## impl-prep 판단
본 변경은 consistency-check 발견에서 유래한 순수 파일명 rename(무의미 변화). §5-1 문서 컨벤션 그대로 이행이므로 impl-prep fan-out 은 순환·불필요로 판단. hook 강제 gate 인 `/ai-review`(stop guard) + `/consistency-check --impl-done`(push guard, DTO 가 spec-linked) 은 이행.

## 체크리스트
- [ ] TEST WORKFLOW (lint·unit·build·e2e)
- [ ] /ai-review + SUMMARY
- [ ] /consistency-check --impl-done spec/7-channel-web-chat (BLOCK: NO)
