---
id: "CLE-ACCT-SESSION-ROUTE"
title: "세션과 토큰 — 라우트 가드와 로그인 뒤 이동"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-ACCT-SESSION"
ancestors: ["CLE-VISION", "CLE-ACCT", "CLE-ACCT-SESSION"]
area: "CLE-ACCT"
content_hash: "f324b62a9e36e693d5ec7881846b935c0e89331aec3a64110f221c9cc422a6ef"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "6a94272f38d273cbe3f9431564ab286c920ce150b3915f4e9bbea088e8cec152"
etag: "sha256-e72fe710d25d31a79a6bbf3473db60124b6896bbe13b062c4dc1224c3f335f2a"
---
> 구현 상태: 구현됨 · 상위: [세션과 토큰](CLE-ACCT-SESSION.md)

## 개요

이 문서는 [세션과 토큰](CLE-ACCT-SESSION.md) 의 하위 문서로 프론트엔드 라우트 가드, 로그인 힌트 쿠키, 토큰을 받는 진입점, 로그인 뒤 이동할 곳과 소셜 로그인의 복귀 경로를 정한다. 로그인 절차는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 이 정한다.

## 라우트 가드

### 공개 경로와 가드

인증 페이지는 route group `(auth)` 로 묶여 실제 경로에 `/auth` 접두사가 없다.

