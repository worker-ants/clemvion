---
id: "CLE-API-CONV-URL"
title: "HTTP API 규약 — URL 과 요청"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-CONV"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-CONV"]
area: "CLE-API"
content_hash: "11bb00d9287b29a21698d0f23325329d7d217e289a13f2753a33cd9af1199457"
read_as: "approved_fallback"
task: "CLE-T-GWC9M3"
source_paths: []
mirror_sha256: "c44f090a17c5ade86a7f6f19742cdefdd6820dadf4b104a51a9648a55c5a288b"
etag: "sha256-54178b9461e7fd4d1d9357bc5b7e50a407a4a5b8bb20e604eb78f3eb33503862"
---
## 개요

이 문서는 [HTTP API 규약](CLE-API-CONV.md) 의 하위 문서로 URL 구조(명명 규칙과 그 예외 · 워크스페이스 스코핑 · 시스템 전역 API), HTTP 메서드, 요청 형식, 공통 API 패턴(상태 토글 · 유니크 제약 범위)을 정한다. 절 번호(§)와 「규칙 n」 은 부모 문서의 번호를 그대로 쓴다.

## 2. URL 구조

### 2.1 기본 패턴

```
{base_url}/api/{resource}
{base_url}/api/{resource}/{id}
{base_url}/api/{resource}/{id}/{sub-resource}
```

### 2.2 명명 규칙

