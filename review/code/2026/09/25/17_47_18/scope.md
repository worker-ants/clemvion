# 변경 범위(Scope) 리뷰 — 2026/09/25 17_47_18 (4라운드)

## 개요

28개 파일 전부가 하나의 plan(`plan/in-progress/workspace-path-guard-impl.md`)·spec
(`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" · "가드
거부의 오류 코드")으로 수렴한다 — **`RolesGuard` 가 경로 파라미터로 받는 워크스페이스(`@WorkspaceParam`)도
인가 대상으로 보게 확장**하는 단일 기능이다. 파일 수는 많지만 구조는 다음 4개 축으로 깔끔히 나뉜다:

1. 핵심 구현 — `workspace.decorator.ts`(`WorkspaceParam`·`workspaceParamNamesOf`),
   `roles.guard.ts`(경로 분기 + 코드 부여), `workspace-roles.ts`(신설 — 서열·거부 본문 단일 표),
   `workspace-reflection-canary.ts`(두 팩토리 동시 카운트)
2. 소비처 전환 — `workspaces.controller.ts` 14곳 · `auth.controller.ts` 1곳을 `@Param`→`@WorkspaceParam`,
   서비스 계층(`workspaces.service.ts`·`workspace-invitations.service.ts`·`auth.service.ts`) 거부 코드를
   공유 상수로 교체
3. 회귀 방지 — 신설 repo-guard `workspace-param-binding`(평범한 `@Param` 으로 워크스페이스를 받는 자리 금지),
   기존 repo-guard `param-uuid-pipe` 확장(모집단 유지)
4. 테스트 — 각 축에 대응하는 unit/e2e, 그리고 `source-scan.ts` 공유 헬퍼 추출(2라운드 WARNING 처분)

파일별 근거가 코드 주석·docstring에 명시적으로 남아 있어(예: "2026-09-25 경로 워크스페이스 15곳을
`@Param` 에서 옮기며 이 가드의 모집단이 136 → 121 로 줄 뻔했다") 각 파일이 왜 이 PR에 포함됐는지 추적 가능하다.
무관한 모듈(edges·nodes·triggers·knowledge-base 등)은 `workspace-roles-attachment.spec.ts` 의 **기존**
import 목록에만 남아 있고 이번 diff 로 손대지 않았다.

## 발견사항

- **[INFO]** `RolesGuard` 의 거부 코드 부여가 경로(path) 라우트뿐 아니라 기존 헤더/토큰 컨텍스트
  라우트(`@Roles()` 전체)까지 함께 바뀐다 — 제목("workspace-path-guard")의 문자적 범위보다 넓다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` — `canActivate`/`assertMember`
    (게이트 133~230행 부근, `## 거부 코드 (2026-09-25~)` docstring)
  - 상세: 종전엔 `@Roles()` 거부가 전부 코드 없는 `false`(전역 필터 기본값 `FORBIDDEN`)였는데, 이번
    변경으로 경로 라우트뿐 아니라 `editorOnly`/`adminOnly` 같은 기존 헤더-컨텍스트 라우트의 거부도
    `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 코드를 싣는다
    (`roles.guard.spec.ts` 의 `expectRoleOutcome` 헬퍼 전면 교체가 그 증거). 이는 "경로 워크스페이스도
    본다" 는 타이틀보다 넓은 API 응답 계약 변경이며, 클라이언트가 종전 `FORBIDDEN` 코드에 의존했다면
    영향을 받는다.
  - 다만 이 확장은 우연이 아니라 **docstring 에 명시적으로 자기 정당화**돼 있다 — "새 경로에만 코드를
    붙이면 같은 실패가 경로에 따라 다른 본문을 내므로 전 경로를 함께 바꿨다" — 그리고 spec 문서
    (`12-workspace.md` §Rationale "가드 거부의 오류 코드")에 근거가 등재돼 있다고 기재돼 있다. 따라서
    "의도 이상의 변경"이라기보다 "의도가 스스로 넓힌 변경이고 그 사실이 문서화됨"에 가깝다 — 액션이
    필요한 결함이 아니라 리뷰 기록용 INFO로 남긴다.
  - 제안: 이미 3라운드 리뷰를 거친 사안이라면 추가 조치 불필요. 다만 API 소비자(FE)가 종전
    `FORBIDDEN` 코드를 문자열 비교하는 곳이 있는지 한 번은 확인할 가치가 있다(이 리뷰의 diff 에는
    FE 코드가 없어 범위 밖).

- **[INFO]** `Roles()` 데코레이터 시그니처를 `string[]` → `WorkspaceRoleName[]` 로 좁힘 — 저장소 전역의
  모든 `@Roles(...)` 호출부(이 diff 에 없는 `edges.controller.ts`·`nodes.controller.ts`·
  `triggers.controller.ts`·`knowledge-base.controller.ts` 포함)에 영향을 주는 타입 변경이다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:38` (`export const Roles = (...roles: WorkspaceRoleName[]) =>`)
  - 상세: "경로 워크스페이스 가드" 기능 자체와는 직접 관련이 적은 방어적 타입 강화(오탈자 컴파일
    차단)다. 다만 `workspace-roles.ts` 신설(서열 단일화)의 자연스러운 부산물이고, 컴파일 타임에만
    영향을 주며(런타임 무해) 저장소의 다른 컨트롤러들은 이미 등록된 역할 이름만 쓰고 있어 실제
    breaking 은 없다(`roles.guard.spec.ts` 의 `@ts-expect-error` 테스트가 이를 build 타입체크
    ratchet 으로 고정). Over-engineering 이라기보다 합리적인 부수 효과로 판단된다.
  - 제안: 조치 불필요. 기록용.

- **[INFO]** 신설 repo-guard `workspace-param-binding`(파일 20/23/24)은 "경로 워크스페이스 가드"라는
  기능명보다 넓은 새 CI 강제 규칙(정적 분석)을 도입한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts` (신규 파일 전체)
  - 상세: 기능 확장처럼 보이지만, 이 저장소는 이미 유사한 회귀-방지 정적 가드 패턴
    (`param-uuid-pipe-guard.ts`)을 관례로 쓰고 있고, 이 신설 가드는 정확히 이번 PR이 고친 결함
    (경로 워크스페이스가 평범한 `@Param` 으로 되돌아가는 것)의 재발을 막는 목적이라 방향이 명확하다.
    Over-engineering 보다는 기존 컨벤션을 그대로 답습한 것으로 판단된다.
  - 제안: 조치 불필요.

- **[INFO]** `source-scan.ts`/`source-scan.spec.ts` 의 `decoratorCallName` 추출(파일 1/2)은 이번
  라운드의 기능과 직접 관련은 없어 보이지만, docstring 이 "2라운드 리뷰(`16_39_25`) maintainability
  WARNING 처분"이라고 명시한다 — 같은 세션의 선행 리뷰 결과를 반영한 DRY 정리로, drive-by 리팩토링이
  아니라 추적 가능한 처분이다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:83`(`decoratorCallName` 신설)
  - 제안: 조치 불필요.

전반적으로 포맷팅-only 변경, 무관한 임포트 정리/추가, 설정 파일 변경, 목적 없는 주석 수정은 관찰되지
않았다. 남아 있던 "가드 층은 이 라우트를 막지 못한다" 류의 stale 주석은 취소선(`~~...~~`)으로 원문을
보존한 채 정정돼 있어(`workspaces.service.ts`, `workspaces.service.spec.ts`) 이 저장소의 자기-반증형
소정정 관례를 따른다.

## 요약

28개 파일은 표면적으로 크지만 단일 plan/spec 으로 수렴하는 하나의 응집된 보안 기능(경로 파라미터
워크스페이스에 대한 `RolesGuard` 인가 확장)이며, 핵심 구현·소비처 전환·회귀방지 가드·테스트의 4개 축이
서로를 설명한다. 눈에 띄는 두 지점(전 `@Roles()` 라우트로의 거부-코드 확장, `Roles()` 타입 좁힘)은
기능명보다 넓은 blast radius를 갖지만 둘 다 코드 주석과 spec Rationale에 명시적으로 정당화돼 있어
"의도치 않은 확장"이 아니라 "의도가 자기 설명과 함께 넓어진 것"으로 판단된다. drive-by 포맷팅·무관한
임포트·불필요한 주석 변경은 발견되지 않았다.

## 위험도

LOW
