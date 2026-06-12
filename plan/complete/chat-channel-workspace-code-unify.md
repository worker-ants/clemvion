---
worktree: code-node-cleanup-45ffef
started: 2026-06-12
owner: developer
completed: 2026-06-12
spec_impact:
  - spec/5-system/15-chat-channel.md
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
- [x] `/ai-review` + Critical/Warning fix — RISK LOW·Critical 0·Warning 3. W2(optional chaining) fix, W1(perf 선재·추적)·W3(breaking·클라이언트 영향 grep 검증 무) no-op. `review/code/2026/06/12/15_25_55` (SUMMARY+RESOLUTION). fix 후 TEST WORKFLOW 재통과(e2e 188).
- [x] `/consistency-check --impl-done` BLOCK:NO (spec 연결 코드 변경 — SPEC-CONSISTENCY 게이트) — `review/consistency/2026/06/12/15_38_35`. WORKSPACE_REQUIRED Critical 해소 확인. 잔여 WARNING/INFO 전부 무관·선재.

## 후속 (별 작업 — 본 PR scope 밖)
- INFO #4·#5 (impl-done): `15-chat-channel.md` Rationale 에 `401 WORKSPACE_REQUIRED`→`400 WORKSPACE_ID_REQUIRED` 변경 경위 1줄 + `error-codes.md §5 Rename 이력` 에 retired `WORKSPACE_REQUIRED` 등재 검토. (fresh impl-done BLOCK:NO 무효화 회피 위해 본 PR 미포함 — gate 는 code-vs-spec 검증, code 검증 완료.)
- INFO #7 (ai-review): `backend-labels.ts` `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 한국어 라벨 — canonical 공용 코드라 i18n 일괄 pass 로.
- INFO #6 (impl-done): stale worktree(`code-node-followups-close`/`finalize`/`spec-sync-audit`) cleanup.

## 동봉 (같은 PR, 별 commit)
- A1: `code-node-isolated-vm.md` → complete/ (trailing artifact 위생) — **커밋 완료**
- B: `15-chat-channel.md` teamId §4.1 예제 + R-CC-16 EiaEvent 명칭 정합 — **커밋 완료**
