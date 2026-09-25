# 정식 규약 준수 검토 — workspace-guard-followups (`--impl-prep`)

## 검토 범위 및 방법

- 모드: `--impl-prep`. target 은 스코프 디렉토리(`prep2-scope/spec`)로, 실제로는 워크트리의
  `spec/2-navigation/4-integration.md` · `spec/2-navigation/9-user-profile.md` ·
  `spec/5-system/1-auth.md` · `spec/data-flow/12-workspace.md` 4개 파일과 바이트 단위로 동일함을
  `diff -q` 로 먼저 확인했다(스크래치패드 사본 = 현재 워크트리 원본).
- 프롬프트 번들은 컨텍스트 예산 초과로 4개 target 파일 본문과 대부분의 `spec/conventions/**` 문서를
  절단했다 — `error-codes.md` · `spec-impl-evidence.md` · `swagger.md` · `migrations.md` ·
  `audit-actions.md` · `frontend-layering.md` 를 포함해 관련 규약 원문을 저장소에서 직접 `Read` 로
  재확인했다(번들 부재를 "규약 없음"으로 취급하지 않았다).
- `plan/in-progress/workspace-guard-followups.md` 로 이 작업이 `#1399`(경로 워크스페이스 가드,
  `spec_impact: none` 순수 리팩터)의 후속 정리이며 spec 변경을 의도하지 않음을 확인했다. 또한 동일
  scope 를 다룬 직전 라운드 두 산출물 — `review/consistency/2026/09/25/18_42_32/convention_compliance.md`
  (risk **NONE**) · 같은 라운드의 `naming_collision.md`(risk **LOW**) — 를 대조해, 이번 라운드가
  새로 봐야 할 것은 "그 라운드가 이미 NONE 판정한 동일 4개 spec 문서가 여전히 규약을 지키는가" 임을
  확인했다.

## 규약 대조 상세

1. **명명 규약** — 4개 문서에 등장하는 wire 에러 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` ·
   `ADMIN_REQUIRED` · `OWNER_REQUIRED` · `WORKSPACE_ID_REQUIRED` · `VALIDATION_ERROR` 등)는 전부
   `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 를 지킨다. `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의
   `PRIVATE` historical-artifact 는 `error-codes.md §3` 레지스트리에 정확히 링크돼 있다
   (`4-integration.md` L876). `id: integration` / `id: user-profile` / `id: auth` frontmatter 는
   저장소 전수 grep 상 다른 문서와 충돌하지 않는다.
2. **출력 포맷 규약** — `12-workspace.md` "가드 거부의 오류 코드" 절이 선언하는 4개 코드
   (`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)가 `spec/5-system/3-error-handling.md`
   §1.2 카탈로그에 그대로 등재돼 있음을 확인했다(카탈로그가 프롬프트 번들에서는 target 밖이라
   직접 `Read` 로 대조). `9-user-profile.md` L370 의 `GET /workspaces/:id/settings` 비-멤버
   `403 NOT_A_MEMBER` 서술도 동일 카탈로그와 일치한다.
3. **문서 구조 규약** — `1-auth.md`·`12-workspace.md` 는 Overview/번호 본문/Rationale 3섹션 구조를
   갖춘다. `12-workspace.md` 는 `spec-impl-evidence.md §1` 이 `spec/data-flow/**` 를 frontmatter
   의무에서 **명시적으로 제외**한 대상이라, frontmatter 부재는 위반이 아니라 규약이 예정한 상태다.
   `4-integration.md`(`status: implemented`)·`9-user-profile.md`(`status: partial` +
   `pending_plans:` 존재)의 frontmatter 는 §3 라이프사이클 요건을 충족한다.
