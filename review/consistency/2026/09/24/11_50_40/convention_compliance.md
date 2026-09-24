# 정식 규약 준수 검토 — target: `spec/5-system` (--impl-done, diff-base=origin/main)

## 검토 범위 확인

- `spec/5-system/**` 자체의 diff: **0개 파일** — 이번 PR 은 spec 을 건드리지 않는 코드 전용 변경이다.
- 실제 구현 diff(3파일/371줄): `codebase/backend/src/modules/workspaces/workspaces.service.ts`
  (+`.spec.ts`) · `codebase/backend/test/workspace-rbac.e2e-spec.ts` — `WorkspacesService.removeMember()`
  의 인가 판정 순서를 "대상 조회 → owner 판정 → `assertAdmin`" 에서 "요청자 멤버십(`NOT_A_MEMBER`)
  → 대상 조회 → self 위임 → admin 판정(`ADMIN_REQUIRED`) → owner 판정(`CANNOT_REMOVE_OWNER`)" 으로
  재배치했다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/member-auth-order-8c4d1f`)
  절대경로에서 `git diff origin/main...HEAD` 로 직접 확인했다.
- 대조 규약: `spec/conventions/error-codes.md`(명명·안정성), `spec/5-system/2-api-convention.md §5.3`(에러
  응답 봉투), `spec/5-system/3-error-handling.md §1`(카탈로그), `spec/conventions/audit-actions.md`(감사
  액션 명명), `spec/conventions/swagger.md`(API 문서 데코레이터 패턴). `spec/5-system` 자체 문서 구조
  규약은 직전 `--impl-prep`(`review/consistency/2026/09/24/10_22_24/convention_compliance.md`)에서
  이미 standing check 를 수행해 그 결과를 재확인만 했다(아래 첫 항목).

## 발견사항

- **[INFO]** (carry-forward, 이번 diff 와 무관) `spec/5-system` 17개 기술 spec 중 4개가 `## Overview`
  정식 표제를 쓰지 않는다
  - target 위치: `11-mcp-client.md`·`5-expression-language.md`·`7-llm-client.md`(전부 `## 1. 개요`로
    대체) · `16-system-status-api.md`(개요 표제 자체가 없음)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조(3섹션 권장)" —
    `## Overview (제품 정의)` / 본문 / `## Rationale`
  - 상세: 이번 PR 이 이 4개 파일을 건드리지 않았으므로 diff 로 인한 신규 위반이 아니다. "권장"
    규약이라 CRITICAL/WARNING 대상은 아니며, 직전 impl-prep 라운드 판정(LOW)과 동일하게 유지된다.
  - 제안: 조치 불요(이번 PR 스코프 밖). 별도 문서 정리 세션에서 4개 파일에 `## Overview` 표제를
    보충하거나 SKILL.md 에 번호형 개요 예외를 명시.

