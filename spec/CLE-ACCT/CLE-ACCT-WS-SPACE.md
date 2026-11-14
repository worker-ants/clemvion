---
id: "CLE-ACCT-WS-SPACE"
title: "워크스페이스와 멤버 — 생성 · 전환 · 설정 · API"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-WS"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-WS"]
area: "CLE-ACCT"
content_hash: "0144162c6ecea259a319bec146ff9ae672d16e34f32d6a7bcfd7de6dd48d1150"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "c75d21ff4e56106727d1a57109327a019997c5b8cbc2993113e7464f6cc44d7f"
etag: "sha256-a35dd9ec09fb69c6a5e534351e26a7ae9f450fda9e6b8679cb68e38a7378df23"
---
## 개요

이 문서는 [워크스페이스와 멤버](CLE-ACCT-WS.md) 의 하위 문서로 워크스페이스의 종류와 생성, 전환, 관리 화면과 설정을 정하고 워크스페이스 · 멤버 · 초대 API 목록을 모은다.

## 워크스페이스 종류와 생성

| 종류 | 만드는 방법 | 특징 |
| --- | --- | --- |
| 개인 | 가입할 때 자동 생성 | 사용자당 1개. 삭제·나가기·초대·소유자 이양을 할 수 없다 |
| 팀 | 사용자가 `POST /api/workspaces` 로 생성 | 요청자가 소유자가 된다. 한 사용자가 여러 개를 소유할 수 있다. 멤버를 초대한다 |

워크스페이스 슬러그(slug, `Workspace.slug`)는 만들 때 정하고 이후 바꾸지 않는다. 이름을 바꿔도 URL 이 바뀌지 않아 딥링크와 북마크가 유지된다.

### 첫 개인 워크스페이스 자동 생성

아래 경우에 개인 워크스페이스를 자동으로 만든다.

| 경로 | 조건 |
| --- | --- |
| 이메일 가입 | 이메일 인증을 마쳤을 때. `invitationToken` 으로 가입한 경우는 제외한다 |
| 소셜 로그인 (최초) | 신규 사용자를 자동 가입시킬 때 |

초대 토큰으로 가입한 사용자는 초대받은 팀 워크스페이스에 바로 멤버로 들어가므로 개인 워크스페이스를 만들지 않는다. 이때 JWT `activeWorkspaceId` 클레임도 그 팀 워크스페이스로 발급한다(`auth.service.ts` 의 `resolveTokenWorkspaceContext`). 그 사용자가 나중에 개인 워크스페이스를 원하면 워크스페이스 관리 화면에서 직접 만들 수 있다.