4. **API 문서 규약(Swagger)** — `swagger.md §5-4` 체크리스트("`@Roles(...)` 가 붙었거나
   `@WorkspaceId()`·`@WorkspaceParam(...)` 을 소비하는 엔드포인트는 `@ApiForbiddenResponse` 필수,
   설명에 요구 역할과 코드 명시")는 이번 plan 의 요구 2("`FORBIDDEN_*_ROUTE` 상수가 `NOT_A_MEMBER.code`·
   `ROLE_REQUIRED.*.code` 를 보간")가 정확히 지키려는 그 규약이다. 현재 컨트롤러의
   `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 하드코딩 문자열은
   `common/constants/workspace-roles.ts` 의 실제 값(`NOT_A_MEMBER.code === 'NOT_A_MEMBER'`,
   `ROLE_REQUIRED.admin.code === 'ADMIN_REQUIRED'`, `ROLE_REQUIRED.owner.code === 'OWNER_REQUIRED'`)과
   문자열이 이미 동일함을 확인했다 — 즉 계획된 보간 리팩터는 렌더링 결과를 바꾸지 않는 순수
   내부 정리이며, 대상 spec 문서(4개)가 서술하는 어떤 문구·코드도 이 리팩터로 어긋나지 않는다.
5. **금지 항목** — `12-workspace.md` §Rationale "74번째 라우트 문제는..." 절이 opt-in 마커 재도입
   금지를 스스로 재확인하고 `@WorkspaceParam` 이 그 금지의 예외가 아님을 논증한 것을 재검토했고,
   금지 위반 소지가 없음을 재확인했다.

## 발견사항

- **[INFO]** `common/constants/workspace-roles.ts` 가 `1-auth.md` frontmatter `code:` 에 없음
  - target 위치: `spec/5-system/1-auth.md` frontmatter (파일 상단 `code:` 리스트)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (`code:` = "본 spec 이 약속한 surface 의
    구현 경로") — 엄밀한 위반은 아니고 완성도 제안. 가드(`spec-code-paths.test.ts`)는 글로브 ≥1건
    매치만 요구하므로 이 상태로도 빌드는 통과한다.
  - 상세: `code:` 는 `workspace-roles-attachment.spec.ts`(가드 테스트)는 등재했지만, 그 가드가
    검증하는 원본 모듈 `common/constants/workspace-roles.ts`(`NOT_A_MEMBER`·`ROLE_REQUIRED`·
    `ADMIN_ROLES`·`WORKSPACE_ROLE_LEVEL` 의 단일 SoT, `1-auth.md` §3·Rationale 이 서술하는 RBAC
    판정표 그 자체의 구현)는 어떤 glob(`common/guards/*.ts`, `common/decorators/*.ts`,
    `common/utils/*.ts`)에도 걸리지 않는다. `common/constants/**` 패턴이 리스트에 없다.
  - 제안: 이번 plan 이 바로 이 파일(`workspace-roles.ts`)의 소비처를 정리하는 작업이므로, 같은
    커밋에서 `- codebase/backend/src/common/constants/workspace-roles.ts` (또는
    `common/constants/*.ts`)를 `1-auth.md` frontmatter `code:` 에 추가하면 evidence 완결성이
    올라간다. 필수 아님 — 현재도 가드는 통과한다.

- **[INFO]** `spec/2-navigation/*.md` 도메인 전반이 `## Overview` 표제를 쓰지 않음 (18개 중 17개,
  `4-integration.md`·`9-user-profile.md` 포함)
  - target 위치: `spec/2-navigation/4-integration.md` · `spec/2-navigation/9-user-profile.md`
    (frontmatter 직후 바로 `## 1. …` 로 시작, 별도 `## Overview` 섹션 없음)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 — 이 항목은
    "권장" 이며 `spec/conventions/**` 파일이 강제하는 build 가드는 없다.
  - 상세: 이 두 문서만의 특이점이 아니라 `2-navigation/` 영역 18개 파일 중 17개가 동일 패턴이다
    (예외는 `6-config.md` 1개뿐, grep 실측). 즉 이 task 가 이 4개 문서 중 2개에서 만든 새 이탈이
    아니라 해당 도메인의 기존 문서 관행이다.
  - 제안: 조치 불요 — 이번 plan 범위(코드 리팩터, `spec_impact: none`)와 무관하다. 도메인 전체의
    구조를 통일하고 싶다면 별도 project-planner 턴으로 다뤄야 할 규모(17개 파일)라 이 PR 에 묶지
    않는다.

CRITICAL/WARNING 없음.

## 요약

target(`4-integration.md`·`9-user-profile.md`·`1-auth.md`·`12-workspace.md`)은 직전 라운드
(`review/consistency/2026/09/25/18_42_32`)에서 이미 정식 규약 준수 risk **NONE** 으로 판정됐고,
이번 라운드가 그 판정 이후 달라진 것이 없는 동일 파일들을 독립적으로 재검증한 결과도 동일하다 —
에러 코드 명명(`UPPER_SNAKE_CASE`)·카탈로그 등재·frontmatter 라이프사이클·swagger 체크리스트·
opt-in 마커 금지 어느 축에서도 새로운 CRITICAL/WARNING 을 찾지 못했다. 이번 plan(`FORBIDDEN_*_ROUTE`
상수의 코드 보간)은 우연이 아니라 `swagger.md §5-4` 가 이미 요구하는 패턴을 하드코딩에서 단일
소스(`common/constants/workspace-roles.ts`) 참조로 강화하는 작업이라, 진행해도 대상 spec 문서와
어긋날 위험이 없다. 남는 두 INFO 는 각각 "그 상수 모듈을 frontmatter 에도 등재하면 더 완결적"이라는
제안과, task 범위 밖의 기존 도메인 패턴(2-navigation 의 Overview 표제 생략) 지적일 뿐이다.

## 위험도

NONE
