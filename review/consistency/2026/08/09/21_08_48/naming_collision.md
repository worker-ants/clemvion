# 신규 식별자 충돌 검토 — `spec/data-flow/` (--impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD --stat` 실측 결과, 이번 세션의 실제 코드 변경은 다음 2개
파일뿐이다 (둘 다 docstring/주석 수정, 로직 변경 없음):

- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — 캐너리가 세는
  대상이 "`@Roles()` 없는 서브셋(73건)"이 아니라 "`@WorkspaceId()` 소비 라우트 전체(정적
  실측 142건)"임을 명시하는 주석 보강.
- `codebase/backend/src/common/utils/uuid.ts` — `isValidUuid`/`isUuidShaped` 경계를 고정하는
  근거로 `system-status.e2e-spec.ts`(오지목)를 지목하던 것을, 실제 근거인 두 단위 테스트
  (`uuid.spec.ts`, `workspace-context.util.spec.ts`)로 교체하고 그 e2e 가 실제로 고정하는
  별개 불변식(`roles.guard.spec.ts`)을 구분해 서술.

그 외 diff 는 `plan/in-progress/spec-draft-auth-invariants-sync.md` →
`plan/complete/`로의 이동(체크박스·링크 경로 갱신)과 `plan/in-progress/auth-guard-reflection-hardening.md`의
체크박스 완료 표시뿐이며, review 산출물 디렉토리(`review/code/...`, `review/consistency/...`)는
이번 검토 대상이 아니다. `spec/data-flow/**` 자체를 수정하는 diff 는 없다(프롬프트의 대형
번들은 impl-done 컨텍스트용 spec 전문이며, 실제 변경분이 아니다).

이 스코프는 target 이 스스로 명시하듯 "곧 착수할 실제 코드 작업"으로 이미 예고돼 있었고,
직전 세션(`review/consistency/2026/08/09/20_34_07/naming_collision.md`)도 "주석 한 줄
정정이라 새 식별자를 도입하지 않는다"고 사전 판정한 바 있다. 이번 세션은 그 예고가 실제로
그렇게 수행됐는지 diff 로 재확인한다.

## 발견사항

이번 세션에서 새로 발견된 CRITICAL/WARNING 없음. 두 파일 모두 **주석/docstring 본문만**
바뀌었고, 다음 어느 카테고리에도 새 식별자를 도입하지 않는다:

- 요구사항 ID — 없음. 인용된 "142건"·"73건"은 수치이지 ID 가 아니며, 기존 캐너리 로직
  (`assertWorkspaceIdReflectionWorks`)의 동작 설명을 정정한 것뿐 새 요구사항을 신설하지 않는다.
- 엔티티/타입명 — 없음. 함수·클래스·인터페이스 신설 없음.
- API endpoint — 없음.
- 이벤트/메시지명 — 없음.
- 환경변수·설정키 — 없음.
- 파일 경로 — 없음. 기존 파일 2개의 내용만 수정, 신규 파일 생성 없음.

## 확인했으나 충돌 없음 (재검증)

- docstring 이 인용하는 테스트 설명 문자열이 실제 코드와 정확히 일치하는지 실측(`git grep`)
  으로 재확인했다 — 존재하지 않는 테스트명을 새로 지어내 마치 기존 캐너리인 양 서술했다면
  "가짜 식별자 도입"에 해당하므로 이 관점에서 확인 대상이다:
  - `uuid.spec.ts:55` — `it('accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)', ...)` — docstring 인용과 정확히 일치.
  - `workspace-context.util.spec.ts:134` — `it('Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)', ...)` — 일치(plan 문서의 구 라인 번호 `:135` 는 `:134` 로 갱신됨, 별도 정합성 관점).
  - `roles.guard.spec.ts:337` — `it('형식이 깨진 헤더여도 전역 라우트는 400 을 내지 않는다 — 단축이 헤더 파싱보다 먼저다', ...)` — 일치.
  세 인용 모두 기존에 존재하던 테스트를 정확히 가리키며, 새 이름을 발명하거나 기존 동명
  테스트와 다른 의미로 재사용하지 않는다.
- `spec/data-flow/12-workspace.md` §Rationale "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터
  — UUID 검증 강도 비대칭 (2026-08-09)" — docstring 이 이 섹션을 SoT 로 인용하는데, 실제
  bundle 상 해당 섹션이 이미 존재함을 확인(§1860 부근). 신규 섹션을 만들며 기존 동일 제목과
  충돌하는 상황이 아니라, **기존 섹션을 가리키는 참조**일 뿐이다.
- `isValidUuid`/`isUuidShaped`/`assertWorkspaceIdReflectionWorks`/`handlerConsumesWorkspaceId` —
  모두 이번 diff 이전부터 존재하던 함수명이며 이번 변경은 그 함수들의 **동작을 설명하는 주석
  문구만** 고쳤다. 새 함수·새 이름 도입 없음.
- plan 문서 쪽(`spec-draft-auth-invariants-sync.md`, `auth-guard-reflection-hardening.md`)도
  체크박스 완료 표시·PR 번호(`#1112`) 기록·상대경로 갱신뿐, 신규 plan ID·신규 섹션 제목
  충돌 없음.

## 요약

이번 세션의 실제 diff 는 `workspace-reflection-canary.ts`·`uuid.ts` 두 파일의 docstring/주석
정정과 관련 plan 문서 2건의 체크박스·경로 갱신으로 한정되며, `spec/data-flow/**` 를 포함해
어느 spec 파일도 수정하지 않는다. 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
환경변수·설정키·파일 경로 중 어느 것도 새로 도입되지 않았고, docstring 이 인용하는 세 개
테스트명·한 개 spec 섹션 제목은 모두 실측 결과 기존에 존재하는 대상을 정확히 가리킨다.
신규 식별자 충돌 관점에서 이번 target 은 검토 대상 자체가 사실상 없다.

## 위험도

NONE
