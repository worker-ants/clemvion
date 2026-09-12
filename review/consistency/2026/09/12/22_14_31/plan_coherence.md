# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 조사 방법

target(`spec/5-system/`) 의 scope 델타는 0파일이라 번들 diff 는 절단됐다. 실제 구현
변경(14파일/760줄)과 관련 plan 문서는 워킹트리를 절대경로로 직접 확인했다:

- `git diff origin/main...HEAD --stat` — 코드 변경 대상: `auth.controller.ts`
  (`switchWorkspace` `@ApiParam format:'uuid'` 추가), `triggers.controller.ts`
  (`rotateBotToken` 에 `ParseUUIDPipe` + `@ApiParam format:'uuid'` 추가),
  신규 `repo-guards/__tests__/param-uuid-pipe*` 가드 3파일, 가이드 MDX 6곳,
  `backend-labels.ts`/`.test.ts` 주석 정정, plan 문서 2건(`trigger-uuid-and-guide-error-codes.md`
  신설, `spec-draft-nullable-notation-followups.md` 갱신).
- `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 전문(체크리스트·6라운드
  `/ai-review` 처분 표 포함).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff hunk(§신규 6항목).
- 교차 검색: `auth-guard-reflection-hardening.md`(동일 클래스의 선례),
  `backend-lint-gate-broken-on-main.md`, `spec-sync-auth-gaps.md`, chat-channel 3계열
  plan, MCP/`param-uuid-pipe`/`22P02` 관련 plan 전수 grep — 중복·충돌 등록 없음 확인.
- `spec/5-system/15-chat-channel.md §5.4` 실제 표를 직접 열어, plan 이 주장하는
  "신규 `:id` 400 VALIDATION_ERROR 행 부재" 를 실측 확인(참 — 있는 행은 헤더 형식
  트리거용 동명 코드뿐, `:id` 트리거 행은 없음).

## 발견사항

- **[INFO]** `rotateBotToken :id` UUID 검증의 신규 400 분기가 `15-chat-channel.md §5.4`
  표·`swagger.md §5-4` 체크리스트에 아직 반영되지 않았다 — 등재는 됐으나 target 미적용
  - target 위치: `spec/5-system/15-chat-channel.md §5.4`(실패 응답 표, 369~380행) ·
    `spec/conventions/swagger.md §5-4`(간접 대상, 이번 번들엔 미포함)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 두 항목
    (`15-chat-channel.md §5.4` 행 누락 · `swagger.md §5-4` 런타임 축 누락, 둘 다 "planner
    항목" 으로 명시 등재)
  - 상세: `ParseUUIDPipe` 추가로 `:id` 가 UUID 형식이 아니면 400 `VALIDATION_ERROR` 를 내는
    새 관측 가능 분기가 생겼다. §5.4 표에는 **헤더**(`X-Workspace-Id`) 형식 오류용 동일
    코드 행만 있고 **경로 파라미터**(`:id`) 트리거용 행이 없다 — 실측으로 확인됨. developer
    plan 은 이를 인지하고 (a) 자기-반증형 소정정 조건 1(그 문장을 developer 가 쓰지 않음)이
    깨져 직접 고치지 않았고 (b) `spec-draft-nullable-notation-followups.md` 에 "planner
    항목" 으로 명시 등재해 후속을 만들어 두었다 — CLAUDE.md 의 developer/spec 경계 규약과
    정확히 일치하는 처리다.
  - 제안: target(spec) 은 이번 PR 범위 밖이라 갱신 불필요. 다음 planner 턴에서 두 항목을
    `spec/5-system/15-chat-channel.md §5.4` 와 `spec/conventions/swagger.md §5-4` 에 반영할
    것. 부수: `15-chat-channel.md` frontmatter `pending_plans:` 에는 현재 이 두 항목의 tracker
    (`spec-draft-nullable-notation-followups.md`)가 미등재 상태다(기존 3개 chat-channel 전용
    plan만 등재). `pending_plans:` 의 정의역이 "미구현 surface" 라 이 건(구현 완료·문서만 지연)
    이 반드시 그 필드 대상인지는 모호하나, 다음 planner 턴에서 함께 검토하면 발견 비용이 준다.

- **[INFO]** 동일 결함 클래스(UUID param → 500 마스킹)의 선례가 이미 `1-auth.md` 에 있고,
  이번 plan 의 처분이 그 선례와 일관됨을 확인
  - target 위치: `spec/5-system/1-auth.md §3.3`, `§Rationale`(부트 캐너리·검증 강도 비대칭)
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` §3
    (`X-Workspace-Id` 헤더의 동일 22P02→500 마스킹, 2026-08-09 에 planner 턴으로 spec 반영
    완료)
  - 상세: 두 plan 모두 "call-site 별 방어(파이프/조기검증) 를 먼저 넣고, `GlobalExceptionFilter`
    전역 분류는 별건으로 미룬다" 는 같은 설계를 택했다. 이번 배치가 새로 등재한
    "`GlobalExceptionFilter` 가 22P02 를 분류하지 않는다" 항목은 다른 in-progress plan 에
    중복 등록되어 있지 않고(grep 확인), 기존 선례의 결정과도 충돌하지 않는다.
  - 제안: 없음(확인 목적의 기록).

미해결 결정 우회(CRITICAL) 또는 선행 plan 미해소(WARNING)로 볼 사례는 발견되지 않았다.
`plan/in-progress/**` 전수에서 이번 PR 의 대상 파일(`triggers.controller.ts`,
`auth.controller.ts`, `backend-labels.ts`, 가이드 MDX, `param-uuid-pipe` 가드,
`MCP_ALLOW_INSECURE_URL`)과 겹치는 "결정 필요"/미결 항목은 없었다.

## 요약

target(`spec/5-system/`) 자체는 이번 PR 에서 변경되지 않았고(scope 델타 0), 코드 변경이
새로 만든 관측 가능한 분기(`:id` UUID 형식 오류 → 400)는 spec 표에 아직 반영되지 않은 상태다.
그러나 이는 방치가 아니라 — developer 가 자기-반증형 소정정 조건(조건 1: 그 문장을 자신이
썼는가)이 깨졌음을 정확히 판정하고, 두 건을 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 "planner 항목" 으로 명시 등재해 후속을 놓치지 않도록 했다. 동일 결함 클래스의 기존 선례
(`auth-guard-reflection-hardening.md`)와 설계·처분 방향이 일관되며, 다른 in-progress plan 과의
결정 충돌·중복 등록도 발견되지 않았다. 유일한 개선 여지는 신규 등재 항목을 대상 spec 파일의
`pending_plans:` frontmatter 에도 cross-reference 해 두면 다음 사람이 더 빨리 찾을 수 있다는
점 정도이며, 이는 이번 PR 을 막을 사유가 아니다.

## 위험도
NONE