| 규칙 | 예시 |
|------|------|
| 리소스는 복수형 명사 | `/api/workflows`, `/api/triggers` |
| 케밥 케이스 | `/api/knowledge-bases`, `/api/auth-configs` |
| 중첩은 2단계까지 | `/api/knowledge-bases/:id/documents` |
| 3단계 이상은 최상위로 분리 | `/api/documents/:docId` (필요할 때) |
| **자원 액션**: `/api/{resource}/{id}/{action}` 의 마지막 세그먼트는 자원이 아니라 동사(구)다. 앞 경로가 가리키는 자원에 가하는 동작이다. 케밥 케이스 복합 동사구도 포함한다(`run-now`, `transfer-ownership`, `set-default`). 목적어는 경로에 두고 액션 이름에 넣지 않는다. `/workflows/:id/nodes/:nodeId/execute` 가 맞고 `/workflows/:id/execute-node` 는 틀리다. Boolean 상태 필드의 단순 토글에는 이 형태를 쓰지 않는다(§12.1) | `/executions/:id/stop`, `/schedules/:id/run-now`, `/workflows/:id/nodes/:nodeId/execute` |
| **예외: RPC 형태 하위 채널 액션** `/api/{resource}/{id}/{channel}/{action}`. 자원 자체가 아닌 하위 채널에 가하는 부수 동작(`rotate-*`, `revoke-*`, `disable-*`, `switch` 등)이다. URL 만으로 자원·채널·동작을 식별할 수 있어야 해서 허용한다. 자원 액션에 `{channel}` 이 하나 더 끼는 자매 형태다. `/api/users/me` 의 `me` 는 로그인한 사용자 id 의 별칭이다. 그래서 이메일 변경 `/api/users/me/email-change/{action}` 도 이 형태다(채널 `email-change`) | `/api/triggers/:id/notification/rotate-secret`, `/api/triggers/:id/interaction/revoke-token`, `/api/triggers/:id/chat-channel/rotate-bot-token`, `/api/auth/workspaces/:id/switch`, `/api/users/me/email-change/request` |
| **예외: 인증 family 전용 네임스페이스** `/api/external/{resource}`. 로그인 세션·워크스페이스 인증이 아니라 실행 단위 토큰(per_execution token, `iext_*`) 같은 인터랙션 토큰으로만 접근하는 별도 인증 family 다. 같은 자원이라도 인증 주체와 호출하는 쪽이 달라 경로를 나눈다. 규칙 위반이 아니라 명시한 예외다. 상세는 [External Interaction API](../CLE-IX/CLE-EIA.md), 요청 빈도 제한은 [§7](CLE-API-CONV-RATE.md#7-요청-빈도-제한), 부재 표현은 [§5.5](CLE-API-CONV-RESP.md#55-부재-표현-null-과-키-생략) | `/api/external/executions/:id`, `/api/external/executions/:id/interact` |
| **예외: 인증 상태 전이와 capability 액션** `/api/auth/{action}`. 자원 CRUD 가 아니라 인증 상태 전이(자격 검증, 로그인·로그아웃·토큰 갱신, 비밀번호 재설정, 2단계 인증 등록·해제)이거나 그 전이에 필요한 읽기 전용 capability 조회(OAuth 시작, WebAuthn 가용성)다. 조작할 자원이 없거나(로그인) 자원을 노출하면 안 되므로(비밀번호 재설정 토큰) 복수형 명사로 표현할 수 없다. 2단계 인증 수단 관리(Passkey credential 목록 · 수정 · 삭제, `/api/auth/2fa/webauthn/credentials[/:id]`)도 이 묶음이다. 삭제가 `DELETE` 대신 `POST …/:id/delete` 인 것은 아래 「본문을 받아야 하는 삭제」 행이 정한다. 로그인 세션 목록 · 강제 종료는 아래 행이다. `/api/auth/workspaces/:id/switch` 는 RPC 형태 예외 쪽이다. 상세는 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/2fa/verify`, `/api/auth/oauth/:provider` |
| **예외: 리프레시 쿠키 Path 아래의 로그인 세션 자원** `/api/auth/sessions…`. 로그인 세션 목록 조회와 강제 종료는 인증 상태 전이가 아니라 자원 조회와 자원 액션이다. 그래도 `/api/auth` 아래에 둔다. 리프레시 쿠키의 Path 가 `/api/auth` 라서 브라우저는 그 아래 경로에만 쿠키를 보낸다. 서버는 그 쿠키로 현재 로그인 세션을 가려낸다. `auth` 아래에서도 자원 이름은 복수형 명사(`sessions`)이고 하나를 끝내는 동작은 자원 액션 형태(`:familyId/revoke`)다. 일괄 종료 `revoke-others` 는 규칙 2(자원 액션 `/{id}/{action}`)에서 벗어난 이름이고 선례로 삼지 않는다. 옛 경로의 이름을 그대로 둬 클라이언트 변경을 접두사 교체로 줄였다. 이 행의 라우트는 사용자 범위 라우트이며 현재 워크스페이스를 쓰지 않는다(`X-Workspace-Id` 불필요). 쿠키가 필요 없는 로그인 이력 조회는 `/api/users/me/login-history` 에 둔다. 근거는 Rationale 의 「세션 API 를 `/api/auth/sessions` 에 둔 이유」, 동작은 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) | `/api/auth/sessions`, `/api/auth/sessions/:familyId/revoke`, `/api/auth/sessions/revoke-others` |
| **예외: 본문을 받아야 하는 삭제** `POST /api/{resource}/{id}/delete`. 삭제 요청이 재확인 자격 증명(비밀번호)을 본문으로 받아야 하면 `DELETE` 대신 이 형태를 쓴다. 일부 CDN · 프록시가 `DELETE` 요청의 본문을 버리기 때문이다. 동작은 §3 의 `DELETE` 와 같은 자원 삭제이고 성공은 204 다. 2026-11-14 에 Passkey 삭제에서 처음 더한 예외다. 본문이 꼭 필요한 삭제에만 선례로 삼고, 본문 없이 지우는 삭제는 계속 `DELETE` 를 쓴다. 근거는 Rationale 의 「본문을 받아야 하는 삭제를 `POST …/delete` 로 받는다」 | `POST /api/auth/2fa/webauthn/credentials/:id/delete` |
| **예외: 인앱 알림의 일괄 동작** `/api/notifications/{action}`. 모두 읽음(`POST /api/notifications/mark-all-read`)과 모두 닫기(`POST /api/notifications/dismiss-all`)는 자원 하나가 아니라 본인 알림 여러 건에 한꺼번에 하는 동작이다. 규칙 2(자원 액션 `/{id}/{action}`)에서 벗어난 기존 이름이고 선례로 삼지 않는다. 근거는 Rationale 「인앱 알림의 읽음 경로와 일괄 동작을 §12.1 · §2.2 의 예외로 적었다 (2026-10-24)」에 있고 동작은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 이 정한다 | `/api/notifications/mark-all-read`, `/api/notifications/dismiss-all` |

### 2.3 워크스페이스 스코핑

모든 리소스 API 는 현재 워크스페이스 컨텍스트에서 동작한다.

- 현재 워크스페이스는 access token 의 `activeWorkspaceId` 클레임으로 정한다. `jwt.strategy` 가 멤버십을 검증한 뒤 그 값을 `request.user.workspaceId` 로 채택한다.
- 워크스페이스 전환은 토큰 재발급(`POST /api/auth/workspaces/:id/switch`)으로 한다.
- **전환기 하위 호환(header-first)**: `X-Workspace-Id` 헤더가 있으면 `WorkspaceId` 데코레이터와 `RolesGuard` 가 그 워크스페이스를 먼저 쓴다. 헤더가 없으면 토큰 클레임을 쓴다. 클라이언트가 헤더를 떼면 토큰 클레임이 단일 기준이 된다.
- **예외: 경로 파라미터로 워크스페이스를 받는 라우트**(`/api/workspaces/:id/...`, `POST /api/auth/workspaces/:id/switch`)는 경로 값이 인가 대상이다. 헤더와 토큰 컨텍스트를 쓰지 않는다(2026-09-25). 가드가 경로 값도 검증하는 근거는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#경로-파라미터-워크스페이스도-가드가-본다) 의 Rationale 「경로 파라미터 워크스페이스도 가드가 본다」에 있다.
- 결정 우선순위·전환 흐름·마이그레이션의 단일 기준은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#전환-api-와-토큰) 의 「전환 API 와 토큰」 절과 [「API 인가」](../CLE-ACCT/CLE-ACCT-WS.md#api-인가) 절이다.
- 구현 상태: 구현됨(2026-07-07). `jwt.strategy` 는 토큰 클레임을 `activeWorkspaceId ?? workspaceId` 로 이중으로 읽고 그 멤버십을 검증해 현재 워크스페이스를 확정한다. 데코레이터와 `RolesGuard` 는 전환기 동안 헤더를 먼저 본다.

```
전환기: X-Workspace-Id 헤더가 있으면 header-first 로 먼저 쓴다
X-Workspace-Id: {workspace-uuid}

헤더가 없으면 토큰 클레임(activeWorkspaceId)이 현재 워크스페이스다
Authorization: Bearer {access-token}   (payload.activeWorkspaceId)
```

헤더가 없거나 형식이 잘못됐거나 비멤버일 때 돌려주는 에러 코드는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 유효성 검증 절(`X-Workspace-Id` 세 갈래)에 있다.

#### 시스템 전역 API 예외

일부 관측용 API 는 워크스페이스 경계가 없는 시스템 전역 집계를 돌려준다. 이 부류는 `X-Workspace-Id` 를 받더라도 무시한다. 개별 워크스페이스나 사용자를 식별할 수 있는 데이터(레코드 id, payload 등)는 내보내지 않는다.

| 전역 API | 설명 |
|----------|------|
| `GET /api/system-status/overview` | 전체 BullMQ 큐의 집계 카운트와 health. 상세는 [시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md) |

## 3. HTTP 메서드

| 메서드 | 용도 | 멱등성 |
|--------|------|--------|
| GET | 리소스 조회 (목록·상세) | O |
| POST | 리소스 생성, 액션 실행 | X |
| PATCH | 리소스 부분 수정. 인앱 알림 읽음 `PATCH /api/notifications/:id/read` 는 §12.1 의 예외인 전용 경로다 | O |
| DELETE | 리소스 삭제. 본문(재확인 자격 증명)을 받아야 하는 삭제는 `POST /{id}/delete` 를 쓴다(§2.2 「본문을 받아야 하는 삭제」 예외) | O |
| PUT | 쓰지 않는다 (PATCH 를 쓴다) | 없음 |

## 4. 요청 형식

### 4.1 목록 조회 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| page | Integer | 페이지 번호 (1부터) | 1 |
| limit | Integer | 페이지 크기 (최대 100) | 20 |
| sort | String | 정렬 필드 (예: `created_at`) | `created_at` |
| order | `asc` / `desc` | 정렬 방향 | `desc` |
| search | String | 검색 키워드 | 없음 |

### 4.2 필터 파라미터

필터 파라미터는 리소스마다 따로 정한다. 예:

```
GET /api/workflows?status=active&tag=marketing
GET /api/triggers?type=webhook&status=active
```

## 12. 공통 API 패턴

### 12.1 상태 토글 패턴

리소스의 상태 필드를 토글(활성·비활성 등)할 때는 전용 엔드포인트를 만들지 않는다. **PATCH 본문에 바꿀 필드를 넣는다.**

```
PATCH /api/{resource}/{id}
Content-Type: application/json

{ "isActive": false }
```

| 규칙 | 설명 |
|------|------|
| 패턴 | `PATCH /:id { field: value }` |
| 전용 엔드포인트 불필요 | `POST /:id/activate`, `POST /:id/deactivate` 같은 전용 엔드포인트를 만들지 않는다 |
| 적용 대상 | `isActive`(워크플로우, 트리거, 스케줄), `isDisabled`(노드) 같은 Boolean 토글 필드. 토글 필드의 요청 본문 이름은 camelCase(`isActive`)다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md), [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md)) |
| 예외 | 인앱 알림의 읽음은 `PATCH /api/notifications/:id/read` 를 쓴다. 읽음은 `is_read` 의 한 방향 전이이고 읽지 않음으로 되돌리는 API 가 없다. 이 경로가 `PATCH` 인 것은 이미 구현된 경로를 그대로 두기 때문이다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md)). 모두 읽음 · 모두 닫기 · 닫기는 Boolean 토글이 아니므로 §2.2 가 정한다 |

상태 토글이 아닌 동작(실행, 중단, 복제, 권한 이양 등)의 경로 형태는 §2.2 의 자원 액션 행이 정한다.

### 12.2 유니크 제약 범위

| 필드 | 유니크 범위 | 설명 |
|------|------------|------|
| `Trigger.endpoint_path` | 전역 | 모든 워크스페이스를 통틀어 중복될 수 없다. 라우팅 키(`/api/hooks/:endpointPath`)가 워크스페이스와 무관한 전역 키이기 때문이다(V132) |

인덱스 정의는 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 인덱스 전략 절에 있다.

## 구현 위치

이 문서의 규칙은 컨트롤러 라우트 선언마다 흩어져 있어 한곳에 모인 구현이 없다. 워크스페이스 스코핑은 `jwt.strategy` · `WorkspaceId` 데코레이터 · `RolesGuard` 가 맡는다(§2.3). 공통 구현 위치는 [HTTP API 규약](CLE-API-CONV.md#구현-위치) 에 있다.

## Rationale

### 세션 API 를 `/api/auth/sessions` 에 둔 이유 (2026-10-10)

Task CLE-T-ERAJ7P 의 결정이다.

로그인 세션 목록과 강제 종료가 `/api/users/me/sessions` 에 있을 때는 리프레시 쿠키가 요청에 붙지 않았다. 쿠키의 Path 가 `/api/auth` 이기 때문이다. 그래서 서버가 현재 로그인 세션을 가려내지 못했다. 세 라우트를 `/api/auth/sessions…` 로 옮겼고 옛 경로는 별칭 없이 지웠다(404). 결함과 결정의 상세는 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 Rationale 「세션 API 를 리프레시 쿠키 Path 아래로 옮겼다」에 있다.

새 경로는 §2.2 의 기존 행 어디에도 맞지 않는다.

- `/api/auth/{action}` 예외는 인증 상태 전이와 그 전이에 필요한 capability 조회를 위한 것이다. 세션 목록은 자원이다.
- 쿠키가 필요 없는 본인 소유 자원은 `users/me` 에 둔다(로그인 이력 조회). 세션 목록과 강제 종료는 리프레시 쿠키가 있어야 현재 로그인 세션을 가린다.

`/api/auth` 아래의 Passkey credential 라우트(`/api/auth/2fa/webauthn/credentials[/:id]`)는 `/api/auth/{action}` 예외의 2단계 인증 등록 · 해제 묶음으로 설명되는 기존 예외이고 이 예외 행과는 근거가 다르다. 삭제의 `POST …/:id/delete` 형태는 2026-11-14 에 따로 더한 예외다(아래 「본문을 받아야 하는 삭제를 `POST …/delete` 로 받는다」).

그래서 §2.2 에 예외 행을 따로 두었다. 예외의 근거는 "현재 로그인 세션을 리프레시 쿠키로 가려야 한다" 하나로 좁혔다. 앞으로 `/api/auth` 아래에 자원 라우트를 더하려면 이 근거가 그 라우트에도 맞는지 먼저 본다. `revoke-others` 를 선례로 삼지 않는 것은 §2.2 의 행에 적었다.

기각한 대안은 네 가지다.

- `/api/auth/{action}` 예외의 문구를 넓혀 세션 라우트를 넣는 안. "인증과 관련된 것은 모두 `/api/auth`" 로 읽히게 돼 예외의 경계가 사라진다.
- 리프레시 쿠키 Path 를 `/api` 로 넓혀 세션 라우트를 `/api/users/me/sessions` 에 두는 안. 모든 API 요청에 리프레시 쿠키가 붙는다.
- 액세스 토큰에 로그인 세션 클레임을 넣어 쿠키 없이 현재 세션을 가리는 안. 토큰 계약과 토큰을 발급하는 모든 경로를 바꿔야 한다.
- 옛 경로를 별칭으로 남기는 안. 옛 경로로 온 요청은 여전히 현재 세션을 가려내지 못한다.

### 이메일 변경 경로를 하위 채널 액션의 예로 더했다 (2026-10-17)

§2.2 의 RPC 형태 하위 채널 액션 행에 `/api/users/me/email-change/{action}` 을 예로 더했다(NERV Task `CLE-T-D331TT`). 이 경로는 전부터 있었는데 어느 형태에 드는지 적힌 곳이 없었다. `me` 는 로그인한 사용자 id 의 별칭이므로 이 경로는 `/api/{resource}/{id}/{channel}/{action}` 과 같은 형태다. 그래서 예외 행을 새로 두지 않고 기존 행의 예로 넣었다.

### 인앱 알림의 읽음 경로와 일괄 동작을 §12.1 · §2.2 의 예외로 적었다 (2026-10-24)

§12.1 은 인앱 알림의 `is_read` 를 Boolean 토글의 적용 대상으로 들었지만 알림 모듈은 읽음을 처음부터 전용 경로 `PATCH /api/notifications/:id/read` 로 구현했다. 읽음은 되돌리지 않는 한 방향 전이다. 그래서 이 경로만 §12.1 의 예외로 적었다(NERV Task `CLE-T-3HJ8MM`). 이 경로가 `PATCH` 인 것은 이미 구현된 경로를 그대로 두기 때문이다.

모두 읽음 · 모두 닫기 · 닫기는 Boolean 토글에 해당하지 않는 `POST` 동작이다. 닫기는 `dismissed_at` 을 채우는 동작이다. 한 건 닫기 `POST /api/notifications/:id/dismiss` 는 §2.2 의 자원 액션 형태 그대로다. 두 일괄 경로 `mark-all-read` · `dismiss-all` 은 자원 id 없이 컬렉션 경로에 동사를 붙여 규칙 2 에서 벗어난다. 그래도 `revoke-others` 처럼 기존 이름을 그대로 두고 §2.2 에 예외로 적었다. 이 두 이름은 선례로 삼지 않는다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md#rationale)).

기각한 대안은 두 가지다.

- 읽음을 `PATCH /api/notifications/:id { isRead }` 로 바꾸는 안. 백엔드 · 프런트엔드 API 를 바꿔야 한다. 또 읽지 않음으로 되돌리는 동작이 없는데 토글 형태만 갖추게 된다.
- 두 일괄 경로를 규칙에 맞는 형태로 옮기는 안. 이미 쓰는 프런트엔드 호출과 응답 DTO 를 함께 바꿔야 하는데 동작은 같다. 경로를 바꿔 달라는 요구도 없다.

읽지 않음으로 되돌리는 기능이 생기면 `PATCH /api/notifications/:id { isRead }` 로 옮기는 것을 다시 본다.

### 본문을 받아야 하는 삭제를 `POST …/delete` 로 받는다 (2026-11-14)

NERV Task `CLE-T-Q6E11N` 의 사람 결정으로 Passkey 삭제에도 비밀번호 재확인을 둔다([Passkey 기능과 등록 「Passkey 삭제에도 비밀번호 재확인을 둔다」](../CLE-ACCT/CLE-ACCT-SIGNIN-PASSKEY.md#passkey-삭제에도-비밀번호-재확인을-둔다-2026-11-14)). 비밀번호는 요청 본문으로 받아야 한다. 일부 CDN · 프록시는 `DELETE` 요청의 본문을 버려서 §3 의 `DELETE` 를 그대로 쓰면 비밀번호가 서버에 닿지 않을 수 있다. 그래서 §2.2 에 `POST /{id}/delete` 예외를 더하고 §3 의 `DELETE` 행에서 그 예외를 가리켰다.

- **로그인 세션 강제 종료와는 근거가 다르다.** `POST /api/auth/sessions/:familyId/revoke` 도 재인증 자격 증명을 본문으로 받는 `POST` 다. 다만 `revoke` 는 삭제가 아니라 종료를 뜻하는 도메인 동사라 원래 자원 액션 형태다. 이 예외는 삭제 자체를 `POST` 로 옮긴다.
- **`/api/auth/{action}` 예외 행에 넣지 않았다.** 그 행은 경로를 `/api/auth` 아래에 두는 근거이고 메서드는 정하지 않는다. Passkey credential 은 복수형 자원(`credentials/:id`)이라 그 행의 근거로 메서드 예외를 설명할 수 없다.

기각한 대안은 두 가지다.

- `DELETE` 에 본문을 싣는 안. 중간 장비가 본문을 버리면 서버는 비밀번호가 빠진 요청으로 보고 거부한다. 사용자는 비밀번호를 맞게 넣고도 실패한다.
- 비밀번호를 쿼리 문자열이나 헤더로 받는 안. 쿼리 문자열은 접근 로그와 브라우저 기록에 남는다. 헤더로 받으면 비밀번호를 본문으로 받는 다른 재확인 라우트(TOTP 끄기 · Passkey 복구 코드 재발급)와 형식이 갈린다.
