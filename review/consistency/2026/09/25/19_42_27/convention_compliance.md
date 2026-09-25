# 정식 규약 준수 검토 — workspace-guard-followups (`--impl-done`)

## 검토 범위 및 방법

- 모드: `--impl-done`. 프롬프트의 target 번들(`done2-scope/spec`)은 컨텍스트 예산 초과로
  거의 전부(`2-navigation/4-integration.md`·`9-user-profile.md`·`5-system/1-auth.md`·
  `conventions/redis-keys.md`·`data-flow/12-workspace.md`·`<git diff>` 6개)가 절단됐다. 절단된
  파일은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/workspace-guard-followups`,
  이 세션의 CWD 와 동일)에서 절대경로로 직접 `Read`/`git diff`/`grep` 하여 재확인했다 — 번들 부재를
  "규약 없음"으로 취급하지 않았다.
- 실제 구현 diff(`git diff origin/main...HEAD -- codebase`, 8파일/291줄)를 전문 확인했다: 대상은
  `common/constants/workspace-roles.ts`(docstring 갱신) · `common/decorators/workspace.decorator.ts`
  (reflection 공통 헬퍼 추출) · `auth.controller.ts`/`executions.controller.ts`/
  `workspaces.controller.ts`(`@ApiForbiddenResponse` 설명 문자열을 하드코딩에서 코드 보간으로) ·
  `integrations.service.ts`(로컬 `ADMIN_ROLES` 제거, 공용 상수로 교체) ·
  `workspaces.service.ts`/`.spec.ts`(이양 거부 객체 스프레드, docstring 정정, unit 보강).
  spec 파일 변경은 0건 — `plan/in-progress/workspace-guard-followups.md` 의 `spec_impact: none`
  (동작 불변 리팩터) 선언과 일치한다.
- 직전 두 라운드 — `--impl-prep`(`review/consistency/2026/09/25/19_06_16/convention_compliance.md`,
  위험도 NONE) 와 그 이전 `#1399` 라운드(`18_42_32`) — 가 이미 이 plan 이 다루는 4개 spec 문서와
  `swagger.md §5-4`/`error-codes.md` 대조를 마쳤음을 확인했다. 이번 라운드는 "그 계획대로 실제
  구현됐는가, 새 이탈이 없는가" 를 코드 대 규약으로 재검증하는 데 집중했다.

## 규약 대조 상세

1. **명명 규약** — 이번 diff 는 새 에러 코드·API endpoint·DTO 를 신설하지 않는다. 보간에 쓰인
   `NOT_A_MEMBER.code`/`ROLE_REQUIRED.{editor,admin,owner}.code` 는 기존 `UPPER_SNAKE_CASE`
   상수(`error-codes.md §1`)를 그대로 참조만 한다. `integrations.service.ts` 의 로컬
   `ADMIN_ROLES = new Set(['owner','admin'])` 를 제거하고 공용
   `common/constants/workspace-roles.ts` 의 동명 상수로 교체한 것을 실제 코드에서 확인했다
   (`grep ADMIN_ROLES` — 저장소 전수 3개 소비처가 모두 같은 import 를 쓴다, 중복 정의 0건). 직전
   라운드(`18_42_32`)의 naming_collision WARNING("동명이인 `ADMIN_ROLES` 두 벌")이 이 diff 로
   완전히 해소됐다.
