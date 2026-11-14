---
id: "CLE-ACCT-WS-AUTHZ"
title: "워크스페이스와 멤버 — API 인가"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-WS"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-WS"]
area: "CLE-ACCT"
content_hash: "8ac5a587bc6c92847469c7bcc8d529080728e5e64983aaf55b54d644f4645759"
read_as: "approved_fallback"
task: "CLE-T-ZPPWK4"
source_paths: []
mirror_sha256: "4e0ac8a0bd84799b864846ef1d0eb6e592546f97186497078a3aa5ac8d66e091"
etag: "sha256-8c4f7ced07cca2d40defcdaa1713ddd8633d74cb781c0e2267392c3252fbc1fc"
---
## 개요

이 문서는 [워크스페이스와 멤버](CLE-ACCT-WS.md) 의 하위 문서로 서버가 요청마다 현재 워크스페이스와 역할을 판정하는 인가 규칙을 정한다. 가드의 멤버십 검증, 경로 파라미터로 받는 워크스페이스, 가드 거부 에러 코드, `X-Workspace-Id` 형식 검사, 부팅 때의 가드 인식 자가 검사를 다룬다.

## API 인가

요청마다 서버가 워크스페이스와 역할을 판정하는 순서는 다음과 같다.

1. 요청을 받으면 액세스 토큰을 검증한다.
2. 현재 워크스페이스와 역할을 정한다. `jwt.strategy` 의 토큰 클레임 해석은 [전환 API 와 토큰](CLE-ACCT-WS-SPACE.md#전환-api-와-토큰) 과 같다. 워크스페이스 컨텍스트는 헤더 우선이다. `WorkspaceId` 데코레이터와 `RolesGuard` 는 `X-Workspace-Id` 헤더가 있으면 그 워크스페이스를 먼저 쓰고, 없으면 토큰 클레임을 쓴다. 두 곳이 같은 규칙이라 컨텍스트와 역할 검증 대상이 일치한다.
3. 요청 리소스가 그 워크스페이스에 속하는지 확인한다.
4. 역할이 그 동작의 권한을 갖는지 확인한다.
5. 권한이 없으면 403 이다.

### 멤버십 검증은 가드가 무조건 한다

- `RolesGuard` 는 전역(`APP_GUARD`) 가드다. 워크스페이스 컨텍스트를 쓰는 인증 라우트라면 라우트에 `@Roles()` 가 있든 없든 헤더로 지정한 워크스페이스의 멤버십을 확인한다(경로로 워크스페이스를 받는 라우트는 아래 「경로 파라미터로 받는 워크스페이스」). `@Roles()` 는 역할 계층 비교만 통제한다.
- 헤더가 없으면 워크스페이스 컨텍스트는 `jwt.strategy` 가 이미 멤버십을 확인한 값이라 추가 검사가 필요 없다. 검증이 필요한 경로는 헤더가 토큰 값을 덮을 때다.
- 가드는 `@WorkspaceId()` 를 소비하는(`handlerConsumesWorkspaceId`) 라우트와 경로 파라미터로 받는 워크스페이스 없이 `@Roles()` 가 붙은 라우트에서 헤더 · 토큰이 가리키는 현재 워크스페이스를 검사한다. `@Roles()` 라우트는 파라미터로 드러내지 않아도 토큰의 `activeWorkspaceId` 클레임이 가리키는 현재 워크스페이스를 쓸 수 있어서다. 경로로 받는 워크스페이스(`@WorkspaceParam(...)`)는 아래 「경로 파라미터로 받는 워크스페이스」 가 다룬다. 그 라우트는 검증에서 빠지는 것이 아니라 인가 대상이 경로 값으로 바뀐다. `@WorkspaceId()` 도 함께 쓸 때만 헤더 · 토큰이 가리키는 현재 워크스페이스의 멤버십을 따로 본다.
- 제외 대상은 (a) `@Public()` 라우트와 `request.user` 가 없는 미인증 요청(판정은 `JwtAuthGuard` 몫), (b) `@Roles()` · `@WorkspaceId()` · `@WorkspaceParam(...)` 을 하나도 쓰지 않는 라우트다. 시스템 전역 API `GET /api/system-status/overview` 가 (b) 의 예이고 헤더가 와도 멤버십을 확인하지 않는다([시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md)).

### 경로 파라미터로 받는 워크스페이스

- 경로로 워크스페이스를 받는 라우트(`/api/workspaces/:id/...` 14곳과 전환 `POST /api/auth/workspaces/:id/switch` 1곳)는 헤더·토큰이 아니라 경로 값이 인가 대상이다. 이 파라미터는 `@WorkspaceParam('<name>')` 으로 바인딩한다.
- `RolesGuard` 는 `@WorkspaceId()` 와 같은 방식(`ROUTE_ARGS_METADATA` 의 팩토리 identity)으로 이 소비를 알아보고 등록된 이름의 경로 값을 인가 대상으로 쓴다. 경로 값은 토큰이 확인한 적이 없으므로 멤버십을 항상 조회한다.
- 역할 요구는 서비스 계층과 같게 `@Roles()` 로 적는다. 소유자·관리자 요구 8곳은 `@Roles('admin')`, 소유자 요구 2곳(워크스페이스 삭제 `remove`, `transferOwnership`)은 `@Roles('owner')`, 멤버면 되는 곳은 `@Roles()` 없이 둔다.
- 컨트롤러 핸들러가 워크스페이스 ID 를 평범한 `@Param` 으로 받는 것은 저장소 가드가 금지한다. `@Param(...)` 으로 받은 파라미터 이름이 `workspaceId` 이거나 `WorkspaceId` 로 끝나면 CI 가 실패한다. 허용 목록은 없다. 이름이 규칙 밖(`id` 등)이면 가드가 알아보지 못한다. 이것이 가드의 한계다.
- Nest 는 가드를 파이프보다 먼저 돌린다. 가드가 받는 경로 값은 검증 전 원문이다. 가드는 헤더와 같은 `isUuidShaped` 로 형식만 보고, 형식이 아니면 판정하지 않고 넘긴다. 뒤의 `ParseUUIDPipe` 가 400 을 내고 핸들러는 돌지 않는다. 형식이 맞으면 파이프 범위 밖의 값이든 없는 워크스페이스든 가드가 멤버십을 조회해 403 이 된다.
- 서비스 계층의 `assertMembership`·`assertAdmin` 검사는 남긴다. 가드 인식이 깨져 조용히 통과될 때의 두 번째 방어선이다. `leaveWorkspace`·`addMemberByEmail`·`transferOwnership` 은 워크스페이스를 조회하기 전에 인가를 먼저 한다. 트랜잭션 안에서 잠금을 잡고 다시 검사하는 곳(`leaveWorkspace`, `transferOwnership`)은 그 재검사를 두고 앞에 잠금 없는 인가를 먼저 둔다.

### 가드 거부 에러 코드

| 거부 | 코드 |
| --- | --- |
| 대상 워크스페이스 멤버가 아니다(헤더 위조, 경로 워크스페이스, 없는 워크스페이스를 구분하지 않는다) | `NOT_A_MEMBER` |
| 멤버지만 `@Roles()` 가 요구하는 최소 역할에 못 미친다 | 요구 역할이 `editor` 면 `EDITOR_REQUIRED`, `admin` 이면 `ADMIN_REQUIRED`, `owner` 면 `OWNER_REQUIRED` |

- 상태 코드는 모두 403 이다. `@Roles('viewer')` 는 멤버십과 같다. 여러 역할을 주면 가장 낮은 역할이 요구 역할이다. 메시지는 서비스 계층과 같은 한국어다.
- 이 표는 경로 라우트뿐 아니라 `@Roles()` 가 붙은 모든 라우트와 헤더 위조 거부에 적용된다.
- 비멤버는 요구 역할과 상관없이 `NOT_A_MEMBER` 다. 부재와 비멤버도 구분하지 않는다. `getMemberRole` 이 `workspace_member` 만 보므로 둘 다 `NOT_A_MEMBER` 이고, 이것이 경로 라우트에서 워크스페이스 존재가 새는 것을 가드 층에서 막는다.
- `OWNER_REQUIRED` 는 가드 밖에서도 난다. 관리자 역할을 주거나 빼는 요청은 가드를 통과한 뒤 서비스 계층이 같은 코드로 거부한다. 문구는 «관리자 역할은 소유자만 주거나 뺄 수 있습니다.» 로 가드의 «Owner 권한이 필요합니다.» 와 다르다([관리자 역할 규칙](CLE-ACCT-WS-MEMBER.md#관리자-역할-규칙)).
- 통합 OAuth 콜백도 가드 밖에서 `EDITOR_REQUIRED`·`ADMIN_REQUIRED` 를 낸다. 통합 재인증·추가 권한 요청 콜백의 커밋 직전 인가 재판정이 서비스 계층에서 개인 통합은 편집자 미만을 `EDITOR_REQUIRED` 로, 조직 통합은 관리자 미만을 `ADMIN_REQUIRED` 로 거부한다. 이 거부는 콜백 팝업과 통합의 `last_error` 로 알린다([통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드)).
- `NOT_A_MEMBER` 도 가드 밖에서 난다. 통합 행을 만드는 트랜잭션(통합 생성, Cafe24 Private·MakeShop `oauth/begin`)은 맨 먼저 워크스페이스 행을 잠근다. 그 사이 워크스페이스가 지워졌으면 공개 범위와 관계없이 이 코드로 거부한다. 개인 통합이면 이어서 요청자의 멤버십을 잠가 다시 읽고 없을 때도 이 코드다. 둘 다 가드를 지난 뒤 워크스페이스가 지워지거나 같은 사람이 나가거나 제거된 경쟁에서만 난다. 통합을 만드는 경로는 가드처럼 없는 워크스페이스와 비멤버를 구분하지 않는다. 워크스페이스 관리 경로는 같은 경합에서 404 `WORKSPACE_NOT_FOUND` 를 낸다([워크스페이스를 찾지 못할 때](#워크스페이스를-찾지-못할-때)). 코드의 뜻은 [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) 에 있다.
- 조직 통합을 개인으로 바꾸는 전환은 같은 순서로 잠그지만 `NOT_A_MEMBER` 를 쓰지 않는다. 워크스페이스가 그 사이 지워졌으면 통합도 함께 지워져 404 `RESOURCE_NOT_FOUND` 다. 통합을 만든 사람이 멤버가 아니면 409 `INTEGRATION_OWNER_NOT_MEMBER` 다. 요청자는 멤버이고 거절 이유는 통합을 만든 사람에게 있다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md#나간-멤버의-개인-통합으로-바꾸는-전환은-거절한다-2026-10-29)).
- 코드를 붙이지 않는 가드 거부 두 자리가 남는다. 미인증 요청이 `@Roles()` 라우트에 닿는 경우(`JwtAuthGuard` 가 먼저 401 을 내므로 실제로 닿지 않는다)와 `@Roles()` 라우트에 워크스페이스 컨텍스트가 전혀 없는 경우(가입 직후에도 토큰이 개인 워크스페이스를 갖는다)다. 도달 경로가 없어 범위 밖이다.

### 워크스페이스를 찾지 못할 때

워크스페이스를 찾지 못해 거부하는 자리는 둘이다. 자리마다 코드 · 상태 코드 · 뜻이 다르다.

| 발행 자리 | 코드 · 상태 | 조건 | 메시지 |
| --- | --- | --- | --- |
| 워크스페이스 관리 경로(`WorkspacesService`) | `WORKSPACE_NOT_FOUND` 404 | 멤버 · 관리자 · 소유자 검사를 통과한 뒤 대상 워크스페이스 행을 읽었는데 없다. 이름 변경, 설정 조회 · 변경, 삭제, 나가기, 소유자 이양, 직접 추가가 이렇게 검사한다 | `워크스페이스를 찾을 수 없습니다.` |
| 액세스 토큰 검증(`jwt.strategy`) | `NO_WORKSPACE_AVAILABLE` 401 | 토큰은 유효한데 현재 워크스페이스로 쓸 곳이 없다. 클레임이 가리키는 워크스페이스의 멤버십, 개인 워크스페이스, 첫 멤버십이 모두 없다 | `No workspace found for user` |

- 관리 경로는 인가를 먼저 한다. 비멤버와 없는 워크스페이스는 그 단계에서 둘을 구분하지 않고 403 `NOT_A_MEMBER` 로 거부된다([가드 거부 에러 코드](#가드-거부-에러-코드)). 워크스페이스를 지우면 멤버십도 함께 지워진다. 그래서 404 는 사실상 인가와 조회 사이에 다른 요청이 그 워크스페이스를 지운 경합에서만 난다.
- 통합을 만드는 트랜잭션(통합 생성, Cafe24 Private·MakeShop `oauth/begin`)은 같은 경합에서 이 코드를 쓰지 않는다. 워크스페이스 자체가 아니라 그 안에 통합을 만드는 요청이라 가드와 같은 403 `NOT_A_MEMBER` 로 거부한다([가드 거부 에러 코드](#가드-거부-에러-코드)). 공개 범위 전환은 대상 통합도 워크스페이스와 함께 지워졌으므로 404 `RESOURCE_NOT_FOUND` 다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md#위험-영역-탭)).
- 토큰 검증의 401 은 액세스 토큰으로 인증하는 모든 요청에서 날 수 있다. 예를 들어 초대로 가입해 개인 워크스페이스가 없는 사용자가 유일한 팀 워크스페이스에서 나가면 그 뒤 요청은 이 401 이 된다. 토큰 클레임을 대신할 워크스페이스를 찾는 순서는 [전환 API 와 토큰](CLE-ACCT-WS-SPACE.md#전환-api-와-토큰) 과 같다.
- 토큰 검증의 401 은 2026-11-12 결정대로 2026-11-14 부터 `NO_WORKSPACE_AVAILABLE` 로 나간다(NERV Task `CLE-T-ZPPWK4`). 조건과 메시지는 바뀌지 않았다. `WORKSPACE_NOT_FOUND` 는 관리 경로의 404 하나만 남았다. 카탈로그는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 있다.

### `X-Workspace-Id` 형식 검사

| 입구 | 검사 | 통과 범위 |
| --- | --- | --- |
| `X-Workspace-Id` 헤더 | `isUuidShaped`(`common/utils/uuid.ts`) | canonical 8-4-4-4-12 hex. 버전·variant nibble 을 보지 않는다 |
| 워크스페이스 `:id` 경로 파라미터 | ① `RolesGuard` 의 `isUuidShaped`, ② `ParseUUIDPipe` | ① 형식이면 인가 판정(403), 아니면 넘김. ② Nest `ParseUUIDPipe` 의 기본 범위(버전 1~8 과 RFC variant, nil · max UUID) 밖이면 400 `VALIDATION_ERROR` |
| `:memberId`·`:invitationId` 경로 파라미터 | `ParseUUIDPipe`(`workspaces.controller.ts` 4곳) | Nest `ParseUUIDPipe` 의 기본 범위(버전 1~8 과 RFC variant, nil · max UUID). 밖이면 400 `VALIDATION_ERROR` |

- `ParseUUIDPipe` 의 기본 범위는 Nest 버전을 따라 바뀐다. 표는 Nest 12 기준이고 `common/utils/uuid.spec.ts` 의 "ParseUUIDPipe 기본 범위 (경로 파라미터)" 가 고정한다. `isValidUuid`(버전 1~5 와 RFC variant)와는 다른 검사다.
- 헤더 형식이 깨지면 400 `VALIDATION_ERROR`, 비멤버면 403 `NOT_A_MEMBER` 다. 헤더와 클레임이 모두 없으면 가드가 통과시킨 뒤 `@WorkspaceId()` 가 400 `WORKSPACE_ID_REQUIRED` 를 낸다(`workspace.decorator.ts`. 예: `@Roles()` 없이 `@WorkspaceId()` 를 쓰는 라우트). 경로로 받는 워크스페이스가 없는 `@Roles()` 라우트는 `@WorkspaceId()` 를 함께 써도 가드가 먼저 돌아 위 「가드 거부 에러 코드」 의 코드 없는 거부(403, 기본 코드 `FORBIDDEN`)가 된다. 카탈로그는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 있다.
- 헤더 검사는 `@WorkspaceId()` 를 쓰는 라우트와 경로 파라미터로 받는 워크스페이스 없이 `@Roles()` 를 쓰는 라우트(모두 인증 라우트)에서만 돈다. `@WorkspaceParam(...)` 을 쓰는 라우트는 경로 값에 같은 `isUuidShaped` 를 쓰고 `@WorkspaceId()` 도 함께 쓸 때만 헤더를 본다. 세 데코레이터를 하나도 쓰지 않는 전역 라우트는 헤더 형식이 깨져도 400 이 아니라 무시한다.
- 헤더를 경로 파라미터 수준으로 조이지 않는다. 이유는 [Rationale](#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 에 있다.

### 부팅 때 가드 인식 자가 검사

`main.ts` bootstrap 은 `assertWorkspaceIdReflectionWorks(app)`(`common/decorators/workspace-reflection-canary.ts`)를 부른다. `DiscoveryService` 로 등록된 모든 컨트롤러를 훑어 `@WorkspaceId()` 나 `@WorkspaceParam(...)` 을 소비하는 라우트 수를 세고, 0 이면 throw 해 기동을 멈춘다. 판정에는 `handlerConsumesWorkspaceId` 를 그대로 부른다. 인식 개수는 부팅 로그(`@WorkspaceId() 소비 라우트 N건 인식`)에 남긴다. 일부 라우트만 인식이 깨지는 부분 파손은 잡지 못하므로 로그의 급락으로 알아챈다. 이 검사는 `assertProductionConfig` 와 별도 단계이고 모든 환경에서 돈다.

## 구현 위치

- `codebase/backend/src/modules/auth/strategies/jwt.strategy.ts` (토큰 클레임 해석과 대체 순서, 쓸 워크스페이스가 없을 때의 401 `NO_WORKSPACE_AVAILABLE`)
- `codebase/backend/src/common/guards/*.ts` (`RolesGuard`, `JwtAuthGuard`)
- `codebase/backend/src/common/constants/workspace-roles.ts` (가드와 서비스가 함께 쓰는 거부 본문 `NOT_A_MEMBER` · `ROLE_REQUIRED` · `ADMIN_ROLE_CHANGE_REQUIRES_OWNER`)
- `codebase/backend/src/common/decorators/*.ts` (`@WorkspaceId()`, `@WorkspaceParam(...)`, `@Roles()`, `workspace-reflection-canary.ts`)
- `codebase/backend/src/common/utils/workspace-context.util.ts`, `codebase/backend/src/common/utils/uuid.ts`, `codebase/backend/src/common/utils/uuid.spec.ts`(경로 파라미터 `ParseUUIDPipe` 기본 범위 고정)
- `codebase/backend/src/repo-guards/__tests__/workspace-param-binding*.ts`, `codebase/backend/src/repo-guards/__tests__/fixtures/workspace-param-binding/**` (경로 워크스페이스 `@Param` 바인딩 금지 가드와 대조군)
- `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts` (`RolesGuard` 전역 등록과 핸들러별 `@Roles` 고정)

## Rationale

### 멤버십 검증은 가드 한 곳에서 `@Roles()` 와 상관없이 한다

2026-08-08 결정이다. 헤더 위조가 `RolesGuard` 멤버십 검증으로 막힌다는 보장은 "워크스페이스 스코프 핸들러마다 `@Roles()` 가 빠짐없이 붙어 있다" 는 분산된 전제에 기대고 있었다. 전제는 충족되지 않았다. 그날 전수 실측에서 HTTP 라우트 222개 중 `@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는 라우트가 73개(변경 15, 조회 58)였다. `RolesGuard.canActivate` 가 `requiredRoles` 가 비면 멤버십 조회 전에 통과시켰기 때문이고, 인증된 사용자가 헤더만 위조해 다른 워크스페이스 리소스에 접근할 수 있었다(cross-tenant).

그래서 멤버십 검증을 라우트 데코레이터에서 떼어 가드가 무조건 하게 했다. `@Roles()` 는 역할 계층 비교만 통제한다. 헤더 우선 순서는 그대로다. 바뀐 것은 헤더로 들어온 값의 검증 시점이 라우트별 opt-in 에서 가드 무조건으로 옮겨진 것이고, "멤버십 검증이 인증 진입점 한 곳으로 모인다" 는 목표를 헤더 제거를 기다리지 않고 앞당긴 것이다. 토큰 우선으로 되돌아간 것이 아니다.

기각한 대안은 73개 라우트에 `@Roles('viewer')` 를 붙이는 것이다. opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 다시 생긴다. 이 저장소에서 이미 최소 두 번 일어났다. 원 보안 리뷰도 구조적 해소를 권고했다.

가드는 요청이 도는 워크스페이스만 본다. 요청 본문의 참조 id 는 저장 때 서비스가 본다([참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속)).

워크스페이스와 무관한 전역 API 는 이 검증에서 뺀다. `@Roles()` · `@WorkspaceId()` · `@WorkspaceParam(...)` 을 하나도 쓰지 않는 라우트는 헤더가 와도 멤버십을 확인하지 않는다. 이런 라우트는 워크스페이스 값을 받을 통로가 없어 헤더를 위조해도 다른 워크스페이스 데이터에 닿지 않는다. 예외가 없으면 프론트엔드가 모든 요청에 붙이는 헤더 때문에 시스템 상태 같은 전역 API 가 헤더와 토큰의 워크스페이스가 다를 때마다 멤버십을 다시 조회하고, 헤더의 워크스페이스에 속하지 않은 사용자는 403 을 받는다. 2026-08-08 e2e 회귀(`test/system-status.e2e-spec.ts`)로 실측했다. 예외 여부는 가드가 세 데코레이터의 사용 여부를 reflection 으로 보고 정한다. 새 라우트가 `@WorkspaceId()` 를 쓰면 표시를 따로 달지 않아도 검사 대상이 되므로 위에서 기각한 라우트별 opt-in 과 달리 빠뜨려도 열리지 않는다. 다만 가드는 세 데코레이터만 알아본다. 핸들러가 `req.user.workspaceId` 를 직접 읽는 경우의 비대칭은 아래 「경로 파라미터 워크스페이스도 가드가 본다」 와 「부팅 때 가드 인식을 스스로 검사한다」 가 다룬다. `@Roles()` 라우트는 파라미터로 드러내지 않아도 토큰의 `activeWorkspaceId` 클레임이 가리키는 현재 워크스페이스를 쓸 수 있으므로 이 예외에서 뺀다.

### 경로 파라미터 워크스페이스도 가드가 본다

2026-09-25 결정이다. 위 결정은 헤더·토큰 컨텍스트만 봤다. 경로 `:id` 로 워크스페이스를 받는 라우트 15곳(`workspaces.controller.ts` 14, `auth.controller.ts` 전환 1)은 서비스 계층 `assertMembership`·`assertAdmin` 에만 기댔다. 그날 실측에서 인가 누락은 없었지만 세 메서드(`leaveWorkspace`, `addMemberByEmail`, `transferOwnership`)가 인가 전에 워크스페이스를 조회해 비멤버가 "없음·개인·팀" 을 구분할 수 있었다(존재·종류 오라클). `transferOwnership` 은 트랜잭션 안에서 워크스페이스를 먼저 읽어 "없음 404, 개인 `CANNOT_TRANSFER_PERSONAL`, 팀 비소유자 `OWNER_REQUIRED`" 로 갈렸고, 가드가 토큰 워크스페이스로 판정해 HTTP 로도 닿았다. `@Roles('owner')` 가 붙은 `transferOwnership` 조차 가드는 핸들러가 다루는 경로 워크스페이스가 아니라 헤더·토큰 워크스페이스를 검사했다.

그래서 경로 워크스페이스를 `@WorkspaceParam('<name>')` 으로 바인딩하고 가드가 그 값을 인가 대상으로 쓰게 했다.

`@WorkspaceParam` 도 라우트마다 쓰는 데코레이터라, 다음 경로 라우트가 평범한 `@Param('id')` 로 워크스페이스를 받으면 같은 빈칸이 생긴다. 데코레이터로는 74번째 라우트 문제가 닫히지 않는다. 그래서 컨트롤러가 워크스페이스 ID 를 `@Param` 으로 받는 것을 정적 저장소 가드로 막았다.

`@WorkspaceParam` 은 아래 부팅 자가 검사 결정이 다시 기각한 "opt-in 마커" 가 아니다. 그 결정이 `SetMetadata` 마커를 기각한 이유는 마커가 값 바인딩 옆에 따로 다는 메타데이터라 빠뜨려도 라우트가 멀쩡히 돈다는 것이었다. `@WorkspaceParam` 은 핸들러가 워크스페이스 ID 를 받는 방법 자체다. `@WorkspaceId()` 와 같은 자리이고 가드는 같은 소비 reflection 으로 알아본다. 빠뜨릴 수 있는 것은 데코레이터가 아니라 "같은 값을 평범한 `@Param` 으로 받는 것" 이고, 그것을 정적 가드가 막는다. 비대칭은 남는다. 헤더·토큰 모델에서 `@WorkspaceId()` 대신 `req.user.workspaceId` 를 직접 읽는 라우트도 가드가 알아보지 못하는 같은 모양인데, 그쪽에는 정적 가드가 없다. 그날 실측 4곳이고 모두 사용자 단위 동작의 감사 귀속용이라 워크스페이스 자원에 접근하지 않는다.

서비스 계층 검사는 남긴다. 이 메서드들의 HTTP 밖 호출자는 없다(그날 실측: 내부 위임 `removeMember → leaveWorkspace` 하나이고 가드를 거친 HTTP 요청 안이다). 그러니 서비스 검사가 막는 것은 다른 호출 경로가 아니라 가드 인식이 깨져 그냥 통과되는 경우다. 오라클이 있던 세 메서드도 인가를 앞으로 옮겨 두 번째 방어선에 같은 오라클이 남지 않게 했다.

기각한 대안은 두 가지이고, 실측과 함께 선택지를 제시해 사용자가 결정했다. (1) 오라클 두 곳만 서비스에서 인가를 먼저 하도록 고친다: 위 결정이 74번째 라우트 문제로 기각한 라우트별 패치의 연장이다. (2) 가드가 경로 파라미터도 보되 거부에 코드를 붙이지 않는다: 경로 라우트 13곳의 거부 본문이 서비스 코드에서 `FORBIDDEN` 으로 바뀌고, 프론트엔드가 `OWNER_REQUIRED` 로 소유자 이양 토스트를 가르는 분기가 깨진다. 채택안은 아래 에러 코드 결정과 함께다.

2026-10-08 정정이다. 경로 값이 인가 대상인 라우트에서 가드는 헤더 · 토큰이 가리키는 현재 워크스페이스를 검사하지 않는다. `@WorkspaceId()` 도 함께 소비하는 핸들러만 그 워크스페이스의 멤버십을 본다. 핸들러가 `@WorkspaceId()` 를 소비하지 않으면 헤더 값이 핸들러로 들어갈 통로가 없으므로 2026-08-08 의 헤더 위조 방어는 약해지지 않는다. 헤더 멤버십 확인과 헤더 형식 검사 요구사항의 범위를 이 동작에 맞췄다. `WORKSPACE_ID_REQUIRED` 설명도 실제 발생 경로에 맞췄다. 이 코드는 가드가 통과시킨 뒤 `@WorkspaceId()` 가 던진다. 그래서 경로 파라미터로 받는 워크스페이스가 없는 `@Roles()` 라우트에서 현재 워크스페이스가 없으면 이 코드가 아니라 가드의 코드 없는 거부가 난다. 가드 동작은 바뀌지 않았다.

### 가드 거부에 에러 코드를 붙인다

2026-09-25 결정이다. 앞선 결정들은 가드 거부에 코드를 정하지 않았다. 새 경로에만 코드를 붙이면 같은 실패가 경로에 따라 다른 본문을 낸다는 이유였다. 코드를 정하지 않은 403 은 전역 필터가 기본값 `FORBIDDEN` 으로 채운다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 경로 라우트를 가드로 옮기면 그 라우트들이 서비스에서 내던 코드(`NOT_A_MEMBER`, `ADMIN_REQUIRED`, `OWNER_REQUIRED`)가 `FORBIDDEN` 으로 바뀐다. 그래서 가드의 모든 멤버십·역할 거부에 코드를 함께 붙였다.

적용 범위는 전역이다. `RolesGuard` 는 `APP_GUARD` 라 경로 라우트 15곳만이 아니라 `@Roles()` 가 붙은 모든 라우트와 헤더 위조 거부에 적용된다. 결정 당시 `@Roles()` 라우트는 `editor` 63, `admin` 9, `owner` 3, `viewer` 4 로 합 79였고, 이 변경이 경로 라우트에 `admin` 8, `owner` 1 을 붙여 합 88이 됐다. 그 라우트들의 역할·멤버십 거부 에러 코드가 `FORBIDDEN` 에서 위 코드로 바뀌었고 상태 코드는 403 그대로다.

비멤버에게 어떤 코드를 줄지 두 규칙을 견줬다. (가) "라우트 요구 역할의 코드" 는 비멤버도 관리자 라우트에서 `ADMIN_REQUIRED` 를 받는다. (나) "비멤버는 항상 `NOT_A_MEMBER`, 멤버의 역할 미달만 역할 코드" 다. (가) 는 경로 라우트의 서비스 시절 본문을 비멤버까지 그대로 두지만, 헤더 위조 거부가 `editor` 라우트 63곳에서 `EDITOR_REQUIRED` 가 된다. 비멤버에게 "편집자 권한이 필요하다" 는 틀린 말이고, 프론트엔드가 "이 워크스페이스에 더는 속하지 않는다" 를 알아챌 단일 신호를 잃는다. 그래서 (나) 를 택했다. 대가로 경로 라우트 중 관리자·소유자 요구 10곳에서 비멤버가 받는 코드가 `ADMIN_REQUIRED`·`OWNER_REQUIRED` 에서 `NOT_A_MEMBER` 로 바뀌었다. 비멤버는 그 화면에 닿지 않고, 멤버가 받는 본문은 모두 보존된다.

가드 밖 `NOT_A_MEMBER`(워크스페이스가 그 사이 지워진 경우, 조직 통합, 공개 범위 전환의 다른 응답)는 2026-10-30 에 구현에 맞췄다. 워크스페이스 관리 경로의 404 `WORKSPACE_NOT_FOUND` 와 갈리는 이유는 [워크스페이스를 찾지 못할 때](#워크스페이스를-찾지-못할-때) 에 적었다.

### `X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다

2026-08-09 결정이다. 같은 워크스페이스 UUID 인데 두 입구의 검사 강도가 다르다. 의도한 비대칭이다.

- 헤더를 조이면 403 이 400 으로 바뀐다. 헤더 검사가 하는 일은 "Postgres 가 `uuid` 컬럼 값으로 파싱할 수 있는가" 하나다. 파싱할 수 있는 값을 미리 거르면 `getMemberRole` 이 정상 조회해 "그 워크스페이스 멤버가 아니다"(403)로 답해야 할 요청이 "요청이 잘못됐다"(400)가 된다. nil UUID·v7·비 RFC variant 가 바로 그 구간이다. Postgres 는 모두 받는데 `isValidUuid`(RFC v1~v5 와 variant)는 거부한다. 헤더는 인가 판정의 입력이므로 인가 결과(403)를 형식 에러(400)로 바꾸는 검사를 쓸 수 없다.
- `:memberId`·`:invitationId` 는 인가 판정의 입력이 아니라 리소스 지목이라 엄격해도 된다. 거기서 400 을 내도 바뀔 인가 응답이 없다. 없는 리소스는 어차피 404 이고 400 과 404 는 접근 가능 여부를 드러내지 않는다.
- 워크스페이스 `:id` 경로 파라미터는 2026-09-25 부터 인가 입력이 됐다. 그래서 가드 단계 검사는 헤더와 같은 `isUuidShaped` 이고 `ParseUUIDPipe` 는 가드 뒤에서 형식 파손만 400 으로 거른다. 없는 워크스페이스는 404 가 아니라 가드가 403 `NOT_A_MEMBER` 로 답해 존재가 새지 않는다.
- 경로 파라미터 쪽 범위는 2026-10-04 NestJS 12 상향에서 좁아졌다. Nest 11 의 `ParseUUIDPipe` 는 8-4-4-4-12 hex 모양이면 모두 받아 `isUuidShaped` 와 같았다. Nest 12 는 버전 1~8 과 RFC variant, nil · max UUID 만 받는다. 그래서 `:memberId`·`:invitationId` 에 모양만 맞는 비 RFC 값을 보내면 전에는 핸들러까지 갔고(없는 리소스면 404) 이제는 400 `VALIDATION_ERROR` 다. 위 둘째 항목의 이유대로 이 변화는 접근 가능 여부를 드러내지 않는다. 워크스페이스 `:id` 는 가드가 파이프보다 먼저 판정하므로 인가 응답이 바뀌지 않는다.
- "일관성" 을 이유로 헤더를 `ParseUUIDPipe` 수준으로 조이는 것은 회귀다. 두 검사의 경계는 단위 테스트가 고정한다. `common/utils/uuid.spec.ts` 의 "accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)" 가 경계 자체를, `common/utils/workspace-context.util.spec.ts` 의 "Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)" 가 헬퍼 수준을 지킨다.
- `test/system-status.e2e-spec.ts` 의 nil UUID 프로브는 이 검사에 닿지 않는다. 그 컨트롤러는 세 데코레이터를 하나도 쓰지 않아 `RolesGuard` 가 헬퍼 호출 전에 통과시킨다. 그 e2e 는 "전역 라우트는 헤더를 무시한다" 는 별개 불변식을 지키고, 회귀 감지는 위 두 단위 테스트가 한다.

### 부팅 때 가드 인식을 스스로 검사한다

2026-08-09 결정이다.

(a) 이 검사가 필요한 이유는 실패 방향이 fail-open 이기 때문이다. `RolesGuard` 는 라우트가 워크스페이스를 쓰는지 `handlerConsumesWorkspaceId` 로 판정해 멤버십 검증 대상을 좁힌다. 2026-09-25 부터는 `@WorkspaceParam(...)` 소비도 같은 방식으로 판정한다. 이 판정은 `@nestjs/common` 의 비공개 export `ROUTE_ARGS_METADATA` 와 함수 identity 비교에 기댄다. 이 가정은 (1) Nest 내부 메타데이터 형식 변경(`@nestjs/*` 를 caret 범위로 선언해 minor·patch 업그레이드로도 온다), (2) 핸들러를 감싸는 데코레이터 도입으로 `Function.name` 소실, (3) 빌드 minify·mangle 로 깨질 수 있다. 깨지면 판정이 모든 라우트에서 false 가 되어 멤버십 검증이 조용히 빠진다. cross-tenant 결함이 그대로 되살아난다. 런타임에 조용히 새는 것보다 배포가 멈추는 편이 낫다.

검사 대상은 라우트 목록이 아니라 "0건이 아님" 이다. 특정 라우트를 하드코딩하면 그 라우트가 정당하게 사라질 때 오탐이 나고, 결국 목록을 지우라는 압력이 된다. 판정에는 `handlerConsumesWorkspaceId` 를 그대로 부른다. 검사가 reflection 을 다시 구현하면 자기 복제본을 검사하게 되어 막으려던 파손을 통과시킨다.

이 검사가 세는 집합은 `@Roles()` 유무와 상관없이 `@WorkspaceId()` 나 `@WorkspaceParam(...)` 을 소비하는 라우트 전부다. 앞 결정의 73개는 그중 `@Roles()` 가 없어 cross-tenant 로 새던 부분집합이다. 두 수를 같은 것으로 읽으면 검사가 지키는 범위를 좁게 오해한다. 구체 수치는 문서에 적지 않는다. 라우트가 늘고 줄면 변하는 값이라 문서에 박으면 조용히 낡는다. 현재 개수의 기준은 부팅 로그다.

(b) `SetMetadata` 와 `Reflector` 로 opt-in 마커를 다는 방식은 다시 기각했다. Nest 공식 확장점이지만 `@WorkspaceId()` 를 쓰는 곳마다 마커를 달아야 한다. 이것은 앞 결정이 이미 기각한 "라우트별 opt-in 마커" 모양이다(다음 라우트에서 같은 누락이 다시 생긴다). 이 검사는 호출부에 아무것도 요구하지 않으면서 같은 위험을 막는다.

(c) `assertProductionConfig` 와 합치지 않았다. 축이 다르다. 그쪽은 환경 변수 축이라 `NODE_ENV=production` 에서만 동작하고 개발·테스트에서는 아무 일도 하지 않는다. 이 검사는 환경과 무관한 구조 불변식이라 모든 환경에서 동작해야 뜻이 있다. 합치면 "production config" 라는 이름의 범위를 넘고, production 한정 조건이 이 검사까지 끌고 갈 위험이 생긴다.

### 토큰 검증의 401 에 새 코드 `NO_WORKSPACE_AVAILABLE` 을 주기로 했다 (2026-11-12)

사람이 정했고 2026-11-14 에 NERV Task `CLE-T-ZPPWK4` 가 구현했다. 조건과 메시지(`No workspace found for user`)는 그대로 두고 코드만 바꿨다.

- **한 코드가 두 뜻으로 쓰였다.** 관리 경로의 404 는 대상 워크스페이스가 없다는 뜻이다. 토큰 검증의 401 은 사용자에게 쓸 워크스페이스가 하나도 없다는 뜻이다. [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 은 뜻이 갈리면 코드를 나누라고 정한다. 404 는 그대로 두고 401 에 새 코드를 준다. 프런트엔드에 이 코드로 분기하는 곳이 없어서 옮겨도 깨지는 소비자가 없다.
- **이름은 사용자의 상태를 적는다.** 토큰 검증은 클레임의 워크스페이스, 개인 워크스페이스, 첫 멤버십을 차례로 찾고 셋 다 없을 때 거부한다. 조건은 워크스페이스 하나가 아니라 이 사용자에게 쓸 곳이 없다는 것이다.
- **기각: `WORKSPACE_NOT_AVAILABLE`.** 특정 워크스페이스 하나를 쓸 수 없다는 뜻으로 읽힌다.
- **기각: 멤버십을 넣은 이름(`NO_WORKSPACE_MEMBERSHIP` 류).** 개인 워크스페이스는 멤버십 행이 없어도 대상에 든다. 멤버십이 없다는 것만으로는 이 401 이 나지 않는다.
- **규칙 3 의 `<DOMAIN>_<CONDITION>` 은 따르지 않았다.** 규칙 3 은 권장이다. `WORKSPACE_` 로 시작하는 이름은 위의 `WORKSPACE_NOT_AVAILABLE` 처럼 워크스페이스 하나의 상태로 읽혔다.
