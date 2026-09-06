# 변경 범위(Scope) 리뷰

## 개요

`git diff --stat origin/main...HEAD` 기준 312개 파일. 이 중 283개는 `review/code/**`·
`review/consistency/**` 산출물(당일 반복된 리뷰→수정 라운드가 남긴 것)로, 저장소 관례상
`review/` 는 gitignore 대상이 아니고 각 라운드가 자기 커밋에 산출물을 실어 보존하므로 이
자체는 스코프 위반이 아니다. 실질 코드/문서 diff는 `codebase/`·`spec/`·`plan/`·`CHANGELOG.md`·
`.claude/` 를 합쳐 **29개 파일, +3,399/-27줄**이다. 이번 라운드는 그 29개 전체를 다시
검토했다.

이 브랜치(`user-entity-column-defense`)의 마지막 코드 커밋(`1d13ad579`, 16:57:56)은 바로
직전 코드 리뷰(`review/code/2026/09/06/16_28_58`)의 Critical 1건에 대한 응답이다. 그
라운드가 이미 이 브랜치의 스코프 확산을 정확히 3갈래로 짚어 놓았고, 이번 검토로 그 상태가
**그대로 유지**되고 있음을 확인했다(아래 발견사항 1~3). `1d13ad579` 자체가 새로 편입한
코드는 `triggers.service.spec.ts` 의 JSDoc 위치 수정(16줄)과 `workflows.ts` 의 주석 전용
추가(15줄) 뿐이며, 둘 다 좁게 닫혀 있어 새로운 스코프 문제를 만들지 않는다.

핵심 목표(브랜치명 + `plan/in-progress/spec-draft-nullable-notation-followups.md:293`
`- [x] User 엔티티에 컬럼 수준 방어를 둘지 결정`)에 직접 대응하는 파일은 다음으로, 범위가
명확하다: `user-entity-exposure-guard.ts`/`.spec.ts`(구조 축), `user-secret-absence.ts`/
`.spec.ts`(이름 축), 두 fixture(`user-eager-relation.fixture.ts`,
`user-relation-load.fixture.ts`), `workflow-versions.service.ts`/`.spec.ts`(가드가 실제로
찾아낸 `creator` 유출 수정 — 이것은 곁가지가 아니라 이번 작업의 **핵심 산출물**), 두 e2e
배선(`audit-logs.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`), `workspaces.service.spec.ts`,
`CHANGELOG.md`·plan 문서의 해당 절.

## 발견사항

- **[WARNING]** `.claude/**` harness 코드 수정 — `CLAUDE.md` Skill 표에 없는 쓰기 권한을
  이미 행사한 상태이고, 그 문서화는 아직 완료되지 않았다
  - 위치: `.claude/hooks/_lib/review_guard.py:600`(`_parse_frontmatter_code` docstring
    확장), `:626`(`_strip_comment` 신설), `:651`·`:662`(호출부), `:709` 부근(빈 줄/`#` 주석
    스킵 로직) / `.claude/tests/test_review_guard.py`(신규, 149줄) / plan
    `plan/in-progress/spec-draft-nullable-notation-followups.md:451-488`
  - 상세: `CLAUDE.md` 의 Skill 표는 `developer` 의 쓰기 범위를 `codebase/**`·`plan/**`·
    `review/**`(+ 좁은 spec 자기-반증 예외)로만 명시하고 `.claude/**` 는 어느 역할에도
    배정하지 않는다. 이 브랜치는 spec `code:` glob 파서(`review_guard.py`)의 버그를 고쳐
    커밋했고, 그 필요성(`--impl-done` 게이트가 이 PR 자신의 파일 `workspace-response.dto.ts`
    를 spec-linked 로 못 잡던 문제)은 plan 에 상세히 기록돼 있다. 직전 라운드
    (`review/code/2026/09/06/16_28_58`)가 이를 Critical 로 지적했고, 이후 커밋
    `1d13ad579` 가 "**사용자 결정(2026-09-06)**: 코드는 남기고 `CLAUDE.md` 를 나중에
    명시한다" 는 처분을 plan(`:477-488`)에 인용해 절차적으로는 닫았다. 그러나 실제
    `CLAUDE.md` 파일은 이번 브랜치에서 **한 글자도 바뀌지 않았다**(`git diff
    origin/main...HEAD -- CLAUDE.md` 결과 없음) — plan 체크박스도 여전히 `- [ ]` 미완료다.
    즉 "관행으로는 허용, 문서로는 미기술" 상태가 plan 이 스스로 진단한 그대로 남아 있다.
    harness 파일 diff 자체는 서술한 파서 버그 하나에 좁게 국한돼 있어(기능 확장 없음)
    "고친 내용" 은 절제돼 있으나, "고칠 권한이 있는 파일이었는가" 라는 스코프 질문은 이번
    브랜치 안에서 완결되지 않았다.
  - 제안: 이 PR 자체를 막을 사유는 아니다(이미 사용자 결정으로 dispositioned, 투명하게
    기록됨). 다만 `plan/in-progress/spec-draft-nullable-notation-followups.md:451` 체크박스가
    다음 planner 턴에서 `CLAUDE.md` Skill 표 갱신으로 실제로 닫히는지 추적 필요 — 지금
    상태로 머지되면 "문서화 안 된 권한 행사" 선례가 코드베이스에 확정된다.