| 라우트 | 인증 필요 | 미인증일 때 |
| --- | --- | --- |
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` 등 `(auth)` 그룹 | 아니요 | 없음 |
| `/callback` (OAuth 콜백) | 아니요 | 없음 |
| 그 밖의 모든 라우트 | 예 | 그 화면의 경로와 쿼리를 `redirect` 파라미터에 담아 `/login` 으로 보낸다 |

초대 수락 페이지의 `?token=` 처럼 쿼리가 화면을 정하는 경로가 있다. 그래서 `redirect` 에는 경로와 쿼리를 함께 담는다.

미인증 리다이렉트는 두 층으로 동작한다.

| 층 | 구현 | 동작 |
| --- | --- | --- |
| 1. 서버 proxy | `codebase/frontend/src/proxy.ts` (Next 서버 미들웨어) | `has_session` 쿠키가 없으면 JS 를 내려보내기 전에 `/login?redirect=<인코딩한 경로와 쿼리>` 로 보낸다. 공개 경로(`/login`·`/register`·`/forgot-password`·`/reset-password`·`/verify-email`·`/callback`)와 `/_next`·`/api`·`/_widget`(동봉 배포한 웹채팅 위젯 정적 번들, [웹채팅 구조](../CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md))·정적 자산은 제외한다. 공개 경로 판정과 `has_session` 검사보다 먼저 옛 초대 링크 경로 `/auth/register`(끝 슬래시 포함)를 쿼리를 그대로 둔 채 `/register` 로 리다이렉트한다. 이 경로는 프론트엔드 페이지 경로이고 백엔드 가입 API `POST /api/auth/register` 와 이름만 같다. 이 리다이렉트는 `has_session` 쿠키 유무와 상관없다. 이유는 [워크스페이스와 멤버](CLE-ACCT-WS.md#초대-메일-링크는-register-로-보내고-옛-경로는-리다이렉트한다) 의 Rationale 에 있다 |
| 2. 클라이언트 AuthProvider | `codebase/frontend/src/components/auth/auth-provider.tsx` | 실제 토큰 검증 기준의 최종 가드. 로그인 상태 복원(리프레시와 `GET /api/users/me`)이 실패하면 `/login?redirect=<인코딩한 경로와 쿼리>` 로 보낸다. 담을 값이 안전한 같은 출처 경로가 아니면 `/dashboard` 를 담는다. 지금 경로가 `/login` 이면 보내지 않는다 |

### 로그인 힌트 쿠키

로그인 힌트 쿠키(`has_session`)는 인증 수단이 아니라 화면 전환을 위한 힌트다. API 가 cross-domain 이라 Next 서버 미들웨어가 백엔드 세션을 직접 알 수 없다. 그래서 로그인에 성공하면 프론트엔드 JS 가 non-httpOnly 쿠키 `has_session=1`(path=/, max-age 30일, SameSite=Lax)을 설정하고 로그아웃할 때 지운다. 쿠키 이름 · 속성과 심기 · 지우기 · 읽기는 `codebase/frontend/src/lib/auth/session-hint.ts` 한 곳에 있다. 심는 곳은 `codebase/frontend/src/lib/stores/auth-store.ts` 의 `markSessionIssued` · `setAuthenticated` 이고 지우는 곳은 `logout` 이다. 토큰을 받는 경로는 모두 `codebase/frontend/src/lib/auth/establish-session.ts` 의 `establishSession` 을 거친다. proxy 는 이 모듈의 쿠키 이름 `SESSION_HINT_COOKIE` 로 요청에 쿠키가 있는지만 본다. 가입 화면은 `hasSessionHint` 로 쿠키 값이 `1` 인지 본다. 실제 인가 판정은 항상 토큰(2층 가드와 API 401)이 한다.

토큰을 받으면 `establishSession` 이 액세스 토큰과 이 쿠키를 먼저 두고 `GET /api/users/me` 를 읽는다. 조회 시간 상한은 부르는 쪽이 정하고 기본은 10초다. 로그인 상태 복원은 상한 없이 기다린다. 사용자 조회가 실패해도 토큰과 쿠키는 남기고 로그인 상태만 표시하지 않는다. 이 함수를 쓰는 경로는 다음과 같다.

- 비밀번호 로그인, 2단계 인증(TOTP · Passkey), 복구 코드 로그인. 로그인 폼의 `completeLogin` 이 부른다.
- 소셜 로그인 콜백([소셜 로그인의 복귀 경로](#소셜-로그인의-복귀-경로)).
- 초대 토큰 가입의 자동 로그인.
- 이메일 인증의 자동 로그인.
- 로그인 상태 복원. AuthProvider 가 리프레시 뒤에 부른다. 리프레시나 사용자 조회가 실패하면 로그아웃해 이 쿠키를 지우고 로그인 화면으로 보낸다.

`(auth)` 라우트 그룹에는 세션 하이드레이션(AuthProvider)이 없다. 그래서 가입 페이지가 이미 로그인한 사용자를 알아볼 때도 이 쿠키를 본다. 쿠키만 남고 리프레시 토큰이 만료된 경우에는 다음 화면의 라우트 가드가 로그인 화면으로 돌려보낸다. 이 분기는 [워크스페이스와 멤버](CLE-ACCT-WS.md) 의 초대 절에 있다.

### 로그인 뒤 이동

로그인 뒤 이동할 곳은 이 절이 한 곳에서 정한다. 비밀번호 로그인, 2단계 인증(TOTP · Passkey), 복구 코드 로그인, 소셜 로그인이 모두 같은 규칙을 따른다.

복귀 경로는 로그인을 마친 뒤 돌아갈 화면의 경로와 쿼리다. 로그인 화면은 이 값을 `redirect` 쿼리로 받는다.

- 로그인에 성공하면 `redirect` 값이 안전한 같은 출처 경로일 때 그 경로로 간다. 쿼리와 해시는 그대로 둔다.
- `redirect` 가 없거나 안전하지 않으면 `/dashboard` 로 간다.
- `redirect` 가 여러 번 온 요청(`?redirect=/a&redirect=/b`)은 값을 하나로 정할 수 없다. 이때는 `redirect` 가 없는 것으로 본다(`(auth)/login/page.tsx`).
- 슬러그 경로 `/w/<slug>/…` 는 그대로 간다. 슬러그 없는 옛 경로(예: `/invitations/accept?token=…`)는 옛 경로 흡수 라우트(catch-all route)가 받아 쿼리와 해시를 둔 채 현재 워크스페이스의 슬러그 경로로 넘긴다.
- `/dashboard` 도 슬러그 없는 경로다. 로그인 폼은 슬러그를 알기 전이라 `/dashboard` 로 보내고, `(main)/[...rest]` 옛 경로 흡수 라우트가 워크스페이스 목록을 읽은 뒤 현재 워크스페이스의 `/w/<slug>/dashboard` 로 넘긴다. 리다이렉트만 하는 중간 경로라 화면 깜빡임을 허용한다. 슬러그 라우팅 규칙은 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md) 이 정한다.

안전한 같은 출처 경로의 기준은 다음 표다. 판정은 `isSafeInternalPath`(`lib/workspace/safe-path.ts`) 하나로 한다. 이 함수는 링크 생성(`buildWorkspaceHref`)과 같은 정규화 함수 `toSafeInternalPath` 를 쓴다. 이유는 「[로그인 뒤 이동은 같은 출처 경로만 받는다 (2026-10-18)](#로그인-뒤-이동은-같은-출처-경로만-받는다-2026-10-18)」 에 있다.

| `redirect` 값 | 판정 |
| --- | --- |
| `/` 하나로 시작하는 경로. 쿼리와 해시도 포함한다(예: `/invitations/accept?token=…`, `/w/team-alpha/workflows`) | 쓴다 |
| 앞머리에 `/` · `\` 가 둘 이상 겹친 값(`//host`, `/\host`, `\\host`) | 거부 |
| `/` 로 시작하지 않는 값(외부 URL `https://…`, `dashboard` 같은 상대 경로, 빈 값) | 거부 |
| 탭 · 개행(CR · LF)이 든 값. 자리와 상관없다 | 거부 |