- **[INFO]** 에러 코드 카탈로그의 **발행 경로 서술** 3줄이 이번 리팩터로 낡았다 — 이미 추적됨
  - target 위치(코드): `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()`
  - target 위치(spec): `spec/5-system/3-error-handling.md:46`(`ADMIN_REQUIRED` 발행처를
    `WorkspacesService.assertAdmin()` 단수로 서술) · `:49`(`NOT_A_MEMBER` 발행 경로 열거에 신규
    발행처 `removeMember` 누락) · `spec/5-system/1-auth.md:551`(§3.2 정정 노트가 "`removeMember()`
    는 `assertAdmin(...)` 만 요구한다"를 근거로 인용하는데 그 호출 자체가 이제 없다)
  - 위반 규약: `spec/conventions/error-codes.md` Overview — "카탈로그·분류·트리거: `3-error-handling.md
    §1`(SoT)" 및 `2-api-convention.md §5.3` "어느 쪽을 택하든 [에러 처리 §1 카탈로그]에 등재한다" —
    코드 자체는 이미 등재돼 있으나 그 **발행 경로 서술**이 실제 코드와 어긋난다.
  - 상세: `NOT_A_MEMBER`/`ADMIN_REQUIRED` 코드 값·상태(403)는 신규가 아니고 그대로 유효하다.
    바뀐 것은 "누가 던지는가"라는 카탈로그 산문 서술뿐이며, 최종 RBAC 계약(Admin+ 가 owner 제외
    멤버 제거 가능)도 깨지지 않는다. `spec/` 은 developer 쓰기 범위 밖(CLAUDE.md Skill 체계)이라
    developer 가 직접 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (~L4974-4990, "`removeMember` 리팩터로 낡은 spec 서술 세 줄", 2026-09-24 등재)에 planner 항목
    으로 이관해 두었다 — 자기-반증형 소정정 5조건도 불충족(`1-auth.md:551` 문장은 developer 본인이
    쓴 것이 아니므로 조건1 미충족)이라 planner 턴 라우팅이 맞다. 동일 항목을 `cross_spec.md` 가
    더 상세히 다루므로 본 보고서는 "카탈로그 발행-경로 서술의 정확성"이라는 convention 축에서만
    간단히 교차 확인한다.
  - 제안: 이번 PR 을 막을 이유는 아니다(BLOCK 사유 아님, 코드·상태 값 자체는 정확). 다음 planner
    턴에서 위 세 줄만 국소 정정.

- **[정상]** 나머지 관점(명명·출력 포맷·API 문서·금지 항목)은 위반 미발견
  - **명명(§1)**: diff 가 재사용하는 4개 에러 코드(`NOT_A_MEMBER`·`ADMIN_REQUIRED`·`CANNOT_REMOVE_OWNER`
    ·`MEMBER_NOT_FOUND`)는 전부 변경 전부터 존재(`git show origin/main:...workspaces.service.ts`
    로 확인)하며 `UPPER_SNAKE_CASE` 이고, 신규 코드는 0개다. `error-codes.md §2`("에러 코드 rename
    은 breaking change 다 / 이름 정확성 향상만을 위한 rename 은 하지 않는다")도 위반하지 않는다 —
    이번 변경은 코드 이름을 바꾼 것이 아니라 **어느 경로가 그 기존 코드를 던지는가**만 바꿨다.
  - **출력 포맷(§2)**: `throwNotAMember`/`throwAdminRequired` 가 던지는
    `new ForbiddenException({ code, message })` 형태는 `2-api-convention.md §5.3` 의 "top-level
    `code` 교체" 패턴(사유가 엔드포인트 결과 그 자체 · 한 요청에 사유가 하나뿐)과 정확히 일치한다.
    `details` 를 쓰지 않는 것도 맞다 — 필드 단위 사유가 아니므로 `details[].code` 갈래가 아니다.
  - **문서 구조(§3)**: 이번 diff 는 spec 파일을 건드리지 않아 신규 구조 위반 없음(위 carry-forward
    INFO 만 기존 상태로 유지).
  - **API 문서(§4)**: 신규 controller 라우트·DTO·Swagger 데코레이터 없음 — `swagger.md` 대상 표면
    자체가 이번 diff 에 없다.
  - **금지 항목(§5)**: `AuditLogsService.record({ action: AUDIT_ACTIONS.MEMBER_REMOVED, ... })` 호출은
    변경 전과 동일한 위치·페이로드(`{ mode: 'removed', memberUserId }`)로 유지되며, `audit-actions.md`
    §1 이 금지하는 "인라인 문자열 action"(`AUDIT_ACTIONS` 상수 미사용)에 해당하지 않는다. 신규
    audit action 도 없다.

## 요약

이번 PR 은 `spec/5-system` 문서를 직접 수정하지 않는 코드 전용 보안 수정(`WorkspacesService.removeMember()`
인가 판정 순서 재배치)이며, 재사용하는 4개 에러 코드·에러 응답 봉투 형태·감사 액션 모두 기존
`spec/conventions/**`(error-codes.md·audit-actions.md) 및 `2-api-convention.md §5.3` 규약을 그대로
따른다 — 신규 CRITICAL/WARNING 급 규약 위반은 발견되지 않았다. 유일한 잔여 사항은 카탈로그의 발행
경로 서술 3줄(`3-error-handling.md:46,49`·`1-auth.md:551`)이 이번 리팩터로 낡았다는 점인데, 이는
developer 가 이미 자신의 쓰기 범위 밖으로 정확히 식별해 planner 백로그 항목으로 이관해 두었고
(`spec-draft-nullable-notation-followups.md`), `cross_spec.md` 검토가 같은 항목을 더 상세히 다룬다.
직전 `--impl-prep` 라운드에서 확인된 4개 파일의 `## Overview` 표제 생략도 이번 diff 와 무관한
기존 상태로 그대로 남아 있다. 두 INFO 모두 이번 PR 의 착수·머지를 막을 사유가 아니다.

## 위험도

LOW