| 항목 | 값 |
| --- | --- |
| 이름 | "{사용자 이름}'s Workspace" |
| 슬러그 | 사용자 이메일 로컬 파트 + 랜덤 4자리 (예: `gehrig-a1b2`) |
| 종류 | `personal` |
| 멤버 역할 | `owner` |
| 기본 시간대 | 정의가 갈린다. [미결 사항](CLE-ACCT-WS.md#미결-사항) 참조 |

개인 워크스페이스가 사용자마다 하나라는 규칙은 DB 부분 유니크 인덱스와 앱의 `WorkspacesService.findOrCreatePersonalWorkspace` 가 함께 지킨다. 자세한 내용은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 에 있다.

### 팀 워크스페이스 생성

`POST /api/workspaces { name }` 으로 만든다. 서버는 종류를 `team` 으로 고정하고 슬러그를 `team-<uuid 앞 8자>` 로 만든다(`createTeam`). 요청자는 소유자 멤버가 되고 `settings` 는 빈 객체로 시작한다. 응답은 201 이고 `data` 에 `{ id, name, type, slug }` 가 온다.

## 워크스페이스 전환

현재 워크스페이스(active workspace, `activeWorkspaceId`, `X-Workspace-Id`)는 화면과 요청이 대상으로 삼는 워크스페이스다. 화면 라우팅은 URL 슬러그로 정하고, 서버 인가는 `X-Workspace-Id` 헤더, 헤더가 없으면 액세스 토큰 클레임으로 정한다.

- 사용자 영역 위의 워크스페이스 전환 블록에서 워크스페이스를 고르면 바로 전환하고 새 슬러그 URL(`/w/<slug>/dashboard`)로 이동한다. 전환 블록은 개인·팀 그룹과 현재 워크스페이스 표시를 담는다.
- 현재 워크스페이스는 URL 경로(`/w/<slug>/...`, 예 `/w/team-alpha/workflows`)에 나타난다. `(main)/w/[slug]` layout 이 슬러그를 워크스페이스로 풀고 다음 흐름을 구동한다: `useWorkspaceStore.currentWorkspaceId`(localStorage 저장), axios 의 `X-Workspace-Id` 헤더 첨부, `POST /api/auth/workspaces/:id/switch` 로 토큰 재발급. 슬러그는 `GET /api/workspaces` 응답 필드다.
- 처음 불러올 때(딥링크·북마크)는 URL 이 우선이다. `[slug]` layout 이 마운트될 때 풀어낸 워크스페이스가 저장된 현재 워크스페이스와 다르면 URL 에 맞춰 `switchWorkspace` 로 다시 맞춘다. AuthProvider 는 경로가 `/w/` 로 시작하면 저장된 값 기준의 재조정을 건너뛴다. 슬러그 없는 화면에서는 localStorage 값 기준으로 재조정한다.
- 무효하거나 멤버가 아닌 슬러그는 기본 워크스페이스로 보낸다. 이것은 편의 기능이지 인가 경계가 아니다. 실제 차단은 서버 `RolesGuard` 의 403 이다([API 인가](CLE-ACCT-WS-AUTHZ.md#api-인가)).
- 고른 워크스페이스에 따라 사이드바 메뉴의 데이터 범위가 바뀐다.
- 사용자 가이드(`/docs`, 워크스페이스와 무관한 콘텐츠)와 인증 화면(`/login` 등 `(auth)` 그룹)은 슬러그 밖에 있다. 에디터는 `/w/<slug>/workflows/<id>` 로 렌더되고 같은 슬러그 게이트로 URL 우선 재조정을 한다.
- 슬러그 없는 옛 경로·알림 딥링크·`/` 를 현재 워크스페이스 슬러그 경로로 넘기는 규칙과 `/w/` 로 시작하는 경로를 흡수하지 않는 규칙은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 이 정한다.

### 전환 API 와 토큰

`POST /api/auth/workspaces/:id/switch` 는 `AuthService.switchWorkspace` 가 대상 워크스페이스 멤버십을 확인한다. 멤버가 아니면 403 `NOT_A_MEMBER` 다. 멤버면 `activeWorkspaceId=:id` 로 액세스 토큰만 재발급한다. 리프레시 토큰은 워크스페이스와 무관한 opaque UUID 라 회전하지 않는다. 전환마다 새 로그인 세션을 만들면 세션이 쌓이고 옛 토큰이 버려진 채 남기 때문이다.

- 전환이 효력을 가지려면 인증 전략이 토큰 클레임을 존중해야 한다. `jwt.strategy` 는 토큰의 `activeWorkspaceId`(없으면 옛 이름 `workspaceId`)를 읽어 멤버십을 확인하고 그 워크스페이스를 `request.user.workspaceId` 로 쓴다. 클레임이 없거나(옛 토큰, 가입 직후) 멤버십이 사라졌으면 개인 워크스페이스, 없으면 첫 멤버십으로 대체한다.
- 리프레시 토큰은 클레임을 담지 않으므로 전환 뒤 다음 갱신은 현재 워크스페이스를 DB 로 다시 푼다(개인 우선, 없으면 첫 멤버십). v1 에서는 필요하면 전환을 다시 부르는 것으로 충분하다. 갱신 뒤에도 현재 워크스페이스를 유지하는 기능은 후속 과제다.
- 프론트엔드 `workspace-store.switchWorkspace(id)` 는 전환 API 를 불러 재발급된 액세스 토큰을 저장하고 헤더 첨부도 계속한다. 불러올 때 저장된 `currentWorkspaceId` 와 토큰의 현재 워크스페이스가 다르면 전환 API 로 토큰을 다시 맞춘다. 프론트가 헤더 첨부를 없애면 토큰 클레임이 유일한 기준이 되고, 그때 옛 클레임 이름 dual-read 도 정리한다.

## 워크스페이스 관리 화면

`/workspace/settings` 한 페이지에 탭 세 개(개요·멤버·위험 영역)를 둔다. 멤버라면 누구나 들어오고 역할에 따라 탭과 동작이 제한된다. 페이지 헤더에는 현재 워크스페이스의 종류 아이콘(개인 👤, 팀 👥)과 이름, 한 줄 설명이 있어 무엇을 관리하는지 바로 알 수 있다. 팀 워크스페이스 설명 예는 "멤버와 함께 협업하는 공간이에요" 다.

| 탭 | 들어가는 요소 | 동작과 권한 |
| --- | --- | --- |
| 개요 | Name 입력, Slug(읽기 전용), Type(개인·팀), 내 Role, 임베드 허용 도메인 섹션 | 이름과 임베드 허용 도메인은 관리자 이상만 편집한다. 그 밖의 역할에는 읽기 전용으로 보인다 |
| 멤버 (팀 워크스페이스 전용) | 역할 범례(소유자 모든 권한, 관리자 멤버 관리, 편집자 워크플로우 편집, 뷰어 읽기만), 초대 입력(이메일, 역할 선택, [초대]), 대기 중 초대 목록(이메일·역할·만료일, [재발송]·[취소]), 현재 멤버 목록(이름·이메일·역할 드롭다운·제거) | [멤버 관리](CLE-ACCT-WS-MEMBER.md#멤버-관리) 표의 권한을 따른다. 소유자가 아닌 관리자에게는 역할 선택지에 관리자가 없고 관리자 멤버의 역할은 읽기 전용 배지로 보인다([관리자 역할 규칙](CLE-ACCT-WS-MEMBER.md#관리자-역할-규칙)) |
| 위험 영역 | [워크스페이스 나가기], [소유자 이양], [워크스페이스 삭제] | 나가기는 소유자가 아닌 모든 멤버(확인 다이얼로그를 거친다), 소유자 이양은 소유자만(새 소유자 이메일 재입력 확인), 삭제는 소유자만(이름 재입력 확인 필수) |

역할 이름은 사전 표준(소유자·관리자·편집자·뷰어)으로 적는다. 현재 화면 라벨은 편집자를 "멤버" 로 보여 준다. 이 차이는 [용어 사전 — 결정이 필요한 표기](../CLE-GLOSSARY-OPEN.md) 의 「editor 역할의 화면 라벨」 항목(D10)이다.

### 임베드 허용 도메인

개요 탭의 임베드 허용 도메인 섹션은 웹채팅 위젯을 넣을 수 있는 origin 목록(`Workspace.settings.interactionAllowedOrigins`)을 관리한다.

| 항목 | 내용 |
| --- | --- |
| 편집 권한 | 소유자와 관리자. 그 밖의 역할은 읽기 전용 표시. 화면은 `useHasRole("admin")` 로 판정하고 역할 계층상 소유자도 포함된다 |
| 동작 | `GET /api/workspaces/:id/settings`(멤버)로 현재 값을 불러와 origin 을 더하거나 뺀 뒤 [저장] 으로 `PATCH /api/workspaces/:id/settings`(관리자 이상)를 보낸다 |
| 검증 | 형식 `http(s)://host[:port]`(scheme 필수, path·query 불가). 클라이언트가 중복을 막는다. 서버는 형식을 다시 검사하고 끝 슬래시를 정규화한다 |
| 의미 | 목록의 origin 은 built-in 위젯 CDN origin 에 더해 `/api/external/*` CORS 와 임베드에 허용된다. 빈 목록이면 추가 origin 이 없다. CORS 는 built-in 만 허용하고, 임베드 soft 검증은 `enforce=false` 라 모두 허용한다. 두 층의 차이는 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 이 정한다 |
| 반영 지연 | 임베드 soft 검증 캐시가 최대 5분(`Cache-Control: max-age=300`) 이다 |

## 워크스페이스 설정

워크스페이스 설정(workspace settings, `Workspace.settings`)은 워크스페이스마다 두는 JSONB 키 묶음이다. 알려진 키는 다음과 같다. 모두 선택 키다.

| 키 | 뜻 | 기준 문서 |
| --- | --- | --- |
| `timezone` | 기본 시간대(default timezone). IANA 식별자. 서비스 계층이 `Intl.DateTimeFormat` 으로 검증하고 빈 문자열은 설정 해제다. 값이 없을 때의 폴백은 소비하는 쪽이 정한다: AI 노드 시스템 컨텍스트는 [AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md), 스케줄은 [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md). 폴백 값은 [미결 사항](CLE-ACCT-WS.md#미결-사항) 참조 | 이 문서 |
| `interactionAllowedOrigins` | 임베드 허용 도메인. `/api/external/*` CORS 추가 허용 목록이면서 임베드 origin 허용 목록 | [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) |
| `maxConcurrentExecutions` | 워크스페이스당 동시 `running` 실행 상한. 없으면 기본 10 | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) |

- 설정은 `PATCH /api/workspaces/:id/settings` 로 바꾼다. 관리자 이상만 할 수 있다. 서비스 계층 `assertAdmin` 이 소유자·관리자가 아니면 403 `ADMIN_REQUIRED` 로 거부한다.
- 보낸 키만 기존 `settings` 에 병합한다(`settings = { ...settings, 보낸 키 }`). 다른 키는 보존한다.
- 조회 `GET /api/workspaces/:id/settings` 는 뷰어를 포함한 모든 멤버가 할 수 있다. 설정 화면 표시에 쓴다.

## API

설명 칸의 응답은 `{ data }` 봉투 안의 내용만 적는다.

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/workspaces` | 로그인 | 내 워크스페이스 목록. 슬러그를 싣는다 |
| POST | `/api/workspaces` | 로그인 | 팀 워크스페이스 생성. 본문 `{ name }`. 요청자가 소유자. 201 `{ id, name, type, slug }` |
| PATCH | `/api/workspaces/:id` | 관리자 이상 | 이름 변경 전용. 본문 `{ name: string }`(2~100자) |
| GET | `/api/workspaces/:id/settings` | 멤버(뷰어 포함) | 설정 조회. 응답 `{ interactionAllowedOrigins: string[]; timezone?: string; maxConcurrentExecutions?: number }`. 비멤버 403 `NOT_A_MEMBER` |
| PATCH | `/api/workspaces/:id/settings` | 관리자 이상 | 설정 변경. 본문 키는 모두 선택: `interactionAllowedOrigins?: string[]`, `timezone?: string`, `maxConcurrentExecutions?: number`. 보낸 키만 부분 병합한다. 키별 검증은 [워크스페이스 설정](#워크스페이스-설정) 과 [임베드 허용 도메인](#임베드-허용-도메인). 응답 200 `{ id, name, type, slug, settings }`. 권한 부족 403 `ADMIN_REQUIRED` |
| DELETE | `/api/workspaces/:id` | 소유자 | 팀 워크스페이스 삭제. 트랜잭션 처리 |
| POST | `/api/workspaces/:id/leave` | 본인 | 스스로 탈퇴. 유일한 소유자는 막는다 |
| POST | `/api/workspaces/:id/transfer-ownership` | 소유자 | 소유자 이양. 본문 `{ newOwnerMemberId }`(멤버 ID). 대상은 소유자가 아닌 멤버. 트랜잭션 안에서 역할 교환과 `ownerId` 동기화 |
| GET | `/api/workspaces/:id/members` | 멤버 | 멤버 목록 |
| POST | `/api/workspaces/:id/members` | 관리자 이상 | 이미 가입한 사용자 직접 추가. 본문 `{ email, role }`. `role=admin` 은 소유자만(403 `OWNER_REQUIRED`) |
| PATCH | `/api/workspaces/:id/members/:memberId` | 관리자 이상 | 역할 변경. 본문 `{ role }`. 대상의 지금 역할이나 새 역할이 관리자면 소유자만(403 `OWNER_REQUIRED`) |
| DELETE | `/api/workspaces/:id/members/:memberId` | 관리자 이상 | 멤버 제거. 관리자도 제거할 수 있다. 자기 자신이면 나가기로 넘긴다 |
| GET | `/api/workspaces/:id/invitations` | 관리자 이상 | 대기 중 초대 목록 |
| POST | `/api/workspaces/:id/invitations` | 관리자 이상 | 초대 토큰 발송. 본문 `{ email, role }`. 같은 이메일에 대기 중 초대가 있으면 그 행의 토큰을 바꾼다. `role=admin` 이나 관리자 역할 대기 초대 덮어쓰기는 소유자만(403 `OWNER_REQUIRED`). 201 `{ id, email, role, expiresAt }`. 분당 10건 |
| POST | `/api/workspaces/:id/invitations/:invitationId/resend` | 관리자 이상 | 초대 재발송. 토큰 교체, 만료 재시작. 관리자 역할 초대도 같다. 분당 10건 |
| DELETE | `/api/workspaces/:id/invitations/:invitationId` | 관리자 이상 | 초대 취소. `acceptedAt IS NULL` 인 행만. 관리자 역할 초대도 같다 |
| GET | `/api/invitations/:token` | 공개(인증 불요) | 초대 토큰 메타 조회. 가입 페이지 입력란 채우기용. 응답 `{ workspaceName, invitedByName, email, expiresAt, role }`. 없음 404, 만료·사용됨 410. 분당 30건 |
| POST | `/api/workspaces/invitations/accept` | 로그인 | 초대 수락. 본문 `{ token }`. 본인 이메일과 토큰 이메일이 같아야 한다. 200 `{ workspaceId, role }` |
| POST | `/api/auth/workspaces/:id/switch` | 로그인(`JwtAuthGuard`) | 워크스페이스 전환. `:id` 는 `ParseUUIDPipe`. 비멤버 403 `NOT_A_MEMBER`. 액세스 토큰만 `activeWorkspaceId=:id` 로 재발급하고 리프레시 쿠키는 그대로다. 응답 `{ accessToken }` |

- 컨트롤러는 두 개다. `workspaces.controller.ts`(`@Controller('workspaces')`)가 생성·멤버·초대 발급·수락 등 대부분을 받고, `invitations.controller.ts`(`@Controller('invitations')`)가 공개 토큰 메타 조회 하나를 받는다.
- `POST /api/auth/register` 가 본문에 `invitationToken?` 을 받으면 [초대 — 미가입자 가입 경로](CLE-ACCT-WS-INVITE.md#미가입자-가입-경로) 의 트랜잭션을 한다. 가입 API 는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 에 있다.
- 초대 가입 화면의 가입 여부 확인은 공개 API `POST /api/auth/check-email` 을 쓴다. 이 API 는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 이 정한다.

## 구현 위치

- `codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts` (워크스페이스 CRUD, 멤버 관리, 설정)
- `codebase/backend/src/modules/auth/auth.service.ts` (`switchWorkspace`, `registerWithInvitation`, `resolveTokenWorkspaceContext`)
- `codebase/frontend/src/components/workspace/**`
- `codebase/frontend/src/lib/stores/workspace-store.ts`
- `codebase/frontend/src/lib/api/workspaces.ts`
- `codebase/frontend/src/lib/workspace/href.ts`

## Rationale

### 현재 워크스페이스는 토큰 클레임이 정하고 전환기에는 헤더가 먼저다

2026-07-07 결정이다. 현재 워크스페이스를 액세스 토큰의 `activeWorkspaceId` 클레임으로 정하고 전환을 토큰 재발급으로 한다. 목표는 토큰이 현재 워크스페이스의 유일한 기준이 되어 멤버십 검증이 인증 진입점 한 곳으로 모이는 것이다. 헤더 우선 모델에는 "멤버십 검증이 모든 핸들러에 빠짐없이 깔려 있다" 는 분산된 전제에 기대는 정보 누출 위험이 있었다. 이 결정은 그 위험을 풀기 위한 인프라(전환 엔드포인트, 클레임 존중)를 도입했다.

기존 클라이언트와 e2e 는 `X-Workspace-Id` 헤더로 워크스페이스를 바꾼다. 호환을 깨지 않도록 `WorkspaceId` 데코레이터와 `RolesGuard` 는 헤더가 있으면 그 값을 먼저 쓴다. 헤더 위조(멤버가 아닌 워크스페이스 지정)는 `RolesGuard` 가 라우트 `@Roles()` 유무와 상관없이 하는 멤버십 검증이 403 으로 막으므로 정보 누출이 커지지 않는다. 완전한 토큰 기준(과 검증의 한 곳 수렴)은 클라이언트가 헤더 첨부를 없앨 때 이뤄지고, 그때까지 헤더는 전환의 권위 있는 수단으로 남는다. 전환 API 는 그 사이에도 토큰 클레임을 현재 워크스페이스와 맞춰 둔다. 헤더가 사라지면 바로 기준이 되게 하기 위해서다.

### 슬러그는 화면 라우팅 기준이고 서버 인가 기준이 아니다

프론트는 현재 워크스페이스를 URL 경로(`/w/<slug>/...`)로 나타낸다. 이것은 헤더가 나오는 출처만 바꾼다.

- 층을 나눈다. 슬러그는 화면 라우팅의 기준일 뿐이고 서버 인가 기준이 아니다. 인가는 여전히 헤더 우선, 다음 토큰 클레임 모델이 정한다. 슬러그 라우팅이 토큰 우선으로 되돌아간다는 뜻이 아니다. 토큰 우선은 격리 회귀로 이미 기각됐다. 경로 파라미터로 워크스페이스를 받는 라우트만 예외로 경로 값이 인가 대상이다.
- `X-Workspace-Id` 헤더 유지가 전제다. 슬러그 라우팅은 axios 인터셉터의 헤더 첨부(`client.ts`)가 계속된다고 보고 설계했다. 헤더 제거는 별도 결정이고 라우팅이 그것을 앞당기지 않는다.
- 프론트의 멤버십 확인은 편의 기능이다. `[slug]` layout 이 무효·비멤버 슬러그를 기본 워크스페이스로 보내는 것은 인가 경계가 아니다. 헤더 위조는 `RolesGuard` 가 403 `NOT_A_MEMBER` 로 막는다.
- 재조정은 URL 이 우선이다. 처음 불러올 때 `[slug]` layout 이 URL 워크스페이스로 스토어와 토큰을 맞춘다. 경쟁을 막으려고 AuthProvider 는 경로가 `/w/` 로 시작하면 저장된 값 기준의 재조정을 건너뛴다.
- 슬러그는 바뀌지 않는다(`workspace.slug` UNIQUE). 이름을 바꿔도 URL 이 그대로라 딥링크가 안정적이다.