- 판정은 정규화한 결과가 원래 값과 같은지만 본다. 위 표에 없는 값은 거르지 않는다. 예를 들어 앞머리가 아닌 자리의 백슬래시(`/a\b`)는 통과한다.
- 판정하는 곳은 로그인 폼이다(`login-form.tsx` 가 `resolvePostLoginRedirect` 를 부른다). `redirect` 를 담아 보낸 쪽이 이미 검사했어도 다시 판정한다. 누구나 `/login?redirect=…` 링크를 만들 수 있어서다.
- 비밀번호 로그인, 2단계 인증, 복구 코드 로그인은 같은 마무리 단계(`completeLogin`)에서 이동한다. 소셜 로그인은 아래 [소셜 로그인의 복귀 경로](#소셜-로그인의-복귀-경로) 를 따른다.
- 서버 proxy, AuthProvider, 전체 화면 오류의 세션 만료 변형, 초대 흐름은 `redirect` 를 담아 로그인 화면으로 보낼 때 `/login?redirect=<인코딩한 경로와 쿼리>` 형식을 쓴다. 경로와 쿼리를 합친 값을 통째로 인코딩한다. 네 곳 모두 `buildLoginHref` 로 만든다.
- 전체 화면 오류(`ErrorPage`, `app/(main)/error.tsx`)의 세션 만료 변형은 지금 화면의 경로와 쿼리를 담는다. 안전한 같은 출처 경로가 아니면 `/dashboard` 를 담는다([오류 화면과 빈 상태 「감지 규칙」](../CLE-UI/CLE-UI-ERRORS.md#감지-규칙)).
- 초대 흐름은 세 곳에서 로그인 화면으로 보낸다. 가입 화면 아래 «로그인» 링크, 가입 화면의 기존 가입자 이동, 수락 페이지의 «다른 계정으로 로그인» 이다. 세 곳은 같은 헬퍼 `buildInvitationLoginHref` 로 `/login?redirect=<인코딩한 /invitations/accept?token=…>` 을 만든다. 토큰이 없으면 `/login` 이다.
- 복귀 경로가 초대 수락 페이지(`/invitations/accept` 나 `/w/<slug>/invitations/accept`)면 로그인 화면이 초대 안내 문구를 보여 준다. 문구는 [가입과 로그인 「로그인 화면」](CLE-ACCT-SIGNIN.md#로그인-화면) 이 정한다. 초대 흐름은 [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면) 이 정한다.
- 로그인 화면 아래 «계정 만들기» 링크(`/register`)는 복귀 경로를 넘기지 않는다. 동작과 이유는 [가입과 로그인 「로그인 화면」](CLE-ACCT-SIGNIN.md#로그인-화면) 이 정한다.
- 복귀 경로는 이메일 인증을 넘어 이어지지 않는다. 이메일 인증을 마치지 않은 계정은 로그인이 막힌다. 인증 링크로 자동 로그인하면 늘 `/dashboard` 로 간다([가입과 로그인](CLE-ACCT-SIGNIN.md)).

#### 소셜 로그인의 복귀 경로

소셜 로그인은 백엔드와 OAuth 제공자를 거쳐 `/callback` 으로 돌아온다. 백엔드 인증 API 를 바꾸지 않고 복귀 경로를 그 탭의 sessionStorage 로 넘긴다(`lib/auth/post-login-redirect.ts`). 이유는 「[소셜 로그인의 복귀 경로는 sessionStorage 로 넘긴다 (2026-10-18)](#소셜-로그인의-복귀-경로는-sessionstorage-로-넘긴다-2026-10-18)」 에 있다.

1. 로그인 화면은 소셜 로그인을 시작하기 전에 `redirect` 값을 그 탭의 sessionStorage 키 `clemvion.postLoginRedirect` 에 둔다. 값이 없거나 안전하지 않으면 남아 있던 값을 지운다.
2. 가입 화면에서 시작하는 소셜 로그인(`mode=register`)은 남아 있던 값을 지운다.
3. `/callback` 은 성공 · 실패와 관계없이 저장한 값을 한 번 꺼내 바로 지운다. 꺼낸 값도 위 기준으로 다시 검사한다. 값이 없거나 안전하지 않으면 `/dashboard` 를 쓴다.
4. 성공(`?success=true`)이면 리프레시(`POST /api/auth/refresh`)로 액세스 토큰을 받는다. 이어서 `establishSession` 이 토큰과 로그인 힌트 쿠키(`has_session`)를 두고 `GET /api/users/me` 를 읽어 로그인 상태를 표시한다([로그인 힌트 쿠키](#로그인-힌트-쿠키)). 그 뒤 3번의 경로로 이동한다.
5. 리프레시가 실패하면 실패 화면을 보여 준다. `GET /api/users/me` 조회만 실패하면 토큰과 힌트 쿠키를 둔 채 로그인 상태를 표시하지 않고 3번의 경로로 이동한다. 그 경로가 보호 경로면 AuthProvider 가 리프레시와 사용자 조회로 로그인 상태를 다시 복원한다. 복원도 실패하면 로그아웃해 힌트 쿠키를 지우고 `/login?redirect=…` 로 보낸다. 그래서 복귀 경로는 남는다.
6. sessionStorage 를 쓸 수 없으면(사생활 보호 모드 등) 값을 두지 않고 넘어간다. 그러면 콜백은 `/dashboard` 로 간다.

- 소셜 로그인은 같은 탭에서 이동한다. 팝업 창은 쓰지 않는다.
- 복귀 경로는 같은 탭에서만 이어진다. 다른 탭에서 소셜 로그인을 마치면 `/dashboard` 로 간다.
- 콜백 실패 화면의 «다시 시도» 버튼과 로그인 화면 링크는 `/login` 으로 간다. 그래서 실패한 뒤 다시 로그인하면 복귀 경로를 잃는다.
- 백엔드의 로그인 OAuth state(`auth_oauth_state`)와 리프레시 쿠키는 복귀 경로를 담지 않는다. 소셜 로그인 시작 · 콜백 API 는 [가입과 로그인](CLE-ACCT-SIGNIN.md) 이 정한다.

## 구현 위치

- `codebase/frontend/src/proxy.ts`
- `codebase/frontend/src/components/auth/auth-provider.tsx`
- `codebase/frontend/src/lib/auth/session-hint.ts` (로그인 힌트 쿠키 `has_session` 의 이름 · 속성과 심기 · 지우기 · 읽기)
- `codebase/frontend/src/lib/auth/__tests__/session-hint.test.ts` (쿠키 문자열과 읽기 판정)
- `codebase/frontend/src/app/(main)/[...rest]/page.tsx` (로그인 뒤 `/dashboard` 를 슬러그 경로로 넘긴다)
- `codebase/frontend/src/lib/auth/post-login-redirect.ts` (로그인 뒤 이동 판정 `resolvePostLoginRedirect`, 로그인 경로 `buildLoginHref` · `buildInvitationLoginHref`, 소셜 로그인 복귀 경로 저장 `clemvion.postLoginRedirect`)
- `codebase/frontend/src/lib/auth/__tests__/post-login-redirect.test.ts` (이동 판정, 로그인 경로 생성, 복귀 경로 저장과 소비)
- `codebase/frontend/src/lib/auth/use-current-login-href.ts` (전체 화면 오류의 세션 만료 변형이 담는 로그인 경로 `useCurrentLoginHref`)
- `codebase/frontend/src/lib/workspace/safe-path.ts` (안전한 같은 출처 경로 판정 `isSafeInternalPath` 와 정규화 `toSafeInternalPath`)
- `codebase/frontend/src/app/(auth)/login/page.tsx` (`redirect` 가 여러 번 오면 쓰지 않는다)
- `codebase/frontend/src/components/auth/login-form.tsx` (로그인 뒤 이동, 소셜 로그인 시작 전 복귀 경로 저장, 초대 안내 문구)
- `codebase/frontend/src/app/(auth)/callback/callback-content.tsx` (소셜 로그인 콜백의 복귀 경로 소비와 로그인 상태 표시)

## Rationale

### 로그인 뒤 이동은 같은 출처 경로만 받는다 (2026-10-18)

`redirect` 는 누구나 만들 수 있는 링크의 쿼리다. 로그인 화면이 받은 값으로 아무 URL 이나 열면 오픈 리다이렉트가 된다. 공격자가 우리 로그인 화면을 거쳐 피싱 사이트로 보내는 링크를 만들 수 있다. 그래서 같은 출처의 경로만 받고 나머지는 `/dashboard` 로 보낸다.

판정은 링크 생성(`buildWorkspaceHref`)이 쓰는 정규화 함수 `toSafeInternalPath` 하나에 기댄다. 브라우저 URL 파서에서는 앞머리의 `/` 와 `\` 가 같은 뜻이고 탭 · 개행은 지워진다. 그래서 `/\host` 나 `/<탭>/host` 같은 값이 다른 호스트로 읽힌다. 정규화는 앞머리를 `/` 하나로 접고 탭 · 개행을 지운다. `isSafeInternalPath` 는 정규화한 결과가 원래 값과 같을 때만 통과시킨다. 링크 생성과 이동 검사가 같은 함수를 쓰므로 두 곳의 방어 강도가 어긋나지 않는다.

채택하지 않은 선택지는 두 가지다.

- 임의 URL 을 허용한다: 오픈 리다이렉트가 된다.
- 호스트 허용 목록을 둔다: 로그인 뒤 다른 출처로 보낼 화면이 없다. 목록을 관리하는 부담만 는다.

`redirect` 가 여러 번 온 요청은 어느 값이 의도한 복귀 경로인지 알 수 없다. 그래서 `redirect` 가 없는 것으로 보고 `/dashboard` 로 보낸다. 첫 값을 쓰는 방식, 마지막 값을 쓰는 방식, 요청을 거부하는 방식은 채택하지 않은 선택지다.

전체 화면 오류(`ErrorPage`)의 세션 만료 변형(`components/ui/error-page.tsx`, `app/(main)/error.tsx`)도 같은 판정을 쓴다. 이 화면은 처음에 경로만 담아 쿼리가 필요한 화면(예: 초대 수락 페이지의 `?token=`)에서 401 이 나면 로그인 뒤 쿼리 없이 돌아왔다. 2026-11-13 에 이 화면도 경로와 쿼리를 담게 했고([오류 화면과 빈 상태 「감지 규칙」](../CLE-UI/CLE-UI-ERRORS.md#감지-규칙)), 서버 proxy 도 `buildLoginHref` 로 주소를 만들게 했다. 그래서 로그인 화면으로 보내는 네 곳이 한 헬퍼로 같은 인코딩을 쓴다.

### 소셜 로그인의 복귀 경로는 sessionStorage 로 넘긴다 (2026-10-18)

소셜 로그인은 백엔드 시작 요청, OAuth 제공자, 백엔드 콜백을 거쳐 프론트엔드 `/callback` 으로 돌아온다. 이번 범위는 백엔드 인증 API 를 바꾸지 않는다. 그래서 로그인 화면이 복귀 경로를 같은 탭의 sessionStorage 에 두고 `/callback` 이 꺼낸다.

시작 요청 값을 로그인 OAuth state(`auth_oauth_state`) 행에 실어 콜백까지 나르는 방식도 가능하다. `mode` 와 `rememberMe`(「[로그인 유지](CLE-ACCT-SESSION-TOKEN.md#로그인-유지)」)가 이미 이 방식으로 콜백까지 간다([계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md#oauth-state-를-한-번의-delete-로-소비한다)). 이 방식은 state 행에 칸을 더하는 마이그레이션과 백엔드 인증 API 변경이 필요해 이번 범위 밖이다. 다른 탭에서 돌아오거나 팝업 로그인이 필요해지면 이 방식으로 옮긴다.

지금 방식에는 비용이 있다. 소셜 로그인의 시작 값이 두 채널로 나뉜다. `mode` 와 `rememberMe` 는 state 행으로 가고 복귀 경로는 sessionStorage 로 간다. 시작 값을 더할 때마다 어느 채널에 둘지 정해야 한다. 두 채널은 수명도 다르다. state 행은 10분 뒤 만료되고 sessionStorage 값은 콜백이 꺼내거나 탭이 닫힐 때까지 남는다.

백엔드 콜백이 쿼리로 되돌려 주는 방식은 채택하지 않은 선택지다. 백엔드가 시작 요청의 값을 받아 콜백 URL 에 붙여야 해서 같은 이유로 이번 범위 밖이다.

고른 방식에는 한계가 있고 다음처럼 대응한다.

- 같은 탭에서만 이어진다. 다른 탭에서 소셜 로그인을 마치면 `/dashboard` 로 간다.
- 중간에 그만둔 소셜 로그인 시도의 값이 남을 수 있다. 남은 값이 다음 로그인의 목적지가 되지 않도록 `/callback` 은 성공 · 실패 모두에서 값을 한 번 꺼내 지운다. 가입 화면에서 시작하는 소셜 로그인도 남은 값을 지운다.
- sessionStorage 는 같은 출처의 스크립트가 고칠 수 있다. 그래서 저장할 때 검사한 값도 꺼낼 때 다시 검사한다.

콜백은 이동하기 전에 `GET /api/users/me` 를 읽어 비밀번호 로그인과 같게 로그인 상태를 표시한다. 이때 로그인 힌트 쿠키(`has_session`)가 심어진다. 쿠키 없이 보호 경로로 이동하면 proxy 가 JS 를 내려보내기 전에 다시 `/login` 으로 보낸다. 소셜 로그인을 마친 사용자가 복귀 경로 대신 로그인 화면을 보지 않게 하려는 것이다.

### 로그인 힌트 쿠키 규약을 한 모듈에 둔다 (2026-10-18)

쿠키 문자열은 `auth-store.ts` 에, 쿠키 이름은 proxy 와 가입 화면에 따로 적혀 있어 한 곳만 바꾸면 나머지가 어긋날 수 있었다. 그래서 쿠키 이름 · 속성과 심기 · 지우기 · 읽기를 `lib/auth/session-hint.ts` 한 곳에 모았다. 쿠키 이름 · 속성 · 심는 시점은 바뀌지 않았다.

proxy(Next 서버 미들웨어)도 이 모듈을 import 한다. 그래서 이 모듈은 브라우저 전용 모듈을 import 하지 않는다. `document` 는 브라우저인지 확인한 뒤에만 쓴다.

사용처마다 쿠키 문자열을 그대로 두는 방식은 택하지 않았다. 쿠키 이름이나 속성을 바꿀 때 세 곳을 함께 고쳐야 했고, 한 곳을 빠뜨려도 이를 잡는 테스트가 없었다.

### 토큰을 받은 경로를 한 진입점으로 모았다 (2026-11-05)

초대 토큰 가입과 이메일 인증의 자동 로그인은 액세스 토큰만 두고 로그인 힌트 쿠키를 심지 않았다. 그래서 보호 경로로 가면 proxy 가 로그인 화면으로 보냈다. 토큰을 받는 경로가 함께 쓰는 진입점 `establishSession`(`codebase/frontend/src/lib/auth/establish-session.ts`)을 두어 이 어긋남을 없앴다.

- 다섯 경로가 이 함수를 쓴다. 비밀번호 · 2단계 인증 · 복구 코드 로그인, 소셜 로그인 콜백, 초대 토큰 가입, 이메일 인증, 로그인 상태 복원이다([로그인 힌트 쿠키](#로그인-힌트-쿠키)).
- 이 함수는 액세스 토큰과 힌트 쿠키를 먼저 두고 `GET /api/users/me` 를 읽는다. 조회 시간 상한은 부르는 쪽이 `timeoutMs` 로 정하고 기본은 10초다.
- **로그인 상태 복원은 조회 시간 상한을 두지 않는다.** AuthProvider 는 `NO_SESSION_TIMEOUT`(0)을 넘긴다. 복원은 조회가 실패하면 로그아웃하므로 느린 회선에서 상한을 넘긴 조회가 유효한 세션을 끊지 않게 한다. 다른 경로는 조회가 실패해도 토큰과 힌트 쿠키를 남기므로 기본 상한을 쓴다.
- 조회가 실패하면 토큰과 힌트 쿠키를 둔 채 로그인 상태만 표시하지 않고 이동한다. 리프레시 쿠키는 서버가 이미 심었으므로 목적지의 AuthProvider 가 로그인 상태를 다시 복원할 수 있다. 복원도 실패하면 로그아웃해 힌트 쿠키를 지운다.
- **기각: 조회가 성공한 뒤에만 힌트 쿠키를 심는다.** 조회가 잠깐 실패하면 리프레시 쿠키가 살아 있는데도 proxy 가 로그인 화면으로 보낸다.
- **기각: 조회가 실패하면 토큰과 힌트 쿠키를 지우고 에러를 보인다.** 서버 쪽 리프레시 세션은 남으므로 화면과 서버 상태가 어긋난다.
- **진입점은 워크스페이스를 다시 맞추지 않는다.** slug 없는 경로의 리다이렉트가 마지막 워크스페이스 slug 를 붙이고 `/w/<slug>` 경로의 레이아웃이 URL 에 맞춰 토큰을 바꾼다. slug 없는 경로의 로그인 상태 복원은 전처럼 AuthProvider 가 따로 맞춘다.
