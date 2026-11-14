---
id: "CLE-ACCT-SESSION"
title: "세션과 토큰"
type: "feature"
version: 19
status: "approved"
requirements: ["REQ-SESSION-001", "REQ-SESSION-002", "REQ-SESSION-003", "REQ-SESSION-004", "REQ-SESSION-005", "REQ-SESSION-006", "REQ-SESSION-007", "REQ-SESSION-008", "REQ-SESSION-009", "REQ-SESSION-010", "REQ-SESSION-011", "REQ-SESSION-012", "REQ-SESSION-013", "REQ-SESSION-014", "REQ-SESSION-015", "REQ-SESSION-016", "REQ-SESSION-017", "REQ-SESSION-018", "REQ-SESSION-019", "REQ-SESSION-020", "REQ-SESSION-021", "REQ-SESSION-022", "REQ-SESSION-023", "REQ-SESSION-024", "REQ-SESSION-025", "REQ-SESSION-026", "REQ-SESSION-027", "REQ-SESSION-028", "REQ-SESSION-029", "REQ-SESSION-030", "REQ-SESSION-031", "REQ-SESSION-032", "REQ-SESSION-033", "REQ-SESSION-035", "REQ-SESSION-036", "REQ-SESSION-037", "REQ-SESSION-038", "REQ-SESSION-039", "REQ-SESSION-040", "REQ-SESSION-041", "REQ-SESSION-042", "REQ-SESSION-043", "REQ-SESSION-044", "REQ-SESSION-045", "REQ-SESSION-046", "REQ-SESSION-047", "REQ-SESSION-048"]
basis_superseded: false
parent: "CLE-ACCT"
ancestors: ["CLE-VISION", "CLE-ACCT"]
area: "CLE-ACCT"
content_hash: "3145aa8134bc3c46592876150ad574a1bf2df7b4d50306925d974a6505183bb1"
read_as: "approved_fallback"
task: "CLE-T-E90KGZ"
source_paths: ["spec/2-navigation/10-auth-flow.md", "spec/2-navigation/9-user-profile.md", "spec/5-system/1-auth.md", "spec/data-flow/2-auth.md"]
mirror_sha256: "3bce34cc7a5a6d5c74d3d30672364e30e1b3373d0296f49ba6af1e13b89e92cb"
etag: "sha256-758bbdbd5af318167d18cf15be011394e8923a1b9e6d776f7d5f07637ba65a32"
---
> 구현 상태: 부분 구현 (동시 세션 제한은 미구현) · 원문: `spec/5-system/1-auth.md` (§2, §5 로그아웃·갱신 행, Rationale 2.3.A~D·Production fail-closed 가드), `spec/2-navigation/10-auth-flow.md` (§3.3, §7), `spec/2-navigation/9-user-profile.md` (§2.2 활성 세션 행, §6.1 세션 행), `spec/data-flow/2-auth.md` (§1.4~§1.6, Rationale family_id) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 로그인한 뒤 사용자가 로그인 상태를 어떻게 유지하고 끝내는지 정한다. 액세스 토큰(access token, `accessToken`)과 리프레시 토큰(refresh token, `refreshToken`)의 형태와 수명, 로그인 세션(login session, `family_id`) 단위의 토큰 회전(refresh token rotation)과 재사용 감지, 리프레시 쿠키 속성, 세션 목록과 세션 강제 종료(session revoke), 계정 재인증(reauthentication, `verifyReauth`)과 비밀번호 재확인(password re-check, `verifyPasswordForUser`)의 에러 코드, 로그아웃, 프론트엔드 라우트 가드와 로그인 뒤 이동할 곳, 운영 환경 부팅 가드(`assertProductionConfig`)가 막는 설정과 그 가드의 암호화 키 검사 기준이 범위다. 이 문서는 입구이고 주제별 본문은 [하위 문서](#하위-문서) 에 있다.

범위 밖 주제는 다음 문서가 정한다.

- 로그인·2단계 인증·소셜 로그인으로 토큰을 처음 받는 과정: [가입과 로그인](CLE-ACCT-SIGNIN.md)
- 현재 워크스페이스를 바꾸는 토큰 재발급과 서버 인가 규칙: [워크스페이스와 멤버](CLE-ACCT-WS.md)
- `refresh_token`·`login_history` 테이블과 회전 시퀀스: [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md)
- 로그인 이력 이벤트 목록·조회 API·180일 보존: [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)
- 비밀번호 변경 화면: [내 프로필](CLE-ACCT-PROFILE.md)
- 전역 요청 한도: [HTTP API 규약](../CLE-API/CLE-API-CONV.md)

## 요구사항

- REQ-SESSION-001 WHEN 로그인에 성공하면 THE SYSTEM SHALL 15분짜리 액세스 토큰을 응답 본문으로 주고 리프레시 토큰은 HttpOnly·Secure 쿠키로 준다.
- REQ-SESSION-002 WHEN 클라이언트가 액세스 토큰을 받으면 THE SYSTEM SHALL 그 토큰을 JS 메모리에만 보관한다.
- REQ-SESSION-003 WHEN 로그인 유지를 켜고 로그인하면 THE SYSTEM SHALL 리프레시 토큰을 30일 동안 유효하게 하고, 끄면 7일 동안 유효하게 한다.
- REQ-SESSION-004 WHEN 액세스 토큰을 서명하면 THE SYSTEM SHALL 현재 워크스페이스를 `activeWorkspaceId` 클레임으로만 발행한다.
- REQ-SESSION-005 WHEN 액세스 토큰을 읽으면 THE SYSTEM SHALL `activeWorkspaceId ?? workspaceId` 로 옛 클레임 이름의 토큰도 받는다.
- REQ-SESSION-006 IF `NODE_ENV=production` 에서 `JWT_SECRET` 이 없거나 공백뿐이거나 기본 sentinel·예시값이거나 앞뒤 공백을 뗀 길이가 32자 미만이면 THE SYSTEM SHALL 부팅을 거부한다.
- REQ-SESSION-007 WHEN 클라이언트가 API 에서 401 을 받아 액세스 토큰 만료를 감지하면 THE SYSTEM SHALL `POST /api/auth/refresh` 로 새 토큰을 받는다.
- REQ-SESSION-008 WHEN 리프레시 토큰으로 갱신을 요청받으면 THE SYSTEM SHALL 새 액세스 토큰과 같은 로그인 세션의 새 리프레시 토큰을 주고 옛 리프레시 토큰을 바로 무효화한다.
- REQ-SESSION-009 IF 이미 무효화된 리프레시 토큰이 다시 쓰이면 THE SYSTEM SHALL 그 로그인 세션 전체를 무효화하고 로그인 이력에 `token_reuse_detected` 를 남긴 뒤 401 `TOKEN_INVALID` 로 거부한다.
- REQ-SESSION-010 IF 리프레시 토큰이 단순히 만료됐으면 THE SYSTEM SHALL 로그인 세션 무효화나 이력 기록 없이 401 `TOKEN_EXPIRED` 로 거부한다.
- REQ-SESSION-011 IF 같은 리프레시 토큰으로 토큰 회전 요청이 동시에 오면 THE SYSTEM SHALL 한 요청만 토큰 회전을 하고 나머지는 401 `TOKEN_INVALID` 로 거부한다.
- REQ-SESSION-012 IF 갱신 요청에 리프레시 쿠키가 없으면 THE SYSTEM SHALL 401 로 거부한다.
- REQ-SESSION-013 IF 갱신 요청의 `Origin` 이 CORS 허용 목록 밖이거나 `'null'` 이면 THE SYSTEM SHALL 403 으로 거부한다.
- REQ-SESSION-014 WHEN 갱신 요청에 `Origin` 헤더가 없으면 THE SYSTEM SHALL Origin 검사를 통과시킨다.
- REQ-SESSION-015 WHEN 리프레시 쿠키를 설정하거나 지우면 THE SYSTEM SHALL 같은 Path `/api/auth` 를 쓴다.
- REQ-SESSION-016 WHEN 리프레시 쿠키 Domain 을 정하면 THE SYSTEM SHALL `FRONTEND_URL`·`APP_URL` hostname 의 공통 상위 도메인을 자동으로 쓰고, 같은 host·localhost·IP·공통 도메인 없음이면 Domain 을 지정하지 않는다.
- REQ-SESSION-017 WHEN 리프레시 쿠키 SameSite 를 정하면 THE SYSTEM SHALL `COOKIE_SAMESITE` 값을 쓰고 설정이 없거나 알 수 없는 값이면 `none` 을 쓴다.
- REQ-SESSION-018 WHEN 로그인 세션·감사용 클라이언트 IP 를 읽으면 THE SYSTEM SHALL `TRUST_CF_CONNECTING_IP` 가 `true` 나 `1` 일 때만 `CF-Connecting-IP` 를 1순위로 쓰고 이어서 `X-Forwarded-For` 첫 IP, `req.ip`, `req.socket.remoteAddress` 순으로 쓴다. 채팅 채널 서명 검증 실패 한도의 IP 는 이 순서를 쓰지 않는다([채팅 채널 「R-CC-34」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#r-cc-34-서명-검증-실패는-트리거와-ip-쌍으로-세고-한도에-닿으면-401-로-답한다)).
- REQ-SESSION-019 WHEN 공개 웹훅 호출 수 제한(`PublicWebhookThrottleGuard`)·`ip_whitelist`·실행 기록 소스 IP(`Execution.source_ip`) 용 IP 를 읽으면 THE SYSTEM SHALL 헤더 기반 순서(CF 허용 시 `CF-Connecting-IP`, 그다음 `X-Forwarded-For` 첫 IP)만 쓰고 `req.ip`·socket 폴백을 쓰지 않는다. 채팅 채널 서명 검증 실패 한도의 IP 는 이 규칙 밖이고 CF 허용 시 `CF-Connecting-IP`, 그다음 `req.ip` 순으로 읽는다([채팅 채널 「R-CC-34」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#r-cc-34-서명-검증-실패는-트리거와-ip-쌍으로-세고-한도에-닿으면-401-로-답한다)).
- REQ-SESSION-020 WHEN 리프레시 토큰을 발급하면 THE SYSTEM SHALL 발급 시점의 IP·User-Agent·기기 라벨을 기록하고 갱신 때마다 마지막 사용 시각과 IP 를 갱신한다.
- REQ-SESSION-021 WHEN 사용자가 세션 목록을 조회하면 THE SYSTEM SHALL 로그인 세션 단위로 가장 최신 행의 메타데이터를 보여 주고 요청 쿠키와 맞는 로그인 세션에 `isCurrent` 를 표시한다.
- REQ-SESSION-022 WHEN 사용자가 다른 로그인 세션을 강제 종료하면 THE SYSTEM SHALL 계정 재인증 뒤 그 로그인 세션의 리프레시 토큰을 모두 무효화하고 로그인 이력에 `session_revoked` 를 남긴다.
- REQ-SESSION-023 IF 사용자가 현재 로그인 세션을 강제 종료하려 하면 THE SYSTEM SHALL 400 `CANNOT_REVOKE_CURRENT_SESSION` 으로 거부하고 로그아웃을 쓰게 한다.
- REQ-SESSION-024 IF 다른 사용자의 로그인 세션이나 없는 로그인 세션을 강제 종료하려 하면 THE SYSTEM SHALL 같은 404 로 응답한다.
- REQ-SESSION-025 WHEN 계정 재인증을 하면 THE SYSTEM SHALL 비밀번호가 있는 계정은 비밀번호, 비밀번호가 없는 계정은 등록된 TOTP 코드로 확인하고 둘 다 있으면 하나만 통과해도 받는다.
- REQ-SESSION-026 IF 비밀번호도 TOTP 도 없는 계정이 계정 재인증을 하려 하면 THE SYSTEM SHALL Passkey 등록 여부와 상관없이 403 `REAUTH_NOT_AVAILABLE` 로 막는다.
- REQ-SESSION-027 WHEN 비밀번호 변경이 성공하면 THE SYSTEM SHALL 사용자의 모든 로그인 세션을 무효화하고 현재 기기에 7일짜리 새 로그인 세션을 발급한다.
- REQ-SESSION-028 WHEN 비밀번호 변경이나 이메일 변경으로 모든 로그인 세션을 무효화하면 THE SYSTEM SHALL 로그인 이력에 `session_revoked`(`familyId=null`) 1건을 남긴다.
- REQ-SESSION-029 IF 비밀번호 변경 뒤 로그인 세션 무효화나 재발급이 실패하면 THE SYSTEM SHALL 이미 커밋한 비밀번호 변경을 유지하고 실패를 서버 로그에 남긴다.
- REQ-SESSION-030 WHEN 사용자가 로그아웃하면 THE SYSTEM SHALL 호출한 기기의 로그인 세션 전체를 무효화하고 리프레시 쿠키를 지우고 로그인 이력에 `logout` 을 남긴다.
- REQ-SESSION-031 WHEN 리프레시 쿠키 없이 로그아웃을 요청하면 THE SYSTEM SHALL 200 으로 응답한다.
- REQ-SESSION-032 WHEN 사용자가 로그아웃하면 THE SYSTEM SHALL 클라이언트 메모리의 액세스 토큰과 `has_session` 쿠키를 지우고 `/login` 으로 보낸다.
- REQ-SESSION-033 IF 동시 로그인 세션이 5개를 넘으면 THE SYSTEM SHALL 가장 오래된 로그인 세션을 자동 종료한다. (미구현, [미결 사항](#미결-사항))
- REQ-SESSION-035 IF 로그인하지 않은 사용자가 공개 경로 밖 화면을 열면 THE SYSTEM SHALL 그 화면의 경로와 쿼리를 `redirect` 파라미터에 담아 `/login` 으로 보낸다.
- REQ-SESSION-036 IF 요청에 `has_session` 쿠키가 없으면 THE SYSTEM SHALL JS 를 내려보내기 전 서버 proxy 단계에서 `/login?redirect=<인코딩한 경로와 쿼리>` 로 보낸다.
- REQ-SESSION-037 WHEN 로그인에 성공하면 THE SYSTEM SHALL 로그인 힌트 쿠키 `has_session=1`(non-httpOnly, path=/, max-age 30일, SameSite=Lax)을 설정한다.
- REQ-SESSION-038 WHEN 로그인(비밀번호 · 2단계 인증 · 복구 코드 · 소셜 로그인)에 성공하면 THE SYSTEM SHALL `redirect` 값이 하나뿐이고 안전한 같은 출처 경로일 때 그 경로와 쿼리로 보내고 아니면 `/dashboard` 로 보낸다. 안전한 값의 기준은 [로그인 뒤 이동](#로그인-뒤-이동) 에 있다.
- REQ-SESSION-039 WHEN 사용자가 `/profile/sessions` 를 열면 THE SYSTEM SHALL 활성 로그인 세션 목록과 "현재" 배지, 개별 종료와 일괄 종료 버튼을 보여 준다.
- REQ-SESSION-040 WHEN 브라우저가 옛 초대 링크의 페이지 경로 `/auth/register`(끝 슬래시 포함)를 요청하면 THE SYSTEM SHALL 공개 경로 판정과 `has_session` 검사보다 먼저 쿼리를 보존한 채 `/register` 로 리다이렉트한다.
- REQ-SESSION-041 WHEN 서버가 세션 목록과 세션 강제 종료 API 를 노출하면 THE SYSTEM SHALL 리프레시 쿠키 Path 아래인 `/api/auth/sessions` 경로로 노출하고 옛 경로 `/api/users/me/sessions` 는 두지 않는다.
- REQ-SESSION-042 IF 일괄 종료 요청에서 현재 로그인 세션을 식별할 수 없으면 THE SYSTEM SHALL 400 `CURRENT_SESSION_REQUIRED` 로 거부한다.
- REQ-SESSION-043 IF 클라이언트가 `/auth/sessions` 밖의 `/auth/` 경로 요청에서 401 을 받으면 THE SYSTEM SHALL 액세스 토큰을 갱신하지 않고 그 401 을 호출한 쪽에 그대로 돌려준다.
- REQ-SESSION-044 WHEN 클라이언트가 `/auth/sessions` 나 그 하위 경로 요청에서 401 을 받으면 THE SYSTEM SHALL 다른 API 처럼 액세스 토큰을 한 번 갱신하고 요청을 다시 보낸다.
- REQ-SESSION-045 WHEN 소셜 로그인 콜백 화면(`/callback`)이 열리면 THE SYSTEM SHALL 로그인 화면이 소셜 로그인을 시작하기 전에 그 탭의 sessionStorage(키 `clemvion.postLoginRedirect`)에 둔 복귀 경로를 성공 · 실패와 관계없이 한 번 꺼내 바로 지우고 [로그인 뒤 이동](#로그인-뒤-이동) 의 기준으로 다시 검사한다.
- REQ-SESSION-046 WHEN 사용자가 세션 강제 종료 확인 창에서 계정 재인증을 하면 THE SYSTEM SHALL 처음에는 비밀번호 입력란을 보여 주고 400 `REAUTH_REQUIRED` 를 받았는데 그 계정의 TOTP 가 켜져 있으면 TOTP 코드 입력란으로 바꾸며 403 `REAUTH_NOT_AVAILABLE` 을 받으면 입력란 없이 계정 재인증을 할 수 없다고 안내한다.
- REQ-SESSION-047 WHEN 갱신으로 리프레시 토큰을 회전하면 THE SYSTEM SHALL 새 리프레시 토큰이 그 로그인 세션의 로그인 유지 여부를 이어받게 하고 새 리프레시 토큰과 갱신 응답의 리프레시 쿠키를 회전한 시점부터 로그인 유지를 켰으면 30일, 껐으면 7일 동안 유효하게 한다.
- REQ-SESSION-048 WHEN 사용자가 초대 수락 페이지의 «다른 계정으로 로그인» 으로 로그아웃하면 THE SYSTEM SHALL `/login` 대신 `/login?redirect=<인코딩한 /invitations/accept?token=…>` 로 보낸다.

REQ-SESSION-034(30일 비활동 만료)는 지웠고 번호를 다시 쓰지 않는다. 이유는 [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md#30일-비활동-만료를-지우고-동시-세션-제한을-미구현으로-적는다) 에 있다.

## 하위 문서

| 하위 문서 | 맡는 내용 | 요구사항 |
| --- | --- | --- |
| [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md) | 토큰 종류와 수명, 로그인 유지, 액세스 토큰 payload, 토큰 갱신과 재사용 감지, 클라이언트 갱신 재시도, 로그아웃 | REQ-SESSION-001 ~ 005, 007 ~ 012, 030 ~ 032, 043, 044, 047, 048 |
| [세션과 토큰 — 세션 정책과 세션 관리](CLE-ACCT-SESSION-POLICY.md) | 로그인 세션 정책, 리프레시 쿠키 속성, 클라이언트 IP, 본인 확인 에러 코드, 세션 화면, 세션 API | REQ-SESSION-013 ~ 029, 033, 039, 041, 042, 046 |
| [세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md) | 공개 경로와 두 층의 가드, 로그인 힌트 쿠키, 로그인 뒤 이동, 소셜 로그인의 복귀 경로 | REQ-SESSION-035 ~ 038, 040, 045 |
| [세션과 토큰 — 운영 환경 가드](CLE-ACCT-SESSION-GUARD.md) | `assertProductionConfig` 가 막는 설정의 전체 목록, 암호화 키 검사, 가드에 넣는 기준 | REQ-SESSION-006 |

하위 문서가 다루지만 다른 문서에 있는 요구도 있다. 동시 세션 제한의 근거는 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 REQ-NFR-048(NF-SC-07)이다(토큰과 갱신 · 세션 정책). `INTERACTION_JWT_SECRET` 의 운영 환경 가드는 [External Interaction API](../CLE-IX/CLE-EIA.md) 의 REQ-EIA-018 이 맡는다(운영 환경 가드).

다른 문서가 링크하던 절은 아래 이름 그대로 남기고 하위 문서로 잇는다.

### 로그인 유지

→ [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md#로그인-유지)

### 로그아웃

→ [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md#로그아웃)

### 세션 정책

→ [세션과 토큰 — 세션 정책과 세션 관리](CLE-ACCT-SESSION-POLICY.md#세션-정책)

### 본인 확인 에러 코드

→ [세션과 토큰 — 세션 정책과 세션 관리](CLE-ACCT-SESSION-POLICY.md#본인-확인-에러-코드)

### 공개 경로와 가드

→ [세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md#공개-경로와-가드)

### 로그인 힌트 쿠키

→ [세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md#로그인-힌트-쿠키)

### 로그인 뒤 이동

→ [세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md#로그인-뒤-이동)

### 소셜 로그인의 복귀 경로

→ [세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md#소셜-로그인의-복귀-경로)

### 운영 환경 가드

→ [세션과 토큰 — 운영 환경 가드](CLE-ACCT-SESSION-GUARD.md#운영-환경-가드)

### 암호화 키 검사

→ [세션과 토큰 — 운영 환경 가드](CLE-ACCT-SESSION-GUARD.md#암호화-키-검사)

### 가드에 넣는 것과 넣지 않는 것

→ [세션과 토큰 — 운영 환경 가드](CLE-ACCT-SESSION-GUARD.md#가드에-넣는-것과-넣지-않는-것)

## 미결 사항

- **동시 세션 한도의 값과 설정 주체**: 세션 정책 표는 동시 세션 기본 5개(관리자 설정 가능)와 초과 시 가장 오래된 세션 종료를 약속하지만 둘 다 미구현이다(2026-10-10 코드 확인). 5개가 맞는 값인지, "관리자 설정" 의 주체가 운영자 환경 변수인지 워크스페이스 관리자인지 정해지지 않았다. 후속 Task CLE-T-VBQV4H 가 둘을 정하고 구현한다. 관련 요구는 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 REQ-NFR-048(NF-SC-07)이다.
- **`/auth/` 아래 다른 JWT 라우트는 401 에서 갱신하지 않는다**: 클라이언트의 갱신 제외 규칙은 `/auth/sessions` 만 예외로 둔다. 2단계 인증 설정·켜기·끄기(`/auth/2fa/setup`·`/auth/2fa/verify`·`/auth/2fa/disable`), Passkey 등록 · 관리(`/auth/2fa/webauthn/*` 의 JWT 라우트), 워크스페이스 전환(`/auth/workspaces/:id/switch`)도 Bearer 액세스 토큰이 필요한 라우트다. 이 라우트들은 액세스 토큰이 만료된 뒤 첫 호출이 갱신 없이 401 로 끝난다. 제외 조건을 갱신이 필요 없는 라우트의 명시 목록(`/auth/login`, `/auth/login/totp`, `/auth/refresh` 등)으로 좁힐지 결정 필요.

## 구현 위치

하위 문서마다 `## 구현 위치` 에 있다.

## Rationale

### 로그인 세션을 `family_id` 로 묶는다

`refresh_token.family_id` 는 토큰 회전 뒤에도 유지돼 기기 하나의 로그인 상태를 가리킨다. 사용자에게 보이는 활성 세션 목록은 로그인 세션 단위로 가장 최신 행의 메타데이터를 보여 준다. 회전 중 재사용을 감지하면 그 `family_id` 전체를 무효화해 훔친 토큰의 피해 범위를 한 로그인 세션으로 한정한다.

### 구현 상태는 요구사항 줄과 머리 줄에 표시한다 (2026-10-22)

요구사항을 인용하는 다른 문서와 spec-coverage 감사는 요구사항 줄과 머리 줄을 기준으로 읽는다. 그래서 일부만 구현된 요구는 미결 사항이나 본문 절에만 적지 않고 요구사항 줄과 머리 줄 구현 상태에도 표시한다. 로그인 힌트 쿠키 요구에 이 표시를 달았다가 토큰을 받는 경로를 `establishSession` 으로 모은 뒤 지웠다([세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md#토큰을-받은-경로를-한-진입점으로-모았다-2026-11-05)).

### 로그아웃 요구사항을 둘로 나누고 제목 날짜를 맞췄다 (2026-11-13)

표기만 고쳤고 동작은 바뀌지 않았다.

- 요구사항 REQ-SESSION-032 한 줄에 있던 복귀 경로를 지정한 로그아웃을 REQ-SESSION-048 로 옮겼다. 담는 경로도 구현대로 슬러그 없는 `/invitations/accept?token=…` 으로 고쳤다. 앞의 표기는 수락 페이지의 슬러그 경로를 그대로 담는 것처럼 읽혔다.
- 요구사항 REQ-SESSION-037 의 주어를 «프론트엔드 JS» 에서 시스템으로 바꿨다. 쿠키를 심는 곳은 「[로그인 힌트 쿠키](#로그인-힌트-쿠키)」 가 적는다.
- 2026-10-18 에 쓴 Rationale 제목 세 개에 날짜를 붙여 다른 제목과 표기를 맞췄다.

### 클라이언트 IP 요구사항에 채팅 채널 서명 검증 실패 한도를 적었다 (2026-11-14)

표기만 고쳤고 동작은 바뀌지 않았다.

- 채팅 채널 서명 검증 실패 한도가 클라이언트 IP 를 읽는 세 번째 경로로 들어왔다(NERV Task `CLE-T-CC3GPN`). 이 경로는 `X-Forwarded-For` 첫 IP 를 쓰지 않고 `CF-Connecting-IP`(신뢰할 때), `req.ip` 순으로 읽는다(`extractUnspoofableClientIp`). 규칙과 근거는 [채팅 채널 「R-CC-34」](../CLE-CHAT/CLE-CHAT-CORE-GATE.md#r-cc-34-서명-검증-실패는-트리거와-ip-쌍으로-세고-한도에-닿으면-401-로-답한다) 에 있다.
- 요구사항 REQ-SESSION-018 · 019 에 이 경로가 두 순서 밖이라고 적었다.
- 요구사항 REQ-SESSION-019 의 대상을 공개 웹훅 호출 수 제한(`PublicWebhookThrottleGuard`)·`ip_whitelist`·실행 기록 소스 IP(`Execution.source_ip`)로 고쳐 적었다. 요청 한도는 공개 웹훅 호출 수 제한으로 좁혔다. `/api/hooks/*` 의 전역 요청 한도는 `req.ip` 로 세므로 이 요구사항의 대상이 아니다. 실행 기록 소스 IP 는 웹훅 · 채팅 채널 트리거가 실행을 만들 때 같은 `extractClientIpFromHeaders` 로 읽어서 더했다([실행 데이터와 흐름 — 데이터 모델](../CLE-EXEC/CLE-EXEC-DATA-MODEL.md#실행)).
- NERV Task `CLE-T-E90KGZ` 에서 고쳤다.

다른 문서가 링크하던 Rationale 절은 아래 이름 그대로 남기고 하위 문서로 잇는다.

### 세션 API 를 리프레시 쿠키 Path 아래로 옮겼다

→ [세션과 토큰 — 세션 정책과 세션 관리](CLE-ACCT-SESSION-POLICY.md#세션-api-를-리프레시-쿠키-path-아래로-옮겼다)

### 토큰 회전이 로그인 유지 여부를 이어받는다 (2026-11-05)

→ [세션과 토큰 — 토큰과 갱신](CLE-ACCT-SESSION-TOKEN.md#토큰-회전이-로그인-유지-여부를-이어받는다-2026-11-05)

### 소셜 로그인의 복귀 경로는 sessionStorage 로 넘긴다 (2026-10-18)

→ [세션과 토큰 — 라우트 가드와 로그인 뒤 이동](CLE-ACCT-SESSION-ROUTE.md#소셜-로그인의-복귀-경로는-sessionstorage-로-넘긴다-2026-10-18)

### 운영 환경 가드를 한 함수에 모은다

→ [세션과 토큰 — 운영 환경 가드](CLE-ACCT-SESSION-GUARD.md#운영-환경-가드를-한-함수에-모은다)