2. **출력 포맷 규약** — `swagger.md §5-4` 체크리스트("`@Roles()` 가 있으면 요구 역할과 코드 명시,
   없으면 `NOT_A_MEMBER` 로 통일")가 요구하는 패턴을, 하드코딩 리터럴에서
   `common/constants/workspace-roles.ts` 참조로 전환했다. 보간 후 렌더링되는 문자열은 코드 값이
   교체 전과 동일(`NOT_A_MEMBER.code === 'NOT_A_MEMBER'` 등, 직전 라운드가 확인한 사실)하므로
   OpenAPI 산출물이 바뀌지 않는다 — plan 이 "뮤턴트를 걸지 않은 이유"로 적은 것과 일치. `swagger.md`
   §3 Rationale 의 DTO `description` 길이 집계 규칙("템플릿 리터럴·변수 참조는 세지 않는다")은
   대상이 `dto/**/*.dto.ts` 로 한정돼 있고, 이번 diff 는 컨트롤러의 `@ApiForbiddenResponse`
   문자열만 바꿔 그 규칙의 적용 대상 밖이다 — 저촉 없음.
3. **문서 구조 규약** — spec 파일 변경 0건이라 Overview/본문/Rationale 구조·frontmatter 관련
   신규 위반 소지가 없다. `plan/in-progress/workspace-guard-followups.md` frontmatter 는
   `spec_impact: none`(bare, 리스트 아님 — Gate C 요구 형식 충족) · `worktree:
   workspace-guard-followups`(실제 워크트리 디렉터리명과 일치)를 갖춘다.
4. **API 문서 규약(Swagger)** — `workspace-reflection-canary.ts` 를 직접 읽어 부트 캐너리가
   여전히 `handlerConsumesWorkspaceId` · `workspaceParamNamesOf` 를 **top-level export 그대로**
   호출함을 확인했다 — `spec/5-system/1-auth.md` §"부트 캐너리" ("판별에는
   `handlerConsumesWorkspaceId` 를 **그대로 호출**한다") 가 요구하는 불변식과 일치한다. 새로
   추출된 공용 헬퍼 `routeArgEntriesMatching` 은 두 판별 함수 **내부**에서만 쓰이고 캐너리의
   import/호출 대상은 그대로다 — plan 이 스스로 적은 W1 처리("top-level export 는 그대로 두고
   내부만 공용 헬퍼를 부른다")가 실제 코드에 반영됐다.
5. **금지 항목** — `data-flow/12-workspace.md` 가 명시적으로 기각한 "라우트별 opt-in 마커"
   패턴(`SetMetadata`+`Reflector`)의 재도입 여부를 캐너리 파일에서 재확인했다 — 이번 diff 도
   여전히 그 패턴을 쓰지 않는다(팩토리 identity 비교 유지). 새로 발행되는 에러 코드
   문자열·historical-artifact 재사용도 없다.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** `workspaces.service.ts` `transferOwnership` docstring 정정이 스스로 실측을 인용
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (diff 상단,
    `transferOwnership` JSDoc)
  - 위반 규약: 해당 없음 — 규약 위반이 아니라 **모범 사례로 기록**하는 INFO.
  - 상세: "두 멤버를 단일 `IN` 쿼리로 동시에 락" 이라는 종전 문장을 "그 문장을 넣은 `eb009f99c` 의
    구현부터 순차 `findOne` 두 번이었다" 로 정정하며 커밋 SHA 로 실측 근거를 남겼다. 이 문장은
    `codebase/**` 내부 docstring이라 CLAUDE.md 의 "자기-반증형 소정정"(spec/ 문서 전용 예외) 대상은
    아니지만, 그 조항이 요구하는 정신 — 실측을 정정문에 함께 싣기 — 을 그대로 실천했다.
  - 제안: 조치 불요.

## 요약

이번 diff(8파일/291줄)는 `#1399` 후속 정리로, 새 API·DTO·에러 코드를 신설하지 않고 기존
`swagger.md §5-4`("`@Roles()` 없는 워크스페이스 라우트는 `NOT_A_MEMBER`, 있으면 역할별 코드 명시")를
하드코딩 문자열에서 `common/constants/workspace-roles.ts` 보간으로 강화했으며, 렌더링 결과 문자열은
불변이라 OpenAPI 계약을 깨지 않는다. 부트 캐너리가 판별 함수를 "그대로 호출"해야 한다는
`spec/5-system/1-auth.md` 의 불변식은 리팩터 후에도 코드로 확인했고, 직전 라운드가 지적한
`ADMIN_ROLES` 동명이인 중복도 이번 diff 로 완전히 해소됐다(3개 소비처 전부 단일 공용 상수).
`spec_impact: none` 선언과 실제 변경 범위(codebase 리팩터, spec 파일 변경 0건)가 일치하며, 명명·
출력 포맷·문서 구조·Swagger 데코레이터·금지 패턴 어느 축에서도 새로운 CRITICAL/WARNING 을 찾지
못했다.

## 위험도

NONE
