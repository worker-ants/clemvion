---
id: "CLE-API-ERRCODES-AUTH"
title: "에러 코드 카탈로그 — 인증 · 인가 · 워크스페이스"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "82c7a83cfff7a1ef59908ef86d43b9173e631c4c163a2e53219a188ac85aea95"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "2f331804399193ac1210016979a1737e684a1ae51b9357e5cf95b0d0d2bed08e"
etag: "sha256-6f5439649064821f95ee9a3ad739df7538ecec5707562866c2ee1455c5ba2935"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 인증 · 인가 코드(§6.2), 워크스페이스 멤버 직접 추가 코드(§6.12), 워크스페이스 · 로그인 세션 관리 코드(§6.18)를 정한다. 2FA · Passkey · 재인증 코드(§6.3)는 [2FA · Passkey 코드](CLE-API-ERRCODES-MFA.md) 가 정한다.

## 6.2 인증·인가

| 코드 | 이름 | 설명 | HTTP | 정의 문서 |
|------|------|------|------|-----------|
| `AUTH_REQUIRED` | 인증 필요 | 토큰 없음. 401 기본 코드. 현재 구현은 만료된 액세스 토큰도 코드 없이 거부해 이 코드가 나간다 | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `TOKEN_EXPIRED` | 토큰 만료 | 리프레시 토큰 단순 만료. 재사용 감지와 달리 세션 무효화·이력 기록 없이 거부한다(Rationale "`TOKEN_EXPIRED` 설명") | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) |
| `TOKEN_INVALID` | 토큰 무효 | 변조·형식 에러, refresh 토큰이 없거나 소유자가 없음, 또는 refresh 회전 때 조건부 폐기가 0건과 맞음(같은 토큰을 동시에 회전하는 경합) | 401 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `FORBIDDEN` | 권한 없음 | 역할 권한 부족(일반). 403 기본 코드 | 403 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `ADMIN_REQUIRED` | 관리자 권한 필요 | 워크스페이스 소유자·관리자 역할이 필요할 때 쓰는 `FORBIDDEN` 의 맥락 특화 코드. `RolesGuard` 의 `@Roles('admin')` 미달, `WorkspacesService.assertAdmin()`, `IntegrationsService` 의 조직 통합 변경 판정이 발행한다. 통합 OAuth 에서도 세 곳이 낸다. 관리자 미만 요청자가 조직 공개 범위로 `oauth/begin`(`new`)을 부를 때(다시 쓸 설치 대기 행을 찾기 전), `oauth/begin`(`new`)으로 조직 통합의 설치 대기 행을 다시 쓰려 할 때, 콜백의 커밋 직전 재판정(`assertOrgScopeModifiable`)이다. 콜백은 HTML 로 답하고 코드는 통합의 `last_error.code` 에 남긴다(§6.21) | 403 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md), [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](../CLE-INT/CLE-INT-OAUTH.md#설치-대기-행-재사용의-권한), [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `EDITOR_REQUIRED` | 편집자 권한 필요 | 편집자 이상 역할이 필요할 때 쓰는 `FORBIDDEN` 의 맥락 특화 코드(`RolesGuard` 의 `@Roles('editor')` 미달). 통합 관리에서는 뷰어가 쓰기 라우트(생성 · 별칭 수정 · 자격 증명 교체 · 통합 재인증 · 추가 권한 요청 · 저장 전 연결 테스트)나 `oauth/begin`을 부르면 라우트 가드가 대상의 공개 범위와 상관없이 이 코드를 낸다. 통합 OAuth 콜백의 커밋 직전 재판정(`assertPersonalWriteRole`)도 낸다. 개인 통합을 재인증하는 요청자의 역할이 편집자 미만이거나 역할을 모를 때(멤버가 아니게 됐거나 조회하지 못함)다. 콜백은 HTML 로 답하고 코드는 통합의 `last_error.code` 에 남긴다(§6.21) | 403 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md), [통합 관리 「권한」](../CLE-INT/CLE-INT-MANAGE.md#권한), [OAuth 연결과 토큰 갱신 「에러 매핑」](../CLE-INT/CLE-INT-OAUTH.md#에러-매핑) |
| `OWNER_REQUIRED` | 소유자 권한 필요 | 소유자만 하는 동작을 소유자가 아닌 멤버가 요청함. 가드(`@Roles('owner')` 미달)와 서비스 계층(소유자 이양 재검증, 관리자 역할 규칙)이 함께 내고 메시지는 발행처마다 다르다 | 403 | [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드), [워크스페이스와 멤버 「관리자 역할 규칙」](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할-규칙) |
| `LOGIN_FAILED` | 로그인 실패 | 잘못된 자격 증명 | 401 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `ACCOUNT_LOCKED` | 계정 잠김 | 로그인 시도 초과(5회 실패 시 10분). `UnauthorizedException` 이다(Rationale "423 오기 정정") | 401 | [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `EMAIL_VERIFICATION_REQUIRED` | 이메일 인증 필요 | 비밀번호는 맞지만 이메일 인증을 마치지 않은 계정의 로그인. 비밀번호가 틀리면 `LOGIN_FAILED` 다 | 401 | [가입과 로그인 「에러 코드」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-코드) |
| `NOT_A_MEMBER` | 워크스페이스 비멤버 | 대상 워크스페이스 멤버십 검증 실패. `RolesGuard` 의 멤버십 거부(헤더 위조, 경로 워크스페이스, 없는 워크스페이스를 구분하지 않고 요구 역할과도 무관)와 전환(`/api/auth/workspaces/:id/switch`)·탈퇴·멤버십 확인 경로(`auth.service`, `workspaces.service`)가 발행한다. 통합 행을 만드는 트랜잭션의 첫 잠금(`integration-owner-write-lock.ts`)도 이 코드를 낸다. 통합 생성과 Cafe24 Private · MakeShop `oauth/begin` 의 설치 대기 행 쓰기에서 개인 통합을 만드는 요청자가 그 사이 나갔거나 제거됐을 때와 워크스페이스가 그 사이 지워졌을 때다. 워크스페이스가 지워진 경우는 조직 통합에도 해당한다 | 403 | [워크스페이스와 멤버 「가드 거부 에러 코드」](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부-에러-코드), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md), [통합 관리 「에러 코드」](../CLE-INT/CLE-INT-MANAGE.md#에러-코드) |

`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 가드 거부 코드(guard rejection codes)다. 가드 거부에 전용 코드를 쓰게 된 결정은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#가드-거부에-에러-코드를-붙인다) 의 「가드 거부에 에러 코드를 붙인다」 Rationale(2026-09-25)에 있고 403 응답 설명에 싣는 규칙은 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 새 엔드포인트 체크리스트에 있다. 이 가운데 `NOT_A_MEMBER`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 가드를 통과한 뒤 서비스 계층에서도 난다. 서비스 계층은 같은 뜻의 거부에 가드와 같은 코드를 쓴다. `EDITOR_REQUIRED` 도 서비스 계층에서 한 곳 난다. 라우트 가드를 거치지 않는 통합 OAuth 콜백의 커밋 직전 재판정이다. 예외는 초대 모듈이다. 초대 모듈(`WorkspaceInvitationsService`)의 서비스 계층 두 번째 방어선은 비멤버와 관리자 미만 멤버를 모두 §3 의 소문자 `admin_required` 로 거부한다. 초대 라우트는 가드가 먼저 `NOT_A_MEMBER` · `ADMIN_REQUIRED` 로 거부하므로 이 코드는 HTTP 로 나가지 않는다.

## 6.12 워크스페이스 멤버 직접 추가 (도메인 문서 참조)

`POST /api/workspaces/:id/members`(`WorkspacesService.addMemberByEmail`, 이미 가입한 사용자를 바로 합류시킴) 전용 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `CANNOT_ASSIGN_OWNER` | 403 | 직접 추가로 `role=owner` 를 줄 수 없음(소유자는 소유자 이양 경로로만) | [워크스페이스와 멤버 「직접 추가」](../CLE-ACCT/CLE-ACCT-WS.md#직접-추가) |
| `ALREADY_A_MEMBER` | 409 | 이미 멤버인 사용자를 다시 추가함 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `WORKSPACE_TYPE_MISMATCH` | 403 | team 이 아닌 워크스페이스에 직접 추가를 시도함 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |

이 대문자 코드는 초대 흐름(`workspace-invitations.service.ts`)의 소문자 `already_a_member`·`workspace_type_mismatch`(§3)와 **같은 뜻이지만 별개 코드**다. 모듈과 대소문자 관례가 다르고 일부러 나눴으므로 합치지 않는다. 같은 경로의 `USER_NOT_FOUND`(404, 가입하지 않은 이메일)와 `WORKSPACE_NOT_FOUND`(404, 워크스페이스 없음)는 `workspaces.service` 전역 CRUD 가 함께 쓰는 일반 코드라 직접 추가 전용이 아니어서 이 절에 두지 않고 §6.4 에 등재했다. 같은 경로에서 소유자가 아닌 요청자가 `role=admin` 을 지정하면 §6.2 의 `OWNER_REQUIRED`(403)다. 전환·탈퇴 경로의 `NOT_A_MEMBER`(403)는 §6.2 다.

## 6.18 워크스페이스·로그인 세션 관리 (도메인 문서 참조)

도메인 문서가 상태 코드와 함께 적은 코드만 등재한다. 설명 끝의 "현재 구현" 은 도메인 문서가 상태 코드를 구현 근거로 적은 코드다.

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `CANNOT_REVOKE_CURRENT_SESSION` | 400 | 단일 세션 강제 종료(`POST /api/auth/sessions/:familyId/revoke`)로 현재 요청의 refresh 토큰 쿠키와 맞는 세션 family 를 끝내려 함(자기 세션 종료 차단). 로그아웃을 쓰게 안내한다 | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `OAUTH_STATE_MISMATCH` | 400 | OAuth state 가 없거나 만료·소비됐거나 provider 가 다름. 로그인 콜백에서는 URL 신호 `invalid_state`(§3)로 바뀐다. 통합 OAuth 콜백도 같은 코드를 쓴다. 통합 콜백에서 이 코드가 어디에 남는지는 §6.21 표 아래에 있다 | [가입과 로그인 「에러 처리」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#에러-처리), [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
| `CANNOT_DELETE_PERSONAL` | 403 | personal 워크스페이스는 삭제할 수 없음(team 전용) | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `CANNOT_LEAVE_PERSONAL` | 403 | personal 워크스페이스는 탈퇴할 수 없음(team 전용) | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `SOLE_OWNER_CANNOT_LEAVE` | 403 | 유일한 소유자는 탈퇴할 수 없음 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `TARGET_IS_SELF` | 400 | 소유자 이양 대상으로 자기 자신을 지정함 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `TARGET_ALREADY_OWNER` | 409 | 소유자 이양 대상이 이미 소유자임 | [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `CURRENT_SESSION_REQUIRED` | 400 | 다른 세션 일괄 종료(`POST /api/auth/sessions/revoke-others`)에서 리프레시 쿠키가 없거나 그 쿠키로 현재 세션을 찾지 못함. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#세션-강제-종료) |
| `MEMBER_NOT_FOUND` | 404 | 역할 변경·소유자 이양·멤버 제거의 대상 멤버가 없음. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가) |
| `OWNER_ROLE_PROTECTED` | 403 | 역할 변경 대상이나 새 역할이 소유자임. 소유자 부여·박탈은 소유자 이양으로만 한다. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `CANNOT_TRANSFER_PERSONAL` | 403 | personal 워크스페이스는 소유자를 이양할 수 없음. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가) |
| `CANNOT_REMOVE_OWNER` | 403 | 소유자를 멤버에서 제거하려 함. 현재 구현 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md#멤버-변경과-직접-추가), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |

- 세션 API 의 경로는 `/api/auth/sessions` 다. 이 경로에 둔 근거는 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 과 [HTTP API 규약](CLE-API-CONV.md) 의 「세션 API 를 `/api/auth/sessions` 에 둔 이유」 Rationale 에 있다.
- **비슷한 이름 주의**: 소유자가 들어간 403 코드는 두 부류다. `OWNER_REQUIRED`(§6.2)는 요청자의 역할이 부족할 때 난다. `OWNER_ROLE_PROTECTED` · `CANNOT_ASSIGN_OWNER`(§6.12) · `CANNOT_REMOVE_OWNER` 는 대상 멤버나 부여하려는 역할 값이 소유자일 때 난다. 한 요청이 두 부류에 다 걸리면 소유자 대상 검사가 관리자 역할 규칙의 `OWNER_REQUIRED` 보다 먼저다. 동작마다 검사 순서는 [워크스페이스와 멤버 「관리자 역할 규칙」](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할-규칙) 이 정한다.

## Rationale

### `ACCOUNT_LOCKED` 423 → 401 오기 정정 (2026-08-31)

카탈로그는 423, 구현(`auth.service.ts` 의 `UnauthorizedException`)과 계정 데이터 흐름 문서의 두 표는 401 이었다. 낡은 것이 아니라 처음부터 틀렸다. `git log -S "LockedException"` 이 백엔드 auth 에서 0건이라 423 을 던진 적이 없고 그 행은 최초 초안부터 그대로였다.

**기각한 대안: 구현을 423 으로 바꾸기.** 상태 코드는 API 계약이라 클라이언트가 401 로 분기해 재로그인을 유도하고 있을 수 있다. 문서가 틀렸다는 근거가 실측으로 확정됐으므로 문서를 고치는 쪽이 위험이 없다. 423 이 의미상 낫다는 판단은 별개 제품 결정이다.

### `TOKEN_EXPIRED` 설명을 리프레시 토큰 만료로 맞춘 이유

원문 카탈로그는 이 코드를 액세스 토큰 만료로 설명했다. 인증 흐름 문서는 리프레시 토큰 단순 만료에 이 코드를 쓴다고 정하고([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)) 현재 구현도 갱신 경로에서만 던진다. 카탈로그는 정의 문서를 따르므로(규칙 8) 설명을 정의 문서에 맞췄다. 만료된 액세스 토큰에 전용 코드를 줄지는 이 정렬과 별개인 제품 결정이다.

### 관리자 역할 규칙의 거부에 `OWNER_REQUIRED` 를 다시 쓴다 (2026-10-10)

2026-10-10 에 관리자 역할을 주고 빼는 일을 소유자 전용으로 정했다(NERV Task `CLE-T-0W7CA7`, [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#관리자-역할을-주고-빼는-일은-소유자만-한다)). 소유자가 아닌 요청자의 요청은 가드를 통과한 뒤 서비스 계층이 403 `OWNER_REQUIRED` 로 거부한다. 거부 본문은 `workspace-roles.ts` 의 `ADMIN_ROLE_CHANGE_REQUIRES_OWNER` 이고 코드 값은 가드의 소유자 미달 코드(`ROLE_REQUIRED.owner.code`)를 그대로 쓴다. 메시지만 «관리자 역할은 소유자만 주거나 뺄 수 있습니다.» 로 이 동작에 맞췄다.

- **규칙 6 의 새 조건으로 보지 않았다.** 뜻이 "이 동작은 소유자만 한다" 로 가드의 소유자 미달과 같다. 클라이언트가 할 일도 소유자에게 맡기는 것 하나다. 서비스 계층이 가드 코드를 다시 쓰는 선례도 있다. 소유자 이양의 서비스 재검증이 같은 코드를 낸다.
- **초대 모듈의 소문자 관례를 따르지 않았다.** 「예외 등록 근거에 "모듈 안 일관성 보존" 도 들어가는 이유」 는 이미 소문자로 굳은 코드를 지키는 근거다. 새 코드를 소문자로 만들라는 규칙이 아니다(규칙 7). 초대 라우트는 2026-09-25 부터 가드의 대문자 코드(`NOT_A_MEMBER`, `ADMIN_REQUIRED`)를 이미 낸다. 그래서 대문자 `OWNER_REQUIRED` 가 더해져도 그 엔드포인트 응답에 새로운 대소문자 혼재는 생기지 않는다.
- **같은 코드의 메시지는 발행처마다 다르다.** 규칙 4 대로 클라이언트는 메시지가 아니라 코드와 요청한 동작으로 안내를 고른다. 프론트엔드는 소유자 이양 대화 상자에서만 이 코드로 토스트를 가르고 초대와 역할 변경은 서버 메시지를 그대로 보여 준다. 그래서 코드를 다시 써도 안내가 섞이지 않는다.

기각한 대안은 다음과 같다.

- 관리자 역할 변경 전용 코드를 새로 만든다: `OWNER_REQUIRED` 와 뜻이 같은 쌍둥이 코드가 된다.
- 초대 모듈만 소문자 `owner_required` 를 쓴다: 위 둘째 항목의 이유로 기각했다. 같은 거부가 직접 추가·역할 변경과 초대에서 다른 코드가 된다.
- `ADMIN_REQUIRED` 를 쓴다: 요청자는 이미 관리자라 틀린 안내가 된다.
- 기본 코드 `FORBIDDEN` 을 쓴다: 맥락 특화 코드가 있는데 일반 코드로 내리면 클라이언트가 소유자에게 맡기라는 안내를 고를 수 없다.

### `ADMIN_REQUIRED` · `EDITOR_REQUIRED` 행에 통합의 발행 경로를 더했다 (2026-11-07)

NERV Task `CLE-T-B4WH9N`(통합 스펙 정리)이 최신 승인본과 대조해 넘긴 두 건이다. 코드 변경은 없다. 이미 있는 발행 경로를 카탈로그가 빠뜨렸던 것을 채웠다. 두 행에 적은 나머지 통합 OAuth 발행 자리(조직 통합의 설치 대기 행 재쓰기, 콜백의 커밋 직전 재판정 `assertOrgScopeModifiable` · `assertPersonalWriteRole`)의 정의 근거는 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md) 의 요구사항이다(부모 문서 「하위 문서」 절에 번호를 적었다).

- **`ADMIN_REQUIRED`**: 관리자 미만이 조직 공개 범위로 `oauth/begin` 을 `new` 모드로 부르면 다시 쓸 설치 대기 행을 찾기 전에 이 코드로 거절한다. 컨트롤러가 통합 생성과 같은 판정(`IntegrationsService.assertCanCreate`)을 부른다. 통합 OAuth 의 발행 자리를 두 곳에서 세 곳으로 고쳤다.
- **`EDITOR_REQUIRED`**: 통합 쓰기 라우트와 `oauth/begin` 에는 편집자 이상 라우트 가드가 붙는다. 뷰어가 부르면 대상의 공개 범위와 상관없이 이 코드다. 기준은 [통합 관리 「권한」](../CLE-INT/CLE-INT-MANAGE.md#권한) 의 «역할 거부 코드는 라우트 가드가 먼저 정한다» 다. 관련 문서 칸에 그 문서를 더했다.
