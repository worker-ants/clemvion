# 보안(Security) 리뷰 — workspace-path-guard (5라운드)

## 범위

`codebase/**` 30개 파일. 핵심 변경: 경로 파라미터(`/workspaces/:id/...`, `/auth/workspaces/:id/switch`)로
전달되는 워크스페이스 ID를 `RolesGuard`가 인가 대상으로 판정하도록 하는 `@WorkspaceParam` 데코레이터
신설(`codebase/backend/src/common/decorators/workspace.decorator.ts`), `RolesGuard`
(`codebase/backend/src/common/guards/roles.guard.ts`) 확장, 역할 서열 단일화
(`codebase/backend/src/common/constants/workspace-roles.ts`), 서비스 계층 인가 순서 정정
(`workspaces.service.ts`), 정적 저장소 가드(`workspace-param-binding-guard.ts`) 신설, 그리고 이를
검증하는 광범위한 unit/e2e 테스트. 1~4라운드에서 이미 Critical 0 · Warning 30건이 처분되어 있어(각
RESOLUTION.md), 본 라운드는 그 이후 diff에 남은 잔여 이슈를 찾는 데 집중했다.

## 발견사항

이번 라운드에서 신규 Critical/Warning 급 보안 결함은 발견하지 못했다. 핵심 인가 로직을 아래 관점으로
직접 추적했고, 모두 의도대로 닫혀 있음을 확인했다.

- **인가 우회(IDOR/cross-tenant)**: `RolesGuard.canActivate`가 `workspaceParamNamesOf`로 핸들러의
  `@WorkspaceParam` 등록 이름을 읽어 `request.params[name]`(가드는 파이프보다 먼저 돌아 **원문**을
  본다)에 대해 `assertMember`를 매 요청 호출한다(`roles.guard.ts:154-168`). 이전에는 `@Param('id',
  ParseUUIDPipe)`로만 받아 가드가 인식하지 못했고(`handlerConsumesWorkspaceId`가 false), 인가는
  서비스 계층에서만 이루어져 `transferOwnership`처럼 `@Roles('owner')`가 붙은 라우트조차 헤더·토큰의
  워크스페이스로 판정되는 구멍이 있었다 — 이번 diff가 그 구멍을 구조적으로 닫는다. `roles.guard.spec.ts`의
  `경로 워크스페이스(@WorkspaceParam)가 인가 대상이다` 스위트가 "토큰 워크스페이스의 owner여도 경로
  워크스페이스의 비멤버면 거부", "헤더에 자기 owner 워크스페이스를 실어도 경로 워크스페이스 기준으로
  거부"를 직접 단언하고, `workspace-path-guard.e2e-spec.ts`도 실 DB로 같은 두 방향(헤더 위장 성공/실패)을
  왕복 확인한다.
- **정보 노출(존재/유형 오라클)**: `workspaces.service.ts`의 `addMemberByEmail`·`leaveWorkspace`·
  `transferOwnership`이 이전에는 워크스페이스를 먼저 조회해 비멤버가 "없음(404)·개인·팀"을 구분할 수
  있었다(`spec/data-flow/12-workspace.md` §Rationale). 이번 diff에서 인가(멤버십/역할)를 조회보다
  먼저 수행하도록 재배치했고(`workspaces.service.ts:256-262`, `645-651`, `719-727`), `workspaces.
  service.spec.ts`의 `비멤버에게 워크스페이스 존재·유형을 드러내지 않는다` 스위트가 `workspaceRepo.
  findOne`이 호출되지 않았음까지 직접 단언한다. `workspace-path-guard.e2e-spec.ts`도 비멤버가 팀·
  개인·부재 워크스페이스 전부에 대해 동일한 `403 NOT_A_MEMBER`를 받는지 실 DB로 확인한다.
- **에러 처리(코드 없는 403 → 코드 있는 403)**: 거부 사유가 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/
  `ADMIN_REQUIRED`/`OWNER_REQUIRED`로 명시화됐고, `NOT_A_MEMBER`·`ROLE_REQUIRED` 객체가 스프레드
  (`{ ...NOT_A_MEMBER }`)로 던져져 요청 간 공유 객체가 새지 않는다(`workspace-roles.ts:39-47`).
  민감 정보(스택트레이스, DB 값 등)가 메시지에 실리지 않는다.