- **[WARNING]** `dto-jsdoc-citation-guard` 축은 "User 엔티티 컬럼 방어" 와 무관한 별개
  관심사이며, 여전히 같은 절("검출 3축")로 묶여 서술된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(신규,
    115줄), `dto-jsdoc-citation.spec.ts`(신규, 127줄),
    `fixtures/dto/responses/jsdoc-citation.fixture.ts`(신규), `spec/conventions/
    review-citations.md`(§3 정정), `spec/conventions/spec-impl-evidence.md`(§2.1 선례 정정),
    `CHANGELOG.md:3`(제목 "검출 3축"), `:58`(해당 절)
  - 상세: 이 가드가 잡는 것은 응답 DTO 의 JSDoc 에 리뷰 산출물 인용문이 남아 공개 OpenAPI
    `description` 으로 새는지이지, `User` 엔티티 컬럼 노출과는 판정 대상이 다르다. 직전
    라운드(`16_28_58`)가 정확히 이 지점을 WARNING 으로 지적하며 "CHANGELOG 절 제목에서
    3축으로 묶지 말고 두 절로 나눠 적으라" 고 제안했는데, 이번 검토 시점에도
    `CHANGELOG.md:3` 은 여전히 `(검출 3축)` 으로 두 관심사를 하나의 제목 아래 묶고 있다 —
    직전 지적이 반영되지 않았다.
  - 제안: 새 결함은 아니며 이미 CHANGELOG/plan 에 인과관계가 투명히 남아 있어 은폐성
    스코프 크립은 아니다. 다만 다음 정리 기회에 CHANGELOG 절 제목을 "User 컬럼 검출 2축" /
    "DTO JSDoc 주석 위생 검출" 두 절로 분리하는 것을 다시 권한다.

