---
worktree: code-node-cleanup-45ffef
started: 2026-06-12
owner: developer
---

# chat-channel `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 통일 (옵션 A)

> 출처: `code-node-cleanup` consistency-check CRITICAL #1 (선재 drift, code-node-followups 와 무관히 main 에 존재).
> 사용자 결정(2026-06-12): Critical 해소까지 drift-fix PR 보류 + 의미차 검토 → **의미차 없음, 옵션 A 확정**.

## 배경 — 의미차 조사 결론

`chat-channel.controller.ts` `rotateBotToken` 이 공용 `@WorkspaceId()` 데코레이터를 쓰지 않고
`X-Workspace-Id` 헤더를 수동으로 읽으며 canonical 과 어긋남:

| | canonical (`@WorkspaceId` 데코레이터) | chat-channel (수동) |
|---|---|---|
| 조건 | 헤더 **또는** JWT `workspaceId` 둘 다 없음 | 헤더만 없음 (JWT fallback **누락**) |
| 코드/status | `WORKSPACE_ID_REQUIRED` / 400 | `WORKSPACE_REQUIRED` / 401 |

의미 차이 없음 — 단순 inconsistent outlier + JWT fallback 누락(잠재 버그). workspace 컨텍스트 부재는
인증 실패(401)가 아니라 요청 컨텍스트 부재(400)가 맞음. → 공용 데코레이터로 통일(옵션 A): 코드·status
정합 + JWT fallback 버그 동시 해소.

## 작업 체크리스트

- [x] `chat-channel.controller.ts`: `@Headers('x-workspace-id')` 수동 체크 → `@WorkspaceId()` 데코레이터. `WORKSPACE_REQUIRED`/`UnauthorizedException`/`Headers` import 제거. JSDoc 갱신.
- [x] `chat-channel.controller.spec.ts`: 직접호출로 검증 불가해진 "X-Workspace-Id 미전달 401" 테스트 제거(검증 책임 `workspace.decorator.spec.ts` 로 이관) + `UnauthorizedException` import 제거. (잔여 4 passed)
- [x] spec `15-chat-channel.md §5.4` 표: `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED`(공용 데코레이터). planner 영역이나 drift-sync 라 동반.
- [x] user-docs `triggers.mdx`/`triggers.en.mdx`: 에러코드 목록 `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED`.
- [x] TEST WORKFLOW (lint·unit·build·e2e) — 전부 PASS (unit 40·e2e 188/32 suites, 회귀 0)
- [ ] `/ai-review` + Critical/Warning fix
- [ ] `/consistency-check --impl-done` BLOCK:NO (spec 연결 코드 변경 — SPEC-CONSISTENCY 게이트)

## 동봉 (같은 PR, 별 commit)
- A1: `code-node-isolated-vm.md` → complete/ (trailing artifact 위생) — **커밋 완료**
- B: `15-chat-channel.md` teamId §4.1 예제 + R-CC-16 EiaEvent 명칭 정합 — **커밋 완료**
