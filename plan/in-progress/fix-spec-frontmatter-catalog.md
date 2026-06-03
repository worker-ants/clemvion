---
worktree: fix-spec-frontmatter-catalog
started: 2026-06-03
owner: developer
---

# spec-frontmatter guard — cafe24 필드 카탈로그 제외

> background-context-key-followups §보류 에서 분리된 별 task (사용자 2026-06-03 착수 지시).
> PR #451 머지 후 최신 main(b5fc2ec9) 기준.

## 문제

`spec/conventions/cafe24-api-catalog/<resource>/<entity>.md` 222개(필드 단위 API 레퍼런스 카탈로그, `_generator.py` 생성물 — frontmatter 가 `resource`/`entity`/`cafe24_docs`/`source`)가 spec frontmatter lifecycle guard 4종에 쓸려 들어가 `id` non-empty + `status` enum 요구를 충족 못 해 **444건(222×2) 실패**. main HEAD 에서 이미 red (pre-existing).

- guard: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter.test.ts` (+ 공유 helper `spec-frontmatter-parse.ts` 의 `collectApplicableSpecs`/`isApplicable`). 동일 helper 를 `spec-code-paths`/`spec-status-lifecycle`/`spec-pending-plan-existence` 도 사용 → 한 번 고치면 4종 정합.
- SoT: `spec/conventions/spec-impl-evidence.md §1 적용 대상`.

## 구조 확인

- `spec/conventions/cafe24-api-catalog/` 최상위 19개 .md 중 18개(`application.md`, `category.md` …)는 `id`+`status: implemented` 보유한 **진짜 리소스 인덱스 spec → 검증 유지**.
- `_overview.md` 는 `_` prefix 로 이미 제외.
- 실패는 **하위 디렉토리 222개 필드 카탈로그뿐**.

## 수정 방향 (옵션 b — 사용자 승인)

가짜 `id`/`status` 주입(a)은 생성기·의미상 부적절 → 배제. 필드 카탈로그를 lifecycle guard 대상에서 제외:

- [x] **(spec)** SoT `spec-impl-evidence.md §1 제외` 에 `spec/conventions/<name>-api-catalog/<resource>/**.md` 제외 + `## Rationale R-7` (생성기 산출물 근거) 추가.
- [x] **(code)** `spec-frontmatter-parse.ts` 에 `CATALOG_FIELD_FILE` 정규식(`^spec/conventions/[^/]+-api-catalog/[^/]+/.+\.md$`) + `isApplicable` 제외 한 줄. 최상위 인덱스 유지.
- [x] **(test)** `spec-frontmatter-parse.test.ts` 신규 — 인덱스 유지/필드 제외/미래 makeshop 케이스. + `_overview.md §7.1` 에 §1 제외 cross-link.

## 워크플로 체크리스트
- [x] 3. `/consistency-check --impl-prep` → BLOCK: YES (단, Critical = **현재 red 상태 자체**이며 본 fix 가 해소 대상. checker 가 권장한 fix = 본 plan 과 동일). 산출 `review/consistency/2026/06/03/21_45_50/`
- [x] 5–7. 테스트 + 구현 (code + spec)
- [x] 8. TEST WORKFLOW — lint PASS · **unit PASS (444 실패 → 0, frontend 182 files green)** · build PASS · e2e PASS(144)
- [ ] 9. `/ai-review` + `--impl-done`

## 후속 (비차단 — pre-existing, 별 task)
consistency-check 가 함께 지적했으나 본 카탈로그 fix 와 무관한 pre-existing 항목:
- WARNING#1: `PROJECT.md` line 129/243 guard 설명이 `spec/7-channel-web-chat/` 누락 (INCLUDE_PREFIXES 엔 이미 포함). channel-web-chat scope 문서 정확성 — 별 doc 수정.
- WARNING#2: §1 제외 기술이 basename-level 매칭(`0-overview.md`)보다 좁게 단수 경로로 기술 — 표현 명확화.
- INFO#2: `id` 유일성 미강제(`0-common.md` ×6 중복) — 의도된 패턴, 노트 추가 권장.
- INFO#4: `background-context-key-followups.md §보류` 의 본 항목 → 본 PR 완료 후 `[x]`/정리.