- **[WARNING]** 트리거 `endpoint_path` UNIQUE 충돌 409 상세화(`pg-error.ts` 확장 포함)도
  User 컬럼 방어와 무관한, 게이트 확장이 연쇄적으로 드러낸 별개 spec-impl 갭 수정이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:222`
    (`isEndpointPathUniqueViolation`), `:1607-1608`(`rethrowEndpointPathConflict`),
    `:426`·`:512`(호출부 `.catch()` 배선); `codebase/backend/src/common/db/pg-error.ts:8-11`
    (`PgLikeError.constraint` 필드 추가), `:43-47`(`pgErrorConstraint` 신설);
    `pg-error.spec.ts`(신규)·`pg-error-fixtures.ts`(신규); `CHANGELOG.md:145-157`
  - 상세: 발견 경위 자체가 "User 컬럼 방어 작업이 harness 파서를 고침 → 게이트 범위가
    넓어짐 → 새로 spec-linked 된 영역에서 트리거 계약 갭 발견 → 트리거 서비스 수정" 이라는
    4단 연쇄로, CHANGELOG·plan 에 그대로 서술돼 있어 은폐는 없다. 결과물 자체
    (`pg-error.ts`/`pg-error-fixtures.ts` 의 "두 wrap 표면 단일 SoT" 설계)는 잘 만들어졌지만
    존재 이유가 User 컬럼 방어가 아니다.
  - 제안: 이미 커밋된 순수 additive 수정이라 되돌릴 필요는 없다. plan 은 이미
    `integration-oauth.service.ts` 의 손-작성 constraint 추출 2곳을 `pgErrorConstraint()`
    로 치환하는 후속 작업을 **"범위 확산 지적을 존중해 이번 PR 에서는 하지 않는다"** 고
    명시적으로 보류했다(`:490-503`) — 스코프 규율이 실제로 작동하고 있다는 방증으로, 이
    자체는 긍정적 신호다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 핵심 작업 밖의 파생 갭 수정이지만
  투명하게 disclose 되어 있다 — 조치 불요 (직전 라운드에서 이미 확인, 재확인만)
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 신규 `workspace-rbac.e2e-spec.ts:602`(`it('J. GET /:id/members …')`)가
    `assertMatchesContract` 를 처음 배선하면서 실응답에는 있으나 DTO 에 미선언이던
    `joinedAt` 이 드러나 함께 추가됐다. DTO 인라인 주석(`:82-91`)·CHANGELOG·plan 완료 노트
    세 곳 모두 발견 경위를 명시한다. 이전 라운드가 지적했던 e2e 케이스 라벨 충돌
    (`F.` 중복)도 현재는 `J.` 로 정정되어 재발하지 않는다(`workspace-rbac.e2e-spec.ts:602`
    vs 기존 `:330` `it('F. sole owner …')` — 더 이상 충돌 없음).

- **[INFO]** `codebase/frontend/src/lib/api/workflows.ts` 의 주석 전용 추가는 이번 브랜치의
  핵심 관심사 밖이지만 극히 국소적이고 사유가 분명하다
  - 위치: `codebase/frontend/src/lib/api/workflows.ts:109-123`
  - 상세: consistency 라운드(`review/consistency/2026/09/06/16_29_00` W5)가 지적한
    "`WorkflowVersionDetail` 동명이인 선언의 역참조가 백엔드 쪽에만 있어 프런트 파일을
    여는 사람에게는 안 닿는다"를 양방향으로 만드는 JSDoc 15줄 추가다. 코드 동작 변경
    없음, User 컬럼 방어와 무관하지만 같은 세션의 리뷰→수정 루프가 만든 정당한 부산물이다.

## 요약

핵심 산출물(User 엔티티 컬럼 노출 검출 2축 + e2e 배선 + `WorkflowVersionsService.findOne`
실유출 수정)은 목적에 명확히 부합하고 실측 근거가 충실하다. 그러나 같은 브랜치 안에 이미
여러 라운드에 걸쳐 지적돼 온 세 갈래의 무관한 곁가지 — (1) `CLAUDE.md` 에 명시되지 않은
harness(`.claude/**`) 쓰기 권한 행사(문서화 미완료 상태로 남음), (2) DTO JSDoc 인용 가드
신설, (3) 트리거 `endpoint_path` 409 상세화 — 가 이번 검토 시점에도 그대로 남아 있다. 세
갈래 모두 CHANGELOG/plan 에 인과관계가 투명히 기록돼 있어 은폐성 스코프 크립은 아니며,
plan 은 오히려 추가 확산(`integration-oauth.service.ts` 치환)을 스코프 규율을 이유로
명시적으로 보류하는 등 자기 억제가 작동하고 있다. 다만 (1)의 `CLAUDE.md` 실제 갱신이
미완료로 남아 있는 점과, (2)의 CHANGELOG 제목이 여전히 두 관심사를 "3축" 으로 묶는 점은
다음 라운드에서 재확인이 필요하다.

## 위험도

MEDIUM