- **역할 서열 단일화로 인한 fail-open 방지**: `Object.hasOwn(WORKSPACE_ROLE_LEVEL, role)`로
  prototype-key(`constructor`, `__proto__` 등) 오염을 막고(`workspace-roles.ts:20-24`,
  `workspace-roles.spec.ts`가 직접 검증), `Roles(...roles: WorkspaceRoleName[])`로 타입을 좁혀
  오탈자로 인한 요구 소실을 컴파일 단계에서 차단한다.
- **형식 검증 순서**: 가드는 `ParseUUIDPipe`보다 먼저 돌아 미검증 원문을 보므로, `isUuidShaped`로
  형식만 먼저 거른 뒤(`roles.guard.ts:159-162`) 형식이 아니면 조회 없이 넘긴다 — Postgres
  `22P02`(파싱 불가) 에러가 500으로 마스킹되는 것을 방지하는 기존 관례(`common/utils/uuid.ts`)를
  올바르게 재사용했다. nil UUID처럼 형식은 맞지만 존재하지 않는 값은 조회 후 403으로 처리되어 응답이
  400/403/404 중 하나로 뒤섞이지 않는다.
- **정적 가드(`workspace-param-binding-guard.ts`)**: 이름 휴리스틱(`workspaceId` 또는
  `*WorkspaceId` 접미) 기반이라 별칭 import(`Param as P`)나 규칙 밖 이름(`id` 단독 등, 이 저장소
  전수 실측상 해당 없음)은 놓칠 수 있음이 docstring에 명시돼 있다. 이는 신규 결함이 아니라 이미
  문서화된 한계이며, 1차 방어선은 이 정적 가드가 아니라 런타임 `RolesGuard`의 reflection이다.
  참고용 INFO로만 남긴다 — 새 코드가 `@Param`으로 워크스페이스 ID를 바인딩하면서 이름도 규칙 밖으로
  짓는 경우에만 이 가드를 우회하고, 그 경우도 가드가 인식하지 못하므로 멤버십 검증 자체가 조용히
  빠지는(즉 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 둘 다 false) 종전 클래스의 결함으로
  회귀할 뿐, 이번 diff가 새로 만든 구멍은 아니다.
- **SQL 인젝션/커맨드 인젝션**: 신규 코드 경로는 모두 TypeORM 파라미터 바인딩(`getMemberRole`,
  `findOne` 등)을 사용하며 원문 문자열을 직접 쿼리에 연결하는 자리가 없다. `isUuidShaped` 정규식은
  고정 길이·비중첩 패턴이라 ReDoS 우려도 없다.
- **하드코딩된 시크릿**: 신규/변경 파일에 API 키·비밀번호·토큰 등 하드코딩된 자격증명 없음(테스트
  픽스처의 이메일·UUID·에러 메시지 문자열뿐).
- **프런트엔드(`role-gate.tsx`)**: 역할 서열 상수의 출처를 가리키는 주석만 갱신됐고, `RoleGate`는
  UI 노출 제어일 뿐 실제 인가는 백엔드 `RolesGuard`가 담당한다는 기존 설계(문서화됨)를 그대로 유지한다
  — 클라이언트 신뢰 문제 없음.

## 요약

`@WorkspaceParam` + `RolesGuard` reflection 확장은 경로 파라미터로 전달되는 워크스페이스 ID가
헤더·토큰 컨텍스트와 별개로 인가 대상이 되지 않던 cross-tenant 클래스의 결함을 구조적(fail-closed
canary + 정적 가드 + 런타임 가드 3중)으로 닫았다. 서비스 계층의 인가-선-조회 순서 정정으로 비멤버에게
워크스페이스 존재·유형이 노출되던 오라클도 함께 제거됐고, 거부 코드 통일로 계층 간 정보 불일치도
없앴다. 핵심 분기(다중 경로 파라미터, 헤더+경로 혼합, 형식 불량 입력, 헤더 위장 양방향)를 unit·e2e
양쪽에서 대조 케이스로 직접 검증하고 있어 회귀 방지력도 높다. 이번 라운드 diff에서 새로 도입된
Critical/Warning급 보안 결함은 발견되지 않았다.

## 위험도

NONE
