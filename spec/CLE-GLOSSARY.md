---
id: "CLE-GLOSSARY"
title: "용어 사전"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "2f39ec5bb1d075986e290af97e60a67f6f9a4316fa91e8287247a0186e90c3a5"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "5019b2ef6c250d140840e730e5ff07f014707c91a0852bb3b2f7b00f389104c1"
etag: "sha256-eb88003ed272f86ef7b770c06dfd2c09dd7032128ca9abc46e37e85dbfc4a436"
---
## 개요

이 문서는 Clemvion 스펙 문서 전체가 따르는 표준 용어 사전이다. 같은 개념을 모든 문서가 같은 말로 부르게 하는 것이 목적이다.

- **적용 범위**: NERV 에 올라가는 모든 스펙 문서(`CLE-*`)에 적용한다. 새 문서를 쓸 때와 옛 스펙 문서를 옮겨 쓸 때 모두 이 사전을 따른다.
- **두 가지 쓰임**: 사람이 읽는 기준이면서, 문서 작성 에이전트가 표기를 치환할 때 쓰는 기준이다. 치환용 목록은 이 문서의 표에서 뽑는다.
- **사용자 가이드 용어집과의 관계**: 화면에 보이는 용어는 사용자 가이드 용어집([사용자 가이드](CLE-UI/CLE-UI-GUIDE.md) 의 `/docs` 용어 사전)과 실제 화면 문구를 따른다. 둘이 다르면 화면 문구를 따르고, 그 차이는 [결정이 필요한 표기](#결정이-필요한-표기)에 적는다.
- **이 문서가 정하지 않는 것**: 개념의 동작과 규칙은 각 표의 "기준 문서" 가 정한다. 이 사전은 이름과 한 줄 정의만 정한다.

관련 문서: [Clemvion 제품 개요](CLE-VISION.md) · [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) · [사용자 가이드](CLE-UI/CLE-UI-GUIDE.md)

## 표기 원칙

문서를 쓰는 사람과 에이전트는 아래 규칙을 이 순서대로 적용한다.

1. **화면에 보이는 개념은 화면 문구를 따른다.** 메뉴명·화면 제목·버튼 라벨이 있는 개념은 한국어 화면 문구와 사용자 가이드 용어집의 표기를 쓴다. 예: 워크플로우, 연결선, 통합, 지식 저장소, 모델 설정, 실행 내역. 가이드 용어집과 화면 문구가 다르면 화면 문구를 쓴다. 화면 문구끼리 서로 다르면 이 사전의 표준을 쓴다.
2. **화면에 없는 내부 개념은 코드 식별자를 기준으로 한다.** 엔진·프로토콜·데이터 개념은 한국어 표기가 널리 쓰이면 한국어로, 그렇지 않으면 영문 그대로 쓴다. 억지로 번역하지 않는다. 예: park, rehydration, dry-run, fire-and-forget, Graph RAG.
3. **코드 식별자·API 필드·enum 값·에러 코드는 원문 그대로 백틱으로 적는다.** 이것들을 본문 용어로 쓰지 않는다. "`ModelConfig` 를 저장한다" 가 아니라 "모델 설정(`ModelConfig`)을 저장한다" 로 쓴다.
4. **처음 나올 때 병기한다.** 문서에서 한 용어가 처음 나올 때는 `한국어(English, code_id)` 형식으로 쓴다. 예: 지식 저장소(Knowledge Base, `KnowledgeBase`). 그다음부터는 한국어 표준 용어만 쓴다. 영문이 표준인 용어는 `영문(code_id)` 로 쓴다. 예: Graph RAG(`rag_mode=graph`).
5. **다의어는 구분 표기를 쓴다.** 한 단어가 여러 뜻이면 [다의어 구분](#다의어-구분) 표의 구분 표기를 쓴다. 예: "실행" 은 워크플로우 실행(`Execution`) 전용이고, 노드 한 번 실행은 "노드 실행(`NodeExecution`)" 이다. 구분 표기가 없으면 한정어를 붙인다. 예: "알림" 대신 "인앱 알림" 또는 "EIA 알림 웹훅".
6. **같은 뜻의 다른 말은 하나만 쓴다.** 각 표의 "쓰지 않는 표기" 열에 적힌 말은 본문에 쓰지 않는다. 인용문·화면 문구를 그대로 옮길 때만 예외로 두고, 그때는 따옴표로 감싼다.
7. **역할과 권한 하한은 한국어 역할명으로 쓴다.** "관리자 이상", "편집자 이상" 처럼 쓴다. `Admin+`, `editor+`, `@Roles('editor')` 는 표 셀이나 코드 설명에서만 쓴다.
8. **"에러" 와 "오류"를 나눈다.** 본문은 "에러" 를 쓴다(에러 코드, 에러 포트, 에러 처리 정책). 화면 문구를 인용할 때만 "오류" 를 쓴다.
9. **띄어쓰기를 고정한다.** 자격 증명, 지식 저장소, 검색 불가, 입력 대기, 실행 내역, 버전 기록처럼 이 사전의 표기대로 띄어 쓴다.
10. **작업용 레이블을 본문 용어로 쓰지 않는다.** `D4`, `PR4`, `C-1`, `B-2`, `P1` 같은 계획·리뷰 레이블은 뜻을 풀어 쓴다. 요구사항 ID(`EIA-AU-07` 등)는 요구사항 표에서만 쓴다.
11. **문서는 NERV 링크로 가리킨다.** `CONVENTIONS`, `PRD 9`, 저장소 경로 같은 옛 이름 대신 문서 제목을 링크 텍스트로 쓴 NERV 링크를 쓴다. 예: `CONVENTIONS` 대신 [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md).
12. **제품명과 외부 서비스명은 영문으로 쓴다.** Clemvion, Cafe24, MakeShop, Telegram, Slack, Discord. 한국어 서비스명(카페24, 메이크샵)은 화면 문구를 인용할 때만 쓴다.
13. **노드 이름은 문서 제목 표기를 따른다.** If/Else·Switch·Loop 처럼 영문 이름이 표준인 노드는 영문으로, 변수 선언·변수 수정·AI 에이전트·텍스트 분류기·정보 추출기·수동 트리거·워크플로우 호출 노드처럼 한국어가 표준인 노드는 한국어로 쓴다. 캔버스 표시 이름이 다르면 처음 나올 때 병기한다.
## 용어

각 절의 표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

### 제품과 작업 공간

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

### 워크플로우 작성

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 워크플로우 | Workflow, `workflow` | 노드와 연결선으로 만든 자동화 단위. 트리거나 수동 실행으로 돈다. | 워크플로, 작업 흐름, Workflow(본문) | [워크플로우 데이터와 저장 흐름](CLE-WF/CLE-WF-DATA.md) |
| 워크플로우 활성 상태 | active, `workflow.is_active` | 활성·비활성 두 값. 비활성 워크플로우는 스케줄·웹훅 트리거로 시작하지 않고 수동 실행만 된다. | Active/Inactive(본문) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 폴더 | Folder, `folder` | 워크플로우를 묶는 계층 폴더. 5단계까지 중첩하고 순환을 막는다. 지금은 목록 필터로만 쓴다. | 컬렉션(폴더 뜻으로) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 태그 | tag | 워크플로우에 붙이는 자유 라벨. 목록 필터에 쓴다. | 없음 | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 소유 필터 | ownership filter, `mine`, `shared`, `all` | 팀 워크스페이스 목록에서 내가 만든 워크플로우와 남이 만든 워크플로우를 거르는 필터. "공유된 워크플로우" 는 작성자가 내가 아닌 워크플로우다. | 없음 | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 팀 배지 | Team badge | 팀 워크스페이스에 속한 워크플로우에 붙는 "Team" 표시. | 없음 | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 복제 | duplicate | 캔버스 전체를 비활성 사본으로 복사하는 동작. 버전 기록·트리거·테스트 데이터셋은 옮기지 않는다. | Copy(본문) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 내보내기·가져오기 | export, import | 워크플로우를 JSON 파일로 내보내거나 파일에서 새 워크플로우로 만드는 동작. | Export, Import(본문) | [워크플로우 목록과 폴더](CLE-WF/CLE-WF-LIST.md) |
| 에디터 | workflow editor | 캔버스·노드 팔레트·설정 패널·AI 어시스턴트·실행 결과 드로어가 있는 워크플로우 편집 화면. | 편집기, 워크플로 에디터, 워크플로우 편집기 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 캔버스 | Canvas | 노드와 연결선을 배치하는 에디터의 작업 영역. 저장 대상을 말할 때는 "캔버스 내용(노드·연결선 전체)" 으로 쓴다. | 없음 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 팔레트 | Palette | 에디터 왼쪽의 노드 목록. 카테고리별 목록·검색·최근 사용을 보여 준다. | Palette(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 검색 팝업 | node search popup | 캔버스를 더블클릭하거나 포트에서 끌어 빈 곳에 놓을 때 뜨는 노드 선택 팝업. | 빠른 노드 추가 팝업, 노드 추가 검색 팝업, 빠른추가 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 설정 패널 | Settings Panel, `node-settings-panel` | 노드를 고르면 오른쪽에 열리는 설정 편집 패널. 설정·코드·정보 탭이 있다. | Settings Panel, Node Settings Panel(본문) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| auto-form | auto-form, `SchemaForm`, `UiHint` | 노드 스키마의 UI 힌트로 설정 폼을 자동으로 그리는 방식. 이 방식으로 표현하지 못하는 노드는 수작업 폼을 쓴다. | 스키마 기반 자동 폼 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 노드 레이블 | node label, `Node.label` | 캔버스에 보이는 노드 이름. 한 워크플로우 안에서 겹치면 안 된다. | 노드 라벨, 라벨(이 뜻으로) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 노드 메모 | notes, `config.notes` | 노드에 붙이는 자유 메모. 설정 패널은 `config.notes` 에 저장한다(`Node.description` 과의 관계는 결정 항목). | 메모/설명 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 노드 비활성화 | disable node, `isDisabled` | 실행할 때 건너뛰도록 표시한 노드 상태. 워크플로우 비활성과 다르다. | Disable(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 설정 요약 | configuration summary, `summaryTemplate` | 노드 설정을 템플릿으로 줄여 캔버스 노드 셋째 줄에 보여 주는 문구. | 캔버스 요약, Configuration Summary(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 경고 규칙 | `warningRules` | 노드 하나의 설정만 보고 누락이나 오류를 알리는 선언형 규칙. 심각도는 `blocking` 과 `advisory` 다. | warningRule(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 미설정 경고 | not-configured badge | 필수 설정이 비었을 때 캔버스 노드에 붙는 경고 배지. 노드 경고 규칙의 결과다. | Not configured(본문) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 그래프 경고 규칙 | `graphWarningRules` | 노드 사이 관계를 보고 판단하는 경고 규칙. 심각도가 `error` 면 저장을 막는다. | cross-node warningRule, graph-warning | [그래프 경고 규칙](CLE-WF/CLE-WF-WARN.md) |
| 탈출 불가 순환 경고 | `graph:unescapable-cycle` | 분기 노드가 아닌 노드에서 되돌아가는 연결선이 만든 순환에 붙는 경고. 에디터는 순환 자체를 막지 않는다. | 글로벌 DAG 사이클 검사 | [그래프 경고 규칙](CLE-WF/CLE-WF-WARN.md) |
| 저장 | save, `saveCanvas` | 캔버스 내용을 서버에 쓰는 동작. 수동 저장과 실행 직전 저장 두 경로만 있고 타이머 자동 저장은 없다. | 자동 저장(실행 직전 저장 뜻으로), 캔버스 bulk save | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 앱 내부 클립보드 | `editorClipboard` | 복사한 노드와 그 사이 연결선을 담는 에디터 전용 버퍼. OS 클립보드가 아니다. | 클립보드(단독) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 시작 가이드 카드 | `CanvasEmptyState` | 트리거 노드만 있을 때 캔버스에 뜨는 3단계 안내 카드. | 시작하기 카드, Empty State 카드 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 연결선 | Edge, `edge` | 앞 노드의 출력 포트와 뒤 노드의 입력 포트를 잇는 선. `type` 값은 `data` 또는 `error` 다. | 엣지, 에지, Edge(본문) | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 연결선 분할 | edge split | 연결선 위에 노드를 떨어뜨려 가운데에 끼워 넣는 동작. | mid-insert, 중간 노드 삽입, 엣지 분할 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 연결선 분리 | detach | 재연결 앵커를 빈 곳에 놓아 연결선을 지우는 동작. 연결선 분할과 다르다. | 없음 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 연결선 자동 정리 | `dropStaleEdges` | 워크플로우를 불러올 때 지금 설정에 없는 포트에 붙은 연결선을 지우는 동작. 저장해야 서버에 반영된다. | stale 엣지 자동 제거 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 데이터 미리보기 | Data Flow Preview | 연결선을 골라 그 선으로 흐른 데이터를 보는 기능. | 엣지 데이터 미리보기 | [연결선](CLE-WF/CLE-WF-EDGE.md) |
| 포트 | Port, `source_port`, `target_port` | 노드의 입력·출력 연결 지점. 입력 기본 포트 이름은 `in` 이다. | 핸들, handle(본문), sourceHandle(본문) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 에러 포트 | error port, `error` | 런타임 에러 정보를 내보내는 출력 포트. 노드에 원래 있는 고정 에러 포트와, 에러 처리 정책이 "에러 포트로 라우팅" 일 때 생기는 동적 에러 포트가 있다. | error 포트, runtime 에러 포트 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 시스템 포트 | system port | 노드가 미리 정한 고정 제어 출력 포트(`out`, `done`, `user_ended` 등). | control 포트, 제어 포트 | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 동적 포트 | dynamic ports | 설정 항목(Switch 케이스, 분류 카테고리, AI 조건, 버튼)마다 생기는 포트. | dynamic-ports(본문) | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 포트 ID | stable port id | 동적 포트를 가리키는 바뀌지 않는 문자열. 형식이 맞지 않을 때만 `case_0` 같은 순번 ID 로 대신한다. | stable slug id | [노드 포트와 설정 패널](CLE-WF/CLE-WF-NODEPANEL.md) |
| 컨테이너 | container, `containerId` | 자식 노드를 반복 실행하는 Loop·ForEach·Map 세 노드. 자식은 `containerId` 로 소속을 나타낸다. Parallel 과 Background 는 컨테이너가 아니다(결정 항목). | 그룹 박스, 컨테이너(Parallel·Background 뜻으로) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 컨테이너 본문 | container body | 컨테이너가 반복할 때마다 실행하는 자식 노드 묶음. | body 서브그래프, 내부 노드 그룹, 하위 노드 그룹, 하위 워크플로우(노드 그룹) | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| body·emit·done 포트 | `body`, `emit`, `done` | 컨테이너 반복 구조의 세 포트. body 는 본문 진입, emit 은 반복 결과를 모으는 입력, done 은 모은 배열 출력이다. | loopback, 출력 수집(포트 이름으로) | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 그룹 해제 | Ungroup | 컨테이너만 지우고 자식 노드를 최상위로 올리는 삭제 방식. 자식까지 지우는 방식은 "모두 삭제" 다. | 없음 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 도구 영역 | Tool Area, `tool_owner_id` | AI 에이전트 노드 옆에 노드를 놓아 도구로 등록하던 영역. 기능은 제거했고 DB 컬럼만 남았다. 현행 기능으로 쓰지 않는다. | Tool Area(현행 기능처럼) | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 버전 기록 | Version History, `WorkflowVersion` | 저장할 때마다 쌓이는 워크플로우 스냅샷 목록과 그 화면. | 버전 히스토리, 버전 이력, Version History(본문) | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 스냅샷 | version snapshot, `workflow_version.snapshot` | 한 번 저장한 시점의 이름·설명·노드·연결선. 워크플로우 설정(`settings`)은 담지 않는다. | 스냅샷(단독) | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 번호 | vN, `workflow_version.version` | 버전 기록에 보이는 순번. 워크플로우의 `current_version` 과 한 칸 어긋난다. | 없음 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 비교 | version diff | 두 버전 사이에 추가·삭제·수정된 노드와 연결선을 보여 주는 기능. | Diff(본문 단독), 버전 차이 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 버전 복원 | restore | 과거 스냅샷을 다시 저장해 새 버전을 만드는 동작. 이력을 되감지 않고 앞으로 쌓는다. | 롤백 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 변경 요약 | `change_summary` | 저장 요청이 보낸 버전 설명 문자열. 에디터는 보내지 않고 복원할 때만 "Restored from vN" 이 들어간다. | 변경 사항 요약 | [버전 기록](CLE-WF/CLE-WF-VERSION.md) |
| 표현식 | Expression, `{{ }}` | 노드 설정 문자열 안에서 앞 노드 출력·변수·실행 정보를 읽는 인라인 문법. 노드 실행 직전에 한 번 평가한다. | expression(본문), 수식 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 표현식 언어 | Expression Language | 표현식 문법·내장 변수·함수를 정한 명세. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 평가 | evaluate | 표현식을 값으로 바꾸는 일. | 해석(같은 뜻으로), resolve(본문) | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 내장 변수 | built-in variables | `$node`, `$input`, `$var`, `$params`, `$trigger`, `$execution`, `$now`, `$env`, `$loop`, `$item`, `$thread` 처럼 `$` 로 시작하는 표현식 루트. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 워크플로우 변수 | workflow variables, `context.variables`, `$var` | 실행 동안 노드가 읽고 쓰는 사용자 정의 값. 표현식은 `$var`, Code 노드는 `$vars` 로 읽는다. | `$variables`, 워크플로우 변수 저장소 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 트리거 파라미터 참조 | `$params` | `$input.parameters` 의 줄임. 수동 트리거 노드가 검증한 입력 파라미터를 읽는다. | context.parameters | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 웹훅 요청 뷰 | `$trigger` | 웹훅으로 시작한 실행의 원본 HTTP 요청(`body`, `headers`, `query`, `method`). 다른 경로로 시작하면 빈 객체다. | triggerData(본문) | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 노드 참조 | `$node["레이블"]` | 다른 노드의 노드 출력을 레이블이나 UUID 로 읽는 표현식. `.output`, `.config`, `.meta`, `.port`, `.status` 를 읽을 수 있다. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 반복 컨텍스트 | `$loop` | Loop 본문 안에서 `index`·`iteration`·`isFirst`·`isLast` 를 읽는 변수. `$parent` 는 표현식에 없다. | `$loop.count`(표현식 변수로), `$parent.loop` | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 항목 컨텍스트 | `$item`, `$itemIndex` | ForEach·Map·Filter 가 처리하는 현재 배열 항목과 순번. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 환경 변수 참조 | `$env`, `EXPRESSION_ENV_ALLOWLIST` | 운영자가 허용 목록에 적은 환경 변수만 읽는 표현식 변수. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 제한 표현식 | restricted expression | 스케줄 파라미터 값처럼 `$now`·`$schedule` 만 쓸 수 있는 표현식. | 없음 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 표현식 에러 코드 | `EXPR_*` | 문법·참조·타입·함수·시간·깊이 여섯 가지 평가 실패 코드. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 표현식 제외 키 | `EXPRESSION_EXCLUSIONS` | 엔진이 미리 평가하지 않는 노드별 설정 키(`code.code`, `filter.conditions` 등). | 핸들러별 제외 규칙 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| 자동완성 스키마 보강 | enricher | 설정에 선언한 필드를 출력 스키마에 넣어 표현식 자동완성을 돕는 장치. | 없음 | [표현식 언어](CLE-WF/CLE-WF-EXPR.md) |
| AI 어시스턴트 | Workflow AI Assistant, `workflow-assistant` | 에디터 오른쪽 패널에서 자연어 요청을 받아 노드와 연결선을 만들고 고치는 대화형 도우미. AI 에이전트 노드와 다른 기능이다. | 워크플로우 어시스턴트, Workflow Assistant, Assistant(본문), AI 에이전트(이 뜻으로), 채팅형 AI 에이전트 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 어시스턴트 세션 | `AssistantSession`, `workflow_assistant_session` | 워크플로우 하나에 묶인 사용자별 어시스턴트 대화. | 세션(단독) | [AI 어시스턴트 스트리밍과 세션 API](CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| 어시스턴트 메시지 | `AssistantMessage`, `workflow_assistant_message` | 어시스턴트 세션의 사용자·어시스턴트 메시지 행. 도구 호출·계획·사용량 정보가 붙는다. | WorkflowAssistantMessage(본문) | [AI 어시스턴트 스트리밍과 세션 API](CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| 탐색·계획·편집 단계 | Clarify, Plan, Execute | 어시스턴트 대화가 거치는 세 단계. 셋째 단계는 캔버스 편집이지 워크플로우 실행이 아니다. | Execute 단계, 실행 단계 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 계획 카드 | Plan card, `propose_plan` | 어시스턴트가 제안하는 단계별 편집 계획. 사용자가 승인해야 편집을 시작한다. 화면 제목은 "실행 계획" 이다(결정 항목). | 실행 계획(본문), Plan 카드 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 편집 턴 | execution turn | 성공한 편집이 하나 이상 있는 어시스턴트 턴. 계획만 낸 턴은 "계획 전용 턴" 이다. | 실행 턴 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 후보 선택기 | candidate picker, `pendingUserConfig` | 통합·모델 설정·지식 저장소·워크플로우처럼 사용자가 직접 골라야 하는 값을 어시스턴트가 후보 목록으로 보여 주는 장치. | in-message picker | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| Shadow 검증 | `ShadowWorkflow` | 어시스턴트 편집을 서버 메모리의 워크플로우 사본에 먼저 적용해 검증하는 장치. | shadow 검증 | [AI 어시스턴트 도구](CLE-WF/CLE-WF-ASSIST-TOOLS.md) |
| 어시스턴트 도구 | assistant tools, `explore`, `plan`, `edit` | 어시스턴트가 부르는 탐색·계획·편집 LLM 도구. | 없음 | [AI 어시스턴트 도구](CLE-WF/CLE-WF-ASSIST-TOOLS.md) |
| 자동 이어서 진행 | `auto_resume` | 계획 단계가 남았는데 텍스트만 내고 멈춘 턴을 서버가 최대 2번 더 이어 가게 하는 장치. 실행 재개와 다르다. | 자동 재개, stall 자동 복구 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 어시스턴트 도구 호출 한도 | tool-call budget, `toolCallsBudget` | 어시스턴트 한 턴에서 부를 수 있는 도구 호출 수의 상한. AI 노드의 도구 호출 한도와 다르다. | tool-call budget(본문), 동적 budget | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 종료 가드 | finish guard | 계획 완결성·품질 점검·요청 대조가 끝나기 전에 어시스턴트 턴이 끝나지 않게 막는 서버 검사. | 없음 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 턴 종료 사유 | `finish_reason` | 어시스턴트 턴이 끝난 이유(`stop`, `tool_calls`, `error`, `aborted`, `auto_resume_pending`). | 없음 | [AI 어시스턴트 스트리밍과 세션 API](CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| 응답 중단 | stop streaming | 어시스턴트 응답 스트림을 끊는 버튼 동작. 실행 중지와 다르다. | 없음 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |

### 노드

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 노드 | Node, `node` | 입력을 받아 처리하고 출력을 내는 워크플로우 구성 요소. | Node(본문), 노드 인스턴스 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 유형 | node type, `Node.type` | 노드 핸들러를 고르는 문자열(`if_else`, `ai_agent`, `http_request` 등). | 노드 타입 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 카테고리 | node category, `Node.category` | 노드 팔레트 구획과 색을 정하는 일곱 가지 분류. 트리거·Logic·Flow·AI·통합·Data·Presentation 이다. | category(본문) | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 핸들러 | node handler, `NodeHandler` | 노드 유형마다 있는 실행 코드. 엔진이 정해진 계약으로 부른다. | 없음 | [노드 핸들러 계약](CLE-EXEC/CLE-EXEC-HANDLER.md) |
| 노드 정의 | node definition | 노드 유형의 설정 스키마·포트·메타데이터 묶음. | 없음 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 출력 | node output, `NodeHandlerOutput` | 핸들러가 돌려주는 다섯 필드 객체(`config`, `output`, `meta`, `port`, `status`). DB 에는 `NodeExecution.outputData` 로, 실시간 이벤트에는 `output` 으로 통째로 실린다. | 봉투(이 뜻으로), envelope(이 뜻으로), 래퍼, 5필드 invariant, 노드 출력 envelope | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 출력 값 | output value, `output` 필드 | 노드 출력 안의 주 데이터. 다음 노드는 `$node["X"].output` 으로 읽는다. 실시간 이벤트에서는 한 겹 아래 `output.output` 에 있다. | output(본문 단독) | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 설정 에코 | config echo, `config` 필드 | 표현식을 평가하기 전 원래 설정을 노드 출력 `config` 에 다시 싣는 규칙. 자격 증명은 싣지 않는다. | raw echo, config echo(본문) | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 원본 설정 | raw config, `rawConfig` | 표현식을 평가하기 전 노드 설정. 평가한 뒤의 설정은 "평가된 설정(`resolvedConfig`)" 이다. | pre-evaluation config | [실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| 실행 메트릭 | `meta` 필드 | 소요 시간·토큰·상태 코드처럼 관측용 값. | 실행 메타데이터 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 출력 포트 선택 | `port` 필드 | 노드가 이번에 값을 내보낼 출력 포트 ID. | 없음 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 흐름 지시 상태 | `status` 필드 | 엔진 흐름을 바꾸는 핸들러 반환 값(`waiting_for_input`, `resumed`, `ended`, `requires_integration`). 실행·노드 실행 기록의 상태와 층이 다르다. | status(단독), 흐름 제어 상태 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 패스스루 | pass-through | 입력을 바꾸지 않고 출력으로 넘기는 노드 규약. If/Else·Switch·변수 선언·변수 수정·Background 가 따른다. | 패스 스루, Pass-through(본문) | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 사전 검증 에러 | pre-flight error, `handler.validate` | 설정이나 그래프 문제로 핸들러가 시작하기 전에 던지는 에러. 에러 포트로 가지 않고 실행을 실패로 끝낸다. | Pre-flight(본문), pre-flight throw | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 런타임 에러 | runtime error, `output.error` | 외부 호출 실패처럼 실행 중에 난 에러. 에러 포트와 `output.error` 로 내보낸다. | 없음 | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 에러 처리 정책 | Error Handling, `config.errorHandling.policy` | 노드가 실패했을 때의 동작. 워크플로우 중단·노드 건너뛰기·기본 출력 사용·재시도·에러 포트로 라우팅 다섯 가지다. 화면 라벨은 "오류 처리" 다. | 에러 정책, 실패 정책, errorPolicy(이 뜻으로) | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 항목 에러 정책 | item error policy, `config.errorPolicy` | ForEach·Map·Parallel 이 항목이나 분기 하나가 실패할 때 쓰는 정책(`stop`, `skip`, `continue`, `cancel-others-on-fail`). 에러 처리 정책과 다른 설정이다. | errorPolicy(본문 단독) | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 기본 출력 | default output, `defaultOutput` | 에러 처리 정책이 "기본 출력 사용" 일 때 실패 대신 내보내는 JSON. | 기본 출력값 | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 노드 재시도 | node retry, `retryConfig` | 에러 처리 정책의 재시도. 최대 횟수와 간격을 정해 같은 노드를 다시 부른다. | 리트라이 정책 | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 엔진 덮어쓰기 | engine override | 컨테이너와 Parallel 이 끝나면 엔진이 출력 값을 `{ <컬렉션 키>, count }` 로 바꾸는 계약. | 엔진 오버라이트, 오버라이트 컨트랙트 | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| 컬렉션 키 | collection key | 엔진 덮어쓰기 결과의 배열 키. Loop 는 `iterations`, ForEach 는 `items`, Map 은 `mapped`, Parallel 은 `branches` 다. | 컬렉션(배열 뜻으로 단독) | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| 블로킹 노드 | blocking node | 사용자 입력을 기다리며 실행을 멈추는 노드. Form 노드, 버튼이 있는 Presentation 노드, 멀티턴 AI 노드다. | 인터랙션 노드(이 뜻으로), 대기 노드(이 뜻으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 노드 샌드박스 | sandbox, `isolated-vm` | Code 노드를 별도 V8 격리 환경에서 메모리·시간 제한을 걸고 실행하는 정책. 지금은 Code 노드에만 쓴다. | 샌드박싱(다른 노드에도 쓰는 것처럼) | [Code 노드](CLE-NODE-DATA/CLE-NODE-CODE.md) |
| 수동 트리거 노드 | Manual Trigger, `manual_trigger` | 워크플로우마다 정확히 하나 있는 진입 노드. 이름과 달리 수동·웹훅·스케줄 실행이 모두 이 노드에서 시작한다. | 시작 노드, 트리거 노드(이 뜻으로 단독), Manual Trigger(본문) | [수동 트리거 노드](CLE-NODE-TRIG/CLE-NODE-MANUAL.md) |
| 트리거 파라미터 | trigger parameters, `config.parameters` | 수동 트리거 노드가 받는 입력 스키마. 검증과 기본값 적용을 거친 값은 `output.parameters` 로 나온다. | 트리거 진입 파라미터 | [트리거 노드 공통](CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| 진입 어댑터 | trigger adapter | 실행 버튼·웹훅 HTTP 요청·스케줄 입력을 트리거 파라미터로 바꾸는 계층. 채널 어댑터와 다르다. | 실행 어댑터, 트리거 어댑터, 어댑터(단독) | [트리거 노드 공통](CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| 진입 경로 표시 | `meta.source` | 수동 트리거 노드가 어느 경로(`manual`, `webhook`, `schedule`)로 실행됐는지 남기는 값. | 없음 | [트리거 노드 공통](CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| If/Else 노드 | If/Else, `if_else` | 조건 결과에 따라 참·거짓 포트 가운데 하나로 보내는 노드. | IF 노드 | [If/Else 노드](CLE-NODE-LOGIC/CLE-NODE-IFELSE.md) |
| Switch 노드 | Switch, `switch` | 값이나 조건에 맞는 케이스 포트로 보내는 노드. | 없음 | [Switch 노드](CLE-NODE-LOGIC/CLE-NODE-SWITCH.md) |
| 케이스 | case, `CaseDef` | Switch 의 분기 정의. 케이스 ID 가 곧 동적 포트 ID 다. 맞는 케이스가 없으면 기본 경로(`default`)로 간다. | case(본문) | [Switch 노드](CLE-NODE-LOGIC/CLE-NODE-SWITCH.md) |
| 조건 | Condition | 필드·연산자·값으로 된 비교식. 여러 조건은 `combineMode`(and, or)로 묶는다. 조건을 겹겹이 묶는 구조는 없다. | 조건 그룹, ConditionGroup | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 비교 연산자 | operators, `eq`, `neq`, `contains` 등 | 조건 노드가 함께 쓰는 연산자 집합. 본문에는 snake_case 값을 그대로 쓴다. | ==, != 같은 기호 표기 | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 엄격 비교 | `strictComparison` | 타입 변환 없이 비교하는 조건 옵션. 기본은 꺼져 있다. | Strict 모드 | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| Loop 노드 | Loop, `loop` | 정한 횟수만큼 본문을 반복하는 컨테이너. | 없음 | [Loop 노드](CLE-NODE-LOGIC/CLE-NODE-LOOP.md) |
| 최대 반복 횟수·Break 조건 | `maxIterations`, `breakCondition` | Loop 반복 상한과 조기 종료 조건. 끝난 이유는 `meta.exitReason` 에 남는다. | 없음 | [Loop 노드](CLE-NODE-LOGIC/CLE-NODE-LOOP.md) |
| 반복 회차 | iteration | 컨테이너 본문이 한 번 도는 것. 노드 실행 기록 한 행에 대응한다. | 이터레이션, iter | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| ForEach 노드 | ForEach, `foreach` | 배열 항목마다 본문을 차례로 실행하는 컨테이너. | 없음 | [ForEach 노드](CLE-NODE-LOGIC/CLE-NODE-FOREACH.md) |
| Map 노드 | Map, `map` | 배열 항목마다 본문을 실행해 변환 결과 배열을 만드는 컨테이너. | 없음 | [Map 노드](CLE-NODE-LOGIC/CLE-NODE-MAP.md) |
| Filter 노드 | Filter, `filter` | 조건에 맞는 배열 항목만 남기는 노드. | 없음 | [Filter 노드](CLE-NODE-LOGIC/CLE-NODE-FILTER.md) |
| Split 노드 | Split, `split` | 배열을 항목 단위로 나누는 노드. 컨테이너가 아니다. | 없음 | [Split 노드](CLE-NODE-LOGIC/CLE-NODE-SPLIT.md) |
| 변수 선언 노드 | Variable Declaration, `variable_declaration` | 워크플로우 변수를 새로 등록하는 노드. 같은 이름이 있으면 덮어쓰지 않는다. 캔버스 표시 이름은 "Variable" 이다. | Variable Declaration(본문), var_decl | [변수 선언 노드](CLE-NODE-LOGIC/CLE-NODE-VARDECL.md) |
| 변수 수정 노드 | Variable Modification, `variable_modification` | 워크플로우 변수 값을 set·increment·append 같은 연산으로 바꾸는 노드. 캔버스 표시 이름은 "Set Variable" 이다. | Set Variable(본문), var_mod | [변수 수정 노드](CLE-NODE-LOGIC/CLE-NODE-VARSET.md) |
| 시스템 예약 변수 | reserved variables, `__` 접두 | 엔진이 워크플로우 변수에 넣는 `__workspaceId`, `__dryRun` 같은 값. 사용자 변수 이름으로 쓸 수 없다. | 예약 네임스페이스 | [실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| Parallel 노드 | Parallel, `parallel` | 같은 입력으로 여러 분기를 동시에 실행하는 노드. 컨테이너는 아니지만 엔진 덮어쓰기를 받는다. | 병렬 컨테이너 | [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| 병렬 분기 | branch, `branch_<i>` | Parallel 의 분기 포트에서 시작해 동시에 실행하는 노드 묶음. 조건 노드의 경로 선택과 구분한다. | 분기(단독) | [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| 동시 실행 수 | `maxConcurrency` | Parallel 분기를 한 번에 몇 개 돌릴지 정하는 값. 워크스페이스 동시 실행 제한과 다르다. | 없음 | [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| Merge 노드 | Merge, `merge` | 여러 선행 노드 결과를 하나로 합치는 노드. | 없음 | [Merge 노드](CLE-NODE-LOGIC/CLE-NODE-MERGE.md) |
| 병합 전략 | `strategy` | Merge 가 결과를 모으는 방식(`wait_all`, `first`, `append`). | 없음 | [Merge 노드](CLE-NODE-LOGIC/CLE-NODE-MERGE.md) |
| Background 노드 | Background, `background` | 본문을 별도 큐에서 비동기로 돌리고 메인 흐름은 바로 다음으로 넘기는 노드. 컨테이너로 부르지 않는다. | 특수 컨테이너, 백그라운드 노드 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| Background 본문 실행 | background run, `backgroundRunId` | Background 노드 본문이 한 번 도는 단위. 메인 실행과 실행 ID 를 함께 쓴다. | background run(본문), 본문 run, 백그라운드 실행 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| fire-and-forget | fire-and-forget | 부모가 결과를 기다리지 않는 실행. Background 본문과 워크플로우 호출 노드 비동기 모드가 해당한다. | 없음 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| 본문 실패 알림 | `notifyOnFailure` | Background 본문이 실패하면 워크스페이스 관리자에게 인앱 알림을 보내는 옵션. 이메일은 보내지 않는다. | 없음 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| 워크플로우 호출 노드 | Workflow node, `workflow` | 다른 워크플로우를 동기 또는 비동기로 부르는 Flow 노드. | Workflow 노드, 워크플로우 노드 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 서브 워크플로우 | sub-workflow | 워크플로우 호출 노드가 부른 워크플로우와 그 실행. | 하위 워크플로우, 하위 워크플로, sub-workflow(본문), Sub-Workflow | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 동기 호출·비동기 호출 | sync mode, async mode | 동기 호출은 부모 실행 안에서 바로 돌려 결과를 받는다(`executeInline`). 비동기 호출은 자식 실행을 따로 만들고 추적 ID 만 받는다(`executeAsync`). | 없음 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 입력 매핑 | `inputMapping` | 서브 워크플로우에 넘길 파라미터를 표현식으로 정하는 설정. | 입력 파라미터 매핑 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 재귀 깊이 | `recursionDepth` | 서브 워크플로우가 중첩된 깊이. 10 이상이면 실패한다. | 없음 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| AI 노드 | AI nodes | AI 에이전트·텍스트 분류기·정보 추출기 세 노드. | LLM 3 노드, LLM 계열 노드, AI 카테고리 3 노드 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| AI 에이전트 노드 | AI Agent, `ai_agent` | LLM 으로 응답을 만들고 지식 저장소·MCP·조건·표시 도구를 부르는 노드. | AI Agent(본문) | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 텍스트 분류기 노드 | Text Classifier, `text_classifier` | 입력 텍스트를 정의한 카테고리로 나누고 카테고리마다 포트로 보내는 노드. | 분류 노드, 텍스트 분류 | [텍스트 분류기 노드](CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) |
| 정보 추출기 노드 | Information Extractor, `information_extractor` | 비정형 텍스트에서 출력 스키마 필드를 뽑는 노드. 캔버스 표시 이름은 "Info Extractor" 다. | Info Extractor(본문), IE(본문), 추출 노드, 추출기 | [정보 추출기 노드](CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |
| AI 실행 모드 | `mode` | AI 노드가 LLM 을 한 번 부르고 끝나는지(단일 턴), 사용자와 여러 번 대화하는지(멀티턴) 정하는 설정. | 없음 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 멀티턴 | multi-turn, `multi_turn` | AI 노드가 사용자 메시지를 기다리며 여러 턴 대화하는 모드. AI 에이전트와 정보 추출기만 쓸 수 있다. | Multi Turn, multi-turn(본문), Multi-turn, AI Multi Turn | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 단일 턴 | single-turn, `single_turn` | LLM 을 한 번 부르고 끝나는 모드. | Single Turn, single-turn(본문) | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 대화 턴 | turn | 사용자 메시지 한 번과 그에 대한 LLM 응답(도구 호출 포함) 한 주기. 대화 스레드의 기록 한 건은 "대화 기록 항목" 이다. | turn(본문 단독) | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 최대 턴 수·턴 수 | `maxTurns`, `turnCount` | 멀티턴 대화가 이어질 수 있는 최대 턴과 지금까지 진행한 턴. | 없음 | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 조건 도구 | condition tool, `cond_*` | AI 에이전트의 판단 분기를 LLM 도구로 노출한 것. LLM 이 부르면 그 조건 포트로 끝난다. | 조건 포트(도구 뜻으로) | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 지식 저장소 도구 | KB tool, `kb_*` | 지식 저장소 하나를 LLM 검색 도구로 노출한 것. LLM 이 스스로 부를 때만 검색한다. | KB 도구, KB tool(본문), KB 검색 도구 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| MCP 도구 | MCP tool, `mcp_<sid>__<name>` | MCP 지원 통합의 도구를 LLM 도구로 노출한 것. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 표시 도구 | presentation tools, `render_*` | AI 에이전트가 표·차트·캐러셀·템플릿·폼을 대화 안에 그리는 LLM 도구. `render_form` 만 사용자 입력을 기다린다. | 표현 도구, 가상 도구, Presentation Tool Family | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 표시물 페이로드 | `PresentationPayload` | 표시 도구가 만든 결과. 대화 기록 항목의 `presentations[]` 에 담긴다. | 없음 | [AI 에이전트 노드 출력과 디버그](CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) |
| 도구 호출 한도 | `maxToolCalls` | AI 노드 한 번 실행에서 허용하는 도구 호출 횟수(기본 10). 조건 도구는 세지 않는다. | 없음 | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 도구 정의 크기 예산 | tool-definition payload budget | LLM 요청에 싣는 도구 정의 전체의 직렬화 크기 상한. 넘으면 LLM 을 부르기 전에 에러 포트로 보낸다. | 없음 | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 메모리 전략 | `memoryStrategy` | 대화 맥락을 다루는 방식. `manual` 은 대화 맥락 설정대로, `summary_buffer` 는 실행 안 롤링 요약, `persistent` 는 요약에 에이전트 메모리를 더한다. | 관리 축, 자동 컨텍스트 메모리 전략 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 대화 맥락 설정 | Conversation Context, `contextScope` | 대화 스레드를 LLM 입력에 얼마나, 어떤 형식으로 넣을지 정하는 AI 노드 공통 설정. | 범위 축, contextScope 계열 5필드 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 롤링 요약 | running summary, `runningSummary` | 한 실행 안에서 오래된 대화 턴을 줄여 둔 요약. | working-memory 압축, 요약 블록 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 시스템 컨텍스트 접두 | `includeSystemContext` | AI 노드 시스템 프롬프트 앞에 현재 시각과 시간대를 자동으로 붙이는 옵션. | System Context Prefix(본문) | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 종료 사유 | `endReason` | AI 노드 대화가 끝난 이유. AI 에이전트는 4가지, 정보 추출기는 6가지다. | 없음 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 재시도 가능 여부 | `details.retryable` | LLM 계열 에러가 일시적인지 알리는 필수 필드. true 면 화면에 다시 시도 버튼이 보인다. | 없음 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| LLM 호출 기록 | `meta.turnDebug`, `meta.llmCalls` | 턴마다 남기는 LLM 요청·응답 원문. 결과 상세의 응답·요청 탭이 쓴다. | 없음 | [AI 에이전트 노드 출력과 디버그](CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) |
| 출력 스키마 | `outputSchema` | 정보 추출기가 뽑을 필드 목록. 설정 에코에서는 `schema` 키로 나온다. | 없음 | [정보 추출기 노드](CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |
| 수집 재시도 | `maxCollectionRetries` | 정보 추출기 멀티턴에서 필수 필드가 비었을 때 다시 묻는 횟수. | 없음 | [정보 추출기 노드](CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |
| 분류 카테고리 | `CategoryDef` | 텍스트 분류기의 분류 항목. 맞는 항목이 없으면 `fallback` 포트로 간다. | 없음 | [텍스트 분류기 노드](CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) |
| 통합 노드 | integration nodes | 통합을 참조해 외부 서비스를 부르는 다섯 노드(HTTP Request, Database Query, Send Email, Cafe24, MakeShop). | Integration 노드, integration 노드 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| HTTP Request 노드 | HTTP Request, `http_request` | 외부 HTTP API 를 부르는 노드. | HTTP 노드 | [HTTP Request 노드](CLE-NODE-INT/CLE-NODE-HTTP.md) |
| Database Query 노드 | Database Query, `database_query` | 외부 데이터베이스에 SQL 을 실행하는 노드. | DB 노드 | [Database Query 노드](CLE-NODE-INT/CLE-NODE-DBQUERY.md) |
| Send Email 노드 | Send Email, `send_email` | SMTP 로 이메일을 보내는 노드. | 이메일 노드 | [Send Email 노드](CLE-NODE-INT/CLE-NODE-EMAIL.md) |
| Cafe24 노드 | Cafe24, `cafe24` | Cafe24 Admin API operation 을 부르는 노드. | 카페24 노드 | [Cafe24 노드](CLE-NODE-INT/CLE-NODE-CAFE24.md) |
| MakeShop 노드 | MakeShop, `makeshop` | MakeShop Shop API operation 을 부르는 노드. | 메이크샵 노드, Makeshop 노드 | [MakeShop 노드](CLE-NODE-INT/CLE-NODE-MAKESHOP.md) |
| 통합 참조 | `config.integrationId` | 노드가 쓸 통합의 ID. 설정 에코에는 자격 증명 대신 이 값만 남는다. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 성공 포트 | success port, `success`, `out` | 정상 결과를 내보내는 출력 포트. 노드마다 이름이 다르다. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 사설망 차단 | SSRF guard | 사설·loopback·메타데이터 주소로 나가는 연결을 막는 검사. 셀프 호스팅은 `ALLOW_PRIVATE_HOST_TARGETS` 로 끌 수 있다. | egress 방화벽 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| Transform 노드 | Transform, `transform` | 변환 연산을 차례로 적용하는 노드. | 없음 | [Transform 노드](CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) |
| 변환 연산 | `operations[]` | Transform 의 필드 이름 변경·타입 변환·배열 정렬 같은 단계. 대상이 없으면 에러 없이 건너뛴다. | 없음 | [Transform 노드](CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) |
| Code 노드 | Code, `code` | 격리 환경에서 JavaScript 를 실행하는 노드. 워크플로우 변수는 `$vars` 로 읽는다. | 코드 노드 | [Code 노드](CLE-NODE-DATA/CLE-NODE-CODE.md) |
| Presentation 노드 | presentation nodes | 결과를 보여 주거나 사용자 입력을 받는 다섯 노드(Carousel, Table, Chart, Form, Template). | 인터랙션 노드(이 뜻으로), 시각형 노드(다섯 노드 전체 뜻으로) | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| Carousel 노드 | Carousel, `carousel` | 카드 여러 장을 넘겨 보는 형태로 결과를 보여 주는 노드. | 캐러셀 노드 | [Carousel 노드](CLE-NODE-PRES/CLE-NODE-CAROUSEL.md) |
| Table 노드 | Table, `table` | 결과를 표로 보여 주는 노드. | 테이블 노드 | [Table 노드](CLE-NODE-PRES/CLE-NODE-TABLE.md) |
| Chart 노드 | Chart, `chart` | 결과를 차트로 보여 주는 노드. | 차트 노드 | [Chart 노드](CLE-NODE-PRES/CLE-NODE-CHART.md) |
| Form 노드 | Form, `form` | 사용자에게 입력 폼을 보여 주고 제출을 기다리는 노드. 항상 블로킹 노드다. | Human-in-the-loop 노드 | [Form 노드](CLE-NODE-PRES/CLE-NODE-FORM.md) |
| Template 노드 | Template, `template` | 템플릿으로 텍스트·HTML 을 만들어 보여 주는 노드. | 템플릿 노드 | [Template 노드](CLE-NODE-PRES/CLE-NODE-TEMPLATE.md) |
| 시각형 노드 | visual nodes | Carousel·Table·Chart 세 노드. 채팅 채널 매핑에서 쓴다. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 버튼 정의 | `ButtonDef` | Presentation 노드의 버튼. 포트로 보내는 포트 버튼(`port`)과 URL 을 여는 링크 버튼(`link`)이 있다. | 없음 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 전역 버튼·항목 버튼 | global button, item button | 노드 전체에 붙는 버튼과 Carousel 항목마다 붙는 버튼. | 글로벌 버튼, per-item 버튼, 아이템 버튼 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 계속 포트 | `continue` | 링크 버튼만 있을 때 자동으로 생기는 진행 포트. | Continue 포트 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 블로킹 모드 | Blocking Mode | 버튼이나 폼 때문에 Presentation 노드가 입력 대기로 멈추는 동작. | Blocking 모드, Blocking Mode(본문) | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 표시 전용 | display-only | 버튼이 없어 기다리지 않고 바로 다음 노드로 넘어가는 Presentation 동작. 사용자 입력을 기다리지 않는 표시 도구 4종도 이렇게 부른다. | 비-블로킹, 표시-전용, Non-blocking | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 데이터 소스 방식 | `mode`: static, dynamic | 항목을 설정에 직접 적는 정적 모드와 표현식 배열에서 만드는 동적 모드. | Static Items, Dynamic (from input) | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 출력 크기 한도 | output size cap | Presentation 출력 배열이 1MB 를 넘으면 뒤에서부터 잘라 내는 한도. 잘렸는지는 `*Truncated`, `*TotalCount` 로 알린다. | tail-truncate | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 폼 필드 | `FormField` | Form 노드 입력 항목 정의. 이름·아홉 가지 유형·검증 규칙·파일 제약을 담는다. | 없음 | [Form 노드](CLE-NODE-PRES/CLE-NODE-FORM.md) |
| 재개 출력 | resumed output, `status: resumed` | 대기 노드가 입력을 받은 뒤 원래 출력에 사용자 입력 기록을 더해 다시 내는 출력. | 없음 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 사용자 입력 기록 | `output.interaction` | 재개 출력에 붙는 사용자 행동 내용(`button_click`, `button_continue`, `form_submitted`, `message_received`). | interaction payload | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |

### 실행

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 실행 | Execution, `execution` | 워크플로우가 한 번 도는 단위와 그 기록. 상태·입력·출력·에러를 담는다. | 실행 인스턴스, 실행 레코드, Execution(본문) | [실행 데이터와 흐름](CLE-EXEC/CLE-EXEC-DATA.md) |
| 노드 실행 | NodeExecution, `node_execution` | 한 실행 안에서 노드가 한 번 도는 단위와 그 기록. 반복 회차와 재시도마다 행이 따로 생긴다. | 실행 이력 행, NodeExecution row | [실행 데이터와 흐름](CLE-EXEC/CLE-EXEC-DATA.md) |
| 실행 상태 | `ExecutionStatus` | 실행의 상태 값. 대기 중·실행 중·입력 대기·완료·실패·취소됨 여섯 가지이고, 노드 실행에는 건너뜀이 더 있다. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 대기 중 | pending, `pending` | 실행 기록은 만들어졌지만 아직 워커가 시작하지 않은 상태. | 실행 대기, 큐 대기(상태 이름으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 입력 대기 | waiting for input, `waiting_for_input` | Form·버튼·멀티턴 AI 노드가 사용자 입력을 기다리며 멈춘 상태. | Waiting, Waiting for Input, WFI, 대기(단독) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 취소됨 | cancelled, `cancelled` | 사용자 중지나 시스템 사유로 끝난 상태. 노드 실행이 취소됐으면 실패가 아니라 중단이다. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| park | park | 입력 대기에 들어가면서 세그먼트를 끝내고 큐 없이 DB 에만 실행을 남기는 동작. 기한 없이 보존한다. | 파킹, durable park(본문) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 세그먼트 | active segment | 워커가 실행을 한 번 이어서 진행하는 구간. 시작이나 재개부터 다음 park 또는 종료까지다. | active 세그먼트, active-running 세그먼트 | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 재개 | resume, continuation | 입력 대기 실행에 사용자 입력이 들어와 다시 진행하는 것. | 재수화(이 뜻으로), 재구동(이 뜻으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| rehydration | rehydration, `rehydrateContext` | DB 에 저장한 내용으로 실행 컨텍스트를 되살리는 단일 경로. 재개와 재구동이 함께 쓴다. | 재수화 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 재구동 | re-drive | 서버가 죽을 때 실행 중이던 실행을 다른 워커가 다시 굴리는 것. | 재개(이 뜻으로) | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| 재개 명령 | continuation command | 입력 대기 실행에 보내는 사용자 입력 명령(`submit_form`, `click_button`, `submit_message`, `end_conversation`). | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 재개 큐 | `execution-continuation` | 재개 명령을 워커로 넘기는 영속 BullMQ 큐. | Continuation Bus, continuation-queue | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 시작 큐 | `execution-run` | 실행 시작 요청을 받아 워커에 나누는 큐. 우선순위는 수동 실행, 웹훅, 스케줄 순이다. | intake 큐, execution intake | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 동시 실행 제한 | admission gate, `maxConcurrentExecutions` | 워크스페이스(기본 10)와 워크플로우(기본 3)마다 동시에 돌 수 있는 실행 수의 상한. | admission gate(본문), 동시성 cap | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 큐 대기 한도 | `EXECUTION_QUEUE_WAIT_TIMEOUT` | 동시 실행 제한에 걸린 실행이 5분 넘게 기다리면 취소하는 한도. | 없음 | [큐 워커와 동시 실행 제한](CLE-EXEC/CLE-EXEC-WORKER.md) |
| 실행 시간 한도 | `EXECUTION_MAX_ACTIVE_RUNNING_MS` | 입력 대기 시간을 뺀 세그먼트 누적 시간의 상한(기본 30분). 넘으면 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 실패한다. | Workflow timeout, Workflow 단위 timeout | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| stalled 재배달 | stalled redelivery | 워커가 죽어 잠금이 풀린 시작 큐 작업을 BullMQ 가 한 번 더 배달하는 동작. | 없음 | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| 부팅 복구 스캔 | `recoverStuckExecutions` | 서버가 뜰 때 오래 멈춘 실행 중 실행을 재구동하고 방치된 대기 중 실행을 취소하는 스캔. | 부팅 backstop, stuck recovery | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| 안전 종료 | graceful shutdown | SIGTERM 을 받으면 새 실행을 거부하고 진행 중 세그먼트를 기다렸다가 끝내는 절차. | Graceful Shutdown(본문) | [장애 복구와 안전 종료](CLE-EXEC/CLE-EXEC-RECOVERY.md) |
| DLQ | dead-letter queue | 재시도를 다 쓴 큐 작업이 쌓이는 곳. 쌓인 양이 임계를 넘으면 경고 로그를 남긴다. | 없음 | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| 실행 중지 | stop execution, `POST /api/executions/:id/stop` | 사용자가 진행 중인 실행을 멈추는 동작. 결과 상태는 취소됨이다. | 실행 중단(버튼 이름으로), 실행 취소(버튼 이름으로) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 취소 주체 | `result.cancelledBy` | 취소 원인을 나누는 값(`user`, `system`, `timeout`). | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 노드 취소 | node cancellation, `abortSignal` | 실행 중인 노드의 외부 작업을 멈추는 규약. 신호로 알리는 경로와 DB 를 다시 읽어 알아채는 경로가 있다. | abort(본문) | [노드 취소](CLE-EXEC/CLE-EXEC-CANCEL.md) |
| 재실행 | Re-run | 끝난 실행을 바탕으로 새 실행을 만드는 기능. 원본 실행과 재실행 체인으로 묶인다. | Re-run(본문), 리플레이, replay(이 뜻으로), 다시 실행(기능 이름으로) | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 원본 실행 | `re_run_of` | 재실행이 가리키는 바로 앞 실행. | 없음 | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 재실행 체인 | re-run chain, `chain_id` | 재실행으로 이어진 실행 묶음. 깊이는 32까지다. | chain(본문) | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| dry-run | dry-run, `dry_run` | 외부 부수효과가 있는 노드를 실제로 부르지 않고 모의 출력으로 대신하는 재실행 모드. | dryRun(본문), 드라이런 | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 부수효과 노드 | `supportsDryRun` | 외부 시스템 상태를 바꿀 수 있어 dry-run 때 모의 출력으로 바꾸는 노드. | 외부 호출 노드 | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| 마지막 턴 재시도 | `retry_last_turn` | 재시도 가능한 에러로 끝난 멀티턴 AI 노드의 마지막 LLM 호출을 같은 실행 안에서 다시 돌리는 명령. 재실행과 다르다. | 재진입(단독), replay(이 뜻으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 전체 실행 | Run | 에디터에서 워크플로우 전체를 실행하는 기본 방식. | 없음 | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 입력과 함께 실행 | Run with Input | 테스트 입력 JSON 을 넣어 실행하는 방식. | Run with Input(본문) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 선택 노드부터 실행 | run from selected, `input.fromNodeId` | 고른 노드부터 뒤쪽 끝까지만 실행하는 방식. | 부분 실행, 여기서부터 실행, Run from Selected | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 단일 노드 실행 | single node run, `single_node_id` | 대상 노드 하나만 실행하는 디버그 실행. 화면 메뉴 이름은 "이 노드 실행" 이다. | 단일 노드 테스트, 테스트 실행(이 뜻으로) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 테스트 입력 | Mock Input | 에디터 실행에 넣는 입력 JSON. | Mock Input(본문), Test Input Data | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 테스트 데이터셋 | test dataset, `WorkflowTestDataset` | 이름을 붙여 저장한 테스트 입력. 기본은 나만 보고, 워크스페이스에 공유하면 읽기 전용이다. | 데이터셋(단독) | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 실행 결과 드로어 | Run Results drawer | 에디터 아래쪽에서 노드 타임라인과 결과 상세를 보여 주는 패널. | Run Results 드로어, Run Results Drawer | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 실행 트리 | Run Tree | 실행 결과 드로어 왼쪽의 노드 실행 타임라인. | Run Tree 패널, 좌측 실행 트리 | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 결과 상세 탭 | `ResultDetail` | 노드 결과를 미리보기·입력·출력·응답·요청·LLM 사용량·참조·설정·메타·포트·상태·오류 탭으로 나눠 보여 주는 묶음. 실행 상세 화면도 같은 탭을 쓴다. | 서브 탭, LLM Information 탭 | [에디터 실행과 디버깅](CLE-EXEC/CLE-EXEC-RUN.md) |
| 대화 미리보기 | Conversation Preview | 대화 스레드를 출처별 모양으로 그리는 AI 노드 결과 탭. | Preview 탭, conversation Preview, Conversation Inspector | [대화 미리보기](CLE-EXEC/CLE-EXEC-PREVIEW.md) |
| 실행 내역 | Execution History | 워크플로우별 실행 목록 화면과 실행 상세 화면. 에디터 안 패널은 "실행 내역 패널" 이다. | 실행 이력, 실행 히스토리, 실행 기록, Execution History(본문) | [실행 내역](CLE-EXEC/CLE-EXEC-HISTORY.md) |
| 실행 출처 | `triggerSource` | 실행이 어디서 시작됐는지 화면용으로 정리한 값(서브 워크플로우·수동 실행·스케줄·웹훅·알 수 없음). 엔진 내부 마커(`__triggerSource`)나 우선순위용 값(`triggerType`)과 다르다. | 트리거 출처, Trigger 출처 | [실행 내역](CLE-EXEC/CLE-EXEC-HISTORY.md) |
| 노드 실행 순서 로그 | `ExecutionNodeLog` | 노드가 처리된 순서를 쌓는 append-only 테이블. 응답의 `executionPath` 를 채운다. | execution_path(현행 컬럼처럼) | [실행 데이터와 흐름](CLE-EXEC/CLE-EXEC-DATA.md) |
| 실행 컨텍스트 | `ExecutionContext` | 엔진이 핸들러에 넘기는 실행 상태 객체(변수, 노드 출력 캐시, 대화 스레드 등). 세그먼트가 끝나면 사라지고 재개할 때 DB 에서 다시 만든다. | 컨텍스트(단독) | [실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| 호출 스택 | `resume_call_stack` | 중첩 서브 워크플로우 안에서 park 할 때 저장하는 호출 체인. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| AI 재개 체크포인트 | `_resumeCheckpoint` | 서버가 다시 시작된 뒤 멀티턴을 이어 가려고 매 턴 DB 에 남기는 상태 일부. | 체크포인트(단독) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 실행 이벤트 | execution events, `execution.*` | 엔진이 내보내는 실시간 이벤트. WebSocket·SSE·EIA 알림 웹훅이 받아 간다. | 없음 | [WebSocket 이벤트와 명령](CLE-API/CLE-API-WS-EVENTS.md) |
| 이벤트 순번 | `seq` | 한 실행 안에서 이벤트마다 1씩 늘어나는 번호. WebSocket·SSE·EIA 알림 웹훅이 같은 값을 쓴다. | seq(본문 단독) | [WebSocket 이벤트와 명령](CLE-API/CLE-API-WS-EVENTS.md) |
| 실행 스냅샷 이벤트 | `execution.snapshot` | 다시 구독할 때 실행 전체 상태를 한 번 보내는 이벤트. | 스냅샷(단독) | [WebSocket 이벤트와 명령](CLE-API/CLE-API-WS-EVENTS.md) |
| 상태 불일치 에러 | invalid execution state | 입력 대기가 아닌 실행에 재개 명령을 보냈을 때의 거부. WebSocket 은 `INVALID_EXECUTION_STATE`, REST 는 `INVALID_STATE`(422), EIA 는 `STATE_MISMATCH`(409)로 같은 뜻이다. | 없음 | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 엔진 에러 코드 | `EngineErrorCode` | 실행 자체를 끝내는 에러 코드(`EXECUTION_TIME_LIMIT_EXCEEDED`, `SERVER_INTERRUPTED`, `RESUME_*` 등). 노드 에러 코드는 `output.error.code` 로 에러 포트에 실린다. | 엔진 수준 에러(코드 이름으로) | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 실행 화면 복원 | hydration | 저장된 노드 출력을 실시간·대기·내역 화면에 되살리는 프론트엔드 동작. 엔진의 rehydration 과 다르다. | 하이드레이션 | [실행 화면 복원 규약](CLE-EXEC/CLE-EXEC-HYDRATION.md) |
| WebSocket | WebSocket, Socket.IO, `/ws` | 서버와 화면 사이 실시간 채널. 구현은 Socket.IO 다. | 웹소켓 | [WebSocket 연결과 채널 구독](CLE-API/CLE-API-WS.md) |
| 구독 채널 | subscription channel, `execution:<id>` | WebSocket 이벤트를 받으려고 구독하는 이름(`execution:`, `workflow:`, `kb:`, `notifications:`). | room, 채널(단독) | [WebSocket 연결과 채널 구독](CLE-API/CLE-API-WS.md) |
| SSE | Server-Sent Events | 서버에서 클라이언트로 한 방향으로 흐르는 스트림. AI 어시스턴트 응답과 EIA 이벤트 스트림이 쓴다. 둘은 재연결 규칙이 다르다. | 스트리밍(단독) | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |

### 트리거

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 트리거 | Trigger, `trigger` | 워크플로우를 시작시키는 진입점. 웹훅·스케줄·수동 세 유형이 있다. 채팅 채널과 웹채팅은 웹훅 트리거의 변형이다. | Trigger(본문), 트리거(엔드포인트) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 유형 | `Trigger.type` | `webhook`, `schedule`, `manual` 세 값. 만든 뒤 바꿀 수 없다. 화면 라벨은 웹훅·스케줄·수동이다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 활성 상태 | `trigger.is_active` | 활성·비활성 두 값. 비활성 트리거는 호출을 받지 않는다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 호출 이력 | trigger history, `GET /api/triggers/:id/history` | 트리거가 최근에 시작한 실행 목록. 인증 설정의 사용 내역과 다르다. | Recent Calls, 실행 이력(이 뜻으로) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 웹훅 | Webhook | 외부 HTTP 요청으로 워크플로우를 시작하는 트리거. 밖으로 보내는 알림은 "EIA 알림 웹훅" 이라고 쓴다. | Webhook(본문) | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 웹훅 URL | webhook URL | 백엔드 주소 뒤에 `/api/hooks/` 와 엔드포인트 경로를 붙인 주소. | 전체 URL | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 엔드포인트 경로 | endpoint path, `endpointPath` | 웹훅 URL 끝의 경로 값. 클라이언트가 v4 UUID 로 만들고 전역에서 겹치지 않는다. | endpoint_path(본문), Webhook URL 경로 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 엔드포인트 경로 예약 | `WebhookEndpointReservation` | 한 번 쓴 경로를 그 워크스페이스 소유로 영구히 남기는 기록. | 묘비, tombstone | [트리거 데이터와 흐름](CLE-TRIG/CLE-TRIG-DATA.md) |
| 공개 웹훅 | public webhook, `auth_config_id IS NULL` | 인증 없이 누구나 부를 수 있는 웹훅. 본문 크기와 IP 호출 수 제한이 더 걸린다. 웹채팅 트리거는 모두 공개 웹훅이다. | 공개 트리거, 공개 봇, 공개 챗봇 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 웹훅 남용 방어 | abuse protection | 공개 웹훅에 거는 본문 크기·IP 호출 빈도 제한. | 없음 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 인증 설정 | AuthConfig, `auth_config` | 외부 호출자가 웹훅을 부를 때 쓰는 워크스페이스 단위 인증 자격 증명. "인증" 메뉴에서 만든다. 로그인 인증이나 통합 자격 증명과 다르다. | Auth Config, Authentication(본문), 통합 자격증명 vault | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 인증 설정 유형 | `AuthConfig.type` | `api_key`, `bearer_token`, `basic_auth`, `hmac` 네 값. 화면 라벨은 API 키·Bearer 토큰·Basic Auth·HMAC 이다. | 인증 방식(이 뜻으로) | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| IP 화이트리스트 | `ip_whitelist` | 인증 설정에 붙이는 허용 IP·CIDR 목록. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 평문 보기 | Reveal, `POST /api/auth-configs/:id/reveal` | 관리자 이상이 비밀번호 재확인을 거쳐 인증 설정 비밀 값을 한 번 보는 기능. 화면은 30초 뒤 다시 가린다. | Reveal(본문), 평문 노출 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 키 재생성 | regenerate | 인증 설정의 비밀 값을 새로 발급하고 옛 값을 바로 무효로 만드는 동작. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 사용 내역 | usage | 인증 설정을 쓴 최근 호출과 기간별 호출 수. | 호출 이력(이 뜻으로) | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 필드 마스킹 | `***<last4>` | 인증 설정·모델 설정 응답에서 비밀 필드를 끝 네 글자만 보이게 가리는 방식. 응답 마스킹과 다르다. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 스케줄 | Schedule, `schedule` | Cron 표현식으로 워크플로우를 주기 실행하는 설정. 스케줄 유형 트리거와 1:1 로 묶이고 이름은 트리거에 있다. | Cron Job, 스케줄 관리(개념 이름으로) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| Cron 표현식 | cron expression, `cron_expression` | 분·시·일·월·요일 다섯 필드로 주기를 적는 식. 표현식 언어와 다르다. | cronExpression(본문) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 시각 편집 | visual editor | Cron 표현식을 빈도와 시각을 골라 만드는 편집 방식. 단순한 다섯 가지 패턴만 표현한다. | 시각적 편집기, Visual | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 시간대 | timezone | 스케줄이 쓰는 IANA 시간대. | 타임존 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 다음 실행 | next run, `next_run_at` | 스케줄이 다음에 돌 예정 시각. 화면 표시용이고 실제 실행 시점은 BullMQ 스케줄러가 정한다. | 다음 실행 예정 시간, 다음 실행 시각 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 지금 실행 | run now, `run-now` | 스케줄 주기와 상관없이 한 번 바로 실행하는 동작. 실행 출처는 수동 실행이 된다. | 즉시 실행 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 파라미터 값 | `parameter_values` | 스케줄 실행이 수동 트리거 노드에 넘기는 JSON 값. 제한 표현식을 쓸 수 있다. | 없음 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 트리거 외부 자원 정리 | teardown | 트리거를 지울 때 BullMQ 작업·채널 등록·시크릿을 함께 정리하는 절차. 자원 해제 순서는 [트리거 데이터와 흐름](CLE-TRIG/CLE-TRIG-DATA.md) 이 정한다. | 비밀 정리 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 설정 잠금 | `trigger-config:<id>` | 트리거 `config` 를 다시 쓰는 경로가 한 번에 하나만 돌게 하는 DB 잠금. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |

### 통합

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 통합 | Integration, `integration` | 외부 서비스 자격 증명과 연결 상태를 워크스페이스에 저장한 것. 노드와 AI 에이전트가 참조한다. | 연동, 외부 통합, Integration(본문) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 서비스 유형 | `service_type` | 통합이 연결하는 외부 서비스 종류(google, github, http, database, email, webhook, mcp, cafe24, makeshop). 화면 라벨은 "서비스" 다. | serviceType(본문), 서비스 종류 | [서비스별 인증 방식과 자격 증명](CLE-INT/CLE-INT-AUTH.md) |
| 통합 인증 유형 | `auth_type` | 서비스별 인증 방식(oauth2, api_key, bearer_token, basic, connection_string, smtp, webhook_outbound, none). 화면 라벨은 "인증 유형" 이다. | 인증 방식(이 뜻으로) | [서비스별 인증 방식과 자격 증명](CLE-INT/CLE-INT-AUTH.md) |
| 자격 증명 | credentials | 외부 시스템에 접근하는 비밀 값 묶음. 통합은 이를 암호화해 저장하고 응답에서 가린다. | 자격증명, 인증 정보, credential(s)(본문) | [서비스별 인증 방식과 자격 증명](CLE-INT/CLE-INT-AUTH.md) |
| 공개 범위 | `Integration.scope` | 통합을 누가 쓸 수 있는지 정하는 값. 개인(`personal`)은 만든 사람만, 조직(`organization`)은 워크스페이스 멤버 전체가 쓴다. | scope(본문), 공유 범위, 범위 전환, Organization-scope, (Org) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 권한 범위 | OAuth scope, `credentials.scopes` | OAuth 동의로 받은 권한 목록. 화면 탭 이름은 "권한" 이다. | scope(본문), 사용 권한 scope | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 통합 소유자 | `created_by` | 개인 통합을 보고 바꿀 수 있는 유일한 사용자. 역할이 높아도 남의 개인 통합은 다루지 못한다. | 본인, 생성자 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 통합 상태 | `Integration.status` | 연결됨(`connected`)·만료됨(`expired`)·오류(`error`)·설치 대기(`pending_install`) 네 값. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 상태 사유 | `status_reason` | 상태의 이유를 남기는 snake_case 코드(`auth_failed`, `token_expired`, `install_timeout` 등). | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 만료 임박·주의 필요 | `expiring`, `attention` | DB 에 없는 화면 필터 값. 만료 임박은 7일 안에 만료될 연결이고, 주의 필요는 만료됨·오류·만료 임박을 합친 것이다. | Need attention(본문) | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 연결 테스트 | test connection | 저장한 자격 증명으로 외부 서비스 접속을 확인하는 기능. 저장하기 전에 하는 것은 "저장 전 연결 테스트(`preview-test`)" 다. | ping, 사전 검증(이 뜻으로) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 통합 재인증 | reauthorize | OAuth 통합의 토큰을 새로 받아 되살리는 동작. OAuth 가 아닌 통합은 바로 연결됨으로 되돌린다. | 재인가, Reauthorize(본문), 재연결, 재인증(단독) | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 자격 증명 교체 | rotate credentials, `rotate` | OAuth 가 아닌 통합의 자격 증명을 새 값으로 바꾸는 동작. 연결 테스트를 통과해야 저장한다. | 자격 증명 회전, Rotate credentials, 회전(이 뜻으로) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 추가 권한 요청 | request scopes, `request-scopes` | 이미 있는 통합에 OAuth 권한을 더 받는 흐름. | Scope 추가 요청 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 사용처 | usages, `usageKind` | 통합을 참조하는 워크플로우 노드 목록. 직접 참조(`direct`)와 MCP 참조(`mcp`)를 합친다. 화면 탭 이름은 "사용" 이다. | Usage 탭(개념 이름으로) | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 삭제 차단 | delete blocked | 사용처가 남은 통합을 지우지 못하게 막는 규칙. | 없음 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 활동 로그 | activity log, `IntegrationUsageLog` | 노드가 통합을 부를 때마다 남기는 성공·실패·소요 시간 기록. 90일 보존한다. 화면 탭 이름은 "활동" 이다. | 사용 로그, usage log, Recent activity, 최근 호출 이력 | [통합 데이터와 흐름](CLE-INT/CLE-INT-DATA.md) |
| 호출 API 라벨 | `api_label` | 활동 로그에 남기는 호출 대상 식별자. Cafe24·MakeShop 은 카탈로그 키를 쓴다. | 없음 | [통합 데이터와 흐름](CLE-INT/CLE-INT-DATA.md) |
| OAuth 연결 흐름 | OAuth begin, callback | 팝업에서 OAuth 제공자 동의를 받고 콜백으로 토큰을 받는 흐름. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| OAuth 제공자 | OAuth provider | 통합이 OAuth 동의를 받는 외부 서비스. 화면 라벨은 "제공자" 다. | 프로바이더(이 뜻으로) | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 통합 OAuth state | `integration_oauth_state` | 통합 연결의 인가 요청과 콜백을 짝짓는 10분짜리 일회용 행. 소셜 로그인의 `auth_oauth_state` 와 다른 테이블이다. | OAuth state(단독) | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 미리보기 토큰 | `previewToken`, `integration_oauth_preview` | 새 OAuth 연결이 통합을 만들기 전까지 토큰을 맡겨 두는 10분짜리 참조. | integrationPreviewId, oauth_preview | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 토큰 자동 갱신 | token refresh | 만료가 다가오거나 401 을 받으면 OAuth 토큰을 새로 받는 동작. 갱신 경로는 `proactive`, `background`, `reactive_401` 세 가지다. | 401 자가 회복, 401 자동 회복 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 자동 갱신 표시 | `autoRefresh` | 화면에 "Auto-renews" 를 보일지 정하는 응답 전용 값. 만료 스캐너의 갱신 가능 판정(`isRefreshCapable`)과 대상이 다르다(결정 항목). | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 만료 스캐너 | `integration-expiry-scanner` | 토큰 만료·설치 기한·활동 로그 보존·Cafe24 백그라운드 갱신을 주기적으로 처리하는 작업 묶음. | 일일 스캐너, 매일 스캐너 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 만료 알림·조치 필요 알림 | `integration_expired`, `integration_action_required` | 통합이 만료 임계(7일·3일·당일)에 닿을 때와 오류로 바뀔 때 보내는 인앱 알림 두 종류. | passive 알림, active 알림 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 연속 네트워크 실패 | `consecutive_network_failures` | 노드 실행 중 연결 실패가 이어진 횟수. 3이 되면 통합 상태가 오류로 바뀐다. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| 설치 우선 흐름 | install-first | Cafe24 Private 앱과 MakeShop 이 외부 마켓 앱 설치로 연결을 시작하는 흐름. 통합은 설치 대기 상태로 먼저 생긴다. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 설치 토큰 | `install_token` | App URL 경로에 들어가 설치 대기 통합을 가리키는 22자 토큰. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| App URL·Redirect URI | `appUrl`, `callbackUrl` | 외부 마켓이 설치할 때 부르는 우리 서버 주소와 OAuth 콜백 주소. | 앱 URL | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 설치 시간 초과 | `install_timeout` | 24시간 안에 설치가 끝나지 않아 만료된 사유. Cafe24 Private 앱과 MakeShop 에 모두 적용한다. | 없음 | [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md) |
| Cafe24 앱 유형 | `app_type`: public, private | Public 앱은 서버가 가진 공용 클라이언트를, Private 앱은 사용자가 입력한 클라이언트를 쓴다. | 미심사 앱, 비공개 앱, 앱스토어 등록 앱 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 테스트 실행(Cafe24) | Test run | Cafe24 개발자 센터에서 Private 앱 설치를 시작하는 버튼. 에디터의 실행과 다르다. | 없음 | [OAuth 연결과 토큰 갱신](CLE-INT/CLE-INT-OAUTH.md) |
| 상점 식별자 | store identifier, `mall_id` | 외부 쇼핑몰의 상점 ID. Cafe24 는 `mall_id`, MakeShop 은 `shop_uid` 값을 같은 `mall_id` 컬럼에 둔다. | store-identifier, 매장 식별자 | [통합 데이터와 흐름](CLE-INT/CLE-INT-DATA.md) |
| 중복 사전 감지 | precheck | 상점 식별자를 입력할 때 같은 상점 통합이 이미 있는지 미리 알려 주는 조회. | 없음 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 통합 선택기 | `IntegrationSelector` | 노드 설정 패널의 통합 선택 드롭다운. | Integration 선택 드롭다운 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 삭제된 통합 표시 | Missing integration | 지워진 통합을 참조하는 노드에 캔버스가 붙이는 경고. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 통합 암호화 키 | `INTEGRATION_ENCRYPTION_KEY` | 통합 자격 증명 컬럼을 암호화하는 키. 시크릿 저장소의 `ENCRYPTION_KEY` 와 다르다(결정 항목). | 없음 | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 사설망 허용 플래그 | `ALLOW_PRIVATE_HOST_TARGETS` | 셀프 호스팅에서 사설망 주소 차단을 끄는 설정. MCP 는 `MCP_ALLOW_INSECURE_URL` 을 따로 쓴다. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 시크릿 저장소 | SecretStore, `secret_store` | 비밀을 AES-256-GCM 으로 암호화해 보관하고 `secret://` 참조로 가리키는 저장소. 통합 자격 증명과 인증 설정은 여기 두지 않는다. | Secret Store, secret store(본문) | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 시크릿 참조 | secret ref, `secret://<scope>/<id>/<name>` | 시크릿 저장소 값을 가리키는 문자열. | ref(단독) | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| SecretResolver | `SecretResolver` | 시크릿 저장소를 읽고 쓰는 유일한 서비스. | 없음 | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 저장소 예외 필드 | non-target fields | 시크릿 저장소 밖에 두기로 정한 비밀(인증 설정 `config`, 트리거 단위 토큰, 알림 서명 시크릿 v2 컬럼). 응답 노출 예외는 아니다. | 비대상(단독) | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| 24시간 유예 | 24h grace | 비밀을 바꾼 뒤 옛 값과 새 값을 24시간 함께 받는 기간. | 없음 | [시크릿 저장소](CLE-INT/CLE-INT-SECRET.md) |
| MCP | Model Context Protocol | LLM 이 쓸 도구·리소스를 외부 서버가 제공하는 프로토콜. 번역하지 않는다. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 외부 MCP 서버 | MCP server, `service_type=mcp` | Streamable HTTP 로 연결하는 외부 MCP 통합. | Generic MCP server | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 내부 MCP 브리지 | Internal MCP Bridge | Cafe24·MakeShop 통합을 외부 서버 없이 서버 프로세스 안에서 MCP 도구로 노출하는 방식. | Internal Bridge, MCP Bridge, MCP bridge, in-process bridge | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| MCP 지원 통합 | MCP-capable Integration | AI 에이전트 `mcpServers` 가 받는 통합. 외부 MCP 서버와 내부 MCP 브리지 통합을 함께 이른다. | MCP 서버(이 뜻으로) | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 노출 도구 목록 | `enabledTools` | MCP 지원 통합마다 AI 에이전트에 보여 줄 도구를 좁히는 목록. 비어 있으면 전부 노출한다. | allowlist(본문) | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 도구 설명 덮어쓰기 | `mcpServers[].toolOverrides` | MCP 도구의 설명을 바꾸는 설정. AI 에이전트 최상위의 옛 `toolOverrides` 는 제거했다. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 도구 프로바이더 | `AgentToolProvider` | AI 에이전트 안에서 도구를 만들고 실행하는 구현 단위(지식 저장소·MCP·Cafe24·MakeShop). | provider(이 뜻으로 단독) | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| MCP 진단 | `meta.mcpDiagnostics` | AI 노드 출력에 남는 MCP 서버별 연결·호출 진단. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| Cafe24 | Cafe24, `cafe24` | 카페24 쇼핑몰 Admin API 통합. | 카페24(본문) | [Cafe24](CLE-C24) |
| MakeShop | MakeShop, `makeshop` | 메이크샵 Shop API 통합. | Makeshop, 메이크샵(본문) | [MakeShop](CLE-MKS) |
| Cafe24 리소스 | `Cafe24Resource` | Cafe24 Admin API 의 최상위 분류 18개(store, product, order 등). | 카테고리(이 뜻으로), 18 카테고리 | [Cafe24 operation 메타데이터](CLE-C24-META) |
| MakeShop 섹션 | `MakeshopResource` | MakeShop Shop API 의 최상위 분류 7개. 노드 설정에서는 resource 값이다. | 없음 | [MakeShop operation 메타데이터](CLE-MKS-META) |
| operation | operation, `Cafe24OperationMetadata` | 외부 API 호출 하나(메서드와 경로). 노드의 Operation 드롭다운 값이자 MCP 도구 하나다. | endpoint(같은 뜻으로), op(약어로) | [Cafe24 operation 메타데이터](CLE-C24-META) |
| operation ID | `id`, `operationId` | operation 식별자. Cafe24 는 우리가 정한 snake_case, MakeShop 은 공식 원형을 쓴다. | 없음 | [Cafe24 operation 메타데이터](CLE-C24-META) |
| 카탈로그 키 | catalog key, `cafe24.<resource>.<operation>` | 활동 로그와 드롭다운 라벨 조회에 쓰는 operation 문자열. | labelKey(본문) | [Cafe24 operation 메타데이터](CLE-C24-META) |
| API 카탈로그 | API catalog | 외부 쇼핑몰 API 의 operation 을 전부 적은 참조 문서 묶음. 행 목록 파일과 필드 수준 파일 두 층이다. | API 레퍼런스 카탈로그 | [Cafe24](CLE-C24) |
| 카탈로그 상태 | `supported`, `planned`, `deprecated` | 카탈로그 행의 구현 상태. 스펙 문서 상태와 다른 값이다. | 없음 | [Cafe24 operation 메타데이터](CLE-C24-META) |
| 카탈로그 동기 검사 | `catalog-sync` | 카탈로그 행과 백엔드 operation 메타데이터가 서로 맞는지 빌드에서 확인하는 검사. | 동기 보호, Sync Contract | [Cafe24 operation 메타데이터](CLE-C24-META) |
| 별도 승인 | restricted approval, `restrictedApproval` | 카페24 본사 승인이 있어야 쓸 수 있는 권한·operation 표시. 막지 않고 경고만 한다. | restricted scope, 본사 승인, partner approval | [Cafe24 별도 승인 scope](CLE-C24-SCOPES) |
| 조건부 필수 제약 | `constraints` | 필수 필드 목록으로 표현하지 못하는 OR·짝·함의 제약. | conditional constraints | [Cafe24 operation 메타데이터](CLE-C24-META) |
| Cafe24 요청 봉투 | request envelope | Cafe24 POST·PUT 본문을 `{ shop_no, request }` 로 감싸는 규칙. 노드 출력과 무관하다. | envelope(단독) | [Cafe24 operation 메타데이터](CLE-C24-META) |
| x-scope | `x-scope` | MakeShop operation 이 속한 권한 그룹(한글 그룹명). 실제 권한 토큰(`store.read` 등)과 다르다. | 없음 | [MakeShop operation 메타데이터](CLE-MKS-META) |
| 적립금·예치금 | points, credits, reserve, emoney | 쇼핑몰 회원 혜택 금액. Cafe24 는 mileage 리소스의 points·credits, MakeShop 은 reserve·emoney 다. MakeShop 의 "포인트" 는 적립금과 다른 개념이다. | 포인트(Cafe24 points 번역으로) | [Cafe24](CLE-C24) |

### 외부 상호작용과 채널

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| External Interaction API | External Interaction API, EIA, `/api/external/*` | 실행 중인 워크플로우와 외부 시스템이 주고받는 공개 API. 나가는 EIA 알림 웹훅과 들어오는 REST·SSE 두 채널로 되어 있다. 화면 라벨은 "외부 인터랙션" 이다. | 외부 상호작용 API, 외부 표면(이 뜻으로), 트리거-원격 인터랙션 채널 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| EIA 알림 웹훅 | Outbound Notification Webhook, `config.notification` | 실행 이벤트 다섯 종류를 트리거에 등록한 외부 URL 로 HMAC 서명해 보내는 채널. 인앱 알림과 다르다. | notification webhook, outbound notification, 알림(단독) | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 인바운드 인터랙션 | Inbound Interaction | 외부 클라이언트가 REST 로 명령을 보내고 SSE 로 이벤트를 받는 채널. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 인터랙션 명령 | interaction commands | `submit_form`, `click_button`, `submit_message`, `end_conversation`, `cancel`. 앞의 넷은 재개 명령이다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 인터랙션 토큰 | interaction token | EIA 인바운드 요청을 인증하는 토큰. 실행 단위 토큰과 트리거 단위 토큰이 있다. | 없음 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 실행 단위 토큰 | per_execution token, `iext_*` | 실행 하나에만 쓰는 1시간짜리 JWT. 실행이 끝나면 무효가 된다. | Per Execution(본문), per-execution, 단명 토큰, 위젯 토큰 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 트리거 단위 토큰 | per_trigger token, `itk_*` | 트리거 설정에 저장하는 영구 토큰. | Per Trigger(본문), per-trigger | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 토큰 전략 | `tokenStrategy` | 두 토큰 중 무엇을 쓸지 정하는 트리거 설정. 기본값은 실행 단위다. | 없음 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 트리거 단위 토큰 재발급 | `revoke-token` | 트리거 단위 토큰을 새로 발급하고 옛 토큰을 바로 무효로 만드는 동작. 엔드포인트 이름과 달리 폐기만 하지 않는다. | 토큰 폐기(이 동작 이름으로) | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 알림 서명 시크릿 | notification signing secret, `wsk_*` | EIA 알림 웹훅의 HMAC 서명 비밀. | signing secret(단독) | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 시크릿 교체 | `rotate-secret` | 알림 서명 시크릿을 새로 발급하고 24시간 동안 두 서명을 함께 싣는 동작. | secret 회전 | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 발송 건강도 | `notification_health` | EIA 알림 웹훅의 발송 상태(확인 안 됨·정상·저하됨). 저하돼도 트리거를 끄지 않는다. | 없음 | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 멱등 키 | `Idempotency-Key` | 같은 EIA 요청을 다시 보내도 같은 응답을 받게 하는 헤더. 채팅 채널의 중복 제거 키와 다른 장치다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| SSE 재전송 버퍼 | SSE replay buffer | SSE 가 다시 연결될 때 놓친 이벤트를 5분 동안 다시 보내는 버퍼. 채우지 못하면 `execution.replay_unavailable` 을 보낸다. | 5분 이벤트 버퍼 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 내부 신뢰 호출 | `in_process_trusted` | 채팅 채널 어댑터처럼 HTTP 를 거치지 않고 EIA 서비스를 부르는 서버 내부 호출. 토큰 검증을 건너뛴다. | 없음 | [EIA 데이터와 흐름](CLE-IX/CLE-EIA-DATA.md) |
| 실행 토큰 테이블 | `ExecutionToken`, `execution_token` | 발급한 실행 단위 토큰을 실행별로 추적하는 테이블. | 없음 | [EIA 데이터와 흐름](CLE-IX/CLE-EIA-DATA.md) |
| 표시 메시지 이벤트 | `execution.message` | 버튼 없는 Presentation 노드 결과를 SSE 로 알리는 이벤트. AI 응답 이벤트(`execution.ai_message`)와 다르다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 대기 노드 ID | `waitingNodeId` | 입력 대기 중인 노드를 가리키는 wire 필드. 문서의 논리 표기 `node.id` 와 같은 값이다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 대기 표면 | `WaitingInteractionType` | 입력 대기 노드가 무엇을 기다리는지 나타내는 값(form, buttons, ai_conversation, ai_form_render). EIA 밖으로는 ai_form_render 를 ai_conversation 으로 합친 세 값만 나간다. | interactionType(이 뜻으로 단독), 인터랙션 표면 | [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) |
| 사용자 행동 기록 | `interaction_data.interactionType` | 사용자가 실제로 한 행동(form_submitted, button_click, button_continue). 대기 표면과 이름만 같은 별개 값이다. | interactionType(이 뜻으로 단독) | [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) |
| 인터랙션 유형 레지스트리 | interaction type registry | 여러 계층이 함께 쓰는 인터랙션 값의 단일 목록. | 없음 | [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) |
| 대화 스레드 | ConversationThread | 실행 동안 사용자 인터랙션과 AI 대화를 시간순으로 쌓는 기록. park 할 때 실행에 저장한다. | Conversation Thread, conversation thread, thread(본문) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 대화 기록 항목 | `ConversationTurn` | 대화 스레드에 쌓이는 바뀌지 않는 기록 한 건. AI 대화 턴 하나가 항목 여러 개를 만든다. | turn(이 뜻으로) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 항목 출처 | `ConversationTurnSource` | 대화 기록 항목이 어디서 왔는지 나타내는 값. 백엔드 다섯 값(presentation_user, ai_user, ai_assistant, ai_tool, system)에 화면이 system_error·rag 를 더한다. | source(단독) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 사용자 입력 마커 | `[user-input]` | 사용자 텍스트를 감싸 프롬프트 주입을 막는 표시. 화면에서는 지운다. | 마커(단독) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 출처 접두 | `[from <nodeLabel>]` | LLM 에 보낼 때만 붙이는 노드 출처 표시. | 없음 | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 채팅 채널 | Chat Channel, `config.chatChannel` | Telegram·Slack·Discord 봇을 웹훅 트리거에 연결해 워크플로우를 대화로 돌리는 기능. 새 트리거 유형이 아니라 웹훅 트리거 설정이다. 화면 라벨은 "Chat Channel" 이다. | 챗 채널, chat channel(본문), Chat Channel(본문), 채널(단독) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 프로바이더 | `provider`: telegram, slack, discord | 채팅 채널이 붙는 외부 메신저. 만든 뒤 바꿀 수 없다. | provider(본문 단독) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 어댑터 | `ChatChannelAdapter` | 채널 프로바이더마다 있는 변환·발송 구현. 진입 어댑터·SSE 어댑터와 다르다. | 어댑터(단독), provider 어댑터 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 봇 토큰 | bot token, `botToken`, `botTokenRef` | 채널 봇의 외부 API 자격 증명. 평문은 시크릿 저장소에만 두고 트리거 설정에는 참조만 둔다. | Bot Token(본문), bot token(본문) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 봇 토큰 재발급 | `rotate-bot-token` | 봇 토큰을 바꾸는 유일한 경로. 24시간 동안 옛 토큰도 받는다. | 봇 토큰 회전 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 인바운드 서명 자료 | `inboundSigning` | 메신저 요청의 출처를 확인하는 자료. Telegram 은 서버가 발급하고 Slack·Discord 는 사용자가 입력한다. | signing secret(단독) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| UI 매핑 | `uiMapping` | 노드 출력을 채널 메시지로 바꾸는 옵션 묶음(폼 모드, 시각형 노드 표시, 버튼 배치). | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 폼 모드 | `uiMapping.formMode` | 채널에서 Form 을 받는 방식. 네이티브 모달(`native_modal`), 다단계 질문(`multi_step`), 자동(`auto`)이 있다. | 다단계 텍스트 시퀀스, 다단계 prompt 시퀀스 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 안내 문구 | `languageHints`, `languageLocale` | 봇이 스스로 보내는 안내 메시지와 그 기본 언어. 웹채팅 위젯 언어(`locale`)와 다르다. | 없음 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 건강도 | `chat_channel_health` | 채널 어댑터의 외부 호출 상태(확인 안 됨·정상·저하됨). 저하돼도 트리거를 끄지 않는다. | 없음 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 대화 상태 | `ChannelConversation` | 채팅방과 진행 중인 실행을 잇는 7일짜리 Redis 값. 대화 스레드와 다르다. | conversation thread(이 뜻으로), 대화 상태(단독) | [채팅 채널 데이터와 흐름](CLE-CHAT/CLE-CHAT-DATA.md) |
| 대화 키·채널 사용자 키 | `conversationKey`, `channelUserKey` | 채널 안의 대화와 사용자를 구분하는 키. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 채널 업데이트·채널 메시지 | `ChannelUpdate`, `ChannelMessage` | 어댑터의 입력과 출력을 공통 형태로 정한 타입. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 중복 제거 키 | `idempotencyKey` | 메신저가 같은 update 를 다시 보낼 때 30초 안에 다시 온 것을 거르는 키. EIA 멱등 키와 다르다. | 없음 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 실행 실패 안내 분류 | `classifyExecutionFailure` | 실패 원인을 채널 안내 문구 키 여섯 개 중 하나로 고르는 함수. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 제어 안내 | control-plane message | 도움말·그룹 채팅 거절처럼 노드 렌더를 거치지 않고 바로 보내는 봇 안내. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 웹채팅 | Web Chat, `channel-web-chat` | 고객 사이트에 넣는 임베드형 채팅 위젯과 그 SDK·운영 콘솔 전체. 사이드바 메뉴 이름과 같다. | 웹챗, Web Chat(본문), Channel Web Chat, 채팅 위젯 | [웹채팅](CLE-WEBCHAT/CLE-WEBCHAT.md) |
| 웹채팅 위젯 | web chat widget | iframe 안에서 도는 채팅 화면 SPA. | 위젯 SPA, 동봉 위젯, 공개 위젯, 임베드 위젯, 익명 위젯 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 웹채팅 SDK | `@workflow/web-chat`, `ClemvionChat` | 호스트 페이지가 위젯을 넣고 조작하는 SDK. | 위젯 SDK | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 스니펫 로더 | `loader.js` | 설치 스크립트가 불러오는 SDK 파일. | 없음 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| EIA 클라이언트 SDK | `@workflow/sdk` | EIA HTTP·SSE 를 직접 부르는 별도 클라이언트. 웹채팅 SDK 와 다르다. | SDK(단독), headless client | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| 웹채팅 운영 콘솔 | admin console, `/web-chat` | 제품 안에서 웹채팅을 만들고 외형·설치 스크립트·미리보기를 다루는 화면. | admin 콘솔, 콘솔(단독) | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 웹채팅 인스턴스 | web chat instance | 인터랙션이 켜진 웹훅 트리거와 연결 워크플로우 한 쌍. 새 엔티티를 만들지 않는다. | 인스턴스(단독) | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 제어 인스턴스 | `ChatInstance` | SDK `boot()` 가 돌려주는 JS 제어 객체. | 공개 인스턴스 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 부팅 설정 | `BootConfig` | 위젯을 띄울 때 넘기는 설정 객체. 인증 토큰은 넣지 않는다. | boot 옵션 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 외형 | appearance, `config.interaction.appearance` | 운영 콘솔이 저장하는 위젯 색·위치·봇 이름·환영 메시지 같은 표시 설정. 화면 라벨은 "외형 · 콘텐츠" 다. | 외형/콘텐츠 | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 설치 스크립트 | install snippet | 호스트 사이트 `</body>` 앞에 붙이는 설치 코드. 큐 스텁과 로더 두 블록이다. | 설치 스니펫, 스니펫(단독) | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 라이브 미리보기 | live preview | 운영 콘솔 안에서 위젯을 실제로 띄워 대화까지 해 보는 기능. 대화 미리보기와 다르다. | 없음 | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 런처·패널 | launcher, panel | 위젯이 접혔을 때의 진입 버튼과 펼쳤을 때의 대화창. | 없음 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 위젯 대화 상태 | widget state | 위젯의 로컬 상태 값(`collapsed`, `panel`, `booting`, `streaming`, `awaiting_user_message`, `ended`, `blocked`). | 없음 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 즉시 시작 | eager start | 패널을 열자마자 실행을 시작하는 방식. | eager 시작 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 새 대화 | new chat, `resetSession` | 현재 대화를 버리고 새 실행을 시작하는 동작. | 새 세션, restart, new chat(본문) | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 대화 종료 | end conversation | 사용자가 위젯 대화를 끝내는 동작. AI 대화를 기다리는 중이면 `end_conversation`, 아니면 `cancel` 을 보낸다. | 채팅 종료 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 위젯 세션 | widget session | 위젯이 sessionStorage 에 보관하는 대화 한 건(실행 ID·토큰·API 주소). 로그인 세션과 다르다. | 저장 세션, 세션(단독) | [웹채팅 인증과 세션](CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) |
| 임베드 허용 도메인 | `interactionAllowedOrigins` | 위젯을 넣을 수 있는 호스트 origin 이면서 EIA CORS 추가 허용 목록인 워크스페이스 설정. | CORS allowlist, 임베드 allowlist | [웹채팅 보안](CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) |
| 임베드 검증 | embed check, `embed-config` | 위젯이 뜰 때 호스트 origin 을 임베드 허용 도메인과 비교하는 클라이언트 검증. 맞지 않으면 차단(`blocked`) 상태가 된다. | soft 검증 | [웹채팅 보안](CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) |
| 위젯 배포 주소 | widget CDN base | 위젯 SPA 와 로더를 서빙하는 origin. 기본값은 배포 자신의 주소다. | 위젯 CDN(기본 배포를 가리킬 때) | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| 동봉 배포 | co-deploy | 위젯을 제품과 같은 릴리스로 묶어 같은 origin 에서 서빙하는 배포 방식. | 동봉(이 뜻으로 단독) | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| 호스트 페이지 | host page | 위젯을 올리는 고객 웹페이지. | 호스트(단독), 고객 사이트 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| postMessage 프로토콜 | `wc:*` | 호스트 페이지와 위젯 iframe 사이의 메시지 규약. | 브리지(단독) | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 위젯 고유 문구 | widget chrome | 위젯이 스스로 그리는 UI 문자열. 운영자가 넣은 콘텐츠와 AI 응답은 빠진다. | chrome, 위젯 chrome | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 유휴 실행 회수 | `WEBCHAT_IDLE_TIMEOUT` | 버려진 공개 위젯 실행을, 토큰이 모두 만료되고 1시간이 지나면 취소하는 장치. | idle reaper, backstop, B-2 | [웹채팅 인증과 세션](CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) |
| 사용 모드 | Hosted iframe, BYO-UI | 위젯 iframe 을 쓰는 방식과, 고객이 자기 UI 로 EIA 를 직접 부르는 방식. | M1, M2 | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| API 기준 주소 | `apiBase` | 위젯이 EIA 를 부를 서버 주소. | API origin | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |

### AI 와 지식 저장소

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| LLM | Large Language Model | 대규모 언어 모델. 번역하지 않는다. | 언어 모델(단독) | [LLM 클라이언트](CLE-AI/CLE-AI-LLM.md) |
| LLM 클라이언트 | `LLMClient`, `LlmService` | 여러 모델 프로바이더를 한 인터페이스로 부르는 계층. 캐시·재시도·사용량 기록을 함께 맡는다. | LLM Client(본문) | [LLM 클라이언트](CLE-AI/CLE-AI-LLM.md) |
| 모델 설정 | Model settings, `ModelConfig` | 워크스페이스가 등록한 AI 모델 연결(프로바이더·API 키·주소·기본 모델). 종류는 Chat·Embedding·Rerank 세 가지다. 메뉴 이름과 같다. | LLM 설정, LLM Config, LLMConfig, Model Config, LLM 프로바이더 설정, Models(본문) | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 종류 | `ModelConfig.kind` | `chat`, `embedding`, `rerank` 세 값. 화면 탭은 Chat·Embedding·Rerank 다. | 없음 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 프로바이더 | model provider, `provider` | 모델을 제공하는 서비스(openai, anthropic, google, azure, local, 리랭커는 tei·cohere). 화면 라벨은 "프로바이더" 다. | 제공자(이 뜻으로), LLM Provider | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 기본 모델 | default model, `default_model` | 모델 설정 하나에서 쓸 모델 ID. | 없음 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 워크스페이스 기본 설정 | default config, `is_default` | 종류마다 하나씩 정하는 기본 모델 설정. 노드나 지식 저장소가 모델 설정을 지정하지 않으면 이것을 쓴다. | 워크스페이스 default, 기본 프로바이더 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 기본 파라미터 | `default_params` | Chat 모델 설정의 temperature·max_tokens 같은 기본값. AI 노드가 따로 덮어쓸 수 있다. | 모델 파라미터 기본값 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 목록 항목 | `ModelInfo` | 프로바이더에서 불러온 모델 목록의 한 항목. 모델 설정과 다르다. | 없음 | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| 모델 설정 참조 필드 | `llmConfigId`, `llm_config_id` | 노드와 지식 저장소가 모델 설정을 가리키는 옛 이름 필드. 코드 식별자라 이름을 바꾸지 않는다. | LLM 설정 ID(본문) | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| LLM 사용량 | LLM usage, `LlmUsageLog` | Chat 계열 LLM 호출마다 토큰 수와 비용을 쌓는 기록. 임베딩 호출은 쌓지 않는다. | usage log(이 뜻으로) | [LLM 사용량 기록](CLE-AI/CLE-AI-USAGE.md) |
| 사용량 귀속 | `LlmCallContext` | LLM 사용량 행을 워크플로우·실행·노드 실행에 잇는 값. | attribution(본문) | [LLM 사용량 기록](CLE-AI/CLE-AI-USAGE.md) |
| LLM 스텁 모드 | `LLM_STUB_MODE` | e2e 테스트용으로 늘 같은 답을 내는 LLM 클라이언트. 운영 환경에서는 켤 수 없다. | 없음 | [LLM 클라이언트](CLE-AI/CLE-AI-LLM.md) |
| 지식 저장소 | Knowledge Base, `KnowledgeBase` | 문서를 올려 임베딩하고 AI 노드가 검색하는 워크스페이스 단위 저장소. | 지식 베이스, 지식베이스, 지식저장소, Knowledge Base(본문), 컬렉션(이 뜻으로) | [지식 저장소 관리](CLE-KB/CLE-KB-MANAGE.md) |
| 문서 | Document, `document` | 지식 저장소에 올린 원본 파일 한 개(txt, md, pdf, csv). | 없음 | [지식 저장소 데이터와 흐름](CLE-KB/CLE-KB-DATA.md) |
| 청크 | chunk, `DocumentChunk` | 문서를 나눈 텍스트 조각과 그 벡터. 검색 단위다. | chunk(본문) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 청크 크기·청크 오버랩 | `chunk_size`, `chunk_overlap` | 청크 하나의 추정 토큰 수와 이웃 청크가 겹치는 양. 토큰 수는 실제 토크나이저가 아니라 추정값이다. | 청크 최대 토큰 수 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 | embedding | 텍스트를 벡터로 바꾸는 일과 그 결과. | 벡터 임베딩 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 모델 설정 | embedding model config | 지식 저장소가 쓰는 Embedding 종류 모델 설정. 비워 두면 워크스페이스 기본 설정을 쓴다. | 없음 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 차원 | dimension, `ModelConfig.dimension`, `embedding_dimension` | 벡터 길이. 모델 설정의 `dimension` 은 모델 출력 차원이고 지식 저장소의 `embedding_dimension` 은 저장된 청크의 실제 차원이다. | 차원(단독) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 임베딩 상태 | `embedding_status` | 문서마다 두는 처리 상태. 대기 중·처리 중·준비됨·재시도 중·실패 다섯 값이다. | 없음 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 재임베딩 | re-embed | 청크를 지우고 다시 임베딩하는 작업. 문서 하나 단위와 지식 저장소 전체 단위가 있다. | 재색인, 재인덱싱 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 재처리 잠금 | `reembed_status`, `reextract_status` | 지식 저장소 전체 재임베딩과 그래프 재추출을 한 번에 하나만 돌게 하는 잠금(`idle`, `in_progress`). | KB 잠금 | [지식 저장소 데이터와 흐름](CLE-KB/CLE-KB-DATA.md) |
| 실패 문서 재시도 | `retry-failed` | 최종 실패한 문서를 다시 큐에 넣는 동작. 재시도 횟수가 0으로 돌아간다. | 없음 | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 처리 중 문서 회수 | stuck document recovery | 서버가 뜰 때 10분 넘게 처리 중인 문서를 대기 중으로 되돌리는 동작. 실행 엔진 복구와 다르다. | Stuck 회수(단독) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| 검색 불가 | `not_searchable`, `kb_unsearchable` | 임베딩 차원을 몰라 지식 저장소가 검색에서 빠진 상태. 모델을 바꾼 뒤 재임베딩하지 않았거나 재임베딩 중일 때다. | 검색불가 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| RAG | Retrieval-Augmented Generation | 검색 결과를 LLM 입력에 넣어 답을 만드는 방식. 번역하지 않는다. 풀어 쓸 때는 "RAG(검색 보강)" 로 쓴다. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 검색 모드 | `rag_mode` | 지식 저장소의 검색 방식. Vector RAG(기본)와 Graph RAG 가 있고 만든 뒤 바꿀 수 없다. | KB 모드, 모드 배지(개념 이름으로) | [지식 저장소 관리](CLE-KB/CLE-KB-MANAGE.md) |
| Vector RAG | `rag_mode=vector` | 유사도로만 청크를 찾는 기본 검색 모드. "Vector 모드" 로 줄여 쓸 수 있다. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| Graph RAG | `rag_mode=graph` | 문서에서 뽑은 Entity·Relation 그래프로 검색을 넓히는 모드. "Graph 모드" 로 줄여 쓸 수 있다. | 그래프 RAG, Hybrid 흐름, PRD 9 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| Entity | Entity, `GraphEntity`, `entity` | 청크에서 LLM 으로 뽑은 의미 단위(인물·조직·개념 등). 데이터 모델 엔티티와 구분하려고 영문으로 쓴다. | 엔티티(이 뜻으로) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| Relation | Relation, `GraphRelation` | 두 Entity 사이의 방향 있는 관계(head, predicate, tail). | 관계(단독) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 청크-Entity 매핑 | `ChunkEntity` | 어느 청크가 어떤 Entity 를 언급했는지의 연결. | 없음 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 그래프 추출 | graph extraction | 청크에서 Entity·Relation 을 뽑는 작업. 전체를 다시 하면 "그래프 재추출" 이다. | 추출(단독) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 그래프 추출 LLM | `extraction_llm_config_id` | 그래프 추출에 쓰는 Chat 모델 설정. | 추출 LLM(단독) | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 그래프 검색 파라미터 | `max_hops`, `vector_seed_top_k`, `expanded_chunk_limit` | 최대 확장 깊이·Vector seed 개수·확장 청크 상한. | 없음 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 중심성 가중치 | `centrality_weight` | Graph 모드에서 확장 청크 점수에 곱하는 Entity 등장 빈도 가중치. 리랭킹과 다르다. | rerank(이 뜻으로), score 재정렬 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 리랭킹 | reranking, `rerank_mode` | 검색 후보를 cross-encoder 로 다시 점수 매겨 정렬하는 후처리. 모드는 사용 안 함·Cross-encoder·Cross-encoder + LLM grading 이다. | 리랭크, 재점수화(기능 이름으로), 검색 후처리 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 리랭커 | reranker | 리랭킹에 쓰는 Rerank 종류 모델 설정. | Reranker(본문) | [모델 설정](CLE-AI/CLE-AI-MODELS.md) |
| LLM 그레이딩 | LLM grading | cross-encoder 점수가 서로 비슷할 때만 LLM 으로 후보 순위를 한 번 더 매기는 단계. | listwise LLM grading(본문) | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 후보 풀 | `rerank_candidate_k` | 리랭킹 전에 넓게 가져오는 후보 수. | candidate pool, 회수 폭 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 점수 컷 임계 | `rerank_score_threshold` | 리랭킹 점수가 이 값보다 낮은 후보를 버리는 기준. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 유사도 임계값 | `ragThreshold` | 검색 결과를 자르는 최소 관련도(기본 0.7). 리랭킹이 켜지면 리랭킹 점수 기준으로 해석한다. | θ(본문), Score cutoff | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 동적 점수 컷 | `applyDynamicCut` | 점수 순으로 토큰 예산과 개수 상한까지만 청크를 넣는 규칙. | 동적 컷, token-budget + inject-cap | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 주입 상한 | `ragTopK` | LLM 에 넣을 청크 수의 선택적 상한. 비우면 동적 점수 컷이 정한다. | Top-K(고정 개수 뜻으로) | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 검색 인용 메타 | `meta.ragSources`, `meta.ragDiagnostics` | AI 노드 출력에 남는 인용 청크 목록과 검색 진단. | 없음 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 입력 유형 | `inputType`: query, document | 비대칭 임베딩 모델에서 검색문과 문서를 다르게 인코딩하는 힌트. | passage(이 값 이름으로) | [문서 임베딩](CLE-KB/CLE-KB-EMBED.md) |
| RAG 품질 평가 | RAG evaluation | 골든셋으로 검색 지표를 재는 오프라인 평가. | 없음 | [RAG 품질 평가](CLE-KB/CLE-KB-EVAL.md) |
| 골든셋 | golden set, `GoldenSet` | 질의와 정답 청크를 묶은 평가 데이터. 검수 전은 silver, 검수 후는 gold 다. | 없음 | [RAG 품질 평가](CLE-KB/CLE-KB-EVAL.md) |
| 평가 하네스 | evaluation harness | 골든셋 생성과 지표 계산을 하는 CLI 묶음. | 하베스 | [RAG 품질 평가](CLE-KB/CLE-KB-EVAL.md) |
| 에이전트 메모리 | Agent Memory, `AgentMemory` | AI 노드가 실행을 넘어 사실·선호를 기억하는 영속 메모리. 메모리 전략이 `persistent` 일 때만 쓴다. AI 에이전트와 정보 추출기가 함께 쓴다. | Agent Memory(본문), 장기 메모리, 영속 메모리, persistent 메모리, 세션 간 메모리 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 범위 키 | `scope_key`, `memoryKey` | 메모리가 쌓이는 네임스페이스. 노드 설정 `memoryKey` 의 평가값을 정리한 값이고 없으면 실행 ID 를 쓴다. 화면 라벨은 "scope" 다. | 스코프 키, scope(단독) | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 종류 | `metadata.kind`: fact, preference, entity | 추출한 메모리의 분류. 화면 라벨은 사실·선호·엔티티다. Graph RAG 의 Entity 와 다르다. | 개체 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 추출 | memory extraction | 턴 경계에서 대화로부터 기억할 사실을 뽑아 저장하는 비동기 작업. | 추출(단독) | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 회수 | memory recall | LLM 을 부르기 직전 관련 메모리를 의미 검색으로 가져오는 동작. | 회수(단독) | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 추출 기준점 | `lastExtractionTurnSeq` | 직전 추출이 다룬 마지막 대화 기록 항목 번호. | watermark | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 주입 경계 | data-fence | 회수한 메모리를 지시가 아닌 데이터로 감싸는 표시. | 없음 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 메모리 정리 | memory eviction | 만료된 행을 지우고 범위마다 최신 1000건만 남기는 정리. 기준은 만든 시각이다. | LRU, FIFO/LRU | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |

### 관측과 운영

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 대시보드 | Dashboard | 로그인 뒤 첫 화면. 요약 카드와 최근 워크플로우·실행을 보여 준다. | 홈 | [대시보드](CLE-OBS/CLE-OBS-DASHBOARD.md) |
| 통계 | Statistics | 실행·노드·토큰 통계 화면과 API. | 없음 | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 성공률 | success rate, `successRate` | 기간 안 전체 실행 중 완료 비율. 분모에 실행 중·대기 중·취소됨도 들어간다. | Success Rate(본문) | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 평균 실행 시간 | average duration | 완료된 실행의 평균 소요 시간. | Avg Time, Avg Duration | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 오류 분포 | Error Distribution | 실패 실행을 워크플로우별로 나눈 차트. 에러 코드별 분류가 아니다. | 에러 발생 빈도 및 유형별 분류 | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 노드 통계 | node statistics | 노드 유형별 실행 수·평균 시간·오류율과 병목 표시. | 없음 | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 시스템 상태 | System Status | 워크스페이스와 상관없이 BullMQ 큐 상태를 보여 주는 화면과 API. 헬스 체크와 다르다. | SysStatus | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 큐 그룹 | queue group | 시스템 상태 화면이 큐를 묶는 네 그룹(실행, 지식 저장소, 알림·통합, 스케줄·시스템). "알림·통합" 의 알림은 EIA 알림 웹훅이다. | 없음 | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 큐 건강도 | queue health, `healthy`, `degraded`, `down` | 큐 상태 판정. 화면 라벨은 정상·지연·점검 필요다. | 없음 | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 최근 실패·누적 보관 | `recentFailed`, `failed` | 최근 윈도우(기본 60분) 안의 실패 수와 큐가 아직 보관 중인 실패 수. 누적 보관은 전체 기간 합계가 아니다. | 누적(단독) | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 헬스 체크 | health check, `/api/health`, `/api/health/live` | DB·Redis 를 점검하는 준비 상태 API 와 늘 200 을 돌려주는 생존 확인 API. | Health check(본문) | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| 감사 로그 | Audit Log, `AuditLog` | 워크스페이스 안 변경 동작을 한 행씩 남기는 기록. 관리자 이상만 본다. | Audit Log(본문), 감사(단독) | [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md) |
| 감사 액션 | audit action, `AuditLog.action` | `<resource>.<verb>` 형식의 동작 식별자(예: `integration.created`). | action(본문), audit action(본문) | [감사 action 명명](CLE-OBS/CLE-OBS-AUDITNAME.md) |
| 로그인 이력 | Login History, `LoginHistory` | 로그인 성공·실패·로그아웃 같은 인증 이벤트를 사용자별로 180일 남기는 기록. 본인만 본다. 감사 로그와 다른 기록이다. | Login History(본문) | [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md) |
| 인앱 알림 | Notification, `notification` | 사용자에게 벨과 이메일로 보내는 알림. 본문에서 "알림" 은 이 뜻으로만 쓴다. | Notifications(본문), 벨 알림 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 유형 | `Notification.type` | execution_failed, integration_expired, alert_failure_rate 등 열 가지 값. | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 채널 | `Notification.channel`: in_app, email, both | 알림이 전달되는 경로. 채팅 채널·WebSocket 구독 채널과 다르다. | 채널(단독) | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 닫기 | dismiss, `dismissed_at` | 알림을 목록과 개수에서 숨기는 동작. 행을 지우지 않는다. 화면 버튼은 "닫기", "모두 지우기" 다. | 알림 삭제(이 동작을) | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 필터 | notification filter | 알림 팝오버의 분류 칩(전체, 일반, 통합 액션 필요). | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 규칙 | Alert Rule, `AlertRule` | 실패율·평균 실행 시간·LLM 비용이 임계치를 넘으면 인앱 알림을 보내는 워크스페이스 규칙. | 알람, 알림 룰, Alert Rule(본문) | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 평가 기간 | `window_iso` | 알림 규칙이 지표를 모으는 기간(ISO 8601, 기본 PT1H). 화면 라벨은 "기간", "윈도우" 다. | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 설정 | notification preferences, `notification_preferences` | 알림 유형별 이메일 수신 여부. 실행·스케줄 실패 메일은 기본 켜짐, 통합 만료 메일은 기본 꺼짐이다. 알림 규칙과 다르다. | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 부수 기록 실패 흡수 | best-effort | 감사 로그·로그인 이력·사용량 기록이 실패해도 주 동작을 막지 않는 방식. | swallow, 삼킨다 | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| 보존 배치 | pruner | 로그인 이력(180일)과 활동 로그(90일)의 오래된 행을 지우는 반복 작업. 감사 로그에는 없다. | 없음 | [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md) |
| 비즈니스 메트릭 | business metrics, `clemvion.*` | OTel 로 내보내는 운영 지표. | 없음 | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| 로그 마스킹 | log masking | 서버 로그에 자격 증명이 남지 않게 가리는 규칙. | 없음 | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |

### API 와 개발 규약

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 응답 봉투 | response envelope, `{ data }` | REST 성공 응답을 감싸는 형식. 페이지 목록은 `{ data: [], pagination }` 이다. | 봉투(단독), data 래핑 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 에러 응답 봉투 | error envelope, `{ error: { code, message, requestId, details } }` | 모든 HTTP 에러 응답의 형식. | 에러 봉투, envelope(본문) | [에러 응답과 클라이언트 처리](CLE-API/CLE-API-ERROR.md) |
| 요청 ID | `requestId` | 에러 응답과 서버 로그를 잇는 요청 식별자. | 없음 | [에러 응답과 클라이언트 처리](CLE-API/CLE-API-ERROR.md) |
| 에러 상세 | `details` | 에러 응답의 선택 필드. 배열 또는 객체다. | 없음 | [에러 응답과 클라이언트 처리](CLE-API/CLE-API-ERROR.md) |
| 고정 목록 응답 | non-paginated collection, `{ data: { items } }` | 작은 본인 목록을 페이지 없이 한 번에 돌려주는 형식. | 비-페이징 고정 컬렉션 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 부재 표현 | absence representation | 값이 없음을 응답에서 나타내는 방식. 기본은 null 이고, 정한 경우에만 키를 뺀다. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| PATCH 삼중 상태 | tri-state | PATCH 요청에서 키 생략·null·값이 각각 다른 뜻인 규칙. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 워크스페이스 스코핑 | workspace scoping | API 가 현재 워크스페이스 안의 리소스만 다루게 하는 규칙. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 요청 빈도 제한 | rate limit, `RATE_LIMITED` | 사용자나 IP 기준 요청 수 상한. 넘으면 429 를 돌려준다. | throttle(본문), Rate Limiting, 요청 제한 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 클라이언트 IP 추출 | client IP extraction | 세션·감사 기록과 웹훅·빈도 제한이 요청자 IP 를 읽는 규칙. | 없음 | [HTTP API 규약](CLE-API/CLE-API-CONV.md) |
| 에러 코드 | error code, `error.code` | 클라이언트가 분기에 쓰는 UPPER_SNAKE_CASE 문자열. 이름을 바꾸면 호환성이 깨진다. | wire 코드, errorCode(본문) | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 예외 등록 코드 | historical artifact | 명명 규칙을 어기지만 호환 때문에 유지하는 코드(초대 모듈의 소문자 코드 등). | historical-artifact 예외 | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 은퇴 코드 | retired code | 더 이상 내보내지 않는 옛 에러 코드. | Retired codes(본문) | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| 가드 거부 코드 | guard rejection codes | 권한이 부족할 때 돌려주는 403 코드(`NOT_A_MEMBER`, `EDITOR_REQUIRED`, `ADMIN_REQUIRED`, `OWNER_REQUIRED`). | 없음 | [에러 코드 규약과 카탈로그](CLE-API/CLE-API-ERRCODES.md) |
| OpenAPI 문서 | OpenAPI, Swagger | `@nestjs/swagger` 로 만드는 API 문서와 그 작성 규약. | 없음 | [OpenAPI 문서화](CLE-API/CLE-API-SWAGGER.md) |
| 응답 DTO·요청 DTO | response DTO, request DTO | OpenAPI 스키마에 쓰는 wire 형태 선언. 엔티티를 그대로 노출하지 않는다. | 없음 | [OpenAPI 문서화](CLE-API/CLE-API-SWAGGER.md) |
| 응답 마스킹 | egress masking | DB 원문은 그대로 두고 REST·WebSocket·SSE 로 나갈 때만 자격 증명 값을 가리는 정책. | egress 마스킹, 값-패턴 마스킹, egress-only | [응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) |
| 마스킹 마커 | mask markers, `***`, `[REDACTED]`, `[REDACTED_DEPTH]` | 가린 값 자리에 남는 예약 문자열. | 마커(단독) | [응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) |
| 마스킹 값 재제출 거부 | `MASKED_VALUE_RESUBMITTED` | 마스킹 마커를 실행 입력으로 다시 보내면 400 으로 막는 규칙. | 없음 | [응답 자격 증명 마스킹](CLE-API/CLE-API-EGRESS.md) |
| 다국어 | i18n | 화면 문구를 한국어와 영어로 제공하는 체계. 두 언어의 키가 같아야 한다. | 없음 | [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) |
| 화면 문구 사전 | dict, `dict/{ko,en}` | 메인 앱 화면 문자열 파일. 웹채팅 위젯은 별도 로컬 카탈로그를 쓴다. | 없음 | [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) |
| 백엔드 라벨 매핑 | `backend-labels` | 백엔드가 내보낸 영문 문자열을 화면에서 한국어로 바꾸는 매핑. 매핑이 없으면 영문을 그대로 보인다. | 없음 | [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) |
| 가이드 근거 앵커 | `ImplAnchor` | 사용자 가이드 본문의 약속을 코드 심볼에 묶어 빌드에서 확인하는 컴포넌트. | anchor(단독) | [사용자 가이드 근거 규약](CLE-ENG/CLE-ENG-GUIDEEVIDENCE.md) |
| 프론트엔드 레이어 | frontend layers | app → components → lib → types 순서로만 import 하는 규칙. | 계층(단독) | [프론트엔드 레이어 규약](CLE-ENG/CLE-ENG-FRONTEND.md) |
| 마이그레이션 | migration, `V<N>__*.sql` | DB 스키마를 바꾸는 Flyway SQL 파일. 번호는 main 의 최대값에 1을 더하고, 이미 들어간 파일은 고치지 않는다. | 없음 | [DB 마이그레이션 규약](CLE-ENG/CLE-ENG-MIGRATION.md) |
| append-only | append-only | 이미 적용한 것을 고치지 않고 새 항목만 더하는 원칙. 마이그레이션 파일과 감사 로그 행에 쓴다. 어느 쪽인지 함께 적는다. | 없음 | [DB 마이그레이션 규약](CLE-ENG/CLE-ENG-MIGRATION.md) |
| Redis 키 형식 | `{도메인}:{용도}[:{식별자}]` | Redis 키 이름 규칙. | 없음 | [Redis 키 명명 규약](CLE-ENG/CLE-ENG-REDIS.md) |
| fail-open | fail-open | Redis 같은 부수 의존이 실패해도 주 동작을 통과시키는 정책. 반대는 fail-closed 다. 키별 실패 정책은 그 키를 소유한 문서가 정한다. | graceful degradation(같은 뜻으로) | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| raw SQL 결과 튜플 | `[rows, affectedCount]` | raw UPDATE·DELETE … RETURNING 이 돌려주는 형태. | 없음 | [raw SQL 결과 읽기 규약](CLE-ENG/CLE-ENG-RAWQUERY.md) |
| 스펙 상태 | spec status, `backlog`, `spec-only`, `partial`, `implemented`, `archived` | 스펙 문서가 약속한 기능의 구현 단계. NERV 이전 뒤 다시 설계할 대상이다. | 없음 | [스펙과 구현 근거 규약](CLE-ENG/CLE-ENG-SPECEVIDENCE.md) |
| 리뷰 산출물 인용 | review citation | 코드 주석이 리뷰 결과를 가리키는 형식. NERV 리뷰 레코드로 바뀐다. | 없음 | [리뷰 산출물 인용 규약](CLE-ENG/CLE-ENG-REVIEWCITE.md) |
| 단일 기준 | single source of truth | 한 사실을 한 문서에만 정의하고 나머지는 링크하는 원칙. | 단일 진실, SoT(본문), single source of truth(본문) | [Clemvion 제품 개요](CLE-VISION.md) |
| BullMQ 큐 | BullMQ queue | Redis 위에서 도는 비동기 작업 큐. 전체 목록은 한 문서에 둔다. | Message Queue | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| 반복 작업 | job scheduler, repeatable job | BullMQ 로 주기 실행하는 내부 작업(정리·교체·회수). 사용자 스케줄과 다르다. | repeatable job(본문) | [비동기 큐와 Redis 키 목록](CLE-PLAT/CLE-PLAT-QUEUE.md) |
| 파일 저장소 | file storage, S3 | 지식 저장소 원본 문서와 프로필 이미지를 두는 S3 호환 저장소. 개발·셀프 호스팅은 MinIO, SaaS 는 AWS S3 를 쓴다. | 객체 저장소, Object Storage | [파일 저장소](CLE-PLAT/CLE-PLAT-STORAGE.md) |
| 운영 환경 가드 | `assertProductionConfig` | 운영 환경에서 안전하지 않은 설정이면 서버 시작을 막는 검사. | Production fail-closed 가드 | [비기능 요구사항](CLE-PLAT/CLE-PLAT-NFR.md) |
| advisory lock | advisory lock | PostgreSQL 트랜잭션 잠금. 트리거 설정 쓰기와 동시 실행 제한에 쓴다. | 없음 | [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md) |
| 다중 인스턴스 | multi-instance | 서버 프로세스 여러 개가 함께 도는 배포. 웹채팅 인스턴스와 다르다. | 인스턴스(단독) | [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md) |
| 3중 가드 | triple guard | 같은 규칙을 저장·편집 화면(또는 사전 검증)·런타임 세 곳에서 검사하는 방식. 쓸 때 세 지점을 밝힌다. | 없음 | [그래프 경고 규칙](CLE-WF/CLE-WF-WARN.md) |

## 다의어 구분

한 단어가 여러 뜻으로 쓰이는 경우다. 본문에서는 "구분 표기" 열의 말을 쓴다. 단어 자체를 단독으로 쓰지 않는다.

| 단어 | 뜻 | 구분 표기 | 예 |
| --- | --- | --- | --- |
| 실행 | 워크플로우가 한 번 도는 단위(`Execution`) | 실행 | 실행이 입력 대기로 바뀐다. |
| 실행 | 노드가 한 번 도는 단위(`NodeExecution`) | 노드 실행 | 반복 회차마다 노드 실행 행이 생긴다. |
| 실행 | 에디터 실행 버튼 동작 | 전체 실행, 단일 노드 실행, 선택 노드부터 실행 | 사용자가 단일 노드 실행을 누른다. |
| 실행 | AI 어시스턴트의 셋째 단계(Execute) | 편집 단계 | 편집 단계에서 캔버스를 바꾼다. |
| 실행 | 어시스턴트 계획 카드의 화면 제목 "실행 계획" | 계획 카드 | 사용자가 계획 카드를 승인한다. |
| 실행 | 워커가 한 번 이어서 진행하는 구간 | 세그먼트 | 세그먼트가 park 로 끝난다. |
| 실행 | 핸들러의 `execute()` 호출 | 핸들러 호출 | 엔진이 핸들러 호출 전에 설정을 평가한다. |
| 실행 | 인증 설정 사용 내역의 한 건 | 호출 | 최근 24시간 호출 수 |
| 재실행 | 끝난 실행으로 새 실행 만들기(Re-run) | 재실행 | 재실행은 원본 실행과 같은 체인에 묶인다. |
| 재실행 | 멀티턴 AI 노드 마지막 LLM 호출 다시 돌리기 | 마지막 턴 재시도 | 마지막 턴 재시도는 같은 실행 안에서 돈다. |
| 재실행 | 서버 장애 뒤 실행 다시 굴리기 | 재구동 | 부팅 복구 스캔이 실행을 재구동한다. |
| 재실행 | 순환 연결선으로 같은 노드를 다시 방문 | 노드 재방문 | 되돌아가는 연결선이 노드 재방문을 만든다. |
| 재개 | 사용자 입력으로 입력 대기 실행을 잇기 | 재개 | 폼 제출이 실행을 재개한다. |
| 재개 | 서버 장애 뒤 실행 다시 굴리기 | 재구동 | 없음 |
| 재개 | 어시스턴트가 멈춘 턴을 스스로 이어 가기(`auto_resume`) | 자동 이어서 진행 | 없음 |
| 재개 | 마지막 턴 재시도의 재진입 | 마지막 턴 재시도 | 없음 |
| 재시도 | 에러 처리 정책의 재시도 | 노드 재시도 | 노드 재시도는 최대 3번이다. |
| 재시도 | 멀티턴 AI 마지막 호출 다시 돌리기 | 마지막 턴 재시도 | 없음 |
| 재시도 | 문서 임베딩 자동 재시도 | 임베딩 재시도 | 임베딩 재시도 중인 문서는 "재시도 중" 으로 보인다. |
| 재시도 | BullMQ 작업 재시도(`attempts`) | 큐 재시도 | 재개 큐는 큐 재시도를 3번 한다. |
| 재시도 | LLM 클라이언트 호출 재시도 | LLM 호출 재시도 | 없음 |
| 대기 | 워커가 아직 시작하지 않은 상태(`pending`) | 대기 중 | 없음 |
| 대기 | 사용자 입력을 기다리는 상태(`waiting_for_input`) | 입력 대기 | 없음 |
| 대기 | 동시 실행 제한에 걸려 큐에서 기다림 | 큐 대기 | 큐 대기가 5분을 넘으면 취소한다. |
| 대기 | 외부 마켓 앱 설치를 기다리는 통합(`pending_install`) | 설치 대기 | 없음 |
| 알림 | 사용자에게 보내는 벨·이메일 알림(`Notification`) | 인앱 알림(문맥이 분명하면 알림) | 실행이 실패하면 인앱 알림을 보낸다. |
| 알림 | 트리거가 외부 URL 로 보내는 이벤트(`config.notification`) | EIA 알림 웹훅 | EIA 알림 웹훅은 HMAC 서명을 싣는다. |
| 알림 | 임계치 감시 규칙(`AlertRule`) | 알림 규칙 | 알림 규칙이 실패율을 5분마다 본다. |
| 알림 | 알림 유형별 이메일 수신 여부(`notification_preferences`) | 알림 설정 | 없음 |
| 알림 | 시스템 상태 큐 그룹 "알림·통합" | EIA 알림 웹훅 큐 | 없음 |
| 알림 | 화면 안 안내 상자·잠깐 뜨는 안내 | 인라인 안내, 토스트 | 없음 |
| 알림 | 외부 모니터링(OTel·Prometheus·Grafana)에서 지표에 거는 alerting. 제품 기능 알림 규칙(`AlertRule`)과 다르다 | 경보, 경보 규칙 | 경보 예: `rate(clemvion_audit_write_failed[5m]) > 0` |
| 통합 | 외부 서비스 연결(`Integration`) | 통합 | 노드가 통합을 참조한다. |
| 통합 | 여러 개를 하나로 합침 | 합침, 단일화 | 모델 설정 화면을 하나로 합쳤다. |
| 통합 | 브랜치 병합 | 병합 | 없음 |
| 세션 | 기기 하나의 로그인 상태 | 로그인 세션 | 로그인 세션을 강제 종료한다. |
| 세션 | AI 어시스턴트 대화 | 어시스턴트 세션 | 없음 |
| 세션 | 위젯이 보관하는 대화 한 건 | 위젯 세션 | 없음 |
| 세션 | 에이전트 메모리 문서의 "세션"(실행 한 건) | 실행 | 에이전트 메모리는 실행을 넘어 남는다. |
| 세션 | 리뷰 산출물 디렉터리 | 리뷰 세션 | 없음 |
| 세션 | WebSocket 연결 | WebSocket 연결 | 없음 |
| 회전 | 리프레시 토큰을 쓸 때마다 새 토큰 발급 | 토큰 회전 | 없음 |
| 회전 | OAuth 가 아닌 통합의 자격 증명 바꾸기 | 자격 증명 교체 | 없음 |
| 회전 | EIA 알림 서명 비밀 바꾸기 | 시크릿 교체 | 없음 |
| 회전 | 채팅 채널 봇 토큰 바꾸기 | 봇 토큰 재발급 | 없음 |
| 회전 | 트리거 단위 토큰 바꾸기 | 트리거 단위 토큰 재발급 | 없음 |
| 회전 | OAuth 제공자가 refresh_token 을 1회용으로 바꿔 주는 것 | 제공자 토큰 교체 | 없음 |
| 재인증 | 비밀번호 또는 TOTP 로 본인 확인 | 계정 재인증 | 이메일 변경 전에 계정 재인증을 한다. |
| 재인증 | 비밀번호만으로 본인 확인 | 비밀번호 재확인 | 없음 |
| 재인증 | OAuth 통합 토큰 다시 받기 | 통합 재인증 | 만료된 통합은 통합 재인증으로 되살린다. |
| source | 대화 기록 항목의 출처(`ConversationTurnSource`) | 항목 출처 | 없음 |
| source | WebSocket 메시지의 `live`·`injected` 표시 | 전송 출처 표시 | 없음 |
| source | 수동 트리거 노드의 진입 경로(`meta.source`) | 진입 경로 표시 | 없음 |
| source | 실행이 시작된 곳(`triggerSource`) | 실행 출처 | 없음 |
| source | 토큰 갱신이 시작된 경로(`proactive` 등) | 갱신 경로 | 없음 |
| 채널 | 외부 메신저 봇 연결(`chatChannel`) | 채팅 채널 | 없음 |
| 채널 | 알림 전달 경로(`in_app`, `email`, `both`) | 알림 채널 | 없음 |
| 채널 | WebSocket 이벤트 구독 이름 | 구독 채널 | 없음 |
| 채널 | EIA 의 알림 웹훅·인바운드 두 경로 | EIA 채널 | 없음 |
| 채널 | 웹채팅 위젯 | 웹채팅 | 웹채팅은 채팅 채널 모듈을 거치지 않는다. |
| replay | 끝난 실행으로 새 실행 만들기 | 재실행 | 없음 |
| replay | SSE 재연결 때 놓친 이벤트 다시 보내기 | SSE 재전송 | 없음 |
| replay | 마지막 LLM 호출 다시 돌리기 | 마지막 턴 재시도 | 없음 |
| replay | 조회·재실행·멀티턴 재개를 묶은 정책 이름 | 실행 기록 재사용 정책 | 없음 |
| resumed | 노드 출력 `status: resumed` | 재개 출력 | 없음 |
| resumed | WebSocket 응답(ack)의 `resumed` 불리언 | 재개 수락 여부 | 없음 |
| resumed | `execution.resumed` 이벤트 | 재개 이벤트 | 없음 |
| 컨테이너 | Loop·ForEach·Map(`containerId` 소속) | 컨테이너 | 없음 |
| 컨테이너 | 엔진 덮어쓰기를 받는 노드(컨테이너 + Parallel) | 엔진 덮어쓰기 대상 노드 | 없음 |
| 컨테이너 | 캔버스에 그리는 그룹 상자 | 컨테이너 박스 | 없음 |
| 컨테이너 | Background 노드 | Background 노드 | Background 노드는 컨테이너가 아니다. |
| 분기 | 조건 노드가 포트 하나를 고름 | 경로 선택 | If/Else 가 참 포트로 경로를 고른다. |
| 분기 | Parallel 이 동시에 돌리는 노드 묶음 | 병렬 분기 | 없음 |
| 분기 | AI 에이전트의 LLM 판단 분기 | 조건 도구 | 없음 |
| 본문 | 컨테이너가 반복하는 자식 노드 묶음 | 컨테이너 본문 | 없음 |
| 본문 | Background 노드가 비동기로 돌리는 노드 묶음 | Background 본문 | 없음 |
| 본문 | HTTP 요청·이메일 내용 | 요청 본문, 메일 본문 | 없음 |
| 봉투(envelope) | 노드 핸들러 반환 객체 | 노드 출력 | "봉투" 를 쓰지 않는다. |
| 봉투(envelope) | REST 성공 응답 `{ data }` | 응답 봉투 | 없음 |
| 봉투(envelope) | HTTP 에러 응답 `{ error }` | 에러 응답 봉투 | 없음 |
| 봉투(envelope) | WebSocket·SSE 로 나가는 이벤트 틀 | 이벤트 봉투 | 없음 |
| 봉투(envelope) | EIA 알림 웹훅 요청 본문의 `payload` 틀 | 알림 웹훅 페이로드 | 없음 |
| 봉투(envelope) | Cafe24 POST·PUT 본문 `{ shop_no, request }` | Cafe24 요청 봉투 | 없음 |
| 봉투(envelope) | 노드 `output.error` 의 표준 모양 | 노드 에러 객체 | 없음 |
| scope | 통합을 누가 쓰는지(`Integration.scope`) | 공개 범위 | 없음 |
| scope | OAuth 동의로 받은 권한(`credentials.scopes`) | 권한 범위 | 없음 |
| scope | 에이전트 메모리 네임스페이스(`scope_key`) | 메모리 범위 키 | 없음 |
| scope | 시크릿 참조 경로의 첫 칸(`secret://<scope>/…`) | 시크릿 범위 | 없음 |
| scope | 대화 스레드·컨텍스트가 유지되는 범위 | 유지 범위 | 대화 스레드의 유지 범위는 실행 하나다. |
| 추출 | 청크에서 Entity·Relation 뽑기 | 그래프 추출 | 없음 |
| 추출 | 대화에서 기억할 사실 뽑기 | 메모리 추출 | 없음 |
| 추출 | 정보 추출기 노드가 필드 뽑기 | 필드 추출 | 없음 |
| 추출 | PDF 에서 텍스트 뽑기 | 텍스트 추출 | 없음 |
| entity | 데이터 모델의 테이블 단위 | 엔티티 | Integration 엔티티 |
| entity | Graph RAG 의 의미 단위 | Entity | 없음 |
| entity | 에이전트 메모리 종류 값 | 메모리 종류 `entity` | 없음 |
| entity | Cafe24 카탈로그의 하위 리소스 | 하위 리소스 | 없음 |
| rerank | cross-encoder 재정렬 | 리랭킹 | 없음 |
| rerank | Graph RAG 의 등장 빈도 가중 재정렬 | 중심성 가중치 | 없음 |
| rerank | 리랭킹에 쓰는 모델 설정 | 리랭커 | 없음 |
| recall·회수 | LLM 호출 전 메모리 가져오기 | 메모리 회수 | 없음 |
| recall·회수 | 리랭킹 전 후보를 넓게 가져오기 | 후보 풀 | 없음 |
| recall·회수 | 평가 지표 Recall@k | Recall@k | 없음 |
| recall·회수 | 끝난 실행의 잔여 토큰 무효화 | 토큰 정리 | 없음 |
| recall·회수 | 버려진 공개 위젯 실행 취소 | 유휴 실행 회수 | 없음 |
| recall·회수 | 처리 중에 멈춘 문서 되돌리기 | 처리 중 문서 회수 | 없음 |
| 트리거 | 워크플로우 진입점 엔티티 | 트리거 | 없음 |
| 트리거 | 노드 카테고리 | 트리거 카테고리 | 없음 |
| 트리거 | `manual_trigger` 노드 | 수동 트리거 노드 | 없음 |
| 트리거 | PostgreSQL 트리거 함수 | DB 트리거 | 없음 |
| 인스턴스 | 웹채팅 하나(웹훅 트리거 + 워크플로우) | 웹채팅 인스턴스 | 없음 |
| 인스턴스 | SDK `boot()` 가 돌려주는 JS 객체 | 제어 인스턴스 | 없음 |
| 인스턴스 | 서버 프로세스 | 서버 인스턴스 | 다중 인스턴스 배포 |
| 동봉 | 위젯을 제품과 같은 origin 에 함께 배포 | 동봉 배포 | 없음 |
| 동봉 | 응답에 다른 값을 함께 실음 | 함께 싣는다 | 입력 대기 응답에 대화 스레드를 함께 싣는다. |
| error | 통합 상태 `error`(조치가 필요함) | 오류 상태(통합) | 없음 |
| error | 문서 임베딩 상태 `error`(자동 재시도 중) | 재시도 중 | 없음 |
| error | 실행 실패 | 실패(`failed`) | 실행에는 `error` 상태가 없다. |
| error | 연결선 `type=error` | 에러 연결선 | 없음 |
| stuck 회수 | 서버가 뜰 때 멈춘 실행 처리 | 부팅 복구 스캔 | 없음 |
| stuck 회수 | 서버가 뜰 때 처리 중 문서 되돌리기 | 처리 중 문서 회수 | 없음 |
| OAuth state | 소셜 로그인 인가 짝짓기(`auth_oauth_state`) | 로그인 OAuth state | 없음 |
| OAuth state | 통합 연결 인가 짝짓기(`integration_oauth_state`) | 통합 OAuth state | 없음 |
| turn | 사용자 메시지 한 번과 LLM 응답 한 주기 | 대화 턴 | 없음 |
| turn | 대화 스레드의 기록 한 건 | 대화 기록 항목 | 없음 |
| turn | 한 번의 LLM 호출 기록(`turnDebug`) | LLM 호출 | 없음 |
| turn | AI 어시스턴트 대화 한 차례 | 어시스턴트 턴 | 없음 |
| budget | AI 노드 도구 호출 횟수(`maxToolCalls`) | 도구 호출 한도 | 없음 |
| budget | 롤링 요약 토큰 한도(`memoryTokenBudget`) | 메모리 토큰 예산 | 없음 |
| budget | LLM 요청의 도구 정의 크기 | 도구 정의 크기 예산 | 없음 |
| budget | 어시스턴트 한 턴 도구 호출 수 | 어시스턴트 도구 호출 한도 | 없음 |
| budget | RAG 주입 토큰 상한 | 주입 토큰 예산 | 없음 |
| 컬렉션 | 지식 저장소(화면 옛 표기) | 지식 저장소 | 없음 |
| 컬렉션 | 지식 저장소 안 문서 묶음(구현 전) | 문서 폴더 | 없음 |
| 컬렉션 | 배열 값 | 배열 | 없음 |
| 컬렉션 | 엔진 덮어쓰기 결과 키 | 컬렉션 키 | 없음 |
| 컬렉션 | 페이지 없는 작은 목록 응답 | 고정 목록 응답 | 없음 |
| 어댑터 | 실행 입력을 트리거 파라미터로 바꾸는 계층 | 진입 어댑터 | 없음 |
| 어댑터 | 메신저 프로바이더별 변환 구현 | 채널 어댑터 | 없음 |
| 어댑터 | EIA SSE 스트림 구현(`SseAdapter`) | SSE 어댑터 | 없음 |
| display-only | 버튼 없는 Presentation 노드 | 표시 전용 노드 | 없음 |
| display-only | 입력을 기다리지 않는 표시 도구 4종 | 표시 전용 도구 | 없음 |
| snapshot | 저장 시점의 워크플로우 | 버전 스냅샷 | 없음 |
| snapshot | park 할 때 저장한 대화 스레드 | 대화 스레드 스냅샷 | 없음 |
| snapshot | 재구독 때 보내는 실행 상태 | 실행 스냅샷 이벤트 | 없음 |
| snapshot | 한 턴 동안 고정한 원본 설정 | 턴 설정 사본 | 없음 |
| 워크플로 | 제품의 자동화 단위 | 워크플로우 | 없음 |
| 워크플로 | GitHub Actions 파이프라인 | CI 워크플로우(GitHub Actions) | 없음 |
| 지식 저장소 | 제품의 Knowledge Base | 지식 저장소 | 없음 |
| 지식 저장소 | 스펙·계획 문서 모음 | 스펙 문서 저장소 | 없음 |
| /docs | 앱 안 사용 설명서 | 사용자 가이드(`/docs`) | 없음 |
| /docs | 백엔드 Swagger UI 경로 | Swagger UI(백엔드 `/docs`) | 없음 |
| 상태(status) | 실행·노드 실행 기록의 상태 | 실행 상태, 노드 실행 상태 | 없음 |
| 상태(status) | 핸들러가 엔진에 주는 지시 | 흐름 지시 상태 | 없음 |
| 상태(status) | 통합 연결 상태 | 통합 상태 | 없음 |
| 상태(status) | 카탈로그 행 구현 상태 | 카탈로그 상태 | 없음 |
| 상태(status) | 스펙 문서 구현 단계 | 스펙 상태 | 없음 |
| 마스킹 | 나갈 때 값 패턴으로 가리기(DB 원문 보존) | 응답 마스킹 | 없음 |
| 마스킹 | 설정 리소스 비밀 필드 끝 4자만 보이기 | 필드 마스킹 | 없음 |
| 마스킹 | 서버 로그에서 가리기 | 로그 마스킹 | 없음 |
| 마스킹 | 웹훅 수신 헤더를 저장 전에 가리기 | 수신 헤더 마스킹 | 없음 |
| provider | AI 모델 제공 서비스 | 모델 프로바이더 | 없음 |
| provider | 통합 OAuth 동의 서비스 | OAuth 제공자 | 없음 |
| provider | 채팅 채널 메신저 | 채널 프로바이더 | 없음 |
| provider | AI 에이전트 도구 구현(`AgentToolProvider`) | 도구 프로바이더 | 없음 |
| 관리자 | 워크스페이스 `admin` 역할 | 관리자 | 없음 |
| 관리자 | 제품을 배포·운영하는 사람 | 운영자 | 없음 |
| 관리자 | 관리용 화면·API(권한은 뷰어 이상일 수 있음) | 관리 화면 | 에이전트 메모리 관리 화면 |
| 레이블·라벨 | 노드 이름(`Node.label`) | 노드 레이블 | 없음 |
| 레이블·라벨 | 화면에 보이는 문자열 | 라벨 | 버튼 라벨 |
| 레이블·라벨 | 포트 표시 이름(`PortDef.label`) | 포트 라벨 | 없음 |
| 카테고리 | 노드 분류 | 노드 카테고리 | 없음 |
| 카테고리 | Cafe24 최상위 분류 | Cafe24 리소스 | 없음 |
| 카테고리 | 텍스트 분류기 분류 항목 | 분류 카테고리 | 없음 |
| 카테고리 | Cafe24 `category` 리소스(상품 분류) | 상품 분류 | 없음 |
| operation | 외부 쇼핑몰 API 호출 하나 | operation | 없음 |
| operation | Transform 의 처리 단계 | 변환 연산 | 없음 |
| 웹훅 | 워크플로우를 시작하는 수신 트리거 | 웹훅 | 없음 |
| 웹훅 | 트리거가 외부로 보내는 이벤트 | EIA 알림 웹훅 | 없음 |
| 웹훅 | 알림 규칙의 전달 경로 | 알림 규칙 웹훅 | 없음 |
| 웹훅 | 외부 쇼핑몰이 보내는 변경 이벤트 | 쇼핑몰 이벤트 | 없음 |
| 테스트 | 통합·모델 설정 접속 확인 | 연결 테스트 | 없음 |
| 테스트 | 지식 저장소 임베딩 모델 확인 | 임베딩 테스트 | 없음 |
| 테스트 | Cafe24 개발자 센터의 설치 시작 버튼 | 테스트 실행(Cafe24) | 없음 |
| 테스트 | 에디터에서 노드 하나만 실행 | 단일 노드 실행 | 없음 |
| 사전 검증 | 핸들러 시작 전 설정 검증 실패 | 사전 검증 에러 | 없음 |
| 사전 검증 | 재개 명령을 큐에 넣기 전 상태 확인 | 명령 사전 검증 | 없음 |
| 사전 검증 | 통합 저장 전 접속 확인(`preview-test`) | 저장 전 연결 테스트 | 없음 |
| 미리보기 | AI 노드 결과의 대화 표시 탭 | 대화 미리보기 | 없음 |
| 미리보기 | 운영 콘솔 안 위젯 시연 | 라이브 미리보기 | 없음 |
| 미리보기 | 연결선으로 흐른 데이터 보기 | 데이터 미리보기 | 없음 |
| 미리보기 | 새 OAuth 연결의 임시 토큰 | 미리보기 토큰 | 없음 |
| 레이어 | 프론트엔드 import 계층 | 프론트엔드 레이어 | 없음 |
| 레이어 | 에러 코드가 실리는 자리(응답·노드 출력·엔진) | 에러 코드 층 | 없음 |
| 레이어 | 시스템 데이터 계층 | 데이터 계층 | 없음 |
| 도메인 | 스펙 문서의 제품 영역 | 영역 | 없음 |
| 도메인 | Redis 키 첫 칸 | 키 도메인 | 없음 |
| 도메인 | 감사 액션의 대상 종류 | 리소스 | 없음 |
| 도메인 | 임베드 허용 origin | 임베드 허용 도메인 | 없음 |
| 버전 | 워크플로우 버전 기록 번호 | 버전 번호 | 없음 |
| 버전 | 마이그레이션 파일 번호 | 마이그레이션 번호 | 없음 |
| 버전 | 기능 단계 표기(v1, v2) | 1차 범위, 후속 범위 | 없음 |
| 카탈로그 | 외부 쇼핑몰 API 참조 문서 | API 카탈로그 | 없음 |
| 카탈로그 | operation 조회용 문자열 | 카탈로그 키 | 없음 |
| 카탈로그 | 에러 코드 목록 | 에러 코드 카탈로그 | 없음 |
| 카탈로그 | 웹채팅 위젯 문구 파일 | 위젯 문구 카탈로그 | 없음 |
| 카탈로그 | BullMQ 큐 목록 | 큐 목록 | 없음 |
| 토큰 | 로그인 인증 토큰 | 액세스 토큰, 리프레시 토큰 | 없음 |
| 토큰 | EIA 인증 토큰 | 실행 단위 토큰, 트리거 단위 토큰 | 없음 |
| 토큰 | 링크·흐름 식별 토큰 | 초대 토큰, 설치 토큰, 미리보기 토큰, 챌린지 토큰 | 없음 |
| 토큰 | 메신저 봇 자격 증명 | 봇 토큰 | 없음 |
| 토큰 | LLM 처리 단위 | LLM 토큰 | 사용량의 LLM 토큰 수 |
| 활성 | 워크플로우가 트리거로 시작할 수 있음 | 워크플로우 활성 상태 | 없음 |
| 활성 | 트리거가 호출을 받음 | 트리거 활성 상태 | 없음 |
| 활성 | 지금 대상으로 삼는 워크스페이스 | 현재 워크스페이스 | 없음 |
| 활성 | 숨기지 않은 알림 | 보이는 알림 | 없음 |
| 중지·중단·취소 | 사용자가 진행 중 실행을 멈추는 버튼 동작 | 실행 중지 | 없음 |
| 중지·중단·취소 | 멈춘 결과 상태 | 취소됨 | 없음 |
| 중지·중단·취소 | EIA·채널의 멈춤 명령 | 취소 명령(`cancel`) | 없음 |
| 중지·중단·취소 | 핸들러에 전달하는 멈춤 신호 | 노드 취소 신호(`abortSignal`) | 없음 |
| 중지·중단·취소 | AI 어시스턴트 스트림 끊기 | 응답 중단 | 없음 |
| 표면 | 입력 대기 노드가 받는 입력 종류 | 대기 표면 | 없음 |
| 표면 | 결과를 보여 주는 화면 | 화면 | 실행 상세 화면 |
| 컨텍스트 | 엔진이 핸들러에 넘기는 실행 상태 | 실행 컨텍스트 | 없음 |
| 컨텍스트 | 채널 발송 대상을 다시 찾는 정보 | 채널 라우팅 정보 | 없음 |
| 컨텍스트 | LLM 사용량을 잇는 식별자 묶음 | 사용량 귀속 | 없음 |
| 컨텍스트 | 시스템 프롬프트 앞 시각·시간대 | 시스템 컨텍스트 접두 | 없음 |
| 설정(config) | 노드에 저장한 설정 값(`Node.config`) | 노드 설정 | 없음 |
| 설정(config) | 노드 출력의 `config` 필드 | 설정 에코 | 없음 |
| 설정(config) | 트리거 `config` JSON | 트리거 설정 | 없음 |
| 설정(config) | 지금은 없는 옛 "Config" 메뉴 | 모델 설정, 인증 설정(해당 화면 이름) | 없음 |
| 기본(default) | 모델 설정 안의 모델 ID(`default_model`) | 기본 모델 | 없음 |
| 기본(default) | 종류별 기본 모델 설정(`is_default`) | 워크스페이스 기본 설정 | 없음 |
| 기본(default) | Switch 에 맞는 케이스가 없을 때의 포트 | 기본 경로 | 없음 |
| 기본(default) | 에러 처리 정책의 대체 출력 | 기본 출력 | 없음 |
| 임계 | 검색 결과 최소 관련도 | 유사도 임계값 | 없음 |
| 임계 | 알림 규칙이 비교하는 값 | 임계치 | 없음 |
| 임계 | 통합 만료 알림 시점(7일·3일·당일) | 만료 임계 | 없음 |
| 서명(signing) | 메신저 요청 출처 확인 자료 | 인바운드 서명 자료 | 없음 |
| 서명(signing) | EIA 알림 웹훅 HMAC 비밀 | 알림 서명 시크릿 | 없음 |
| 서명(signing) | 인증 설정 HMAC 서명 헤더 | 서명 헤더 | 없음 |
| interactionType | 입력 대기 노드가 받는 입력 종류 | 대기 표면 | 없음 |
| interactionType | 사용자가 실제로 한 행동 | 사용자 행동 기록 | 없음 |
| 건강도(health) | 큐 상태(`healthy`, `degraded`, `down`) | 큐 건강도 | 없음 |
| 건강도(health) | 의존성 점검 API(`healthy`, `unhealthy`) | 헬스 체크 | 없음 |
| 건강도(health) | 알림 웹훅·채널 발송 상태(`unknown`, `healthy`, `degraded`) | 발송 건강도, 채널 건강도 | 없음 |
| 차원 | 모델이 내는 벡터 길이 | 모델 출력 차원 | 없음 |
| 차원 | 저장된 청크 벡터 길이 | 저장 청크 차원 | 없음 |
| 공유 | 팀 워크스페이스에 속함 | 팀 배지 | 없음 |
| 공유 | 작성자가 내가 아닌 워크플로우 | 공유된 워크플로우 | 없음 |
| 공유 | 통합을 워크스페이스 전체가 씀 | 공개 범위 조직 | 없음 |
| 자동 저장 | 실행 직전 저장 | 실행 직전 저장 | 없음 |
| 자동 저장 | 타이머 자동 저장(없음) | 자동 저장 | 에디터에는 자동 저장이 없다. |
| 호스트 | 위젯을 올리는 고객 페이지 | 호스트 페이지 | 없음 |
| 호스트 | 제품을 직접 설치해 운영함 | 셀프 호스팅 | 없음 |
| 혜택(benefit) | Cafe24 회원 혜택 프로모션(`benefits`) | Cafe24 혜택 | 없음 |
| 혜택(benefit) | MakeShop 쿠폰·적립금 지급 섹션(`benefit`) | MakeShop 혜택 섹션 | 없음 |
| 에러 포트 | 노드에 원래 있는 에러 포트 | 고정 에러 포트 | 없음 |
| 에러 포트 | 에러 처리 정책으로 생기는 에러 포트 | 동적 에러 포트 | 없음 |

## 약어

약어는 처음 나올 때 풀어 쓴다. "쓰는 곳" 이 제한된 약어는 그 밖에서 쓰지 않는다.

| 약어 | 풀이 | 쓰는 곳 |
| --- | --- | --- |
| API | Application Programming Interface | 어디서나 |
| CDN | Content Delivery Network | 위젯 배포 주소를 설명할 때. 기본 배포에는 CDN 이 없다는 점을 함께 적는다. |
| CIDR | Classless Inter-Domain Routing | IP 화이트리스트 |
| CORS | Cross-Origin Resource Sharing | 임베드 허용 도메인, EIA |
| CPIK | MakeShop 외부 연동 섹션 이름 | MakeShop 섹션 이름으로만. 뜻풀이가 공식 문서에 없다. |
| DLQ | Dead-Letter Queue | 큐 복구 설명 |
| DTO | Data Transfer Object | API 규약·OpenAPI |
| e2e | end-to-end 테스트 | 개발 규약 |
| EIA | External Interaction API | 처음에 "External Interaction API(EIA)" 로 쓴 뒤 어디서나 |
| FK·PK | Foreign Key·Primary Key | 데이터 모델 |
| HMAC | Hash-based Message Authentication Code | 인증 설정, EIA 알림 웹훅, 설치 흐름 |
| i18n | internationalization(다국어) | 개발 규약. 본문에서는 "다국어" 로 쓴다. |
| IANA | Internet Assigned Numbers Authority(시간대 이름) | 시간대 |
| JWT | JSON Web Token | 액세스 토큰, 실행 단위 토큰 |
| KB | Knowledge Base | 표 셀, 코드 식별자(`kb_*`, `KbToolProvider`), 화면 문구 인용 안에서만. 본문은 "지식 저장소" 로 쓴다. |
| LLM | Large Language Model | 어디서나 |
| MCP | Model Context Protocol | 어디서나 |
| OTel | OpenTelemetry | 관측 |
| PAT | Personal Access Token | GitHub 통합 설명 |
| RAG | Retrieval-Augmented Generation | 어디서나 |
| RBAC | Role-Based Access Control | 권한 매트릭스 설명 |
| SDK | Software Development Kit | 웹채팅 SDK, EIA 클라이언트 SDK 처럼 한정어와 함께 |
| SPA | Single Page Application | 웹채팅 위젯 구조 |
| SSE | Server-Sent Events | 어디서나 |
| SSRF | Server-Side Request Forgery | 사설망 차단 설명 |
| TEI | Text-Embeddings-Inference | 리랭커 프로바이더 |
| TOTP | Time-based One-Time Password | 2단계 인증 |
| TTL | Time To Live | 보존·만료 기간 |
| UUID | Universally Unique Identifier | 식별자 설명 |
| WS | WebSocket | 표와 코드 설명에서만. 본문은 "WebSocket" 으로 쓴다. |
| 2FA | Two-Factor Authentication | 표와 코드 설명에서만. 본문은 "2단계 인증" 으로 쓴다. |

쓰지 않는 약어: `IE`(정보 추출기), `WFI`(입력 대기), `SoT`(단일 기준), `BYO`(단독), `AgentMem`, `SysStatus`. 모두 풀어 쓴다.

## 상태값과 enum 표기

enum 값은 백틱으로 적고, 화면에 보이는 라벨과 본문 표기를 아래 대응표대로 쓴다. 화면 라벨이 문서마다 다르게 적힌 경우는 [결정이 필요한 표기](#결정이-필요한-표기)에 모았다.

### 실행 상태 (`Execution.status`)

| enum | 화면 라벨 | 본문 표기 | 비고 |
| --- | --- | --- | --- |
| `pending` | 대기 중 | 대기 중 | 실행 내역 필터에는 없다. |
| `running` | 실행 중 | 실행 중 | 없음 |
| `waiting_for_input` | 대기 | 입력 대기 | 화면 라벨이 "대기 중" 과 헷갈린다(결정 항목). |
| `completed` | 완료 | 완료 | 통계 범례는 "성공" 이다(결정 항목). |
| `failed` | 실패 | 실패 | 없음 |
| `cancelled` | 취소됨 | 취소됨 | 사용자 중지와 시스템 취소를 모두 포함한다. |

### 노드 실행 상태 (`NodeExecution.status`)

실행 상태 여섯 값에 `skipped` 가 더해진다.

| enum | 캔버스 표시 | 본문 표기 |
| --- | --- | --- |
| `pending` | 변화 없음 | 대기 중 |
| `running` | 실행 중(파란 테두리) | 실행 중 |
| `waiting_for_input` | 입력 대기 중 | 입력 대기 |
| `completed` | 성공(초록 체크) | 완료 |
| `failed` | 실패(빨간 테두리) | 실패 |
| `cancelled` | 없음 | 취소됨 |
| `skipped` | 건너뜀(회색) | 건너뜀 |

### 흐름 지시 상태 (`NodeHandlerOutput.status`)

| 값 | 본문 표기 | 뜻 |
| --- | --- | --- |
| 없음(`undefined`) | 일반 완료 | 다음 노드로 넘어간다. |
| `waiting_for_input` | 입력 대기 | 엔진이 park 한다. |
| `resumed` | 재개 출력 | 입력을 받은 직후 한 번 보이는 상태. |
| `ended` | 대화 종료 | 멀티턴 대화를 마친다. |
| `requires_integration` | 통합 필요 | 통합 서비스를 쓸 수 없을 때. |

### 에러 처리 정책 (`config.errorHandling.policy`)

| enum | 화면 라벨 | 본문 표기 |
| --- | --- | --- |
| `stop_workflow` | 워크플로우 중단 | 워크플로우 중단(기본) |
| `skip_node` | 노드 건너뛰기 | 노드 건너뛰기 |
| `use_default_output` | 기본 출력 사용 | 기본 출력 사용 |
| `retry` | 재시도 | 노드 재시도 |
| `route_to_error_port` | 에러 포트로 라우팅 | 에러 포트로 라우팅 |

항목 에러 정책(`config.errorPolicy`)은 ForEach·Map 이 `stop`·`skip`·`continue`, Parallel 이 `stop`·`continue`·`cancel-others-on-fail` 을 쓴다. 본문에는 값을 그대로 적는다.

### 트리거와 실행 출처

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Trigger.type` | `webhook`, `schedule`, `manual` | 웹훅, 스케줄, 수동 | 웹훅 트리거, 스케줄 트리거, 수동 트리거 |
| `triggerSource`(실행 출처) | `subworkflow`, `manual`, `schedule`, `webhook`, `unknown` | 서브 워크플로우, 수동 실행, 스케줄, Webhook, — | 서브 워크플로우, 수동 실행, 스케줄, 웹훅, 알 수 없음 |
| `__triggerSource`(엔진 마커) | `manual`, `webhook`, `schedule` | 없음 | 진입 경로 마커 |
| `triggerType`(큐 우선순위) | `manual`, `webhook`, `schedule` | 없음 | 우선순위 입력 |
| `result.cancelledBy` | `user`, `system`, `timeout` | 없음 | 사용자, 시스템, 시간 초과 |

### 워크스페이스와 계정

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Workspace.type` | `personal`, `team` | 개인 워크스페이스, 팀 워크스페이스 | 같음 |
| `WorkspaceMember.role` | `owner`, `admin`, `editor`, `viewer` | 소유자, 관리자, 멤버, 뷰어 | 소유자, 관리자, 편집자, 뷰어(`editor` 화면 라벨은 결정 항목) |
| `LoginHistory.event` | `login_success`, `login_failed`, `totp_failed`, `webauthn_failed`, `logout`, `session_revoked`, `token_reuse_detected` | 로그인 성공, 로그인 실패, 2FA 실패, 없음, 로그아웃, 세션 강제 종료, 토큰 재사용 감지 | 화면 라벨과 같게 쓴다. `webauthn_failed` 는 "Passkey 인증 실패" 로 쓴다. |

### 통합

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Integration.status` | `connected` | 연결됨(필터), Connected(목록 배지) | 연결됨 |
| 〃 | `expired` | 만료됨, Expired | 만료됨 |
| 〃 | `error` | 오류, Error | 오류 |
| 〃 | `pending_install` | Pending install(배지), 필터 없음 | 설치 대기 |
| 화면 필터 전용 | `expiring`, `attention` | 만료 임박, 주의 필요 | 만료 임박, 주의 필요 |
| `Integration.scope` | `personal`, `organization` | 개인, 조직 | 개인, 조직 |
| `status_reason`(오류) | `auth_failed`, `insufficient_scope`, `network`, `unknown_error` | 없음 | 값 그대로 |
| `status_reason`(만료) | `token_expired`, `install_timeout` | 없음 | 값 그대로 |
| `status_reason`(설치 대기) | `oauth_*` 콜백 실패 사유, `hmac_verification_failed` | 사유별 안내 문구 | 값 그대로 |
| 응답 전용 | `credentials_unreadable` | 없음 | DB 에 없는 응답 전용 값으로 밝혀 적는다. |

통합 목록 배지는 영문 라벨을 코드에 직접 적어 두었다. 대응표는 결정 항목에 있다.

### 지식 저장소

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Document.embedding_status`, `graph_extraction_status` | `pending` | 대기 중 | 대기 중 |
| 〃 | `processing` | 처리 중 | 처리 중 |
| 〃 | `completed` | 준비됨 | 준비됨(처리 완료) |
| 〃 | `error` | 재시도 중 | 재시도 중(일시 오류) |
| 〃 | `failed` | 실패 | 실패(최종) |
| `reembed_status`, `reextract_status` | `idle`, `in_progress` | 재임베딩 중(진행 중일 때만) | 대기, 진행 중 |
| `rag_mode` | `vector`, `graph` | Vector — 유사도 검색, Graph — entity·relation 그래프 검색 | Vector RAG, Graph RAG |
| `rerank_mode` | `off`, `cross_encoder`, `cross_encoder_llm` | 사용 안 함, Cross-encoder, Cross-encoder + LLM grading | 리랭킹 끔, Cross-encoder, Cross-encoder + LLM 그레이딩 |
| KB 도구 결과 | `not_searchable`, `search_failed`, `grounding: none` | 재임베딩 필요 · 검색 불가(검색 불가만) | 검색 불가, 검색 실패, 근거 없음 |

### AI 노드와 에이전트 메모리

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `mode` | `single_turn`, `multi_turn` | Single Turn, Multi Turn | 단일 턴, 멀티턴 |
| `memoryStrategy` | `manual`, `summary_buffer`, `persistent` | 없음 | 값 그대로(설명은 "수동·요약 버퍼·영속") |
| `ModelConfig.kind` | `chat`, `embedding`, `rerank` | Chat, Embedding, Rerank | 같음 |
| 에이전트 메모리 `kind` | `fact`, `preference`, `entity` | 사실, 선호, 엔티티 | 사실, 선호, 엔티티(메모리 종류) |
| 대기 표면 | `form`, `buttons`, `ai_conversation`, `ai_form_render` | 없음 | 값 그대로. EIA 밖으로는 앞의 세 값만 나간다. |
| 사용자 입력 기록 `type` | `form_submitted`, `button_click`, `button_continue`, `message_received` | 폼 제출, 버튼 클릭, 링크 이동, 없음 | 값 그대로 |
| 항목 출처 | `presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`(+화면 `system_error`, `rag`) | 없음 | 값 그대로 |

### 관측

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| 큐 건강도 `health` | `healthy`, `degraded`, `down` | 정상, 지연, 점검 필요(전체는 시스템 정상, 일부 지연, 점검 필요) | 정상, 지연, 점검 필요 |
| 헬스 체크 `status` | `healthy`, `unhealthy`(Redis 미설정 `unconfigured`) | 없음 | 정상, 비정상 |
| 발송·채널 건강도 | `unknown`, `healthy`, `degraded` | 확인 안 됨, 정상, 저하됨 | 확인 안 됨, 정상, 저하됨 |
| `Notification.channel` | `in_app`, `email`, `both` | 없음 | 인앱, 이메일, 둘 다 |
| `AlertRule.type` | `failure_rate`, `duration`, `llm_cost` | 실패율, 평균 실행 시간, LLM 비용 | 같음 |
| `AlertRule.channel` | `in_app`, `email` | 없음(화면 사전에 "이메일"·"웹훅" 문구가 있지만 쓰는 화면이 없다) | 인앱, 이메일 |

### 외부 상호작용과 채널

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `tokenStrategy` | `per_execution`, `per_trigger` | Per Execution, Per Trigger | 실행 단위, 트리거 단위 |
| 채널 `provider` | `telegram`, `slack`, `discord` | Telegram, Slack, Discord | 같음 |
| `uiMapping.formMode` | `auto`, `native_modal`, `multi_step` | 자동, 네이티브 모달, multi_step | 자동, 네이티브 모달, 다단계 질문 |
| `uiMapping.visualNode` | `auto`, `text`, `photo` | auto, text, photo | 값 그대로 |

### 카탈로그와 스펙 문서

| 필드 | 값 | 본문 표기 |
| --- | --- | --- |
| 카탈로그 상태 | `supported`, `planned`, `deprecated` | 지원, 지원 예정, 폐기 |
| 스펙 상태 | `backlog`, `spec-only`, `partial`, `implemented`, `archived` | 값 그대로. 카탈로그 상태와 섞지 않는다. |

## 결정이 필요한 표기

아래 항목은 표기가 갈려 있어 이 사전이 임시 표준을 정한 것이다. 각 항목의 근거 위치와 자세한 설명은 리뷰 발견으로 올린다. 심각도 `warning` 은 뜻이 달라 구현이 어긋날 수 있는 항목이고, `info` 는 표기만 갈린 항목이다. 사람이 결정하면 이 절과 해당 용어 행을 함께 고친다.

| 번호 | 항목 | 갈리는 표기 | 임시 표준 | 심각도 |
| --- | --- | --- | --- | --- |
| D01 | 실행 내역·실행 이력·실행 히스토리 표기가 갈린다 | 실행 내역 / 실행 이력 / 실행 히스토리 / 실행 기록 | 실행 내역(에디터 안 패널은 "실행 내역 패널") | info |
| D02 | 버전 기록·버전 히스토리·버전 이력 표기가 갈린다 | 버전 기록(화면·NERV 문서 제목) / 버전 히스토리(가이드 용어집) / 버전 이력(스펙) | 버전 기록 | info |
| D03 | 워크플로우와 워크플로 표기가 섞인다 | 워크플로우 / 워크플로 | 워크플로우 | info |
| D04 | 연결선과 엣지 표기가 갈린다 | 연결선 / 엣지 / 에지 / Edge | 연결선 | info |
| D05 | 지식 저장소를 컬렉션·지식 베이스로도 부른다 | 지식 저장소 / 지식 베이스 / 지식베이스 / 지식저장소 / Knowledge Base / KB / 컬렉션 | 지식 저장소(KB 는 표·식별자 안에서만) | info |
| D06 | "컬렉션(폴더)" 이 지식 저장소 안 문서 묶음 기능을 가리킨다 | 컬렉션 = 지식 저장소 자체 / 컬렉션 = 지식 저장소 안 문서 폴더 | 지식 저장소 자체는 "지식 저장소", 문서 묶음은 "문서 폴더"(구현 전) | warning |
| D07 | 통합과 연동이 섞이고, 통합이 "합침" 뜻으로도 쓰인다 | 통합(Integration) / 연동 / 통합(합침) | Integration 은 "통합", 합침 뜻은 "합침·단일화" | info |
| D08 | 인증 설정을 "통합 자격증명 vault" 로 부른다 | 인증 설정(웹훅 인바운드 인증) / 통합 자격 증명 | 인증 설정 | warning |
| D09 | 에러·오류와 에러 처리 정책 이름이 갈린다 | 오류 처리(화면) / 에러 정책(가이드 용어집) / 에러 처리 정책(스펙) / errorPolicy(컨테이너 정책) | 본문은 "에러", 노드 정책은 "에러 처리 정책", 컨테이너 정책은 "항목 에러 정책" | info |
| D10 | editor 역할의 화면 라벨이 "멤버" 다 | 편집자·Editor(스펙) / 멤버(화면 라벨) | 편집자(`editor`) | warning |
| D11 | 소유자 이양·소유권 이전·Owner 이양 표기가 갈린다 | Owner 이양(화면) / 소유권 이전(스펙) / 양도 | 소유자 이양 | info |
| D12 | 모델 설정과 LLM 설정, 프로바이더와 제공자가 섞인다 | 모델 설정 / LLM 설정 / LLM 프로바이더 설정 / Model Config · 프로바이더 / 제공자 | 모델 설정, 모델 프로바이더(모델), OAuth 제공자(통합) | info |
| D13 | "재인증" 이 세 가지 동작을 가리킨다 | 계정 재인증(비밀번호·TOTP) / 비밀번호 재확인(비밀번호만) / 통합 재인증(OAuth) / 재인가 | 계정 재인증, 비밀번호 재확인, 통합 재인증 | warning |
| D14 | "회전" 이 유예 규칙이 다른 여러 교체 동작을 가리킨다 | 토큰 회전 / 자격 증명 교체 / 시크릿 교체 / 봇 토큰 재발급 / 트리거 단위 토큰 재발급 / 제공자 토큰 교체 | 화면 문구에 맞춘 동작별 이름(교체·재발급), 리프레시 토큰만 "토큰 회전" | info |
| D15 | revoke-token 이 폐기가 아니라 재발급이다 | revoke(폐기) / 재발급 | 트리거 단위 토큰 재발급 | warning |
| D16 | "알림" 하나로 네 개념을 부른다 | 인앱 알림 / EIA 알림 웹훅 / 알림 규칙 / 알림 설정 / 알람 | 인앱 알림, EIA 알림 웹훅, 알림 규칙, 알림 설정 | info |
| D17 | 컨테이너의 범위가 문서마다 다르다 | Loop·ForEach·Map / + Parallel / + Background | 컨테이너는 Loop·ForEach·Map 세 노드. Parallel 은 "엔진 덮어쓰기 대상", Background 는 컨테이너가 아니다. | warning |
| D18 | 에러 포트가 고정 포트인지 정책 포트인지 문서마다 다르다 | 고정 에러 포트 / 에러 처리 정책으로 생기는 동적 에러 포트 | 고정 에러 포트, 동적 에러 포트 | warning |
| D19 | 설치 스크립트와 설치 스니펫 표기가 갈린다 | 설치 스크립트(화면) / 설치 스니펫·스니펫(스펙) | 설치 스크립트 | info |
| D20 | 새 대화를 다섯 이름으로 부른다 | 새 대화 / 새 세션 / resetSession / newChat / restart | 새 대화 | info |
| D21 | 웹채팅과 웹챗 표기가 섞인다 | 웹채팅 / 웹챗 / Web Chat / Channel Web Chat | 웹채팅 | info |
| D22 | 채팅 채널 화면 라벨이 영문이다 | Chat Channel(화면) / 채팅 채널(NERV 문서 제목) / 챗 채널 | 채팅 채널 | info |
| D23 | 자격 증명과 자격증명 띄어쓰기가 섞인다 | 자격 증명 / 자격증명 | 자격 증명 | info |
| D24 | scope 가 공개 범위와 권한 범위를 모두 가리켜 감사 문서가 잘못 설명한다 | 공개 범위(`Integration.scope`) / 권한 범위(`credentials.scopes`) | 공개 범위, 권한 범위 | warning |
| D25 | 서브 워크플로우 표기가 다섯 가지다 | 서브 워크플로우 / 하위 워크플로우 / 하위 워크플로 / sub-workflow / Sub-Workflow | 서브 워크플로우 | info |
| D26 | 노드 표시 이름과 문서 제목이 다르다 | Info Extractor / Information Extractor / IE · Variable / Variable Declaration · Set Variable / Variable Modification | 정보 추출기 노드, 변수 선언 노드, 변수 수정 노드(캔버스 표시 이름은 처음에 병기) | info |
| D27 | 멀티턴 표기가 네 가지다 | 멀티턴 / multi-turn / Multi-turn / Multi Turn / AI Multi Turn | 멀티턴(`multi_turn`) | info |
| D28 | "대기 중" 과 "대기" 라벨이 서로 다른 상태다 | 대기 중(`pending`) / 대기(`waiting_for_input`) / Waiting for Input(PRD) | 본문은 대기 중(`pending`), 입력 대기(`waiting_for_input`) | warning |
| D29 | 문서 임베딩 상태의 enum 과 화면 라벨 대응표가 없다 | pending·processing·completed·error·failed / Ready·Processing·Retrying·Failed / 대기·처리 중·완료·오류 | `pending`=대기 중, `processing`=처리 중, `completed`=준비됨, `error`=재시도 중, `failed`=실패 | warning |
| D30 | 통합 상태 배지는 영문 문구를 코드에 직접 적었다 | 연결됨·만료됨·오류(필터) / Connected·Expired·Error·Pending install(배지) | 연결됨, 만료됨, 오류, 설치 대기 | info |
| D31 | 실행 완료를 "완료" 와 "성공" 으로 섞어 보여 준다 | 완료 / 성공 | 완료(`completed`) | info |
| D32 | 시간대와 타임존 표기가 섞인다 | 시간대 / 타임존 / IANA 시간대 | 시간대 | info |
| D33 | 재임베딩과 재인덱싱·재색인이 섞인다 | 재임베딩 / 재인덱싱 / 재색인 | 재임베딩 | info |
| D34 | 리랭킹·리랭크·리랭커와 Graph RAG 의 rerank 가 섞인다 | 리랭킹(동작) / 리랭커(설정) / 리랭크 / Graph RAG 의 rerank(중심성 가중) | 리랭킹, 리랭커, 중심성 가중치 | info |
| D35 | Entity·엔티티가 세 개념을 가리킨다 | 데이터 모델 엔티티 / Graph RAG Entity / 에이전트 메모리 종류 entity(화면 "엔티티") | 엔티티(데이터 모델), Entity(Graph RAG), 메모리 종류 entity | info |
| D36 | 복구 코드와 백업 코드 문구가 함께 있다 | 복구 코드 / 백업 코드 | 복구 코드 | info |
| D37 | 사용자 가이드 표기가 네 가지이고 /docs 경로가 둘이다 | 사용자 가이드 / 유저 가이드 / 사용자 매뉴얼 / User Guide · /docs(가이드) / /docs(Swagger UI) | 사용자 가이드 | info |
| D38 | AI 어시스턴트 계획 카드의 화면 제목이 "실행 계획" 이다 | 실행 계획(화면) / 계획 카드 / Plan 카드 | 계획 카드 | info |
| D39 | AI PRD 가 AI 어시스턴트를 "AI 에이전트" 로 부른다 | AI 에이전트(노드) / AI 어시스턴트(에디터 기능) | AI 에이전트 노드, AI 어시스턴트 | info |
| D40 | 통합 자격 증명 암호화 키 이름이 문서마다 다르다 | ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY | 통합 암호화 키는 `INTEGRATION_ENCRYPTION_KEY`, 시크릿 저장소 키는 `ENCRYPTION_KEY` | warning |
| D41 | "자동 갱신" 이 서로 다른 두 판정을 가리킨다 | 자동 갱신 표시(`autoRefresh`, google 포함) / 갱신 가능 판정(`isRefreshCapable`, google 제외) | 자동 갱신 표시, 갱신 가능 통합 | warning |
| D42 | chat_channel_token_v2 가 옛 토큰인지 새 토큰인지 문서마다 다르다 | v2 = 옛 토큰 백업 / v2 = 새 토큰 | 값 설명은 CLE-CHAT-DATA 한 곳에서 정한다 | warning |
| D43 | 워크플로우 변수 루트 이름이 세 가지다 | `$var`(표현식) / `$vars`(Code 노드) / `$variables`(엔진 문서) | 표현식은 `$var`, Code 노드는 `$vars` | warning |
| D44 | 노드 출력 규약 문서를 "CONVENTIONS" 로 부른다 | CONVENTIONS / CONVENTIONS Principle N / 노드 Output 규약 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) 링크 | info |
| D45 | 엔드포인트 경로가 비밀인지 아닌지 문서마다 다르다 | 사실상 비밀 키(웹훅·트리거 목록) / 비밀 아님(웹채팅 SDK·운영 콘솔) | 용어는 "엔드포인트 경로" 하나로 쓰고 비밀성은 CLE-TRIG-WEBHOOK 이 정한다 | warning |
| D46 | 지식 저장소 임베딩 차원이 파생 캐시인지 실측값인지 다르다 | 모델 설정 dimension 의 파생 캐시 / 저장 청크의 실제 차원 | 모델 출력 차원(`ModelConfig.dimension`), 저장 청크 차원(`embedding_dimension`) | warning |
| D47 | 제거된 도구 영역을 현행 기능처럼 적은 문서가 있다 | 도구 영역(Tool Area) 제거됨 / 현행 기능 | 도구 영역(제거됨) | warning |
| D48 | 노드 메모를 저장하는 필드가 두 가지로 적혀 있다 | `Node.description`(데이터 모델 "메모/설명") / `config.notes`(설정 패널) | 노드 메모(`config.notes`) | warning |
| D49 | 외부 인터랙션과 외부 상호작용 표기가 갈린다 | 외부 인터랙션(화면) / 외부 상호작용(NERV 영역 제목·데이터 모델) | API 는 "External Interaction API(EIA)", 한국어 일반 표기는 "외부 인터랙션" | info |
| D50 | 파일 저장소 표기가 네 가지다 | 파일 저장소 / 객체 저장소 / Object Storage / S3·MinIO | 파일 저장소 | info |
| D51 | "관리자" 가 워크스페이스 역할과 운영자를 모두 가리킨다 | 관리자(`admin` 역할) / 운영자(제품 운영) / 관리 화면 | 관리자(역할), 운영자, 관리 화면 | info |
| D52 | 봉투(envelope)가 노드 출력과 여러 전송 형식을 함께 가리킨다 | 노드 출력 5필드 / 응답 봉투 / 에러 응답 봉투 / 이벤트 봉투 / Cafe24 요청 봉투 | 노드 출력에는 "봉투" 를 쓰지 않고, 나머지는 한정어를 붙인다 | info |
| D53 | 내부 MCP 브리지 표기가 세 가지다 | Internal MCP Bridge / Internal Bridge / MCP Bridge | 내부 MCP 브리지 | info |
| D54 | render_* 도구를 표현 도구·가상 도구로 부른다 | 표현 도구 / 가상 도구 / Presentation Tool Family | 표시 도구 | info |
| D55 | Cafe24·MakeShop 과 한국어 서비스명이 섞인다 | Cafe24 / 카페24 · MakeShop / Makeshop / 메이크샵 | Cafe24, MakeShop | info |
| D56 | Cafe24 리소스와 MakeShop 섹션을 카테고리로도 부른다 | 카테고리 / Resource / 섹션 | Cafe24 리소스, MakeShop 섹션 | info |
| D57 | "회수" 가 recall 과 reclaim 을 모두 뜻한다 | 메모리 회수(recall) / 후보 회수 / 토큰 회수 / 유휴 실행 회수 / 처리 중 문서 회수 | 메모리 회수, 후보 풀, 토큰 정리, 유휴 실행 회수, 처리 중 문서 회수 | info |
| D58 | 건강도(health) 값 집합이 표면마다 다르다 | healthy·degraded·down(큐) / healthy·unhealthy(헬스 체크) / unknown·healthy·degraded(발송·채널) | 큐 건강도, 헬스 체크, 발송 건강도, 채널 건강도 | info |
| D59 | 현재 워크스페이스를 활성 워크스페이스로도 부른다 | 현재 워크스페이스(화면) / 활성 워크스페이스 / 워크스페이스 컨텍스트 | 현재 워크스페이스 | info |
| D60 | 로그인 세션을 디바이스 세션으로도 부른다 | 로그인 세션(화면) / 디바이스 세션 / family | 로그인 세션 | info |
| D61 | 데이터 흐름 문서가 2단계 인증 전환을 "TOTP fallback" 으로 적는다 | WebAuthn 우선·TOTP fallback(data-flow) / TOTP 자동 전환 금지(1-auth) | Passkey·보안 키가 있으면 그 방식만 쓰고 TOTP 로 자동 전환하지 않는다 | warning |
| D62 | 단일 진실과 단일 기준 표기가 갈린다 | 단일 진실 / SoT / single source of truth / 단일 기준 | 단일 기준 | info |
| D63 | 없어진 Config 메뉴 이름이 남아 있다 | Config 서브메뉴 / 모델 설정 / 인증 | 모델 설정, 인증(인증 설정) | info |
| D64 | 트리거 호출 이력과 인증 설정 사용 내역이 같은 이름으로 적혀 있다 | 호출 이력(트리거) / 사용 내역(인증 설정, 화면) / 호출 이력(인증 설정, 스펙) | 트리거는 호출 이력, 인증 설정은 사용 내역 | info |
| D65 | 알림 닫기를 "모두 지우기" 로 보여 준다 | 닫기(dismiss, 숨김) / 모두 지우기(화면) | 알림 닫기 | info |
| D66 | 적립금과 포인트 번역이 서비스마다 다르다 | Cafe24 points = 적립금 / MakeShop point = 포인트(적립금과 다름) | Cafe24 points·MakeShop reserve 는 적립금, MakeShop point 는 포인트 | info |
| D67 | 상태 불일치 에러가 표면마다 코드가 다르다 | INVALID_EXECUTION_STATE(WebSocket) / INVALID_STATE(REST 422) / STATE_MISMATCH(EIA 409) | 상태 불일치 에러(코드는 표면별로 그대로) | info |

## Rationale

### 표준을 고른 순서

표준 표기는 아래 순서로 골랐다. 앞 단계에서 정해지면 뒤 단계는 보지 않는다.

1. **실제 화면 문구**(한국어 문구 사전, 코드에 직접 적힌 라벨 포함). 사용자가 보는 이름과 스펙 이름이 같아야 문서와 제품을 오가며 헷갈리지 않는다.
2. **사용자 가이드 용어집**. 화면 문구가 없거나, 화면 문구끼리 서로 다를 때 쓴다.
3. **NERV 문서 목록의 제목과 범위 설명**. 화면에도 가이드에도 없는 개념은 새 문서 제목의 표기를 따른다. 제목이 곧 링크 텍스트라 본문과 어긋나면 안 된다.
4. **코드 식별자**. 내부 개념은 식별자의 뜻을 살린 한국어를 쓰고, 한국어가 자리 잡지 않은 말은 영문을 그대로 쓴다.

화면 문구끼리 다른 경우가 적지 않았다. 연결선(어시스턴트)과 엣지(버전 비교), 오류 처리(절 이름)와 에러 포트로 라우팅(옵션), 자격 증명(통합)과 자격증명(재실행)이 그 예다. 이때는 1단계를 적용할 수 없어 2·3단계로 정했고, 화면에 남은 다른 표기는 [결정이 필요한 표기](#결정이-필요한-표기)에 코드 수정 대상으로 적었다.

### 주요 선택의 이유

- **워크플로우**: 스펙은 두 표기가 85:48 파일로 섞여 있지만 사이드바·화면 대부분과 가이드 용어집이 "워크플로우" 다. GitHub Actions 를 가리킬 때만 "CI 워크플로우(GitHub Actions)" 로 한정해 표기로 뜻을 가르지 않고 한정어로 가른다.
- **실행 내역**: 가이드 용어집은 "실행 이력" 이지만 메뉴와 화면 제목이 "실행 내역" 이므로 화면을 따랐다. 가이드 용어집 쪽 수정은 사람이 정한다.
- **버전 기록**: 가이드 용어집은 "버전 히스토리" 인데 에디터 화면은 "버전 기록" 이다. 원칙대로 화면을 따랐고 NERV 문서 제목도 "버전 기록" 으로 맞췄다. 가이드 용어집과의 차이는 결정 항목으로 넘겼다.
- **연결선**: 가이드 용어집이 "엣지" 를 금지어로 두고 NERV 문서 제목도 "연결선" 이다. 화면의 "엣지" 문구는 화면 쪽을 고칠 대상으로 봤다.
- **지식 저장소**: 메뉴명과 가이드 용어집이 같다. "컬렉션" 은 배열·고정 목록 응답·구현 전 문서 폴더와 겹쳐 치환 금지어로 둔다.
- **통합**: 메뉴명과 가이드 용어집이 같다. "여러 개를 하나로 합침" 뜻의 "통합" 은 검색과 기계 치환에서 Integration 과 부딪혀 "합침·단일화" 로 바꾼다.
- **에러**: 화면이 "오류" 와 "에러" 를 섞어 쓰므로 스펙과 NERV 문서 제목의 "에러" 를 본문 표준으로 뒀다. 노드 정책 이름을 가이드 용어집의 "에러 정책" 대신 "에러 처리 정책" 으로 둔 것은 컨테이너의 `config.errorPolicy`(항목 에러 정책)와 이름이 부딪히기 때문이다.
- **편집자**: 화면은 `editor` 역할을 "멤버" 로 보여 주지만, 같은 화면이 워크스페이스 소속자 전체도 "멤버" 로 부른다. "멤버 이상" 이 모호해지는 문제가 화면 우선 원칙보다 크다고 보고 "편집자" 를 임시 표준으로 뒀다.
- **계획 카드**: 화면 제목 "실행 계획" 은 "실행 = 워크플로우 실행" 이라는 다의어 규칙과 부딪힌다. 본문 모호성을 없애는 쪽을 택하고 화면 제목은 결정 항목으로 넘겼다.
- **모델 프로바이더와 OAuth 제공자**: 화면이 모델 설정에는 "프로바이더", 통합 OAuth 에는 "제공자" 를 쓴다. 두 개념이 실제로 다르므로 각 화면 표기를 그대로 살려 한정어와 함께 쓴다.
- **영문으로 둔 용어**: park, rehydration, dry-run, fire-and-forget, Graph RAG, Entity, Relation, MCP, RAG, LLM 은 영문을 그대로 쓴다. 한국어 번역(재수화, 드라이런 등)은 한두 문서에만 있어 자리 잡지 않았다. Entity 는 데이터 모델의 "엔티티" 와 구분하려는 목적도 있다.
- **단일 기준**: 옛 스펙의 "단일 진실" 대신 NERV 문서 목록이 쓰는 "단일 기준" 을 따랐다.

### 한정어를 붙이는 방식을 택한 이유

다의어는 단어를 새로 만들기보다 한정어를 붙여 나눴다(예: 인앱 알림, EIA 알림 웹훅, 계정 재인증, 통합 재인증). 화면 문구를 바꾸지 않고도 본문의 뜻을 하나로 좁힐 수 있고, 사용자 가이드와 표기가 어긋나지 않는다. 한정어 없이 단어만 쓰면 되는 경우는 "쓰지 않는 표기" 에 "(단독)" 을 붙여 표시했다.

### 치환 목록과의 관계

이 문서의 표에서 뽑은 치환 목록(`term_map.json`)에는 문맥을 보지 않고 바꿔도 되는 표기만 넣었다. 한 단어가 여러 뜻인 경우는 `context_required` 로 표시하고, 에이전트가 [다의어 구분](#다의어-구분) 표를 보고 직접 고르게 했다. 기계 치환은 단어 경계를 지켜야 한다. 예를 들어 "워크플로" 는 뒤에 "우" 가 붙지 않을 때만 바꾼다.

### 검토한 다른 선택

- **스펙 문서에서 가장 많이 쓴 표기를 표준으로 삼기**: 빈도만 보면 "엣지", "실행 이력", "Knowledge Base" 가 앞선다. 하지만 사용자는 화면과 가이드를 보므로 문서 빈도보다 화면 표기를 앞에 뒀다.
- **외래어를 모두 영문으로 두기**: 문서 작성은 쉬워지지만 가이드 용어집이 이미 "연결선", "지식 저장소", "표현식" 같은 한국어 표기를 정했으므로 따르지 않았다.
