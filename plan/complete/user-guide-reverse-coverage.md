---
worktree: user-guide-reverse-coverage-53a0eb
started: 2026-05-23
completed: 2026-05-23
owner: developer
---

# User-guide reverse-evidence (`<ImplAnchor>`) + 3 가드 실행 plan

> ✅ 완료 (2026-05-23). Phase 1-4 모두 한 turn 안 처리. TEST WORKFLOW lint/unit(4565)/build/e2e(98) 모두 PASS.

## 배경

`plan/in-progress/spec-harness-impl-coverage.md` (spec PR) 의 **결정 B** 실행. SoT: [`spec/conventions/user-guide-evidence.md`](../../spec/conventions/user-guide-evidence.md).

## 작업 범위

### Phase 1 — `<ImplAnchor>` MDX 컴포넌트

- 신규 `codebase/frontend/src/components/docs/impl-anchor.tsx` 작성
- 사용자 view 에서 hidden 렌더 (`display: none`)
- `mdx-components.tsx` 에 등록

### Phase 2 — 3 build-time 가드 작성

- `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/integrations-coverage.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/triggers-coverage.test.ts`

### Phase 3 — 기존 가이드 페이지 anchor 일괄 추가

대상:
- `codebase/frontend/src/content/docs/06-integrations-and-config/*.{mdx,en.mdx}` 의 GUI 흐름 절
- `codebase/frontend/src/content/docs/02-nodes/triggers.{mdx,en.mdx}` 의 provider 절

### Phase 4 — `spec/conventions/i18n-userguide.md §Principle 7` 본문 갱신

본 가드 도입의 부분 커버 범위 명시 (GUI 흐름 절은 커버, 개념 설명 절은 미커버).

## 의존

- spec PR (`spec-harness-impl-coverage`) 머지 후 ([`spec/conventions/user-guide-evidence.md`](../../spec/conventions/user-guide-evidence.md), [`spec/2-navigation/13-user-guide.md §8`](../../spec/2-navigation/13-user-guide.md) 의존)

## 체크리스트

- [x] spec PR 머지 + main 동기 확인
- [x] Phase 1: `<ImplAnchor>` 컴포넌트 구현 + 단위 테스트
- [x] Phase 2: 3 가드 작성 + 통과
- [x] Phase 3: 기존 가이드 anchor 일괄 추가 (integrations + triggers 카테고리)
- [x] Phase 4: `i18n-userguide.md §Principle 7` 갱신
- [x] `user-guide-writer` sub-agent 자가 검증 체크리스트 (PROJECT.md) 통과 확인
- [x] TEST WORKFLOW (lint/unit/build/e2e)
- [x] REVIEW WORKFLOW
- [x] plan `complete/` 이동
