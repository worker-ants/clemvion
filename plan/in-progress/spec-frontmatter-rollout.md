---
worktree: pending
started: pending
owner: developer
---

# Spec frontmatter 일괄 롤아웃 + 4 build-time 가드 실행 plan

> Stub. 실착수 시 worktree·started 채움.

## 배경

`plan/in-progress/spec-harness-impl-coverage.md` (spec PR) 의 **결정 A** 실행. SoT: [`spec/conventions/spec-impl-evidence.md`](../../spec/conventions/spec-impl-evidence.md).

## 작업 범위

### Phase 1 — frontmatter 일괄 추가

대상 spec 파일 60여개 (§1 적용 대상 — `spec/{2-navigation,3-canvas,4-nodes,5-system}/**.md`, `spec/conventions/**.md`, 제외 목록 적용).

초기 `status` 분류:
- `implemented` — 기존 머지된 PR 로 구현 완료. `code:` 채움
- `partial` — 부분 구현 + 후속 plan 존재. `pending_plans:` 채움
- `spec-only` — 작성됐고 구현 의도 결정됨. `pending_plans:` 권장
- `backlog` — `spec/0-overview.md §6.3` 로드맵 매칭

### Phase 2 — 4 build-time 가드 작성

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-code-paths.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts`

각 가드의 검증 의무는 [`spec/conventions/spec-impl-evidence.md §4`](../../spec/conventions/spec-impl-evidence.md) 참조.

## 의존

- spec PR (`spec-harness-impl-coverage`) 머지 후 (PROJECT.md 매트릭스 + spec-impl-evidence.md 의존)
- **착수 전 확인**: `ai-presentation-tools.md` 의 `conversation-thread.md §1.2` 관련 미완료 항목 완료 여부 (frontmatter 추가 시 같은 파일 경합 회피)
- **착수 전 확인**: `ai-agent-tool-connection-rewrite.md` 의 미결 디자인 5건 — frontmatter 결정에 영향 가능. 미결 시 `status: partial` + `pending_plans:` 로 먼저 설정하고 후속 갱신
- **착수 전 확인**: `spec-overview-followups-2026-05-18.md §3` (`spec/0-overview.md` Rationale 추가) 머지 여부

## 체크리스트

- [ ] spec PR 머지 + main 동기 확인
- [ ] 의존 plan 3건 상태 확인 (`ai-presentation-tools`, `ai-agent-tool-connection-rewrite`, `spec-overview-followups-2026-05-18`)
- [ ] Phase 1: 60여 spec 파일 frontmatter 일괄 추가 (status 분류 + code 글로브 채움)
- [ ] Phase 2: 4 build-time 가드 작성 + 통과 확인
- [ ] PROJECT.md §자동 가드 표의 4 row 가 main 과 정합 확인 (spec PR 에서 이미 반영됨)
- [ ] TEST WORKFLOW (lint/unit/build/e2e — 본 plan 은 코드 변경 포함 e2e 의무)
- [ ] REVIEW WORKFLOW (`/ai-review`)
- [ ] plan `complete/` 이동
