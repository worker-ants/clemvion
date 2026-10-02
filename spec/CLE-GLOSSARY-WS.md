---
id: "CLE-GLOSSARY-WS"
title: "용어 사전 — 제품과 작업 공간"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "22c90e37ede940cbb4dd3373510bc39340b1bb76eee753cb91375090f9c4d83d"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "00fe3064a2bc91af8832e284080d8af6b0ff00f5ccd0bbef9e1bf6dd8ad8edc9"
etag: "sha256-06fe29fd199ff0ffce66d7298a5a733ab7950fe6be17544a28250dc2b70e22b6"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「제품과 작업 공간」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기는 [용어 사전](CLE-GLOSSARY.md) 에 있고, 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| Clemvion | Clemvion | 이 제품의 이름. 영문 한 가지로만 쓴다. | 없음 | [브랜드](CLE-UI/CLE-UI-BRAND.md) |
| SaaS | SaaS | 클라우드에서 여러 고객이 함께 쓰는 배포 형태. | 없음 | [Clemvion 제품 개요](CLE-VISION.md) |
| 셀프 호스팅 | self-hosting | 고객이 자기 인프라에 직접 설치해 운영하는 배포 형태. 코드는 SaaS 와 같다. | 셀프호스트, 온프레미스(같은 뜻으로) | [Clemvion 제품 개요](CLE-VISION.md) |
| 사용자 | User, `user` | 로그인 계정 한 명. | 유저 | [계정과 워크스페이스 데이터 흐름](CLE-ACCT/CLE-ACCT-DATA.md) |
| 워크스페이스 | Workspace, `workspace` | 워크플로우·통합·설정 같은 리소스를 격리하는 단위. 사용자는 개인 워크스페이스 1개와 팀 워크스페이스 여러 개에 속한다. | 작업 공간, Workspace(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 개인 워크스페이스 | personal workspace, `Workspace.type=personal` | 가입할 때 자동으로 생기는 1인 워크스페이스. 삭제·나가기·초대·소유자 이양을 할 수 없다. | personal workspace(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 팀 워크스페이스 | team workspace, `Workspace.type=team` | 사용자가 만들고 멤버를 초대하는 공유 워크스페이스. | team workspace(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 현재 워크스페이스 | active workspace, `activeWorkspaceId`, `X-Workspace-Id` | 화면이나 요청이 대상으로 삼는 워크스페이스. 화면 라우팅은 슬러그로 정하고, 서버 인가는 `X-Workspace-Id` 헤더, 없으면 토큰 클레임으로 정한다. 어느 층의 값인지 함께 적는다. | 활성 워크스페이스, 워크스페이스 컨텍스트, 세션 workspaceId | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 워크스페이스 슬러그 | slug, `Workspace.slug` | URL `/w/<slug>/…` 에 들어가는 워크스페이스 식별자. 만들 때 정하고 바꾸지 않는다. 화면 라우팅 기준이며 서버 인가 기준은 아니다. | URL slug | [레이아웃과 내비게이션](CLE-UI/CLE-UI-LAYOUT.md) |
| 워크스페이스 설정 | workspace settings, `Workspace.settings` | 워크스페이스마다 두는 설정 키 묶음(기본 시간대, 임베드 허용 도메인, 동시 실행 제한). 관리 화면을 가리킬 때는 "워크스페이스 관리 화면" 이라고 쓴다. | 없음 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 기본 시간대 | default timezone, `Workspace.settings.timezone` | 시간대를 정하지 않은 스케줄과 AI 노드 시스템 컨텍스트가 쓰는 워크스페이스 IANA 시간대. | 기본 타임존 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 멤버 | Member, `WorkspaceMember` | 워크스페이스에 속한 사용자. 역할과 상관없이 소속된 사람 전체를 말한다. | 구성원, 멤버(편집자 역할 이름으로) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 멤버 ID | member id, `workspace_member.id` | 멤버 관련 API 와 소유자 이양이 받는 식별자. 사용자 ID(`user.id`)와 다르다. | 없음 | [계정과 워크스페이스 데이터 흐름](CLE-ACCT/CLE-ACCT-DATA.md) |
| 역할 | Role, `WorkspaceMember.role` | 워크스페이스 안 권한 등급. 소유자·관리자·편집자·뷰어 네 단계이고 위 역할은 아래 역할 권한을 모두 포함한다. | 권한 레벨 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 소유자 | Owner, `owner` | 워크스페이스를 삭제하거나 소유권을 넘길 수 있는 최상위 역할. | Owner(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 관리자 | Admin, `admin` | 멤버와 워크스페이스 설정을 관리하는 역할. 제품을 운영하는 사람은 "운영자" 로 쓴다. | Admin(본문), 어드민, 관리자(운영자 뜻으로) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 편집자 | Editor, `editor` | 워크플로우·트리거·스케줄을 만들고 실행하는 역할. 현재 화면 라벨은 "멤버" 다(결정 항목). | Editor(본문), 멤버(역할 이름으로) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 뷰어 | Viewer, `viewer` | 읽기만 할 수 있는 역할. | 조회자, Viewer(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 권한 하한 | minimum role, `@Roles()`, `RoleGate` | 화면이나 API 가 요구하는 최소 역할. 본문은 "관리자 이상" 처럼 쓴다. | Admin+, admin 이상, Editor+, editor+, editor 이상(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 권한 매트릭스 | RBAC matrix, `RolesGuard` | 리소스와 역할마다 허용 동작을 적은 표. 한 문서에만 둔다. | 역할 권한 매트릭스, RBAC 요약 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 참조의 소속 | reference ownership, `assertReferenceInScope` | 요청 본문이 보내 컬럼에 저장되는 참조 id 가 가리켜도 되는 범위. 워크스페이스 리소스는 요청자의 워크스페이스, 노드·연결선 끝점 같은 구조 참조는 같은 워크플로우다. 서버가 저장 전에 거부한다. 요청이 도는 워크스페이스를 보는 가드 검사와 다르다. | cross-workspace refs(본문) | [데이터 모델 개요](CLE-PLAT/CLE-PLAT-DATA.md) |
| 운영자 | operator | 제품을 배포하고 운영하는 사람. 워크스페이스 관리자 역할과 다르다. | 관리자 개입(이 뜻으로), 시스템 관리자 | [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md) |
| 초대 | Invitation, `WorkspaceInvitation` | 관리자 이상이 이메일로 보내는 팀 워크스페이스 합류 요청. 7일 안에 한 번만 쓸 수 있고 받는 사람 이메일이 일치해야 한다. | invitation(본문) | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 초대 토큰 | invitation token, `invitationToken`, `token` | 초대 링크에 들어가는 64자 일회용 토큰. | 없음 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 멤버 직접 추가 | add member, `POST /api/workspaces/:id/members` | 이미 가입한 사용자를 메일 없이 바로 멤버로 넣는 경로. 초대와 다른 합류 경로다. | 가입 사용자 즉시 추가 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 소유자 이양 | transfer ownership, `transfer-ownership` | 현재 소유자가 다른 멤버에게 소유자 역할을 넘기는 동작. 기존 소유자는 관리자가 된다. | 소유권 이전, Owner 이양, 양도 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 가입 | sign up | 이메일과 비밀번호, 또는 소셜 로그인으로 계정을 만드는 절차. 초대 링크로 가입하면 초대도 함께 수락한다. | 없음 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 소셜 로그인 | OAuth login, `auth_oauth_state` | Google·GitHub 같은 외부 계정으로 로그인하는 방식. 통합의 OAuth 연결과 다른 흐름이다. | 없음 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| OAuth 전용 계정 | OAuth-only account, `password_hash IS NULL` | 비밀번호 없이 소셜 로그인으로만 가입한 계정. 2단계 인증도 없으면 계정 재인증을 할 수 없다. | OAuth-only, OAuth 단독 가입 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 2단계 인증 | 2FA | 비밀번호 다음에 한 번 더 확인하는 로그인 단계. TOTP 와 Passkey·보안 키 두 방식이 있다. | 이중 인증, 2FA(본문 단독) | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| TOTP | TOTP, `two_factor_enabled` | 인증 앱이 만드는 6자리 코드로 하는 2단계 인증. `two_factor_enabled` 는 TOTP 사용 여부만 뜻한다. | OTP | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| Passkey·보안 키 | WebAuthn, `WebAuthnCredential` | 브라우저 WebAuthn 인증기로 하는 2단계 인증. 하나라도 등록돼 있으면 로그인 때 이 방식만 보여 주고 TOTP 로 자동 전환하지 않는다. | 패스키, WebAuthn(본문 단독) | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 복구 코드 | recovery code, `totp_recovery_codes`, `webauthn_recovery_codes` | 2단계 인증 수단을 잃었을 때 쓰는 일회용 코드. TOTP 와 Passkey 가 10개짜리 코드 묶음을 따로 쓴다. | 백업 코드 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 챌린지 토큰 | `challengeToken` | 비밀번호를 통과한 뒤 2단계 인증 검증을 부를 때 쓰는 단기 토큰. | 없음 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 계정 잠금 | account lock, `ACCOUNT_LOCKED` | 로그인이 5번 연속 실패하면 10분 동안 로그인을 막는 상태. | 없음 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 이메일 변경 | email change, `pendingEmail` | 계정 재인증, 새 주소 확인 메일, 링크 확인 순서로 로그인 이메일을 바꾸는 절차. 확정되면 다른 로그인 세션을 모두 끊는다. | 없음 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 비밀번호 재설정 | password reset | 로그인하지 못할 때 메일 링크로 비밀번호를 새로 정하는 절차. 로그인한 상태에서 바꾸는 것은 "비밀번호 변경" 이다. | 없음 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 로그인 세션 | login session, refresh token family, `family_id` | 기기 하나의 로그인 상태. 리프레시 토큰이 바뀌어도 `family_id` 가 같으면 같은 세션이다. 목록·강제 종료·재사용 감지가 이 단위로 동작한다. | 디바이스 세션, family(본문), 세션(단독) | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 액세스 토큰 | access token, `accessToken` | API 호출에 쓰는 15분짜리 JWT. | Access Token(본문) | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 리프레시 토큰 | refresh token, `refreshToken` | 액세스 토큰을 다시 받을 때 쓰는 토큰. HttpOnly 쿠키로 오간다. | refresh 토큰, Refresh Token(본문) | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 토큰 회전 | refresh token rotation | 리프레시 토큰을 쓸 때마다 새 토큰을 주고 옛 토큰을 바로 무효로 만드는 동작. 옛 토큰이 다시 쓰이면 세션 전체를 끊는다. | 회전(단독) | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 로그인 유지 | remember me, `rememberMe` | 켜면 리프레시 토큰 수명이 7일에서 30일로 늘어나는 로그인 옵션. | Remember me, remember-me | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 세션 강제 종료 | session revoke | 사용자가 특정 로그인 세션이나 다른 모든 세션을 끝내는 동작. | 세션 revoke | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 계정 재인증 | reauthentication, `verifyReauth` | 세션 강제 종료나 이메일 변경 전에 비밀번호 또는 TOTP 로 본인임을 다시 확인하는 절차. 실패하면 `REAUTH_REQUIRED` 를 낸다. | 재인증(단독), step-up | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 비밀번호 재확인 | password re-check, `verifyPasswordForUser` | 2단계 인증 끄기·복구 코드 재발급·인증 설정 평문 보기처럼 비밀번호만 받는 본인 확인. 계정 재인증과 에러 코드가 다르다. | 재인증(이 뜻으로) | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 로그인 힌트 쿠키 | `has_session` | 프론트 서버가 로그인 여부를 미리 짐작하는 30일 쿠키. 인증 수단이 아니다. | 없음 | [세션과 토큰](CLE-ACCT/CLE-ACCT-SESSION.md) |
| 내 프로필 | profile | 이름·비밀번호·언어·테마·보안 설정을 바꾸는 화면. | 없음 | [내 프로필](CLE-ACCT/CLE-ACCT-PROFILE.md) |
| 사용자 가이드 | User Guide, `/docs` | 앱 안에서 보는 한국어·영어 사용 설명서. | 유저 가이드, 사용자 매뉴얼, 매뉴얼, User Guide(본문) | [사용자 가이드](CLE-UI/CLE-UI-GUIDE.md) |
| 빈 상태 | empty state, `EmptyState` | 데이터가 없거나 필터 결과가 0건일 때 보이는 안내와 버튼. | Empty State(본문) | [오류 화면과 빈 상태](CLE-UI/CLE-UI-ERRORS.md) |
| 전체 화면 오류 | error page variant | 세션 만료·권한 없음·페이지 없음·서버 에러·네트워크 오류 다섯 경우에 보이는 전체 화면 안내. | 없음 | [오류 화면과 빈 상태](CLE-UI/CLE-UI-ERRORS.md) |
| 인라인 안내 | inline alert | 화면 안에 계속 보이는 안내 상자. 인앱 알림과 다르다. | Inline Alert, 인라인 알림 | [레이아웃과 내비게이션](CLE-UI/CLE-UI-LAYOUT.md) |
| 상세 드로어 | detail drawer, `SlideDrawer` | 목록 행을 누르면 오른쪽에서 열리는 상세 패널. | 상세 패널, 우측 슬라이드 패널, drawer(본문) | [레이아웃과 내비게이션](CLE-UI/CLE-UI-LAYOUT.md) |
| 딥링크 | deep link | 특정 리소스 화면을 곧바로 여는 링크. 알림에서 리소스로, 스케줄에서 트리거로 이동할 때 쓴다. | drill-down | [레이아웃과 내비게이션](CLE-UI/CLE-UI-LAYOUT.md) |
| 옛 경로 흡수 라우트 | catch-all route | 슬러그 없는 옛 경로를 현재 워크스페이스 슬러그 경로로 넘기는 라우트. | catch-all(본문) | [레이아웃과 내비게이션](CLE-UI/CLE-UI-LAYOUT.md) |
| 마켓플레이스 | Marketplace | 워크플로우 템플릿·AI 에이전트 프리셋·통합 플러그인·커스텀 노드를 게시하고 설치하는 공간. 아직 구현하지 않았다. | Marketplace(본문) | [마켓플레이스 (구상)](CLE-UI/CLE-UI-MARKET.md) |
| 커스텀 노드 | custom node | 마켓플레이스로 설치할 사용자 정의 노드. 구현 전이다. | 노드 플러그인, 커스텀 플러그인 노드 | [마켓플레이스 (구상)](CLE-UI/CLE-UI-MARKET.md) |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「제품과 작업 공간」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.
