---
id: "CLE-ACCT-SIGNIN"
title: "가입과 로그인"
type: "feature"
version: 8
status: "approved"
requirements: ["REQ-SIGNIN-001", "REQ-SIGNIN-002", "REQ-SIGNIN-003", "REQ-SIGNIN-004", "REQ-SIGNIN-005", "REQ-SIGNIN-006", "REQ-SIGNIN-007", "REQ-SIGNIN-008", "REQ-SIGNIN-009", "REQ-SIGNIN-010", "REQ-SIGNIN-011", "REQ-SIGNIN-012", "REQ-SIGNIN-013", "REQ-SIGNIN-014", "REQ-SIGNIN-015", "REQ-SIGNIN-016", "REQ-SIGNIN-017", "REQ-SIGNIN-018", "REQ-SIGNIN-019", "REQ-SIGNIN-020", "REQ-SIGNIN-021", "REQ-SIGNIN-022", "REQ-SIGNIN-023", "REQ-SIGNIN-024", "REQ-SIGNIN-025", "REQ-SIGNIN-026", "REQ-SIGNIN-027", "REQ-SIGNIN-028", "REQ-SIGNIN-029", "REQ-SIGNIN-030", "REQ-SIGNIN-031", "REQ-SIGNIN-032", "REQ-SIGNIN-033", "REQ-SIGNIN-034", "REQ-SIGNIN-035", "REQ-SIGNIN-036", "REQ-SIGNIN-037", "REQ-SIGNIN-038", "REQ-SIGNIN-039", "REQ-SIGNIN-040", "REQ-SIGNIN-041", "REQ-SIGNIN-042", "REQ-SIGNIN-043", "REQ-SIGNIN-044", "REQ-SIGNIN-045", "REQ-SIGNIN-046", "REQ-SIGNIN-047", "REQ-SIGNIN-048", "REQ-SIGNIN-049", "REQ-SIGNIN-050", "REQ-SIGNIN-051", "REQ-SIGNIN-052", "REQ-SIGNIN-053", "REQ-SIGNIN-054", "REQ-SIGNIN-055", "REQ-SIGNIN-056", "REQ-SIGNIN-057", "REQ-SIGNIN-058", "REQ-SIGNIN-059", "REQ-SIGNIN-060", "REQ-SIGNIN-061", "REQ-SIGNIN-062", "REQ-SIGNIN-063", "REQ-SIGNIN-064", "REQ-SIGNIN-065", "REQ-SIGNIN-066", "REQ-SIGNIN-067", "REQ-SIGNIN-068", "REQ-SIGNIN-069", "REQ-SIGNIN-070", "REQ-SIGNIN-071"]
basis_superseded: false
parent: "CLE-ACCT"
ancestors: ["CLE-VISION", "CLE-ACCT"]
area: "CLE-ACCT"
content_hash: "96c7d6362dd1f8bb666ce010ead053e091670b25e01c4b68fdf2efc85bf1a22f"
read_as: "approved_fallback"
task: "CLE-T-7WZKFB"
source_paths: ["spec/2-navigation/10-auth-flow.md", "spec/2-navigation/9-user-profile.md", "spec/5-system/1-auth.md"]
mirror_sha256: "fd963a846254d885873b78b893e801207472503741718e61e238ecb39844fed0"
etag: "sha256-84c1075b3b57019786ffbc8bff5aef9866c7ca1938c15ec12485c93d45b7a67a"
---
> 구현 상태: 부분 구현 (셀프 호스팅 LDAP·SAML 인증, 로그인의 이메일 인증 확인 순서와 응답 코드, Passkey 기능이 꺼졌을 때 Passkey 만 등록한 계정의 로그인 차단, Passkey 인증 챌린지 1회 사용, 서명 확인 뒤의 counter 판정은 미구현) · 원문: `spec/5-system/1-auth.md` (§1.1~§1.4, §5, Rationale), `spec/2-navigation/10-auth-flow.md` (§1~§5, §8, Rationale), `spec/2-navigation/9-user-profile.md` (§2.0·§2.2 이메일 변경·2단계 인증 설정, §6.1 이메일 변경 행) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 사용자가 계정을 만들고 로그인하는 방법을 정한다. 이메일·비밀번호 가입과 이메일 인증, 로그인, 2단계 인증(2FA, TOTP 와 Passkey·보안 키), 소셜 로그인(OAuth login, `auth_oauth_state`), 비밀번호 재설정(password reset), 이메일 변경(email change, `pendingEmail`)의 화면과 API 가 범위다.

인증 화면은 사이드바가 없는 전체 화면 레이아웃을 쓴다. 가입·로그인·2단계 인증·비밀번호 재설정·OAuth 콜백 화면이 모두 이 레이아웃 안에 있다. 이메일 변경은 로그인한 사용자가 내 프로필에서 시작하지만 로그인 식별자를 바꾸는 절차라서 이 문서가 흐름과 API 를 소유한다.

범위 밖 주제는 다음 문서가 정한다.

- 액세스 토큰·리프레시 토큰, 로그인 세션, 로그인 유지, 로그아웃, 계정 재인증 에러 코드, 라우트 가드, 로그인 뒤 이동할 곳: [세션과 토큰](CLE-ACCT-SESSION.md)
- 초대 링크로 하는 가입, 첫 개인 워크스페이스 자동 생성, 역할과 권한: [워크스페이스와 멤버](CLE-ACCT-WS.md)
- 내 프로필 화면과 비밀번호 변경: [내 프로필](CLE-ACCT-PROFILE.md)
- 테이블 컬럼, 서버 시퀀스, 상태 전이: [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md)
- 감사 로그 액션(`user.*`)과 로그인 이력 이벤트·보존: [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)
- 웹훅 호출자 인증인 인증 설정(AuthConfig): [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md)

## 요구사항

- REQ-SIGNIN-001 WHEN 사용자가 이메일과 비밀번호로 가입하면 THE SYSTEM SHALL 이메일 인증을 마친 뒤에만 계정을 활성화한다.
- REQ-SIGNIN-002 WHEN 사용자가 비밀번호를 정하면 THE SYSTEM SHALL 8자 이상이고 대문자·소문자·숫자·특수문자 중 3가지 이상을 섞은 비밀번호만 받는다.
- REQ-SIGNIN-003 WHEN 비밀번호를 저장하면 THE SYSTEM SHALL cost factor 12 이상의 bcrypt 해시로 저장하고 OAuth 전용 계정은 `password_hash` 를 NULL 로 둔다.
- REQ-SIGNIN-004 IF 로그인이 5번 연속 실패하면 THE SYSTEM SHALL 계정을 10분 동안 잠그고 `ACCOUNT_LOCKED` 로 거부한다.
- REQ-SIGNIN-005 IF 계정이 잠기면 THE SYSTEM SHALL 이메일 알림을 보내지 않고 로그인 이력과 `ACCOUNT_LOCKED` 에러 코드로만 알린다.
- REQ-SIGNIN-006 WHEN 이메일 인증·비밀번호 재설정·이메일 변경 토큰을 발급하면 THE SYSTEM SHALL 원래 토큰은 메일 링크로만 보내고 DB 에는 SHA-256 해시만 저장한다.
- REQ-SIGNIN-007 WHEN 읽기 전용이 아닌 가입 폼 이메일 입력란에서 포커스가 빠지면 THE SYSTEM SHALL 형식을 검사하고 `POST /api/auth/check-email` 로 중복 여부를 확인한다.
- REQ-SIGNIN-008 IF 가입 폼의 약관 동의가 체크되지 않았으면 THE SYSTEM SHALL 가입 버튼을 비활성화한다.
- REQ-SIGNIN-009 WHILE 사용자가 비밀번호를 입력하는 동안 THE SYSTEM SHALL 5단계 비밀번호 강도 바를 보여 준다.
- REQ-SIGNIN-010 WHEN 초대 토큰 없이 가입이 성공하면 THE SYSTEM SHALL 토큰을 발급하지 않고 이메일 인증 안내 화면으로 보낸다.
- REQ-SIGNIN-011 WHEN 사용자가 이메일 인증 링크를 열면 THE SYSTEM SHALL 24시간 안의 토큰인지 검증하고 개인 워크스페이스를 만든 뒤 자동 로그인해 대시보드로 보낸다.
- REQ-SIGNIN-012 WHEN 인증 메일 재발송을 요청받으면 THE SYSTEM SHALL 계정 존재·인증 여부와 상관없이 같은 응답을 주고 인증 전 계정에만 24시간짜리 인증 토큰을 다시 보낸다.
- REQ-SIGNIN-013 WHEN 사용자가 인증 안내 화면이나 재설정 안내 화면에서 재발송 버튼을 누르면 THE SYSTEM SHALL 60초 쿨다운을 적용한다.
- REQ-SIGNIN-014 IF 없는 이메일 · 비밀번호가 없는 계정 · 틀린 비밀번호로 로그인이 실패하면 THE SYSTEM SHALL 어느 경우인지 드러내지 않는 같은 문구를 보여 준다. (부분 구현)
- REQ-SIGNIN-015 WHEN Passkey 기능이 켜져 있고 로그인 1단계를 통과한 사용자에게 Passkey·보안 키가 1개 이상 있으면 THE SYSTEM SHALL `methods: ['webauthn']` 챌린지를 주고 TOTP 입력을 제공하지 않는다.
- REQ-SIGNIN-016 WHEN 로그인 1단계를 통과한 사용자에게 Passkey 가 없고 TOTP 가 켜져 있으면 THE SYSTEM SHALL `methods: ['totp']` 챌린지를 준다.
- REQ-SIGNIN-017 WHEN 로그인 1단계를 통과한 사용자에게 2단계 인증이 없으면 THE SYSTEM SHALL 바로 액세스 토큰을 발급한다.
- REQ-SIGNIN-018 IF Passkey 인증이 실패하면 THE SYSTEM SHALL 같은 화면에서 Passkey 복구 코드 입력만 제공하고 TOTP 화면으로 자동 전환하지 않는다.
- REQ-SIGNIN-019 WHEN 클라이언트가 로그인 응답을 받으면 THE SYSTEM SHALL `requires2fa` 와 `methods[0]` 만 보고 2단계 화면을 고른다.
- REQ-SIGNIN-020 WHEN TOTP 활성화 검증이 성공하면 THE SYSTEM SHALL TOTP 복구 코드 10개를 한 번만 평문으로 보여 주고 SHA-256 해시로 저장한다.
- REQ-SIGNIN-021 WHEN 사용자가 첫 Passkey 를 등록하면 THE SYSTEM SHALL TOTP 복구 코드와 분리된 Passkey 복구 코드 10개를 한 번만 평문으로 보여 준다.
- REQ-SIGNIN-022 WHEN 복구 코드로 2단계 인증을 통과하면 THE SYSTEM SHALL 그 코드를 해당 코드 묶음에서 지운다.
- REQ-SIGNIN-023 WHEN 사용자가 TOTP 를 끄면 THE SYSTEM SHALL 비밀번호 재확인과 TOTP 코드 확인을 모두 통과한 뒤에만 TOTP secret 과 TOTP 복구 코드를 비운다.
- REQ-SIGNIN-024 WHEN 사용자가 마지막 Passkey 를 삭제하면 THE SYSTEM SHALL 애플리케이션 계층에서 Passkey 복구 코드를 NULL 로 비운다.
- REQ-SIGNIN-025 WHEN 사용자가 Passkey 복구 코드 재발급을 요청하면 THE SYSTEM SHALL 비밀번호 재확인 뒤 기존 미사용 코드를 버리고 10개를 새로 발급한다.
- REQ-SIGNIN-026 IF `WEBAUTHN_RP_ID`·`WEBAUTHN_ORIGIN` 이 설정되지 않았고 `WEBAUTHN_ALLOW_FALLBACK=1` 도 아니면 THE SYSTEM SHALL 부팅은 계속하되 가용성 조회(`GET /api/auth/2fa/webauthn/availability`)를 뺀 Passkey 엔드포인트를 모두 503 `WEBAUTHN_DISABLED` 로 응답한다.
- REQ-SIGNIN-027 WHILE Passkey 기능이 꺼져 있는 동안 THE SYSTEM SHALL 로그인에서 `methods: ['webauthn']` 챌린지를 주지 않고 TOTP 가 켜진 사용자에게 `methods: ['totp']` 챌린지를 주며 저장된 credential 행은 보존한다.
- REQ-SIGNIN-028 IF 처음 쓰는 Passkey 인증 챌린지로 온 인증 응답이 서명 검증을 통과했는데 sign counter 가 저장값 이하이면(저장값과 응답 값이 모두 0 인 경우는 뺀다) THE SYSTEM SHALL 그 credential 행을 즉시 삭제하고 사용자의 활성 리프레시 토큰을 모두 무효화한다. (부분 구현)
- REQ-SIGNIN-029 IF sign counter 역행으로 credential 을 삭제하면 THE SYSTEM SHALL 로그인 이력에 `webauthn_failed`(`failure_reason=WEBAUTHN_COUNTER_REGRESSION`)를 남긴다.
- REQ-SIGNIN-030 WHEN 같은 Passkey 인증 챌린지로 인증 검증 요청이 동시에 오면 THE SYSTEM SHALL 한 요청만 서명 · counter 판정으로 보내고 나머지는 credential 을 지우지 않고 401 `WEBAUTHN_INVALID` 로 거부한다. (미구현)
- REQ-SIGNIN-031 WHEN 비밀번호 재설정을 요청받으면 THE SYSTEM SHALL 계정 존재·가입 경로와 상관없이 같은 응답을 주고 메일 발송 실패도 드러내지 않는다.
- REQ-SIGNIN-032 WHEN 이메일을 가진 사용자가 비밀번호 재설정을 요청하면 THE SYSTEM SHALL OAuth 전용 계정과 Passkey 보유 계정을 포함해 30분짜리 재설정 토큰을 메일로 보낸다.
- REQ-SIGNIN-033 WHEN 비밀번호 재설정이 성공하면 THE SYSTEM SHALL 그 사용자의 리프레시 토큰을 모두 무효화하고 새 로그인 세션 없이 로그인 화면으로 보낸다.
- REQ-SIGNIN-034 WHEN 비밀번호 재설정이 성공하면 THE SYSTEM SHALL Passkey credential 과 복구 코드를 그대로 보존한다.
- REQ-SIGNIN-035 IF 재설정 토큰이 만료됐거나 무효이면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부하고 화면에 재요청 링크를 보여 준다.
- REQ-SIGNIN-036 WHEN 재설정 토큰을 한 번 쓰면 THE SYSTEM SHALL 그 토큰을 바로 무효화한다.
- REQ-SIGNIN-037 WHEN 사용자가 이메일 변경을 시작하면 THE SYSTEM SHALL 비밀번호 또는 등록된 TOTP 로 계정 재인증을 요구한다.
- REQ-SIGNIN-038 IF 비밀번호도 TOTP 도 없는 OAuth 전용 계정이 이메일 변경을 시작하면 THE SYSTEM SHALL Passkey 등록 여부와 상관없이 403 `REAUTH_NOT_AVAILABLE` 로 막는다.
- REQ-SIGNIN-039 WHEN 이메일 변경을 시작하면 THE SYSTEM SHALL 새 이메일로만 1시간짜리 확인 메일을 보내고 옛 이메일 확인을 차단 조건으로 쓰지 않는다.
- REQ-SIGNIN-040 WHEN 이메일 변경 확인 토큰을 소비하면 THE SYSTEM SHALL 본인의 로그인 세션에서 온 요청만 받는다.
- REQ-SIGNIN-041 WHEN 이메일 변경이 확정되면 THE SYSTEM SHALL 모든 로그인 세션을 무효화하고 현재 기기에 새 로그인 세션을 발급한다.
- REQ-SIGNIN-042 WHEN 이메일 변경이 확정되면 THE SYSTEM SHALL 옛 이메일에 보안 통지를 보내고 발송 실패는 무시한다.
- REQ-SIGNIN-043 WHEN 이메일 변경이 확정되면 THE SYSTEM SHALL 감사 로그 `user.email_changed` 를 남기되 details 에 원래 이메일 값을 담지 않는다.
- REQ-SIGNIN-044 IF 새 이메일을 다른 계정이 쓰고 있으면 THE SYSTEM SHALL 409 `RESOURCE_CONFLICT` 로 거부한다.
- REQ-SIGNIN-045 IF 이메일 변경 시작 단계의 확인 메일 발송이 실패하면 THE SYSTEM SHALL 대기 중 변경 정보를 지우고 에러를 돌려준다.
- REQ-SIGNIN-046 IF 확인 메일 재발송이 실패하면 THE SYSTEM SHALL 새로 만든 토큰을 유지해 재발송으로 복구할 수 있게 한다.
- REQ-SIGNIN-047 WHEN 대기 중 이메일 변경이 있는 상태에서 다시 요청하면 THE SYSTEM SHALL 기존 토큰을 덮어써 유효한 토큰을 0~1개로 유지한다.
- REQ-SIGNIN-048 WHEN 가입·로그인 화면을 열면 THE SYSTEM SHALL 자격 증명이 설정된 OAuth 제공자만 소셜 로그인 버튼으로 보여 준다.
- REQ-SIGNIN-049 IF 활성 OAuth 제공자 목록 조회가 실패하면 THE SYSTEM SHALL 빈 목록으로 처리해 소셜 로그인 UI 를 숨긴다.
- REQ-SIGNIN-050 WHEN 소셜 로그인 이메일이 기존 계정 이메일과 같으면 THE SYSTEM SHALL 그 계정에 OAuth 제공자 정보를 연결한다.
- REQ-SIGNIN-051 WHEN 사용자가 처음 소셜 로그인하면 THE SYSTEM SHALL 자동으로 가입시키고 개인 워크스페이스를 만든다.
- REQ-SIGNIN-052 WHEN OAuth 콜백을 받으면 THE SYSTEM SHALL 서버가 발급한 `state` 를 한 번만 소비해 검증한다.
- REQ-SIGNIN-053 WHEN 소셜 로그인이 성공하면 THE SYSTEM SHALL 액세스 토큰을 URL 에 싣지 않고 리프레시 토큰만 쿠키로 설정한 뒤 `/callback?success=true` 로 보낸다.
- REQ-SIGNIN-054 IF OAuth 흐름이 실패하면 THE SYSTEM SHALL `/callback?error=<code>` 로 보내 에러 메시지와 다시 시도 버튼을 보여 준다.
- REQ-SIGNIN-055 IF 셀프 호스팅 운영자가 추가 인증 방식을 선택하면 THE SYSTEM SHALL LDAP·Active Directory 와 SAML 2.0 인증을 제공한다. (미구현)
- REQ-SIGNIN-056 WHEN TOTP 끄기 요청의 코드를 확인하면 THE SYSTEM SHALL 로그인 2단계와 같은 규칙으로 인증 앱의 6자리 코드나 TOTP 복구 코드를 받는다.
- REQ-SIGNIN-057 IF TOTP 끄기 요청의 코드가 맞지 않거나 TOTP 가 켜져 있지 않으면 THE SYSTEM SHALL 401 `TOTP_INVALID` 로 거부하고 2단계 인증 상태를 바꾸지 않는다.
- REQ-SIGNIN-058 WHEN 사용자가 TOTP 를 끄면 THE SYSTEM SHALL Passkey credential 과 Passkey 복구 코드를 그대로 둔다.
- REQ-SIGNIN-059 WHEN TOTP 끄기 요청을 받으면 THE SYSTEM SHALL 사용자당 분당 10회로 요청을 제한한다.
- REQ-SIGNIN-060 IF Passkey 등록 검증에서 credential 공개 키의 알고리즘이 EdDSA(`-8`) · ES256(`-7`) · RS256(`-257`) 밖이면 THE SYSTEM SHALL 400 `WEBAUTHN_VERIFY_FAILED` 로 거부하고 credential 을 만들지 않는다.
- REQ-SIGNIN-061 IF Passkey 등록 검증 요청에 transport 목록 필드(`response.response.transports`)가 있는데 그 값이 문자열 배열이 아니거나(`null` 포함) NUL 문자(`\u0000`)가 든 문자열이 있으면 THE SYSTEM SHALL 400 `WEBAUTHN_VERIFY_FAILED` 로 거부하고 credential 을 만들지 않는다.
- REQ-SIGNIN-062 WHEN Passkey 등록 검증이 성공하면 THE SYSTEM SHALL 클라이언트가 보낸 transport 문자열을 표준 값이 아니어도 바꾸거나 빼지 않고 저장한다.
- REQ-SIGNIN-063 IF Passkey 등록 검증 요청이나 Passkey 이름 변경 요청의 표시 이름(`deviceName`)이 유니코드 코드 포인트 100개를 넘거나 NUL 문자(`\u0000`)가 들어 있으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부하고 credential 을 만들거나 이름을 바꾸지 않는다.
- REQ-SIGNIN-064 IF Passkey 이름 변경 요청의 표시 이름(`deviceName`)이 비었거나 공백 문자로만 돼 있으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부하고 이름을 바꾸지 않는다.
- REQ-SIGNIN-065 WHEN 로그인 요청을 받으면 THE SYSTEM SHALL 이메일 인증 여부를 비밀번호 확인 뒤에 확인한다. (미구현)
- REQ-SIGNIN-066 IF 비밀번호가 맞지만 이메일 인증을 마치지 않은 계정이 로그인하면 THE SYSTEM SHALL 토큰을 발급하지 않고 401 `EMAIL_VERIFICATION_REQUIRED` 로 거부한다. (미구현)
- REQ-SIGNIN-067 IF Passkey 기능이 꺼져 있는 동안 Passkey credential 이 1개 이상 있고 TOTP 가 꺼진 사용자가 로그인 1단계를 통과하면 THE SYSTEM SHALL 토큰을 발급하지 않고 503 `WEBAUTHN_DISABLED` 로 거부한다. (미구현)
- REQ-SIGNIN-068 WHEN 로그인 2단계 Passkey 인증 검증 요청을 받으면 THE SYSTEM SHALL 서명과 counter 를 판정하기 전에 그 요청의 Passkey 인증 챌린지(`optionsToken` 의 `challenge`)를 만료 시각까지 다시 쓰지 못하게 기록한다. (미구현)
- REQ-SIGNIN-069 IF 이미 인증 검증에 쓴 Passkey 인증 챌린지로 인증 검증 요청이 오면 THE SYSTEM SHALL credential 과 리프레시 토큰을 건드리지 않고 401 `WEBAUTHN_INVALID` 로 거부한다. (미구현)
- REQ-SIGNIN-070 IF Passkey 인증 응답이 서명 검증을 통과하지 못하면 THE SYSTEM SHALL counter 값과 상관없이 credential 을 지우지 않고 401 `WEBAUTHN_INVALID` 로 거부한다. (부분 구현)
- REQ-SIGNIN-071 IF Passkey 인증 검증이 실패하면 THE SYSTEM SHALL 같은 챌린지 토큰(`challengeToken`)으로 새 옵션을 받거나 Passkey 복구 코드로 통과할 수 있게 둔다.

## 인증 화면 공통

인증 화면은 사이드바 없는 전체 화면 레이아웃에 가운데 카드 하나를 둔다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 배경 | 화면 전체 | 제품 브랜드 색상 또는 그래디언트 | 현재 구현은 Shadcn neutral 그래디언트다 |
| 카드 | 화면 가운데 | 최대 너비 400px 카드 | 모바일에서는 전체 너비로 늘어난다 |
| 로고 | 카드 상단 | Full logo 변종 | 변종과 라이트·다크 선택은 [브랜드](../CLE-UI/CLE-UI-BRAND.md) 의 매트릭스를 따른다 |
| 폼 | 카드 본문 | 화면별 입력 폼 | 아래 각 절 |

인증 페이지는 Next.js route group `(auth)` 로 묶여 URL 에 `/auth` 접두사가 붙지 않는다. 실제 경로는 `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/callback` 이다. 이 문서에서 `/api/auth/...` 는 백엔드 API 경로이고 `/login` 같은 경로는 화면 경로다. 라우트 가드와 공개 경로 목록은 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다.

## 가입

### 가입 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목 | 카드 상단 | "Create your account" | 없음 |
| 입력 폼 | 제목 아래 | Name, Email, Password 입력란과 비밀번호 강도 바 | 아래 필드 검증 표 |
| 약관 동의 | 입력 폼 아래 | "I agree to Terms of Service" 체크박스 | 체크하지 않으면 가입 버튼 비활성 |
| 가입 버튼 | 약관 아래 | "Create Account" | 가입 요청 |
| 소셜 로그인 | 가입 버튼 아래 | "or continue with" 구분선, Google·GitHub 버튼 | [소셜 로그인](#소셜-로그인) 의 제공자 노출 규칙 |
| 로그인 링크 | 카드 하단 | "Already have an account? → Sign in" | 로그인 화면으로 이동. 초대 가입 화면에서는 초대 수락 페이지를 `redirect` 로 넘긴다([워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면)) |

### 필드 검증

| 필드 | 검증 규칙 | 실시간 피드백 |
| --- | --- | --- |
| Name | 필수, 2~50자 | 입력 즉시 |
| Email | 필수, 이메일 형식 | 포커스가 빠질 때 형식 검증과 `POST /api/auth/check-email` 중복 확인(가입 폼 `onBlur` 가 `checkEmailAvailability` 를 부른다). 초대 가입 화면은 이메일 입력란이 읽기 전용이라 이 확인을 하지 않는다. 그 화면의 가입 여부 확인은 [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면) 이 정한다 |
| Password | 필수, 8자 이상 100자 이하, 대문자·소문자·숫자·특수문자 중 3가지 이상 | 입력 중 강도 바 표시 |
| Terms | 필수 체크 | 체크하지 않으면 버튼 비활성 |

### 비밀번호 강도 바

8자 이상·소문자·대문자·숫자·특수문자 다섯 기준을 1점씩 더한 `score`(0~5)로 다섯 단계 라벨을 보여 준다(`codebase/frontend/src/lib/utils/password.ts`).

| 강도 라벨 (i18n key) | score | 색상 |
| --- | --- | --- |
| 약함 (`auth.register.strengthWeak`) | 0~1 | 빨강 (`bg-red-500`) |
| 보통 (`auth.register.strengthFair`) | 2 | 주황 |
| 양호 (`auth.register.strengthGood`) | 3 | 노랑 |
| 강함 (`auth.register.strengthStrong`) | 4 | 연초록 (`green-400`) |
| 매우 강함 (`auth.register.strengthVeryStrong`) | 5 | 진초록 (`green-600`) |

### 가입 처리

1. 클라이언트가 입력을 검증한다.
2. `POST /api/auth/register { name, email, password, termsAccepted, invitationToken? }` 을 호출한다. 서버는 `termsAccepted` 가 `true` 가 아니면 400 `VALIDATION_ERROR` 로 거부한다.
3. 초대 토큰 없는 가입이 성공하면 이메일 인증 안내 화면으로 이동한다. 서버는 사용자 행과 인증 메일만 만들고 토큰·쿠키·개인 워크스페이스는 만들지 않는다.
4. 실패하면 이메일 중복 같은 에러를 인라인으로 보여 준다.

`invitationToken` 을 담은 가입은 인증 메일 없이 한 트랜잭션에서 사용자와 멤버십을 만들고 바로 로그인한다. 이 경로의 화면과 규칙은 [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면) 이 정한다. 로그인하지 않은 기존 가입자가 초대 링크를 열면 가입 화면 대신 로그인 화면으로 보내는 규칙도 그 절에 있다. 초대 토큰 가입이 409 `RESOURCE_CONFLICT` 로 끝나면 4번처럼 에러를 보여 주지 않고 같은 로그인 화면으로 보낸다. 가입 여부 확인이 실패해 가입 폼을 띄운 기존 가입자가 이 경우다.

### 이메일 인증 안내 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목 | 카드 상단 | "Verify your email" | 없음 |
| 안내 | 제목 아래 | 인증 링크를 보낸 이메일 주소 | 없음 |
| 재발송 버튼 | 안내 아래 | "Resend Email" | `POST /api/auth/resend-verification` 호출, 60초 쿨다운(`RESEND_COOLDOWN_SECONDS = 60`, `verify-email-content.tsx`) |
| 로그인 링크 | 카드 하단 | "Back to login" | 로그인 화면으로 이동 |

- 인증 링크는 `?token=` 쿼리로 토큰을 전달한다. 인증 페이지는 그 토큰을 요청 본문에 담아 `POST /api/auth/verify-email { token }` 을 호출한다.
- 인증에 성공하면 자동 로그인하고 개인 워크스페이스를 만든 뒤 대시보드(`/dashboard`)로 보낸다. 개인 워크스페이스 생성 규칙은 [워크스페이스와 멤버](CLE-ACCT-WS.md) 가 정한다.
- 인증 토큰은 24시간 동안 유효하다.
- 인증 메일 재발송 API 는 IP 당 분당 5회로 제한하고 이메일 존재 여부를 드러내지 않는 같은 응답을 준다.

## 이메일·비밀번호 인증 규칙

| 항목 | 규칙 |
| --- | --- |
| 가입 | 이메일과 비밀번호로 가입한다. 이메일 인증이 필수다 |
| 비밀번호 정책 | 8자 이상, 대문자·소문자·숫자·특수문자 중 3가지 이상 조합 |
| 비밀번호 저장 | bcrypt(cost factor 12 이상). `user.password_hash` 는 nullable 이고 OAuth 전용 계정(OAuth-only account, `password_hash IS NULL`)은 NULL 이다 |
| 로그인 | 이메일과 비밀번호를 검증한 뒤 JWT 를 발급한다. 토큰 형태는 [세션과 토큰](CLE-ACCT-SESSION.md) |
| 비밀번호 분실 | 이메일로 30분짜리 재설정 링크를 보낸다. 이메일이 있는 모든 사용자에게 발급한다([비밀번호 재설정](#비밀번호-재설정)) |
| 로그인 실패 | 5회 연속 실패하면 10분 잠금. 이메일 알림은 없다 |
| 토큰 저장 | 이메일 인증 토큰(`emailVerifyToken`)·비밀번호 재설정 토큰(`passwordResetToken`)·이메일 변경 토큰(`emailChangeToken`)은 SHA-256 해시로만 저장한다. 원래 토큰은 메일 링크로만 전달하고 DB 에 두지 않는다. 검증할 때는 입력 토큰을 같은 해시로 바꿔 비교한다 |
| 인증 메일 재발송 | `POST /api/auth/resend-verification`. IP 당 분당 5회, 이메일 존재·인증 여부와 상관없이 같은 응답. 인증 전 계정에만 새 인증 토큰(24시간 유효)을 보낸다 |

계정 잠금(account lock, `ACCOUNT_LOCKED`)은 `login_attempts` 가 5에 이르면 `locked_until = now + 10분` 으로 건다. 잠긴 동안 로그인하면 401 `ACCOUNT_LOCKED` 를 돌려주고 로그인 이력에 `login_failed`(`failure_reason=ACCOUNT_LOCKED`)를 남긴다. 로그인이 성공하면 카운터와 잠금을 지운다. 상태 전이는 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 에 있다. IP 단위 요청 한도는 계정 잠금과 별개의 방어다. 한 IP 가 여러 계정을 도는 credential stuffing 은 요청 한도가 먼저 막고, 여러 IP 에서 한 계정을 노리는 공격은 계정 잠금이 막는다.

## 로그인

### 로그인 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목 | 카드 상단 | "Sign in to your account" | 없음 |
| 안내 | 제목 아래 | "Welcome back! Sign in to your account." | 복귀 경로(post-login return path)가 초대 수락 페이지면 초대 안내 문구로 바뀐다. 한국어는 "로그인하면 초대 수락 화면으로 이동해요.", 영어는 "Sign in to continue to the invitation." 이다. 복귀 경로는 [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION.md#로그인-뒤-이동) 이 정한다 |
| 입력 폼 | 안내 아래 | Email, Password 입력란 | 이메일 형식과 빈 비밀번호 검사 |
| 로그인 유지 | 입력 폼 아래 | "Remember me" 체크박스 | 리프레시 토큰 수명을 7일에서 30일로 늘린다([세션과 토큰](CLE-ACCT-SESSION.md)). 첫 토큰 회전 뒤 수명은 [세션과 토큰](CLE-ACCT-SESSION.md#미결-사항) 의 미결 사항이다(NERV Task `CLE-T-BYCGF1`) |
| 비밀번호 분실 링크 | 체크박스 옆 | "Forgot password?" | 비밀번호 재설정 화면으로 이동 |
| 로그인 버튼 | 폼 아래 | "Sign In" | 로그인 요청 |
| 소셜 로그인 | 버튼 아래 | "or continue with" 구분선, Google·GitHub 버튼 | [소셜 로그인](#소셜-로그인) |
| 가입 링크 | 카드 하단 | "Don't have an account? → Create account" | 가입 화면(`/register`)으로 이동한다. 로그인 화면이 받은 `redirect` 는 넘기지 않는다. 그래서 초대 수락 페이지에서 온 사용자가 이 링크로 가면 초대 문맥을 잃는다. 이 링크로 만든 계정은 이메일이 초대 이메일과 다르면 그 초대를 수락할 수 없기 때문이다([워크스페이스와 멤버 「초대 수락·가입 때 이메일 일치를 강제한다」](CLE-ACCT-WS.md#초대-수락가입-때-이메일-일치를-강제한다)) |

### 로그인 처리

1. 이메일 형식과 비밀번호가 비어 있지 않은지 검사한다.
2. `POST /api/auth/login { email, password, rememberMe }` 을 호출한다.
3. 서버는 없는 이메일 → 계정 잠금 → 비밀번호 없음(OAuth 전용) → 비밀번호 불일치 → 이메일 인증 전 순서로 확인한다. 여기까지가 로그인 1단계다. 이메일 인증 여부는 비밀번호가 맞을 때만 알린다.
4. 2단계 인증이 없으면 서버는 `{ accessToken }` 과 리프레시 토큰 쿠키를 돌려준다. 응답 본문에 `user` 객체는 없다. 화면은 [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION.md#로그인-뒤-이동) 이 정한 곳으로 이동한다.
5. 2단계 인증이 있으면 서버는 `{ requires2fa, methods, challengeToken }` 을 돌려주고 화면은 2단계 인증 화면으로 이동한다.
6. 없는 이메일 · 비밀번호가 없는 계정 · 틀린 비밀번호면 "Invalid email or password" 를 보여 준다. 어느 경우인지는 드러내지 않는다.
7. 비밀번호가 맞는 이메일 인증 전 계정이면 서버는 401 `EMAIL_VERIFICATION_REQUIRED` 와 "Please verify your email before logging in" 을 돌려준다. 화면은 이 코드를 보고 이메일 인증을 먼저 하라는 안내를 보여 준다.
8. 5회 실패로 잠기면 "Account locked. Try again in 10 minutes." 를 보여 준다.
9. Passkey 기능이 꺼진 서버에서 Passkey 만 등록하고 TOTP 가 꺼진 계정이 로그인 1단계를 통과하면 서버는 503 `WEBAUTHN_DISABLED` 를 돌려준다. 화면은 지금 Passkey 로 로그인할 수 없으니 운영자에게 문의하라는 안내를 보여 준다. 로그인 폼이 이 응답을 직접 처리한다. 컴포넌트가 처리한 에러는 화면 전체를 덮지 않으므로 서버 에러 페이지로 넘어가지 않는다([오류 화면과 빈 상태 「감지를 Next.js 에러 바운더리로 구현한 이유」](../CLE-UI/CLE-UI-ERRORS.md#감지를-nextjs-에러-바운더리로-구현한-이유)). 그 문서의 5xx 전체 화면 처리는 페이지까지 전파된 에러에 쓴다. 규칙은 [Passkey 기능 켜기와 환경 변수](#passkey-기능-켜기와-환경-변수) 에 있다.

3번의 순서와 7번 · 9번은 아직 구현되지 않았다. 지금 구현은 이메일 인증 여부를 비밀번호보다 먼저 확인해 비밀번호가 틀려도 `LOGIN_FAILED` 에 인증 안내 메시지를 실어 준다. Passkey 기능이 꺼지면 Passkey 만 등록한 계정도 비밀번호만으로 로그인시킨다. 앞의 것은 NERV Task `CLE-T-AYT4VB`, 뒤의 것은 `CLE-T-RFSJXQ` 가 맡는다. 화면이 응답 메시지를 읽지 못해 늘 일반 문구를 보여 주는 문제는 `CLE-T-MFWBE1` 이 맡는다.

로그인 화면에서 시작한 로그인은 2단계 인증과 복구 코드를 거쳐도 모두 [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION.md#로그인-뒤-이동) 이 정한 곳으로 이동한다. 소셜 로그인은 제공자를 거쳐 돌아오므로 [콜백 처리](#콜백-처리) 를 함께 본다.

### 2단계 인증 방식 선택

로그인 1단계를 통과하면 서버가 등록 상태를 보고 2단계를 고른다. Passkey·보안 키(WebAuthn, `WebAuthnCredential`)가 있으면 그것만 쓰고, 없을 때만 TOTP 를 쓴다. TOTP 로 자동 전환하지 않는 것이 핵심 규칙이다. 예외는 Passkey 기능이 꺼진 경우 하나다. 그때는 TOTP 가 켜진 사용자가 TOTP 로 로그인하고 Passkey 만 등록한 사용자는 503 `WEBAUTHN_DISABLED` 로 막힌다. 뒤의 것은 아직 구현되지 않았다([로그인 처리](#로그인-처리)).

```mermaid
flowchart TD
  A[로그인 1단계 통과] --> P{Passkey 기능 켜짐}
  P -- 예 --> B{Passkey credential 1개 이상}
  P -- 아니요 --> Q{two_factor_enabled}
  B -- 예 --> C[methods = webauthn 챌린지]
  B -- 아니요 --> D{two_factor_enabled}
  D -- 예 --> E[methods = totp 챌린지]
  D -- 아니요 --> F[액세스 토큰 즉시 발급]
  Q -- 예 --> E
  Q -- 아니요 --> R{Passkey credential 1개 이상}
  R -- 예 --> S[503 WEBAUTHN_DISABLED]
  R -- 아니요 --> F
  C --> G[Passkey 화면, TOTP 입력 없음]
  E --> H[TOTP 화면]
```

| 사용자 상태 | 응답 | 로그인 2단계 화면 |
| --- | --- | --- |
| Passkey 기능 켜짐, Passkey credential 1개 이상 | `{ requires2fa: true, methods: ['webauthn'], challengeToken }` | Passkey 인증 화면. TOTP 코드 입력란은 숨긴다 |
| Passkey 0개이고 `two_factor_enabled = true` | `{ requires2fa: true, methods: ['totp'], challengeToken }` | TOTP 입력 화면 |
| Passkey 기능 꺼짐, Passkey credential 1개 이상, `two_factor_enabled = true` | `{ requires2fa: true, methods: ['totp'], challengeToken }` | TOTP 입력 화면 |
| Passkey 기능 꺼짐, Passkey credential 1개 이상, `two_factor_enabled = false` | 503 `WEBAUTHN_DISABLED`(미구현) | 없음. 로그인 화면에 안내를 보여 준다 |
| 둘 다 없음 | `{ accessToken }` (즉시 로그인) | 없음 |

- Passkey 기능이 켜져 있으면 Passkey 가 하나라도 등록된 사용자에게 로그인 화면에서 TOTP 입력을 주지 않는다. TOTP 로 로그인하려면 보안 설정에서 Passkey 를 먼저 모두 삭제해야 한다.
- Passkey 인증이 실패하면 같은 화면의 "복구 코드 사용" 링크로 Passkey 전용 복구 코드 입력란을 연다. TOTP 화면으로 자동 전환하지 않는다.
- 클라이언트는 `requires2fa` 와 `methods` 만 본다. `requires2fa=true` 이면 챌린지 단계이고 `methods[0]` 으로 화면을 가른다. 로그인 응답에 `requiresTotp` 필드는 없다.
- 챌린지 토큰(`challengeToken`)은 로그인 1단계를 통과한 뒤 2단계 검증을 부를 때 쓰는 단기 토큰(`mfa_challenge` JWT)이다.

### TOTP 입력 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목·안내 | 카드 상단 | "Two-factor authentication", 인증 앱의 6자리 코드를 넣으라는 안내 | 없음 |
| 코드 입력 | 안내 아래 | 6칸 숫자 입력 | 한 칸을 채우면 다음 칸으로 포커스 이동 |
| 복구 코드 링크 | 입력 아래 | "Use a recovery code" | 단일 입력 필드로 바뀐다 |
| 버튼 | 카드 하단 | "Verify", "← Back" | 검증 요청, 로그인 화면으로 돌아가기 |

- `POST /api/auth/login/totp { challengeToken, code }` 로 검증한다. `code` 에는 6자리 코드나 TOTP 복구 코드를 넣는다.
- 성공하면 액세스 토큰과 리프레시 토큰을 발급하고 이동한다.
- 실패하면 "Invalid code. Please try again." 를 보여 주고 로그인 이력에 `totp_failed` 를 남긴다.

### Passkey 인증 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목·안내 | 카드 상단 | "Two-factor authentication", Passkey 나 보안 키로 로그인하라는 안내 | 없음 |
| 인증 버튼 | 안내 아래 | "Use Passkey / Key" | 브라우저 인증기 호출 |
| 복구 코드 링크 | 버튼 아래 | "Use a recovery code" | Passkey 복구 코드 입력란 표시 |
| 뒤로 | 카드 하단 | "← Back" | 로그인 화면으로 돌아가기 |

- 페이지가 열리면 자동으로 `navigator.credentials.get()` 흐름에 들어간다.
- `POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }` 로 `optionsToken` 과 요청 옵션을 받는다.
- 사용자가 인증기를 쓰면 `POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }` 를 호출한다.
- 실패하면 같은 화면의 "Use a recovery code" 링크로 입력란을 열고 `POST /api/auth/2fa/webauthn/recovery { challengeToken, code }` 를 호출한다.
- 브라우저가 WebAuthn 을 지원하지 않거나 인증기에 접근할 수 없으면 안내문과 복구 코드 입력 링크만 보여 준다.

## 2단계 인증

두 방식을 지원한다. 한 사용자가 둘 다 등록할 수 있고 등록은 서로 독립이다.

| 방식 | 설명 |
| --- | --- |
| TOTP | 인증 앱이 만드는 시간 기반 6자리 코드. Google Authenticator·Authy 같은 RFC 6238 클라이언트와 호환한다. QR 코드를 스캔하고 6자리 코드를 넣으면 켜진다. `two_factor_enabled` 는 TOTP 사용 여부만 뜻한다 |
| Passkey·보안 키 | FIDO2·WebAuthn 표준. `@simplewebauthn/server` 와 `@simplewebauthn/browser` 로 구현한다. 한 사용자가 모바일·데스크톱·보안 키처럼 credential 을 여러 개 등록할 수 있다 |

### 2단계 인증 설정 화면

보안 설정 화면은 `/profile/security` 이다. 내 프로필의 보안 카드에서 링크로 들어온다. 화면은 두 카드로 나뉜다.

| 카드 | 들어가는 요소 | 동작 |
| --- | --- | --- |
| TOTP | QR 코드, 확인 코드 입력, 복구 코드 표시, 끄기 폼(비밀번호와 인증 코드 입력) | 인증 앱으로 QR 을 스캔하고 코드를 넣어 켠다. 켜질 때 복구 코드 10개를 한 번 보여 준다. 끌 때는 비밀번호와 인증 코드를 함께 넣는다([TOTP 끄기](#totp-끄기)) |
| Passkey · 보안 키 | credential 목록(이름·transport·마지막 사용·등록일), 등록 버튼, 이름 변경·삭제, 복구 코드 재발급 | credential 을 여러 개 등록하고 관리한다. 첫 등록 때 별도 복구 코드 10개를 한 번 보여 준다. 이름 변경 입력이 비었거나 공백 문자로만 돼 있으면 저장 버튼을 막는다 |

- 프론트엔드는 보안 화면을 열 때 `GET /api/auth/2fa/webauthn/availability` 를 불러 Passkey 카드를 보일지 정한다.
- 비밀번호 재확인(password re-check, `verifyPasswordForUser`)의 에러 코드는 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다.
- OAuth 전용 계정이 유일한 2단계 인증 수단을 끌 때 대안 로그인 경로를 어떻게 보장할지는 아직 정하지 않았다. TOTP 끄기는 비밀번호를 먼저 확인하므로 OAuth 전용 계정은 비밀번호를 추가하기 전에는 TOTP 를 끌 수 없다. Passkey 삭제에는 따로 막는 로직이 없다. 강제 2단계 인증 정책·계정 복구 흐름과 함께 정할 별개 사안이다.

### TOTP 끄기

TOTP 를 끄려면 비밀번호와 인증 코드를 함께 넣는다. 인증 코드는 로그인 2단계와 같이 인증 앱의 6자리 코드나 TOTP 복구 코드다. TOTP 가 켜져 있으면 TOTP 카드에 비밀번호 입력란, 코드 입력란, 끄기 버튼이 보인다. 비밀번호가 8자보다 짧거나 코드가 비어 있으면 화면은 요청을 보내지 않고 안내를 띄운다.

서버는 `POST /api/auth/2fa/disable { password, code }` 를 다음 순서로 처리한다.

1. 본문을 검증한다. `password` 는 8자 이상, `code` 는 6~32자 문자열이다. 빠지거나 형식이 틀리면 400 `VALIDATION_ERROR` 다.
2. 비밀번호를 확인한다(`AuthService.verifyPasswordForUser`). 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀리면 401 `PASSWORD_INVALID` 다. 여기서 실패하면 코드는 확인하지 않는다.
3. 코드를 확인한다(`TotpService.verifyForDisable`). 로그인 2단계와 같은 `verifyForLogin` 을 쓴다. 복구 코드로 통과하면 로그인 때처럼 그 코드를 소비한다. 맞지 않으면 401 `TOTP_INVALID` 다. TOTP 가 켜져 있지 않을 때도 401 `TOTP_INVALID` 다.
4. TOTP 를 끈다. `two_factor_enabled` 를 false 로 바꾸고 TOTP secret 과 남은 TOTP 복구 코드를 NULL 로 비운다. 감사 로그 `user.2fa_disabled` 를 남기고 200 `{ ok: true }` 를 돌려준다.

- Passkey credential 과 Passkey 복구 코드는 건드리지 않는다. Passkey 복구 코드는 TOTP 복구 코드 묶음에 없으므로 코드 입력란에 넣으면 401 `TOTP_INVALID` 다.
- 요청은 사용자당 분당 10회로 제한한다(`SENSITIVE_ACTION_THROTTLE`). 비밀번호를 아는 사람이 6자리 코드를 추측하는 속도를 늦추기 위해서다.
- 코드 확인 실패는 로그인 이력에 남기지 않는다. 로그인 이력의 `totp_failed` 는 로그인 2단계 실패만 뜻한다.
- 화면은 비밀번호 실패와 코드 실패를 나누지 않고 같은 실패 안내를 보여 준다.
- OAuth 전용 계정은 비밀번호가 없어 2번에서 `PASSWORD_REQUIRED` 로 막힌다. [비밀번호 재설정](#비밀번호-재설정) 으로 비밀번호를 추가한 뒤 끈다.
- 켜진 상태의 setup/verify 가 닫히기 전까지는 로그인 세션을 가진 사람이 새 secret 으로 이 확인을 통과할 수 있다(NERV Task `CLE-T-94FTMV`). 이 문제는 [미결 사항](#미결-사항) 에 있다.

### 복구 코드

복구 코드(recovery code, `totp_recovery_codes`, `webauthn_recovery_codes`)는 2단계 인증 수단을 잃었을 때 쓰는 일회용 코드다. TOTP 와 Passkey 가 코드 묶음을 따로 쓴다.

| 항목 | TOTP | Passkey |
| --- | --- | --- |
| 발급 시점 | TOTP 활성화 검증 성공 시 | 첫 credential 등록 검증 성공 시 |
| 개수·형식 | 10개, `xxxx-xxxx-xxxx` | 10개, 같은 형식 |
| 저장 | `user.totp_recovery_codes`: SHA-256 해시 배열, 쓰면 항목 제거 | `user.webauthn_recovery_codes`: SHA-256 해시 배열, 쓰면 항목 제거. TOTP 와 분리 |
| 폐기 | TOTP 를 끄면 NULL | 사용자가 마지막 credential 을 삭제하면 NULL. counter 역행으로 서버가 지운 경우는 비우지 않는다. 사용자가 명시적으로 재발급할 수도 있다 |
| 사용 화면 | 로그인 2단계의 "복구 코드 사용" 링크, [TOTP 끄기](#totp-끄기) 의 코드 입력란 | 로그인 2단계의 "복구 코드 사용" 링크. 별도 코드 묶음에서 검증한다 |

두 묶음을 나누는 이유는 한쪽을 꺼도 다른 쪽 복구가 계속 유효하게 하기 위해서다. TOTP 쪽 복구 코드 재발급 API 는 없다. 끄고 다시 켜면 새로 발급된다. 인증 앱을 잃은 사용자도 TOTP 복구 코드로 TOTP 를 끈 뒤 다시 켤 수 있다.

counter 역행으로 마지막 credential 이 지워져도 Passkey 복구 코드는 남는다. 다음에 첫 Passkey 를 등록할 때 새 코드 10개로 바뀐다. 이렇게 두는 이유는 Rationale 「[counter 역행이면 credential 을 지운다](#counter-역행이면-credential-을-지운다-suspend-기각)」 에 있다.

### Passkey 기능 켜기와 환경 변수

Passkey 는 운영자가 환경 변수를 설정해야 켜지는 선택 기능이다. 셀프 호스팅 도메인이 SaaS 와 다르다는 전제 때문이다. 두 핵심 변수가 모두 있을 때만 켜지고 빠지면 자동 폴백하지 않는다. 운영 도메인과 어긋난 rpID 로 등록하면 이후 인증이 모두 실패해 사용자가 잠기기 때문이다. 설정은 `codebase/backend/src/common/config/webauthn.config.ts` 의 `registerAs('webauthn', ...)` 로 등록한다.

| 변수 | 용도 | 예 |
| --- | --- | --- |
| `WEBAUTHN_RP_ID` | Relying Party ID. 포트·스킴 없는 호스트명 | `clemvion.example.com` |
| `WEBAUTHN_RP_NAME` | 사용자 다이얼로그에 보일 이름. 선택, 기본 `Clemvion` | `Clemvion` |
| `WEBAUTHN_ORIGIN` | 콤마로 구분한 허용 origin 목록. 같은 RP 의 여러 origin 을 지원한다 | `https://clemvion.example.com,https://app.clemvion.example.com` |
| `WEBAUTHN_ALLOW_FALLBACK` | 선택. `1` 이면 `WEBAUTHN_RP_ID`·`WEBAUTHN_ORIGIN` 이 없어도 `FRONTEND_URL` 로 폴백해 켠다. 개발·로컬·시연 전용이고 운영에서는 쓰지 않는다 | `0` (기본) |

| 상태 | 조건 | 동작 |
| --- | --- | --- |
| 켜짐 (`enabled=true`) | 두 변수가 모두 있거나 `WEBAUTHN_ALLOW_FALLBACK=1` | 모든 Passkey 엔드포인트가 동작한다. 로그인 응답이 `methods=['webauthn']` 로 갈릴 수 있다 |
| 꺼짐 (`enabled=false`) | 변수가 없고 폴백도 허용하지 않음 | 부팅은 정상이고 warn 로그만 남긴다. 가용성 조회는 200 `{ enabled: false }` 를 돌려주고 나머지 Passkey 엔드포인트는 모두 `503 WEBAUTHN_DISABLED` 다. 로그인은 `methods: ['webauthn']` 챌린지를 주지 않는다. TOTP 가 켜진 사용자는 `methods=['totp']`, credential 이 있고 TOTP 가 꺼진 사용자는 503 `WEBAUTHN_DISABLED`(미구현), 둘 다 없는 사용자는 즉시 로그인이다([2단계 인증 방식 선택](#2단계-인증-방식-선택)). 프론트엔드는 availability 응답을 보고 Passkey UI 를 숨긴다 |

`GET /api/auth/2fa/webauthn/availability` 는 인증이 필요 없는 공개 GET 이고 응답은 `{ enabled: boolean }` 이다. 응답 봉투는 [API](#api) 첫머리의 규칙을 따른다.

운영자가 설정을 끈 상태에서 이미 credential 을 가진 사용자가 있으면 DB 행은 보존한다. 운영자가 변수를 다시 설정하면 그대로 다시 쓴다. 꺼져 있는 동안 TOTP 가 켜진 사용자는 TOTP 로 들어온다. Passkey 만 등록한 사용자는 운영자가 변수를 다시 설정할 때까지 비밀번호로 로그인하지 못한다. 비밀번호만으로 2단계 인증을 건너뛰게 두지 않기 위해서다. 소셜 로그인은 이 규칙 밖이다. 지금 구현은 기능이 꺼지면 credential 수를 0 으로 보고 이 사용자도 비밀번호만으로 로그인시킨다. 고치는 일은 NERV Task `CLE-T-RFSJXQ` 가 맡는다. 고칠 때 기능이 꺼진 동안의 TOTP 로그인(`POST /api/auth/login/totp`)이 `WEBAUTHN_REQUIRED` 로 막히지 않게 지금 동작을 유지한다.

### Passkey 등록·인증 흐름

등록은 `/profile/security` 의 "Passkey 등록" 에서 시작한다.

1. `POST /api/auth/2fa/webauthn/register/options` (JWT 필수). 서버가 `generateRegistrationOptions` 를 만들고 `optionsToken` JWT(`kind=webauthn_register`, 5분)를 함께 준다.
2. 클라이언트가 `navigator.credentials.create(options)` 를 호출한다.
3. `POST /api/auth/2fa/webauthn/register/verify { optionsToken, response, deviceName? }`. 서버가 `verifyRegistrationResponse` 로 검증하고 `webauthn_credential` 행을 만든다. 첫 등록이면 복구 코드 10개를 발급해 평문으로 한 번 돌려준다.

등록 옵션과 등록 검증은 같은 공개 키 알고리즘 목록만 받는다. 순서대로 EdDSA(`-8`) · ES256(`-7`) · RS256(`-257`)이다. 목록 밖 알고리즘의 공개 키로 만든 credential 은 등록 검증이 400 `WEBAUTHN_VERIFY_FAILED` 로 거부하고 저장하지 않는다. 인증 검증은 등록 때 저장한 공개 키의 알고리즘으로 검증한다.

등록 검증은 클라이언트가 보낸 transport 목록(`response.response.transports`)의 형식도 확인한다. 서버 라이브러리는 이 값을 검증하지 않고 그대로 돌려준다.

- 필드가 없으면 빈 목록으로 저장한다.
- 값이 문자열 배열이 아니면 400 `WEBAUTHN_VERIFY_FAILED` 로 거부하고 credential 을 만들지 않는다. `null` 이거나 배열이 아니거나 문자열이 아닌 항목이 섞인 경우다. 항목에 NUL 문자(`\u0000`)가 든 문자열이 있어도 같다. PostgreSQL `text` 에는 NUL 을 저장할 수 없기 때문이다.
- 문자열 배열이면 표준 값(`usb` · `nfc` · `ble` · `smart-card` · `hybrid` · `internal`)에 없는 값도 바꾸지 않고 저장한다.

등록 검증과 이름 변경(`PATCH /api/auth/2fa/webauthn/credentials/:id`)은 표시 이름(`deviceName`)의 형식을 같은 규칙으로 확인한다. 등록 검증에서는 이 필드를 빼도 된다. 이름 변경에서는 이 필드가 필수 문자열이다. 키를 빼거나 `null` 을 보내면 400 `VALIDATION_ERROR` 로 거부한다.

- 길이는 유니코드 코드 포인트로 세고 100개까지 받는다. 저장 컬럼은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 `webauthn_credential.device_name`(`varchar(100)`)이다. 서로게이트 쌍으로 된 이모지는 1개로 세고, 변형 선택자(U+FE0E · U+FE0F)는 앞 글자와 따로 1개로 센다. ZWJ(U+200D)로 이은 이모지와 피부색 수정자가 붙은 이모지는 화면에 한 글자로 보여도 코드 포인트 여러 개로 센다. 앞뒤 공백을 지우기 전의 값으로 센다.
- NUL 문자(`\u0000`)가 든 이름은 받지 않는다. PostgreSQL `varchar` 에는 NUL 을 저장할 수 없기 때문이다.
- 형식이 틀리면 400 `VALIDATION_ERROR` 로 거부한다. 등록 검증이면 credential 을 만들지 않고, 이름 변경이면 이름을 바꾸지 않는다.
- 이름 변경은 빈 문자열과 공백 문자로만 된 이름도 같은 코드로 거부한다. 공백 문자는 ECMAScript 의 공백 · 줄 끝 문자(`String.prototype.trim()` 이 지우는 문자)다. 제로폭 공백(U+200B)처럼 `trim()` 이 지우지 않는 문자는 공백 문자로 보지 않는다.
- 저장할 때는 앞뒤 공백 문자를 지운다. 등록 검증에서 이름을 뺐거나 지운 결과가 빈 문자열이면 이름 없음(`device_name` NULL)으로 저장한다. 그래서 `device_name` 에는 빈 문자열이 들어가지 않는다.
- 이미 저장된 빈 문자열 이름은 마이그레이션이 NULL 로 바꾼다. 마이그레이션 파일은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 의 「구현 위치」에 있다.

로그인 2단계 인증은 다음 순서다.

1. `POST /api/auth/2fa/webauthn/authenticate/options { challengeToken }`. 서버가 챌린지 토큰을 검증하고 `generateAuthenticationOptions` 와 `optionsToken`(`kind=webauthn_auth`, 5분)을 준다.
2. 클라이언트가 `navigator.credentials.get(options)` 를 호출한다.
3. `POST /api/auth/2fa/webauthn/authenticate/verify { challengeToken, optionsToken, response }`. 서버가 먼저 그 챌린지를 쓴 것으로 기록한다. 이미 쓴 챌린지면 401 `WEBAUTHN_INVALID` 로 거부한다. 이어서 `verifyAuthenticationResponse` 로 검증하고 counter 를 갱신한 뒤 액세스 토큰과 리프레시 토큰 쿠키를 발급한다.

복구 코드로 통과할 때는 `POST /api/auth/2fa/webauthn/recovery { challengeToken, code }` 를 부른다. 서버는 `webauthn_recovery_codes` 해시와 비교해 맞으면 그 항목을 지우고 JWT 를 발급한다.

챌린지는 stateless JWT(`optionsToken`)로 발급하고 별도 테이블에 두지 않는다. payload 는 `{ kind, sub, challenge, exp(5분) }` 이다.

로그인 2단계 인증의 챌린지는 한 번만 쓴다. 이 문서에서 Passkey 인증 챌린지는 `optionsToken`(`kind=webauthn_auth`)에 든 `challenge` 값을 말한다. 챌린지 토큰(`challengeToken`)이나 로그인 1단계 응답의 `methods: ['webauthn']` · `methods: ['totp']` 챌린지와는 다르다. 줄여서 「Passkey 챌린지」 라고 쓰지 않는다.

- 서버는 인증 검증 요청을 받으면 서명과 counter 를 판정하기 전에 그 챌린지를 만료 시각(`exp`)까지 쓴 것으로 기록한다.
- 기록은 여러 서버 인스턴스에서 원자적이다. 같은 챌린지로 동시에 온 요청 가운데 하나만 판정으로 간다.
- 이미 기록된 챌린지면 credential 과 리프레시 토큰을 건드리지 않고 401 `WEBAUTHN_INVALID` 로 거부한다.
- 검증 결과와 상관없이 기록한다. 챌린지 토큰은 기록하지 않는다. 그래서 검증이 실패해도 같은 챌린지 토큰으로 옵션을 다시 받거나 Passkey 복구 코드를 쓸 수 있다. 로그인 화면은 시도할 때마다 옵션을 새로 받는다(`login-form.tsx`).
- 등록 챌린지(`kind=webauthn_register`)는 이 규칙 밖이다.
- 기록을 담는 저장소는 구현 Task 가 정한다. Redis 키면 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에, 테이블이면 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 과 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 에 정의를 더한다. 저장소에 닿지 못할 때 검증을 막을지도 그때 정한다.

이 규칙은 아직 구현되지 않았다. 지금은 같은 챌린지를 만료 전까지 다시 쓸 수 있다. NERV Task `CLE-T-GK9J2B` 가 맡는다. 이유는 Rationale 「Passkey 인증 챌린지는 한 번만 쓴다」 에 있다.

### sign counter 역행과 동시성

처음 쓰는 Passkey 인증 챌린지로 온 응답이 서명 검증을 통과했는데 sign counter 가 역행했으면 서비스는 그 credential 행을 바로 지운다. suspend 컬럼은 두지 않는다. 이어서 그 사용자의 활성 리프레시 토큰을 모두 무효화해 복제한 공격자가 기존 토큰으로 계속 접근하지 못하게 한다. 로그인 이력에는 `webauthn_failed`(`failure_reason='WEBAUTHN_COUNTER_REGRESSION'`)를 남기고 401 `WEBAUTHN_COUNTER_REGRESSION` 으로 응답한다. 사용자가 같은 인증기를 다시 쓰려면 `/profile/security` 에서 다시 등록한다.

역행은 응답의 sign counter 가 저장값 이하인 경우다. 저장값과 응답 값이 모두 0 이면 counter 를 쓰지 않는 인증기로 보고 역행으로 판정하지 않는다. `@simplewebauthn/server` 의 판정과 같다.

서명 검증을 통과하지 못한 응답은 counter 값과 상관없이 401 `WEBAUTHN_INVALID` 이고 credential 을 지우지 않는다. 서명이 틀린 응답으로 지우면 그 사용자의 비밀번호만 아는 사람이 인증기 없이 credential 을 지우고 로그인 세션을 모두 끝낼 수 있기 때문이다. 지금 구현은 서명을 확인하기 전에 counter 역행으로 판정한다. NERV Task `CLE-T-NWHVMN` 이 고친다.

`verifyAuthentication` 은 credential 조회·검증·counter 갱신·역행 시 삭제·리프레시 토큰 무효화를 한 트랜잭션에서 처리한다. credential 행은 `SELECT ... FOR UPDATE` 로 잠근다. 같은 assertion 의 두 요청은 같은 챌린지를 쓰므로 챌린지 기록에서 한쪽만 이 트랜잭션에 들어가고 다른 쪽은 401 `WEBAUTHN_INVALID` 를 받는다. 다른 챌린지로 같은 credential 의 요청이 동시에 오면 한쪽이 잠금을 기다렸다가 갱신된 counter 를 읽는다. 지금 구현에는 챌린지 기록이 없다. 그래서 같은 assertion 의 두 번째 요청이 갱신된 counter 를 읽고 역행으로 처분된다. credential 이 지워지고 첫 요청이 받은 로그인 세션도 끝난다(NERV Task `CLE-T-GK9J2B`). 로그인 이력 기록은 트랜잭션 밖에서 호출해 기록 실패가 credential 삭제와 토큰 무효화 커밋을 막지 않게 한다.

## 비밀번호 재설정

`POST /api/auth/forgot-password` 와 `POST /api/auth/reset-password` 는 가입 경로(이메일·비밀번호, OAuth, Passkey 보유)와 상관없이 같게 동작한다.

| 사용자 상태 | 재설정 요청 | 재설정 실행 |
| --- | --- | --- |
| 이메일·비밀번호 가입 | 재설정 토큰 발급과 메일 발송 | `password_hash` 갱신, 모든 리프레시 토큰 무효화 |
| OAuth 전용 계정 | 같은 방식으로 토큰과 메일을 보낸다. 이메일 존재 노출을 막으면서 "비밀번호 추가" 경로 역할도 한다 | NULL 이던 `password_hash` 가 채워진다. 이후 이메일·비밀번호 로그인이 된다 |
| Passkey 보유 | 같음 | `password_hash` 만 바꾼다. credential 과 복구 코드는 보존한다. 다음 로그인은 비밀번호 뒤에 Passkey 2단계 인증(`methods: ['webauthn']`)을 거친다 |
| Passkey 보유, 복구 코드와 비밀번호 분실 | 재설정 뒤 비밀번호 단계는 통과하지만 Passkey 단계를 못 넘으면 로그인할 수 없다 | 운영자가 credential 을 지워 주는 개입 경로가 필요하다 |
| 토큰 만료(30분 경과) | 다시 요청할 수 있다 | 400 `VALIDATION_ERROR` |
| 없는 이메일 | 같은 응답("If an account exists...") | 없음 |

설계 원칙은 다음과 같다.

- 재설정 요청은 사용자 존재와 가입 경로에 상관없이 같은 응답(200 `{ message }`)을 준다. DB·메일 에러를 포함한 모든 실패를 드러내지 않는다.
- 비밀번호 재설정으로 Passkey credential 을 끄지 않는다. 비밀번호는 1단계 인증일 뿐이고 2단계의 신뢰 기반인 개인 키를 흔드는 사건이 아니다. 잃어버린 기기를 끄려면 사용자가 `/profile/security` 의 Passkey 카드에서 직접 삭제한다. credential 과 복구 코드를 모두 잃었으면 로그인할 수 없으므로 운영자 개입이 필요하다.
- 재설정이 성공하면 모든 활성 로그인 세션을 끝낸다. 탈취된 비밀번호 시나리오를 막기 위해서다. 새 로그인 세션은 발급하지 않고 로그인 화면으로 보낸다.
- 재설정 요청 API 는 IP 당 분당 5회로 제한한다.

### 재설정 화면

| 단계 | 화면 요소 | 동작 |
| --- | --- | --- |
| 1. 이메일 입력 | "Reset your password" 제목, 계정 이메일 입력란, "Send Reset Link" 버튼, "← Back to Sign In" 버튼 | `POST /api/auth/forgot-password { email }`. 성공과 실패 모두 같은 안내 화면으로 간다 |
| 2. 안내 | "Check your email" 제목, "If an account exists for {이메일}, we sent a password reset link." 안내, "Resend Email" 버튼, "← Back to Sign In" 버튼 | 재발송 버튼은 60초 쿨다운을 두고 `POST /api/auth/forgot-password` 를 다시 부른다(`forgot-password-form.tsx`) |
| 3. 새 비밀번호 입력 | 메일 링크로 연다. "Set new password" 제목, New Password 입력과 강도 바, Confirm Password 입력, "Reset Password" 버튼 | `POST /api/auth/reset-password { token, newPassword }` |

- 재설정이 성공하면 "Password updated. Sign in with your new password." 를 보여 주고 로그인 화면으로 이동한다.
- 토큰이 만료됐거나 무효하면 "This link has expired. Request a new one." 와 재요청 링크를 보여 준다.
- 재설정 토큰은 30분 동안 유효하고 쓰면 바로 무효가 된다.

로그인한 상태에서 현재 비밀번호를 알고 바꾸는 비밀번호 변경은 [내 프로필](CLE-ACCT-PROFILE.md) 이 정한다.

## 이메일 변경

로그인한 사용자가 자기 로그인 이메일을 바꾸는 별도 절차다. `/profile` 화면은 이메일을 읽기 전용으로 보여 주고 [변경하기 →] 로 전용 페이지 `/profile/change-email` 에 들어간다. 변경은 세 단계다.

1. 계정 재인증을 한다.
2. 새 이메일로 확인 메일을 보낸다.
3. 새 이메일의 링크를 눌러 확정한다.

```mermaid
sequenceDiagram
  participant U as 사용자
  participant S as 서버
  participant N as 새 이메일
  participant O as 옛 이메일
  U->>S: 변경 요청 (새 이메일, 비밀번호 또는 TOTP)
  S->>S: 계정 재인증, 형식과 중복 검사
  S->>N: 확인 메일 (1시간)
  U->>S: 확인 (본인의 로그인 세션, 토큰)
  S->>S: 이메일 교체, 모든 로그인 세션 무효화, 현재 기기 재발급
  S->>O: 보안 통지 (실패 무시)
```

### 핵심 규칙

- 계정 재인증(reauthentication, `verifyReauth`)을 거친 뒤 새 이메일만 확인한다. 변경을 시작할 때 세션 강제 종료와 같은 계정 재인증을 요구한다. 비밀번호가 있으면 비밀번호, 없으면 등록된 TOTP 코드로 확인한다. 확인 링크는 새 이메일로만 보낸다. 옛 이메일에는 막지 않는 보안 통지만 보낸다.
- 이메일 OTP 는 계정 재인증 수단으로 쓰지 않는다. 바꾸려는 메일함과 순환되기 때문이다. Passkey 로 하는 계정 재인증도 현재 지원하지 않는다.
- 계정 재인증 수단이 없는 계정은 막는다. 비밀번호도 TOTP 도 없는 OAuth 전용 계정은 Passkey 를 등록했어도 `REAUTH_NOT_AVAILABLE` 로 변경할 수 없다. 이 계정은 비밀번호나 TOTP 를 설정한 뒤 이메일을 바꿀 수 있다.
- 변경 확인 토큰(`emailChangeToken`)은 SHA-256 해시로만 저장하고 원래 토큰은 메일 링크로만 전달한다. 유효 시간은 1시간이다.
- 확인은 인증이 필요하다. 새 이메일의 확인 토큰은 본인의 로그인 세션에서 부른 `POST /api/users/me/email-change/verify` 로만 소비한다. 토큰이 사용자에 묶여 있어 새어 나간 링크만으로는 쓸모가 없다. 가입 인증 `verify-email`(`@Public`)보다 강한 가드다.
- 확인이 성공하면 비밀번호 변경과 같이 모든 로그인 세션을 무효화하고 현재 기기에 새 로그인 세션을 발급한다. 로그인 이력 `session_revoked`(일괄, `familyId=null`) 1건과 감사 로그 `user.email_changed` 1건이 함께 남는다. 로그인 세션 처리 이유는 [세션과 토큰](CLE-ACCT-SESSION.md) 에 있다.
- 기존 OAuth 제공자 연결은 제공자 계정 ID 기준이라 이메일 변경과 독립이다.

### 동작 표

| 사용자 상태 | 변경 요청 | 확인 |
| --- | --- | --- |
| 비밀번호 있음 | 비밀번호 재확인 뒤 `pending_email` 저장, 새 이메일로 1시간짜리 확인 메일 | `email = pending_email`, `email_verified=true`, 모든 로그인 세션 무효화, 현재 기기 재발급(`{ accessToken }`) |
| 비밀번호 없음, TOTP 있음 | TOTP 코드 재확인 뒤 같음 | 같음 |
| 비밀번호와 TOTP 모두 없음(Passkey 만 등록한 OAuth 전용 계정 포함) | 403 `REAUTH_NOT_AVAILABLE`. 변경할 수 없고 안내만 한다 | 없음 |
| 새 이메일이 현재 이메일과 같거나 형식이 틀림 | 400 `VALIDATION_ERROR` | 없음 |
| 새 이메일을 다른 계정이 씀 | 409 `RESOURCE_CONFLICT` (가입 중복과 같은 코드) | 트랜잭션 안에서 UNIQUE 를 다시 검사한다. 선점됐으면 409 를 주고 대기 정보를 NULL 로 지운다 |
| 토큰 만료(1시간 경과)나 무효 | 없음 | 400 `VALIDATION_ERROR` |

- 확정 뒤 옛 이메일 통지는 best-effort 이고 실패는 무시한다. 통지에는 "본인이 아니면 비밀번호 재설정으로 보안 조치" 안내가 들어간다.
- 대기 중 변경이 있을 때 다시 요청하면 기존 토큰을 덮어쓴다. 유효한 토큰은 항상 0~1개다.
- 취소(`email-change/cancel`)는 대기 중 변경이 없어도 멱등이다.
- 시작 단계(`request`)의 확인 메일 발송이 실패하면 대기 중 세 필드(`pending_email`, `email_change_token`, `email_change_expires_at`)를 NULL 로 되돌리고 에러를 전파한다. 사용자가 대기 정보 없이 깨끗하게 다시 시작하게 하기 위해서다.
- 재발송(`resend`)의 발송이 실패하면 새로 만든 토큰을 유지한다. 이미 진행 중인 변경을 발송 실패로 지우면 사용자 경험이 더 나빠지기 때문이다. 사용자는 재발송을 다시 불러 복구한다.

### 이메일 변경 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
| --- | --- | --- | --- |
| 제목·안내 | 상단 | "이메일 변경", 새 이메일로 확인 메일을 보내 변경을 마친다는 안내 | 없음 |
| 입력 | 안내 아래 | New email 입력, 계정 재인증 입력(비밀번호 또는 TOTP 코드, 계정 상태에 따라) | 없음 |
| 버튼 | 입력 아래 | [취소], [확인 메일 보내기] | 변경 요청 |
| 대기 표시 | 발송 뒤 | "new@example.com 으로 확인 메일을 보냈어요. 메일 링크로 변경을 완료하세요.", [재발송], [취소] | 재발송·취소 요청 |

이메일 변경 페이지는 `/profile/change-password` 와 같은 sub-route 진입형이다. 대기 중 상태는 이 페이지와 `/profile` 의 사용자 정보 카드에 [재발송]·[취소] 와 함께 보인다. `/profile` 이 대기 상태를 표시할 때 쓰는 `GET /api/users/me` 의 `pendingEmail` 필드는 [내 프로필](CLE-ACCT-PROFILE.md) 이 정한다.

## 소셜 로그인

| 제공자 | 설명 |
| --- | --- |
| Google | Google OAuth 2.0 |
| GitHub | GitHub OAuth Apps |

- 소셜 로그인 이메일이 기존 이메일 계정과 같으면 그 계정에 자동으로 연결한다. 연결은 `oauth_provider IS NULL` 조건부 갱신이라 이미 다른 제공자에 묶인 계정을 덮어쓰지 않는다. 연결할 때 `email_verified=true` 와 아바타 URL 도 함께 설정한다.
- 처음 소셜 로그인하면 자동으로 가입시키고 개인 워크스페이스를 만든다.
- 소셜 로그인은 통합의 OAuth 연결과 다른 흐름이다. 통합 쪽은 [OAuth 연결과 토큰 갱신](../CLE-INT/CLE-INT-OAUTH.md) 이 정한다.

### 제공자 노출

가입·로그인 화면을 열면 `GET /api/auth/oauth/providers` 로 자격 증명이 설정된 제공자 목록을 받는다.

| 응답 | UI 동작 |
| --- | --- |
| `{ providers: ["google", "github"] }` | "Or continue with" 구분선과 두 버튼을 모두 보여 준다 |
| 일부만 포함 (예: `["google"]`) | 해당 버튼만 한 칸으로 보여 준다 |
| 빈 배열 `[]` | 구분선과 버튼을 모두 숨기고 이메일·비밀번호 폼만 보여 준다 |

- 제공자는 `OAUTH_STUB_MODE=true`(개발) 이거나 `{PROVIDER}_CLIENT_ID` 환경 변수가 설정됐을 때 켜진다.
- 응답은 `Cache-Control: private, max-age=300` 으로 5분 캐시한다. Next.js Server Component `fetch` 의 `revalidate: 300` 과 맞췄다. 공유 캐시에 저장되지 않게 `private` 을 쓴다(`auth.controller.ts` 의 `@Header`).
- 이 API 호출이 실패하면 안전한 기본값인 빈 배열로 처리해 소셜 로그인 UI 를 숨긴다. 이메일·비밀번호 로그인은 그대로 된다.

### 흐름

```mermaid
sequenceDiagram
  participant C as 브라우저
  participant S as 서버
  participant P as OAuth 제공자
  C->>C: 로그인 화면이면 복귀 경로를 탭의 sessionStorage 에 저장
  C->>S: GET /api/auth/oauth/:provider
  S-->>C: 302 제공자 인증 URL (state 포함)
  C->>P: 인증 승인
  P-->>C: 302 /api/auth/oauth/:provider/callback?code&state
  C->>S: 콜백
  S->>S: state 소비·검증, 코드 교환, 프로필 조회, 사용자 조회 또는 생성
  S-->>C: 리프레시 토큰 쿠키 + 302 /callback?success=true
  C->>C: 복귀 경로를 꺼내고 지움
  C->>S: POST /api/auth/refresh
  S-->>C: 액세스 토큰
  C->>S: GET /api/users/me
  S-->>C: 사용자 정보
  C->>C: 로그인 상태 표시, 복귀 경로로 이동
```

| 단계 | 동작 |
| --- | --- |
| 1 | 사용자가 "Continue with Google/GitHub" 버튼을 누른다. 로그인 화면에서 누르면 복귀 경로를 이 탭의 sessionStorage 에 먼저 저장한다. 가입 화면에서 누르면 남은 값을 지운다([세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로)) |
| 2 | `GET /api/auth/oauth/:provider`. 로그인 화면은 `mode=login`, 가입 화면은 `mode=register` 를 붙인다. 서버가 `state` 를 담은 OAuth URL 을 만든다 |
| 3 | 브라우저를 같은 탭에서 제공자의 인증 페이지로 보낸다 |
| 4 | 사용자가 제공자에서 승인한다 |
| 5 | 제공자가 `GET /api/auth/oauth/:provider/callback?code=...&state=...` 로 보낸다 |
| 6 | 서버가 `code` 로 토큰을 교환하고 프로필을 조회한 뒤 사용자를 찾거나 만든다 |
| 7 | 리프레시 토큰을 쿠키로 설정하고 프론트엔드 콜백 URL 로 보낸다 |
| 8 | 프론트엔드 `/callback` 에서 액세스 토큰을 받고 복귀 경로로 이동한다([콜백 처리](#콜백-처리)) |

### 콜백 처리

| 단계 | 처리 |
| --- | --- |
| state 검증 | 서버가 발급한 state 인지 확인한다(CSRF 방지). state 는 10분 동안 유효하고 콜백에서 한 번만 소비한다 |
| 코드 교환 | `code` 를 제공자 토큰 엔드포인트에서 `access_token` 으로 바꾼다 |
| 프로필 조회 | `access_token` 으로 이메일·이름·아바타를 조회한다 |
| 사용자 매칭 | 제공자 ID 로 먼저 찾고, 없으면 이메일로 기존 사용자를 찾는다 |
| 기존 사용자 | OAuth 제공자 정보를 연결하고 로그인 처리한다 |
| 신규 사용자 | 자동 가입하고 개인 워크스페이스를 만든 뒤 로그인 처리한다 |
| 토큰 발급 | 리프레시 토큰만 HttpOnly 쿠키로 발급한다. 액세스 토큰은 콜백 페이지가 따로 받는다 |
| 리다이렉트 | `{frontend_url}/callback?success=true`. 액세스 토큰은 URL 에 싣지 않는다. 콜백 페이지가 리프레시 쿠키로 `POST /api/auth/refresh` 를 불러 액세스 토큰을 받아 메모리에 둔다. 복귀 경로도 URL 에 싣지 않는다. 콜백 페이지는 로그인 화면이 탭의 sessionStorage 에 저장해 둔 복귀 경로로 이동한다([세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로)) |

서버 시퀀스와 `auth_oauth_state` 테이블 동작은 [계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md) 에 있다.

### 에러 처리

| 에러 | 리다이렉트 |
| --- | --- |
| state 불일치(없음 · 만료 · 이미 소비 · 제공자 불일치) | `{frontend_url}/callback?error=invalid_state` |
| 코드 교환 실패 | `{frontend_url}/callback?error=token_exchange_failed` |
| 이메일 미제공 (GitHub 비공개 이메일 등) | `{frontend_url}/callback?error=email_required` |
| 서버 에러 | `{frontend_url}/callback?error=server_error` |

state 행이 없거나 만료됐거나 이미 소비됐으면 서비스는 400 `OAUTH_STATE_MISMATCH` 예외를 던진다. state 를 발급한 제공자와 콜백의 제공자가 달라도 같다. 로그인 콜백에서는 컨트롤러가 이 예외를 `?error=invalid_state` 리다이렉트로 바꾸므로 사용자는 400 응답을 받지 않는다.

`error=` 값은 응답 봉투의 `error.code` 가 아니라 리다이렉트 URL 쿼리 파라미터라서 `lower_snake_case` 다. 이 예외는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 예외 등록 코드 목록에 올라 있다.

프론트엔드 `/callback` 페이지는 다음처럼 동작한다.

- 페이지가 열리면 저장해 둔 복귀 경로를 꺼내고 바로 지운다. 성공과 실패에 상관없이 지운다. 저장과 검사 규칙은 [세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로) 가 정한다.
- `success=true` 이면 `refreshAccessToken()`(`POST /api/auth/refresh`)으로 액세스 토큰을 받아 메모리에 둔다. refresh 가 실패하면 에러를 보여 준다.
- 이어서 `GET /api/users/me` 로 사용자를 받아 로그인 상태로 표시한다. 비밀번호 로그인과 같이 이때 로그인 힌트 쿠키(`has_session`)가 심어진다([세션과 토큰 「로그인 힌트 쿠키」](CLE-ACCT-SESSION.md#로그인-힌트-쿠키)).
- 그다음 복귀 경로로 이동한다. 복귀 경로가 없거나 쓸 수 없을 때 갈 곳은 [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION.md#로그인-뒤-이동) 이 정한다.
- `error=*` 이면 에러 메시지, "다시 시도" 버튼, 로그인 화면 링크를 보여 준다. 둘 다 `/login` 으로 간다.
- 사용자 조회만 실패한 경우, 이 탭에서 sessionStorage 를 쓸 수 없는 경우, 실패 화면에서 다시 로그인하는 경우의 복귀 경로 처리는 [세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로) 를 따른다.

## 셀프 호스팅 추가 인증 (미구현)

아래 두 방식은 아직 구현하지 않았다. 백엔드에 LDAP·SAML 핸들러, passport strategy, 의존성이 없다. 셀프 호스팅 운영자를 위한 선택 기능으로 계획만 정했다. 후속 Task 로 추적한다.

| 방식 | 설명 |
| --- | --- |
| LDAP | LDAP·Active Directory 연결 (선택, 미구현) |
| SAML 2.0 | 기업 SSO 연결 (선택, 미구현) |

## API

이 문서가 소유하는 엔드포인트다. 로그아웃·토큰 갱신·로그인 세션 목록은 [세션과 토큰](CLE-ACCT-SESSION.md), 워크스페이스 전환·초대는 [워크스페이스와 멤버](CLE-ACCT-WS.md), 감사 로그 조회는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), 웹훅 수신 인증 설정(AuthConfig)의 CRUD·평문 보기 엔드포인트는 [외부 호출 인증 설정 §API](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#api) 가 정한다.

이 문서의 표와 본문에 적은 성공 응답은 응답 봉투 `{ data: … }` 안의 내용이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 5). 예를 들어 `GET /api/auth/2fa/webauthn/availability` 의 응답 `{ enabled: boolean }` 은 wire 에서 `{ "data": { "enabled": … } }` 다. 에러 응답 형식은 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 가 정한다.

### 가입과 로그인

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/register` | 가입. 인증 불요(`@Public`), IP 당 분당 10회. 본문 `{ name, email, password, termsAccepted, invitationToken? }`. `password` 는 8~100자다. `termsAccepted` 가 `true` 가 아니면 400 `VALIDATION_ERROR` 다. 초대 토큰이 없으면 사용자 행과 인증 메일만 만들고 토큰 없이 201 `{ message }` 를 준다. 활성화는 `verify-email` 에서 한다. 초대 토큰이 있으면 인증 메일 없이 바로 로그인하고 `{ message, accessToken }` 과 리프레시 쿠키를 준다. 개인 워크스페이스는 만들지 않는다([워크스페이스와 멤버](CLE-ACCT-WS.md)). 이메일이 이미 가입돼 있으면 409 `RESOURCE_CONFLICT`(메시지 `Email already registered`)다. 초대 가입 화면은 메시지가 아닌 `error.code` 로 이 경우를 가른다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 4). 이 응답을 전용 코드로 바꾸는 일은 NERV Task `CLE-T-2M6Q02` 가 맡는다 |
| POST | `/api/auth/verify-email` | 본문 `{ token }` 으로 이메일 인증 토큰을 검증한다. 개인 워크스페이스를 만들고 액세스·리프레시 토큰을 바로 발급한다. 인증 불요(`@Public`). 토큰이 무효하거나 만료되면 400 |
| POST | `/api/auth/resend-verification` | 인증 메일 재발송(24시간 유효). 인증 불요(`@Public`), IP 당 분당 5회. 계정 존재·인증 여부와 상관없이 같은 응답. 메일은 인증 전 계정에만 보낸다 |
| POST | `/api/auth/check-email` | 가입 전 이메일 사용 가능 여부 `{ available }`. 인증 불요(`@Public`), IP 당 분당 5회. 가입 폼 이메일 입력란의 중복 확인과 초대 가입 화면의 가입 여부 확인([워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면))에 쓴다. 초대 가입 화면은 이 응답을 5초까지만 기다린다. 저장된 이메일과 대소문자까지 같을 때만 `available: false` 다. 이메일 정규화는 NERV Task `CLE-T-SFWX84` 가 맡는다. 이 확인이 이메일 존재를 새로 드러내지 않는 이유는 [워크스페이스와 멤버 「가입 여부 확인은 이메일 존재를 새로 노출하지 않는다」](CLE-ACCT-WS.md#가입-여부-확인은-이메일-존재를-새로-노출하지-않는다) 에 있다 |
| POST | `/api/auth/login` | 로그인. IP 당 분당 10회. 본문 `{ email, password, rememberMe }`. 2단계 인증이 있으면 `{ requires2fa, methods, challengeToken }`, 없으면 `{ accessToken }` 과 리프레시 쿠키. 실패 401 `LOGIN_FAILED`, 비밀번호가 맞는 이메일 인증 전 계정 401 `EMAIL_VERIFICATION_REQUIRED`, 잠긴 계정 401 `ACCOUNT_LOCKED`, Passkey 기능이 꺼진 동안 Passkey 만 등록하고 TOTP 가 꺼진 계정 503 `WEBAUTHN_DISABLED`. 순서는 [로그인 처리](#로그인-처리). 이메일 인증 확인 순서와 `EMAIL_VERIFICATION_REQUIRED`, Passkey 기능이 꺼졌을 때의 503 은 아직 구현되지 않았다 |
| POST | `/api/auth/login/totp` | 로그인 2단계 TOTP 검증. 본문 `{ challengeToken, code }`(6자리 코드 또는 TOTP 복구 코드). 성공하면 액세스·리프레시 토큰 발급. 챌린지 토큰 무효 401 `CHALLENGE_INVALID`, TOTP 꺼짐 401 `TOTP_NOT_ENABLED`(Passkey 만 있는 계정 포함), TOTP 와 Passkey 가 모두 있는 계정 401 `WEBAUTHN_REQUIRED`, 코드 불일치 401 `TOTP_INVALID` |
| POST | `/api/auth/forgot-password` | 비밀번호 재설정 요청. IP 당 분당 5회. 항상 같은 응답 |
| POST | `/api/auth/reset-password` | 비밀번호 재설정. 본문 `{ token, newPassword }`. 실패는 모두 400 `VALIDATION_ERROR` 다. 지금 구현은 요청 형식이나 새 비밀번호의 길이 · 강도 규칙 위반에 `details` 를 싣고 토큰 무효 · 만료에는 싣지 않는다. 이 차이는 현재 동작이고 계약이 아니다. 클라이언트는 `details` 유무로 원인을 가르지 않는다([미결 사항](#미결-사항)). 새 비밀번호 검사가 토큰 조회보다 먼저다 |

### 2단계 인증

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/2fa/setup` | TOTP 설정 시작(인증 필수). secret 을 발급하고 QR data URL 을 돌려준다 |
| POST | `/api/auth/2fa/verify` | TOTP 활성화 검증(인증 필수). 켜고 TOTP 복구 코드 10개를 한 번 돌려준다 |
| POST | `/api/auth/2fa/disable` | TOTP 끄기. 인증 필수(JWT), 사용자당 분당 10회. 본문 `{ password, code }`. `code` 는 6~32자 문자열이고 로그인 2단계의 `code` 와 같이 인증 앱의 6자리 코드나 TOTP 복구 코드를 받는다. 비밀번호를 먼저 확인하고 이어서 코드를 확인한다. 성공하면 TOTP secret 과 TOTP 복구 코드를 비우고 200 `{ ok: true }`. 본문 누락·형식 에러 400 `VALIDATION_ERROR`, 비밀번호 실패 401 `PASSWORD_REQUIRED`·`PASSWORD_INVALID`, 코드 불일치·TOTP 꺼짐 401 `TOTP_INVALID`. 순서와 규칙은 [TOTP 끄기](#totp-끄기) |
| GET | `/api/auth/2fa/webauthn/availability` | Passkey 기능 켜짐 여부. 인증 불요(`@Public`). 응답 `{ enabled: boolean }` |
| POST | `/api/auth/2fa/webauthn/register/options` | Passkey 등록 옵션. 인증 필수(JWT). `optionsToken` JWT(`kind=webauthn_register`, 5분)를 함께 준다. 기능이 꺼져 있으면 503 `WEBAUTHN_DISABLED` |
| POST | `/api/auth/2fa/webauthn/register/verify` | Passkey 등록 검증. 인증 필수(JWT). credential 을 저장하고 첫 등록이면 복구 코드 10개를 평문으로 돌려준다. 이후에는 SHA-256 해시만 보관한다. 본문 `{ optionsToken, response, deviceName? }`. 실패 400 `WEBAUTHN_VERIFY_FAILED`, `optionsToken` 무효 400 `INVALID_OPTIONS_TOKEN`, 표시 이름 형식 에러 400 `VALIDATION_ERROR`([Passkey 등록·인증 흐름](#passkey-등록인증-흐름)) |
| POST | `/api/auth/2fa/webauthn/authenticate/options` | 로그인 2단계 Passkey 옵션. 인증 불요(`@Public`). 본문의 `challengeToken` 으로 사용자를 식별한다. `optionsToken`(`kind=webauthn_auth`)을 준다. 챌린지 검증 실패 401 `CHALLENGE_INVALID`, TOTP 챌린지로 받은 챌린지 토큰 401 `CHALLENGE_METHOD_MISMATCH` |
| POST | `/api/auth/2fa/webauthn/authenticate/verify` | 로그인 2단계 Passkey 검증. 인증 불요(`@Public`). `challengeToken` 과 `optionsToken` 을 함께 검증한다. 성공하면 액세스·리프레시 토큰 발급. 실패 401 `WEBAUTHN_INVALID`(서명 불일치, 이미 쓴 Passkey 인증 챌린지 포함. credential 을 지우지 않는다). 처음 쓰는 Passkey 인증 챌린지에서 서명이 맞는데 counter 가 역행하면 credential 행을 지우고 401 `WEBAUTHN_COUNTER_REGRESSION`, 로그인 이력 `webauthn_failed`(`failure_reason=WEBAUTHN_COUNTER_REGRESSION`). 챌린지 토큰 실패는 options 와 같다. 이미 쓴 챌린지 거부와 서명 확인 뒤의 counter 판정은 아직 구현되지 않았다([sign counter 역행과 동시성](#sign-counter-역행과-동시성)) |
| POST | `/api/auth/2fa/webauthn/recovery` | Passkey 복구 코드로 2단계 통과. 인증 불요(`@Public`). 본문 `{ challengeToken, code }`. 실패 401 `RECOVERY_CODE_INVALID`. 챌린지 토큰 실패는 options 와 같다 |
| GET | `/api/auth/2fa/webauthn/credentials` | 내 Passkey 목록. 인증 필수(JWT). 응답 `{ items: [{ id, deviceName, transports, lastUsedAt, createdAt }] }`. 페이지 없는 고정 컬렉션이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)). `publicKey`·`counter` 는 싣지 않는다 |
| PATCH | `/api/auth/2fa/webauthn/credentials/:id` | credential `device_name` 수정. 인증 필수(JWT). `:id` 는 UUID. 본문 `{ deviceName }`. 200 과 갱신된 행. 내 것이 아니면 404(존재 노출 방지). 이름이 비었거나 공백 문자로만 돼 있거나 형식이 틀리면 400 `VALIDATION_ERROR`([Passkey 등록·인증 흐름](#passkey-등록인증-흐름)) |
| DELETE | `/api/auth/2fa/webauthn/credentials/:id` | credential 삭제. 인증 필수(JWT). 마지막 credential 을 지우면 `WebAuthnService.deleteCredential` 이 `user.webauthn_recovery_codes` 를 NULL 로 바꾼다(DB 트리거가 아니다). 204 |
| POST | `/api/auth/2fa/webauthn/recovery-codes/regenerate` | Passkey 복구 코드 재발급. 인증 필수(JWT), 본문 `password` 로 비밀번호 재확인. 기존 미사용 코드를 버리고 10개를 새로 발급한다. TOTP 의 `/api/auth/2fa/disable` 과 같은 네임스페이스에 둔다 |

2단계 인증 활성화 API 는 `/api/auth/2fa/*` 만 있다. `/api/users/me/enable-2fa`·`/api/users/me/confirm-2fa` 같은 별칭 경로는 없다.

Passkey credential 목록 · 수정 · 삭제(`/api/auth/2fa/webauthn/credentials[/:id]`)는 본인 소유 자원 라우트지만 [HTTP API 규약](../CLE-API/CLE-API-CONV.md#22-명명-규칙) §2.2 의 `/api/auth/{action}` 예외에 드는 기존 예외다(2단계 인증 등록 · 해제 묶음).

### 소셜 로그인

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/auth/oauth/providers` | 자격 증명이 설정된 OAuth 제공자 목록. 인증 불요(`@Public`), `Cache-Control: private, max-age=300`. 비어 있으면 클라이언트가 소셜 로그인 UI 를 숨긴다 |
| GET | `/api/auth/oauth/:provider` | OAuth 시작. 쿼리 `mode`(`login` · `register`)와 `rememberMe` 를 state 와 함께 저장하고 제공자로 리다이렉트한다. `mode` 가 `register` 가 아니면 `login` 으로 본다. 복귀 경로는 받지 않는다([세션과 토큰 「소셜 로그인의 복귀 경로」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로)) |
| GET | `/api/auth/oauth/:provider/callback` | OAuth 콜백. 성공과 실패 모두 프론트엔드 `/callback` 으로 리다이렉트한다 |

### 이메일 변경

모두 JWT 인증이 필요하다. `users.controller.ts` 가 받아 `AuthService` 로 넘긴다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/users/me/email-change/request` | 이메일 변경 시작. 본문 `{ newEmail, password? \| totpCode? }`. 계정 재인증 필수(비밀번호 또는 등록 TOTP, Passkey 로 하는 계정 재인증은 미지원). 비밀번호도 TOTP 도 없는 계정은 Passkey 가 있어도 403 `REAUTH_NOT_AVAILABLE`. 새 이메일 형식·중복 검증 뒤 새 이메일로 1시간짜리 확인 메일을 보낸다. 분당 5회 |
| POST | `/api/users/me/email-change/verify` | 이메일 변경 확인. 본문 `{ token }`. 토큰을 검증한 뒤 `email` 교체, `email_verified=true`, 모든 로그인 세션 무효화, 현재 기기 재발급(`{ accessToken }` 과 리프레시 쿠키 회전), 옛 이메일 통지, 감사 로그 `user.email_changed`. 토큰 무효·만료 400 `VALIDATION_ERROR`, 새 이메일 선점 409 `RESOURCE_CONFLICT` |
| POST | `/api/users/me/email-change/resend` | 확인 메일 재발송. 대기 중인 새 이메일로 토큰을 다시 발급한다. 분당 5회. 대기 중 변경이 없으면 400 `VALIDATION_ERROR` |
| POST | `/api/users/me/email-change/cancel` | 진행 중인 이메일 변경 취소. 대기 필드를 NULL 로 지운다. 계정 재인증 불요, 대기 중 변경이 없어도 멱등 |

### 에러 코드

| 코드 | HTTP | 상황 |
| --- | --- | --- |
| `LOGIN_FAILED` | 401 | 로그인 실패. 없는 이메일, 비밀번호가 없는 계정(OAuth 전용), 비밀번호 불일치를 같은 코드와 같은 메시지로 거부한다. 로그인 이력 `failure_reason` 에는 각각 `USER_NOT_FOUND` · `PASSWORD_NOT_SET` · `INVALID_PASSWORD` 가 남는다([계정과 워크스페이스 데이터 흐름](CLE-ACCT-DATA.md)). 비밀번호가 맞는 이메일 인증 전 계정은 `EMAIL_VERIFICATION_REQUIRED` 다 |
| `EMAIL_VERIFICATION_REQUIRED` | 401 | 비밀번호는 맞지만 이메일 인증을 마치지 않은 계정의 로그인. 비밀번호가 틀리면 `LOGIN_FAILED` 다. 로그인 이력 `failure_reason` 은 `EMAIL_NOT_VERIFIED` 다. 화면은 이 코드로 이메일 인증 안내를 고른다. 아직 구현되지 않았다. 지금은 비밀번호를 확인하기 전에 `LOGIN_FAILED` 와 인증 안내 메시지로 거부한다([로그인 처리](#로그인-처리)) |
| `ACCOUNT_LOCKED` | 401 | 잠긴 계정으로 로그인 |
| `VALIDATION_ERROR` | 400 | 재설정·이메일 변경 토큰 만료·무효, 재설정의 새 비밀번호 길이·강도 미달, 새 이메일 형식 에러·현재 이메일과 같음, 대기 중 변경 없이 재발송, TOTP 끄기 본문의 `password`·`code` 누락이나 형식 에러, Passkey 표시 이름 형식 에러(코드 포인트 100개 초과 · NUL 문자, 이름 변경의 빈 이름 · 공백 문자로만 된 이름) |
| `RESOURCE_CONFLICT` | 409 | 가입 이메일 중복, 새 이메일 선점 |
| `REAUTH_NOT_AVAILABLE` | 403 | 계정 재인증 수단이 없는 계정(비밀번호도 TOTP 도 없음. Passkey 만 등록한 OAuth 전용 계정 포함)의 이메일 변경 |
| `PASSWORD_REQUIRED`, `PASSWORD_INVALID` | 401 | 2단계 인증 끄기·Passkey 복구 코드 재발급의 비밀번호 재확인 실패. 정의는 [세션과 토큰](CLE-ACCT-SESSION.md) |
| `TOTP_INVALID` | 401 | 로그인 TOTP 검증 실패, TOTP 끄기의 코드 불일치(TOTP 가 꺼져 있을 때 포함). 계정 재인증과 같은 코드를 쓴다 |
| `TOTP_NOT_ENABLED` | 401 | 로그인 2단계 TOTP 검증(`POST /api/auth/login/totp`)에서 사용자가 없거나 TOTP 가 꺼져 있다. Passkey 만 등록하고 TOTP 를 켜지 않은 계정도 이 코드다. 메시지는 다시 로그인하라고 안내한다 |
| `TOTP_NOT_INITIALIZED` | 400 | TOTP 활성화 검증(`POST /api/auth/2fa/verify`)을 설정 시작(`POST /api/auth/2fa/setup`) 없이 불러 secret 이 없다 |
| `WEBAUTHN_DISABLED` | 503 | Passkey 기능이 꺼져 있다. 가용성 조회를 뺀 Passkey 엔드포인트와, Passkey 만 등록하고 TOTP 가 꺼진 계정의 로그인(`POST /api/auth/login`)이 이 코드다. 운영자가 설정을 바꿀 때까지 회복되지 않으므로 재시도 대상이 아니다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 11). 로그인의 이 응답은 아직 구현되지 않았다 |
| `WEBAUTHN_VERIFY_FAILED` | 400 | Passkey 등록 검증 실패. 허용 목록 밖 알고리즘의 공개 키와 형식이 틀린 transport 목록(문자열 배열이 아니거나 NUL 문자가 든 경우)도 이 코드다 |
| `INVALID_OPTIONS_TOKEN` | 400 | `optionsToken` 무효 |
| `CHALLENGE_INVALID` | 401 | 로그인 2단계 챌린지 토큰이 만료 · 위조됐거나 챌린지 토큰이 아님. TOTP 검증과 Passkey 옵션 · 검증 · 복구 코드가 함께 쓴다 |
| `CHALLENGE_METHOD_MISMATCH` | 401 | TOTP 챌린지(`methods: ['totp']`)로 받은 챌린지 토큰을 Passkey 옵션 · 검증 · 복구 코드에 보냄 |
| `WEBAUTHN_INVALID` | 401 | Passkey 인증 실패. 서명이 맞지 않는 응답과 이미 쓴 Passkey 인증 챌린지로 온 검증도 이 코드이고 credential 을 지우지 않는다. 이 두 경우는 아직 구현되지 않았다([sign counter 역행과 동시성](#sign-counter-역행과-동시성)). counter 역행은 아래 `WEBAUTHN_COUNTER_REGRESSION` 이다 |
| `WEBAUTHN_COUNTER_REGRESSION` | 401 | 처음 쓰는 Passkey 인증 챌린지로 온 인증 응답이 서명 검증을 통과했는데 sign counter 가 저장값 이하로 돌아감(둘 다 0 이면 역행이 아니다). 그 credential 을 지우고 리프레시 토큰을 모두 무효화한 뒤 거부한다([sign counter 역행과 동시성](#sign-counter-역행과-동시성)) |
| `WEBAUTHN_REQUIRED` | 401 | TOTP 가 켜져 있고 Passkey 도 등록된 계정이 TOTP 로 로그인 2단계를 통과하려 함(`POST /api/auth/login/totp`). Passkey 만 있는 계정은 `TOTP_NOT_ENABLED` 를 받는다. Passkey 기능이 꺼져 있으면 나지 않는다 |
| `RECOVERY_CODE_INVALID` | 401 | Passkey 복구 코드 불일치 |
| `OAUTH_STATE_MISMATCH` | 400 | OAuth state 없음·만료·이미 소비, 다른 제공자가 발급한 state. 로그인 콜백에서는 컨트롤러가 이 응답 대신 `?error=invalid_state` 로 리다이렉트한다([에러 처리](#에러-처리)) |

전체 카탈로그와 등재 규칙은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 가 정한다.

## 미결 사항

- **TOTP 가 켜진 상태에서 설정을 다시 시작할 수 있다**: `POST /api/auth/2fa/setup` 과 `POST /api/auth/2fa/verify` 는 TOTP 가 이미 켜져 있는지 보지 않는다. setup 은 `two_factor_enabled` 를 그대로 둔 채 secret 을 새 값으로 바꾼다. 이어서 verify 를 부르면 TOTP 복구 코드도 새로 발급돼 기존 코드는 쓸 수 없게 된다. 두 요청 모두 로그인 세션만 있으면 된다. 그래서 비밀번호와 로그인 세션을 가진 사람은 setup 으로 받은 새 secret 의 코드로 [TOTP 끄기](#totp-끄기) 를 통과할 수 있다. 로그인 세션만 가진 사람도 원래 사용자의 인증 앱과 TOTP 복구 코드를 못 쓰게 만들 수 있다. 화면은 TOTP 가 켜져 있으면 설정 카드를 보여 주지 않지만 API 는 막지 않는다. 켜진 상태의 setup·verify 를 거부할지, 끄기와 같은 확인을 요구할지 정해야 한다. 후속 NERV Task `CLE-T-94FTMV` 로 추적한다.
- **Passkey 등록 저장의 원자성**: 등록 검증은 credential 저장과 첫 등록의 복구 코드 발급을 트랜잭션 없이 잇는다. 복구 코드 저장이 실패하면 복구 코드 없는 credential 이 남는다. 같은 사용자가 동시에 첫 등록을 하면 복구 코드 묶음이 서로 덮어쓴다. 같은 credential 을 동시에 등록하면 순차 중복의 409 `WEBAUTHN_CREDENTIAL_EXISTS` 대신 409 `RESOURCE_CONFLICT` 가 난다. `WEBAUTHN_CREDENTIAL_EXISTS` 는 이 문서의 에러 코드 표와 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)에 아직 없어서 등재도 함께 다룬다. 같은 미등재 코드 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 Passkey 인증 검증에서 401, credential 삭제 · 이름 변경에서 404 로 쓰인다. 인증 검증 행의 실패 코드에도 아직 적지 않았다. 후속 NERV Task `CLE-T-9KCQ7Y` 로 추적한다.
- **비밀번호 재설정 실패의 에러 코드**: 토큰 무효 · 만료와 새 비밀번호 규칙 위반이 모두 400 `VALIDATION_ERROR` 다. 사용자가 할 일은 다르다. 토큰 무효면 재설정 메일을 다시 받아야 하고 규칙 위반이면 비밀번호만 고치면 된다. 규약대로 가르려면 코드가 달라야 한다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6). 응답이 바뀌는 일이라 후속 NERV Task `CLE-T-DTVTM9` 에서 정한다.

## 구현 위치

- `codebase/backend/src/modules/auth/**` (가입·로그인·OAuth·TOTP)
- `codebase/backend/src/modules/auth/webauthn/**` (Passkey 서비스·엔티티·DTO·컨트롤러 파일)
- `codebase/backend/src/modules/mail/**` (인증·재설정·이메일 변경 메일)
- `codebase/backend/src/common/config/webauthn.config.ts`
- `codebase/backend/src/common/constants/throttle.ts` (`SENSITIVE_ACTION_THROTTLE`, TOTP 끄기 요청 한도)
- `codebase/backend/src/common/utils/postgres-text.ts` (표시 이름의 NUL 문자 · 코드 포인트 수 검증기)
- `codebase/backend/src/common/utils/postgres-text.spec.ts`, `codebase/backend/src/modules/auth/webauthn/dto/webauthn.dto.spec.ts` (표시 이름 검증기와 등록 검증 · 이름 변경 DTO 의 단위 테스트)
- `codebase/backend/test/totp-disable.e2e-spec.ts` (TOTP 끄기의 비밀번호·코드 확인과 DB 상태)
- `codebase/backend/test/webauthn-2fa.e2e-spec.ts` (Passkey 등록·인증, counter 역행, 등록 알고리즘 고정, transport 목록 형식, 표시 이름 형식, 이름 변경의 빈 이름 · 공백 문자로만 된 이름)
- `codebase/frontend/src/app/(auth)/**` (`callback/callback-content.tsx` 의 소셜 로그인 복귀 포함)
- `codebase/frontend/src/components/auth/**` (`register-form.tsx` · `login-form.tsx` 포함)
- `codebase/frontend/src/lib/auth/post-login-redirect.ts` (로그인 뒤 이동할 곳, 소셜 로그인의 복귀 경로 저장과 꺼내기, 초대 수락 페이지로 돌아오는 로그인 경로 `buildInvitationLoginHref`. 규칙은 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다)
- `codebase/frontend/src/lib/utils/password.ts`
- `codebase/frontend/src/lib/api/auth.ts`, `codebase/frontend/src/lib/api/auth-providers.ts`
- `codebase/frontend/src/app/(main)/w/[slug]/profile/change-email/**`, `codebase/frontend/src/app/(main)/w/[slug]/profile/security/**`

## Rationale

### 계정 잠금에 이메일 알림을 두지 않는다

원문 표가 한때 "5회 실패 시 10분 잠금, 이메일 알림" 이라고 적었지만 구현에는 알림이 없었다(2026-08-31 정정). 되살릴 요구사항이 아니라 표 문구가 틀린 것으로 판단했다. 근거는 다음 실측이다.

| 확인한 것 | 결과 |
| --- | --- |
| 인증 데이터 흐름의 잠금 절 | 잠금 동작을 자세히 적지만 알림 언급이 없다 |
| `users.service.ts` 잠금 설정부 | `MailService` 를 주입받지 않는다 |
| `MailService` 발송 메서드 6종 | verification·workspaceInvitation·passwordReset·emailChangeVerification·emailChangedNotice·notification. 잠금 알림이 없다 |
| 백엔드 전체의 잠금과 메일 연결 | 0건 |

사용자 통지는 로그인 이력과 `ACCOUNT_LOCKED` 에러 코드로 이미 설계돼 있다. 알림을 더하는 것은 별개 제품 결정이다.

### 이메일 변경: 옛 주소와 새 주소를 모두 확인하는 방식을 기각했다

옛 이메일 링크 클릭을 차단 조건으로 두면 옛 메일함을 잃은 사용자가 영원히 이메일을 바꾸지 못한다. 퇴사로 회사 메일을 잃거나 메일 서비스가 끝나는 경우가 이메일 변경의 주된 이유다. 옛 이메일의 두 역할 중 "통제 증명" 은 비밀번호나 TOTP 로 하는 계정 재인증이 메일함 소유보다 강하게 대신한다. 그래서 옛 이메일은 막지 않는 통지 채널로만 둔다. 결과적으로 두 주소를 모두 확인하는 방식보다 본인 증명이 강하고 복구성도 낫다.

기각한 대안은 두 가지다. (a) 옛 주소와 새 주소를 모두 링크로 확인하는 방식은 위 잠김 문제가 있다. (b) 계정 재인증 없이 새 주소만 확인하는 방식은 로그인 세션 탈취만으로 로그인 식별자를 바꿀 수 있게 한다.

### 이메일 변경 확인은 인증이 필요하다

가입 인증 `verify-email` 은 아직 로그인 세션이 없는 계정 활성화라 `@Public` 이다. 이메일 변경은 이미 로그인한 계정의 식별자를 바꾸는 동작이다. 확인 토큰을 인증된 사용자에 묶으면 새어 나간 링크만으로는 변경할 수 없다. 공격자가 그 사용자로 로그인해 있어야 한다. 비용은 다른 기기에서 링크를 열 때 옛 이메일로 한 번 로그인하는 것뿐이다. `@Public` 확인은 누구나 링크를 누르면 바로 커밋돼 링크가 새면 제3자가 피해자 이메일을 바꿀 수 있어 기각했다.

### 이메일 변경 토큰은 1시간 동안 유효하다

가입 인증 24시간(가입 직후 여유)과 비밀번호 재설정 30분(탈취 시나리오라 짧게) 사이로 정했다. 로그인한 상태에서 스스로 하는 동작이라 짧게 두되 새 메일함을 확인할 여유를 준다.

### 이메일 변경 재인증에서 이메일 OTP 를 뺀다

이메일 변경에서는 바꾸려는 메일함의 소유 자체가 증명 대상이다. 이메일 OTP 로 본인을 증명하면 공격자가 지정한 새 메일함의 OTP 로 통과하는 모순이 생긴다. 그래서 계정 재인증을 비밀번호나 TOTP 로 좁히고, 세션 강제 종료와 같은 `SessionsService.verifyReauth` 를 재사용한다. Passkey 로 하는 계정 재인증은 challenge·response 형태의 추가 인증 흐름이 필요해 `verifyReauth` 가 아직 지원하지 않는다. 그 일반화는 착수하지 않았고 별도 계획이 필요하다.

### 계정 재인증 수단이 없는 계정은 이메일 변경을 막는다

비밀번호도 TOTP 도 없는 OAuth 전용 계정은 본인을 다시 확인할 수단이 없다. Passkey 만 등록한 계정도 같다. Passkey 로 하는 계정 재인증을 지원하지 않기 때문이다. 이런 계정에 이메일 변경을 허용하면 로그인 세션 탈취만으로 로그인 식별자를 바꿔 계정을 빼앗을 수 있다. 그래서 `REAUTH_NOT_AVAILABLE` 로 막고 안내만 한다. 강제 2단계 인증과 계정 복구 흐름은 별개 결정이다.

### `user.email_changed` 감사 details 에 이메일 값을 싣지 않는다

`user.email_changed` 는 변경을 확정한 요청의 현재 워크스페이스 관리자가 조회할 수 있다. 바꾸기 전후 주소를 details 에 넣으면 필요 이상으로 개인정보가 드러난다. 그래서 변경이 일어났다는 사실과 포렌식용 `ipAddress` 만 남긴다. 액션 이름 규칙은 [감사 action 명명](../CLE-OBS/CLE-OBS-AUDITNAME.md) 을 따른다.

### Passkey 라이브러리: `@simplewebauthn/server` 와 `@simplewebauthn/browser`

같은 메인테이너가 서버와 브라우저 모듈을 함께 관리한다. FIDO2 L3·WebAuthn 명세를 빨리 따라가고, 등록과 인증의 `generate`·`verify` 쌍이 대칭이라 코드가 단순하다. 서버 라이브러리가 origin·rpID·challenge 일관성 검증과 counter 역행 감지를 제공해 이 문서의 보안 요구를 그대로 만족한다.

서버와 브라우저 모두 v14 를 쓴다. `@simplewebauthn/server` 를 v13 에서 v14 로 올리면서 정한 것은 다음과 같다(2026-10-16, NERV Task `CLE-T-34HB5X`).

- 서버 v14 의 `engines` 는 Node 20 이상이다. 지금 런타임은 Node 26 이다.
- v14 는 양자 내성 암호(Post-Quantum Cryptography, PQC)를 지원하는 런타임에서 등록 옵션과 등록 검증의 기본 알고리즘 목록 맨 앞에 PQC 서명 알고리즘 ML-DSA 의 44 파라미터 세트(COSE 알고리즘 식별자 `-48`)를 넣는다. 지금 런타임인 Node 26 이 그 경우다. Node 는 이 Web Crypto 알고리즘을 아직 실험 기능으로 표시한다.
- 그래서 등록 옵션(`generateRegistrationOptions`)과 등록 검증(`verifyRegistrationResponse`)의 `supportedAlgorithmIDs` 를 v13 기본값인 EdDSA(`-8`) · ES256(`-7`) · RS256(`-257`)으로 고정한다. 옵션은 브라우저에 주는 안내이고 실제로 받는 알고리즘은 등록 검증이 정한다. 그래서 두 호출에 같은 목록을 준다. 인증 검증에는 이 목록이 없다.
- 기본 목록을 그대로 받는 안은 기각했다. ML-DSA 키로 등록한 credential 은 인증할 때마다 런타임의 실험 기능에 기댄다. 런타임을 바꾸거나 그 기능이 바뀌면 그 사용자가 로그인하지 못할 수 있다. PQC 도입은 런타임 지원이 안정된 뒤 따로 정한다.
- 등록 옵션만 고정하는 안도 기각했다. 옵션을 따르지 않는 클라이언트가 ML-DSA 키를 보내면 등록 검증이 받아들인다. 그래서 등록 검증도 목록 밖 알고리즘을 400 `WEBAUTHN_VERIFY_FAILED` 로 거부한다.
- v13 에 머무는 안도 기각했다. 14.0.0(2026-09-02) 뒤로 v13 라인 릴리스가 없고 그 뒤 수정은 모두 v14 릴리스로 나왔다.
- 이미 등록된 credential 은 v13 과 같은 알고리즘이라 그대로 인증된다. counter 역행을 알리는 에러 메시지도 v13 과 같아서 역행 감지가 그대로 동작한다.

### 등록 검증은 transport 목록의 형식만 확인하고 값은 거르지 않는다 (2026-10-16)

클라이언트가 보낸 transport 목록은 서버 라이브러리가 검증하지 않고 그대로 돌려준다. 서비스가 그 값을 확인 없이 `webauthn_credential.transports`(문자열 배열 컬럼)에 저장했다. 그래서 문자열 배열이 아닌 값 가운데 일부는 500 이 났다. `null` 은 빈 목록으로 저장되고 200 을 받았다. 숫자 항목은 문자열로 바뀌어 저장됐다. NERV Task `CLE-T-C5EWSD` 에서 아래처럼 정했다.

- 형식이 틀린 값은 등록 검증 실패로 본다. 브라우저의 `getTransports()` 는 문자열 배열만 돌려주므로 다른 형식은 클라이언트 결함이나 조작한 요청이다. 응답의 다른 필드가 틀렸을 때와 같은 400 `WEBAUTHN_VERIFY_FAILED` 를 쓰고 새 에러 코드를 두지 않는다.
- 요청 DTO 검증으로 400 `VALIDATION_ERROR` 를 내는 안은 기각했다. `response` 는 브라우저가 만든 객체를 통째로 받는 자리라 DTO 가 속을 검증하지 않는다. 같은 객체의 다른 필드가 틀리면 이미 `WEBAUTHN_VERIFY_FAILED` 라서 transport 만 다른 코드를 쓰면 같은 `response` 객체 안의 필드끼리 코드가 둘이 된다. `response` 밖의 최상위 입력 필드인 표시 이름은 이 범위가 아니다(2026-10-17, NERV Task `CLE-T-QJ7XN7`). 표시 이름이 `VALIDATION_ERROR` 를 쓰는 이유는 「[Passkey 표시 이름은 요청 DTO 에서 코드 포인트 수와 NUL 문자를 확인한다](#passkey-표시-이름은-요청-dto-에서-코드-포인트-수와-nul-문자를-확인한다-2026-10-17)」에 있다.
- 형식이 틀린 transport 목록과 허용 목록 밖 알고리즘은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 의 새 조건으로 보지 않는다. 클라이언트가 할 일이 다른 등록 검증 실패와 같기 때문이다. 그래서 새 코드를 만들지 않고 `WEBAUTHN_VERIFY_FAILED` 를 쓴다. 이 응답에는 `details` 를 싣지 않고 원인은 서버 로그에만 남긴다.
- 표준에 없는 값만 걸러 내는 안은 기각했다. WebAuthn Level 3 §2.1.1 에 따르면 열거 값은 문자열이고 RP 는 모르는 값도 처리해야 한다. §4 에는 credential record 의 transport 목록에서 항목을 바꾸거나 빼면 그 credential 을 쓰지 못할 수도 있다고 적혀 있다. 서버 v14 의 타입도 `string[]` 이다.
- 형식이 틀린 값을 빈 목록으로 바꿔 저장하는 안도 기각했다. 잘못된 요청을 성공으로 받으면 클라이언트 결함을 찾기 어렵다. 필드가 빠진 요청은 형식이 틀린 것으로 보지 않는다. 선택 필드가 빠진 것이라서 빈 목록으로 저장한다.
- `null` 은 필드가 빠진 것으로 보지 않고 400 으로 거부한다. 이전에는 빈 목록으로 저장하고 200 을 줬다. 브라우저의 `getTransports()` 는 `null` 을 돌려주지 않는다.
- NUL 문자가 든 항목만 빼고 나머지를 저장하는 안도 기각했다. 값을 바꾸지 않고 저장한다는 원칙을 지키려고 요청 전체를 거부한다.
- 개수와 길이 상한은 따로 두지 않는다. 이 엔드포인트의 요청 본문에는 전역 100KB 한도가 걸린다.

### Passkey 표시 이름은 요청 DTO 에서 코드 포인트 수와 NUL 문자를 확인한다 (2026-10-17)

표시 이름은 `webauthn_credential.device_name`(`varchar(100)`)에 들어간다. 요청 DTO 가 문자열인지와 `MaxLength(100)` 만 확인해서 저장할 수 없는 이름이 검증을 지나 500 이 났다(NERV Task `CLE-T-XYW44D`). 등록 검증과 이름 변경에서 모두 재현했다.

- NUL 문자가 든 이름은 PostgreSQL 이 `invalid byte sequence for encoding "UTF8": 0x00` 으로 거부했다.
- 변형 선택자가 붙은 101 코드 포인트 이름도 500 이었다. class-validator 의 `MaxLength` 는 앞 글자와 변형 선택자(U+FE0E · U+FE0F)를 한 글자로 세서 이 이름을 통과시켰다. PostgreSQL 은 코드 포인트로 세서 `value too long for type character varying(100)` 으로 거부했다.

결정과 기각한 안은 다음과 같다. `optionsToken` 과 함께 틀린 요청의 코드, 전용 에러 코드를 두지 않은 이유, `X-Workspace-Id` 선례는 NERV Task `CLE-T-QJ7XN7` 에서 더했다.

- 에러 코드는 `VALIDATION_ERROR` 다. 표시 이름은 사용자가 입력한 최상위 필드라서 요청 DTO 가 검증한다. transport 목록과 같은 `WEBAUTHN_VERIFY_FAILED` 를 쓰는 안은 기각했다. 그 코드는 인증기 응답의 검증 실패를 뜻하는데 표시 이름은 인증기 응답에 들지 않는다. transport 목록이 DTO 검증을 쓰지 않은 이유(브라우저가 만든 객체를 통째로 받는 자리)도 표시 이름에는 해당하지 않는다.
- 그래서 등록 검증 요청 하나에서 에러 코드는 필드가 있는 자리로 갈린다. 인증기 응답(`response`) 객체 안의 필드는 `WEBAUTHN_VERIFY_FAILED` 이고, 최상위 입력 필드인 표시 이름은 `VALIDATION_ERROR` 다. 요청 DTO 검증이 서비스 검증보다 먼저 돌아서 표시 이름과 `response` 안의 필드가 함께 틀린 요청은 `VALIDATION_ERROR` 를 받는다. `optionsToken` 의 서명 · 만료 확인(400 `INVALID_OPTIONS_TOKEN`)도 서비스가 하므로 표시 이름과 `optionsToken` 이 함께 틀린 요청도 `VALIDATION_ERROR` 다.
- 표시 이름 전용 에러 코드를 새로 두는 안은 기각했다. 표시 이름 형식 에러에서 클라이언트가 할 일은 다른 입력 검증 실패와 같이 그 필드를 고쳐 다시 보내는 것이다. 그래서 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md#규칙) 규칙 6 의 새 조건이 아니다. 어느 필드가 틀렸는지는 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md#23-도메인-세부-사유를-어디에-싣는가-top-level-code-교체와-detailscode) §2.3 · §2.5 에 따라 `details[]` 항목(`field: deviceName`, `code: INVALID_FIELD`)에 싣는다.
- 길이는 저장하는 쪽과 같은 단위인 코드 포인트로 센다. OpenAPI 스키마의 `maxLength` 도 코드 포인트로 세므로 API 문서와 서버의 기준이 같다. 화면의 이름 입력란은 `maxLength` 를 UTF-16 단위로 세서 이보다 엄격하다. 그래서 화면에서 입력한 이름은 이 규칙에 걸리지 않는다.
- 사람이 보는 글자(grapheme) 수로 세는 안은 기각했다. `varchar(100)` 은 코드 포인트로 세므로 grapheme 100개짜리 이름은 저장하지 못할 수 있다. ZWJ 로 이은 이모지는 한 글자로 보여도 코드 포인트가 여러 개다.
- NUL 문자를 지우고 저장하는 안은 기각했다. 사용자가 보낸 이름을 알리지 않고 바꾸게 된다. transport 목록에서 NUL 이 든 항목만 빼는 안을 기각한 이유와 같다.
- 전역 예외 필터에서 SQLSTATE 22021 · 22001 을 400 으로 바꾸는 안은 기각했다. 저장할 수 없는 값은 요청 입구에서 미리 거부한다는 기존 방식(`codebase/backend/src/common/utils/optional-non-null.ts`)과 맞지 않는다. [에러 코드 규약과 카탈로그 §6.4](../CLE-API/CLE-API-ERRCODES.md#64-유효성-검증) 의 `X-Workspace-Id` 형식 에러 행도 같은 방식이다. 형식이 깨진 헤더를 입구에서 거부하지 않으면 멤버십 조회에서 SQLSTATE 22P02 가 나고 500 `INTERNAL_ERROR` 로 가려지기 때문이다. 필터에서 바꾸면 어느 필드가 틀렸는지도 응답에 담을 수 없다.

### Passkey 이름 변경은 공백 문자로만 된 이름을 거부한다 (2026-10-17)

이름 변경 DTO 는 빈 문자열만 거부했다(`MinLength(1)`). 공백 문자로만 된 이름은 검증을 지나 앞뒤 공백을 지운 빈 문자열로 저장됐다. 목록 화면은 이름이 NULL 일 때만 기본 문구를 보여 줘서 이 Passkey 의 이름이 빈 칸으로 보였다. 등록 검증은 같은 입력을 이름 없음(NULL)으로 저장한다. 그래서 이름이 없다는 같은 뜻의 값이 데이터베이스에 NULL 과 빈 문자열 두 가지로 갈렸다(NERV Task `CLE-T-SREW0S`). 화면은 공백 문자로만 된 이름이면 저장 버튼을 막으므로 API 를 직접 부를 때만 생기는 경우다.

결정과 기각한 안은 다음과 같다.

- 이름 변경은 공백 문자로만 된 이름을 빈 문자열과 같은 400 `VALIDATION_ERROR` 로 거부한다. 이름 변경은 이름을 바꾸는 요청이고 화면에는 이름을 지우는 기능이 없다.
- 이름 없음(NULL)으로 저장하는 안은 기각했다. 이름을 지우는 기능이 새로 생기는데 빈 문자열은 계속 거부하므로 같은 뜻의 두 입력이 다르게 처리된다. 빈 문자열까지 NULL 로 받으려면 빈 이름 거부 규칙을 바꿔야 한다.
- 등록 검증은 그대로 둔다. 표시 이름이 선택 필드라서 빈 이름과 공백 문자로만 된 이름은 이름을 주지 않은 요청과 같게 본다. 그래서 공백 문자로만 된 이름을 등록 검증은 받아 NULL 로 저장하고 이름 변경은 거부한다. 두 요청의 뜻이 달라서 생기는 의도한 차이다.
- 길이는 지금처럼 앞뒤 공백을 지우기 전 값으로 센다. 보낸 값을 그대로 검사해서 클라이언트가 지킬 규칙이 단순하다. 지운 뒤 값으로 세려면 두 DTO 에서 검증 전에 값을 바꿔야 한다. 이 기준 때문에 앞뒤 공백까지 합해 코드 포인트 100개를 넘는 이름은 지운 뒤 100개 이하여도 400 이다. NERV Task `CLE-T-XYW44D` 전에는 `MaxLength` 가 변형 선택자를 앞 글자와 묶어 세서 이런 이름 일부가 200 이었다.
- 앞뒤 공백 문자를 지우고 저장하는 것은 NUL 문자를 지우는 안을 기각한 이유(사용자가 보낸 이름을 알리지 않고 바꾸게 된다)의 예외로 둔다. 이름 가운데 글자는 그대로 두고 화면에 보이지 않는 앞뒤 공백만 지운다. 저장한 이름은 목록과 이름 변경 응답에 그대로 나온다.
- 공백 문자의 범위는 `trim()` 의 기준을 그대로 쓴다. 그래야 저장할 때 지우는 문자와 이름 변경이 거부하는 문자가 같다. 제로폭 공백(U+200B)처럼 `trim()` 이 지우지 않는 문자는 이번 결정의 범위 밖이고 지금처럼 받는다.
- 이미 저장된 빈 문자열 이름은 마이그레이션으로 NULL 로 바꾼다. 그러면 `device_name` 에 빈 문자열이 남지 않고 목록 화면에 기본 문구가 나온다. 화면이 빈 문자열도 기본 문구로 그리게 고치는 안은 기각했다. 같은 뜻의 값이 데이터베이스에 두 가지로 남는다.
- 마이그레이션은 `device_name` 이 빈 문자열인 행을 NULL 로 바꾸는 UPDATE 문 하나다. 바꾼 뒤에는 원래 빈 문자열이던 행과 원래 NULL 이던 행을 구분할 수 없어서 되돌리지 않는다. `-- DOWN:` 주석에 그 이유를 적는다.
- 빈 문자열을 막는 데이터베이스 CHECK 제약은 더하지 않는다. `device_name` 을 쓰는 경로는 등록 검증과 이름 변경 둘뿐이고 두 경로 모두 서버가 빈 문자열을 저장하지 않는다.

### 복구 코드 묶음을 TOTP 와 Passkey 로 나눈다

사용자가 한쪽 방식만 끄거나 다시 설정해도 다른 쪽 복구가 유지돼야 한다. 공통 묶음이면 TOTP 를 끌 때 Passkey 복구도 함께 버려야 하는지가 모호해진다. Passkey 만 쓰는 사용자에게도 TOTP 없이 복구 수단을 줘야 한다. 공통 묶음은 "TOTP 가 항상 켜져 있다" 는 가정에 기댄다. 컬럼 하나를 더하는 비용은 작다. PostgreSQL 은 NULL 컬럼에 공간을 거의 쓰지 않는다.

### Passkey 챌린지를 stateless JWT 로 둔다

이 절의 챌린지는 등록 · 인증 옵션 토큰(`optionsToken`)에 담는 `challenge` 값이다. WebAuthn 명세의 challenge unique·fresh 요건은 challenge 가 random 이고 검증 때 클라이언트 응답과 맞는지 확인하면 충족된다. 서버 DB 의 단명 행이 필수는 아니다. JWT 만료 5분과 `kind` 검증으로 등록·인증 흐름의 교차 사용을 막는다. 발급할 때는 행을 만들지 않으므로 발급 쪽에는 단명 행 정리 배치와 인덱스가 필요 없다. 다만 JWT 만으로는 같은 챌린지를 다시 쓰는 것을 막지 못한다. 그래서 Passkey 인증 챌린지는 쓴 기록을 따로 두고 그 기록은 만료 시각이 지나면 정리한다(「Passkey 인증 챌린지는 한 번만 쓴다」).

2026-10-17 정정(NERV Task `CLE-T-D331TT`): 이 절은 같은 5분 안에 같은 JWT 로 두 번째 검증을 시도해도 서버 라이브러리가 challenge·response 쌍의 암호학적 고유성으로 거부하고 counter 는 한 번만 오른다고 적었다. 라이브러리에는 쓴 챌린지를 기억하는 상태가 없어 그렇지 않았다. counter 를 올리는 인증기는 두 번째 검증이 counter 역행으로 처분됐다. counter 가 늘 0 인 인증기는 두 번째 검증도 통과했다.

### counter 역행이면 credential 을 지운다 (suspend 기각)

counter 역행은 인증기 복제 공격이나 인증기 firmware 에러 둘 중 하나다. 둘 다 신뢰가 깨진 상태라 바로 신뢰를 거둔다. 같은 assertion 의 중복 요청은 챌린지 기록에서 먼저 거부되고 서명이 틀린 응답은 역행으로 판정하지 않는다. 그래서 역행 판정까지 오는 응답은 이 두 경우뿐이다(2026-10-17, 「Passkey 인증 챌린지는 한 번만 쓴다」). suspend(`disabled_at` 컬럼과 명시적 재활성화)는 사용자에게 재활성화 선택지를 주는데, 복제한 공격자가 본인인 척 재활성화해도 효과가 같아 보안 이득이 작다. 추가 컬럼·UI 흐름·테스트가 줄어 운영이 단순하고 재등록 비용은 작다.

2026-10-17 추가(NERV Task `CLE-T-D331TT`): counter 역행으로 마지막 credential 이 지워져도 Passkey 복구 코드는 비우지 않는다. 사용자가 마지막 credential 을 지울 때는 비우므로 둘이 다르다. 지금 구현이 이렇게 동작하고 이번에 문서에 적었다. 남은 코드는 쓸 곳이 거의 없다. credential 이 없으면 로그인 응답이 `methods: ['webauthn']` 가 아니다. 쓸 수 있는 곳은 삭제 전에 `methods: ['webauthn']` 로 발급된 챌린지 토큰(`challengeToken`, 5분)뿐이고 그 토큰은 로그인 1단계를 통과해야 받는다. 첫 등록은 credential 수가 0 인지로 판정하므로 다음 등록 때 새 코드로 바뀐다. 역행 트랜잭션에서 복구 코드도 비우는 안은 처음에 미뤘다. counter 역행 처분의 범위를 정하는 사람 결정이 남아 있었기 때문이다. 그 결정으로 범위가 처음 쓰는 챌린지에서 서명이 맞는 응답으로 좁혀졌다. 범위가 좁혀져도 남은 코드를 쓸 곳은 그대로라 비워서 얻는 것이 없다. 그래서 비우는 안은 기각하고 지금 동작을 유지한다. 이 Task 는 이 동작을 바꾸지 않는다.

### 로그인에서 TOTP 로 자동 전환하지 않는다

Passkey 는 피싱에 강하고 TOTP 는 코드를 입력하는 순간 피싱에 약하다. 강한 수단을 등록한 사용자가 약한 수단으로 자동 우회할 수 있으면 등록한 의미가 약해진다. TOTP 로 바꾸고 싶으면 보안 설정에서 Passkey 를 모두 지우거나 Passkey 복구 코드를 쓴 뒤 다시 로그인한다. 의식적인 하향만 허용한다. 분실로 잠길 위험은 별도 복구 코드로 줄인다. 복구 코드까지 잃은 경우의 계정 복구는 이 문서 범위 밖이고 운영자 개입 경로다.

예외는 Passkey 기능이 꺼진 경우다(2026-10-17, NERV Task `CLE-T-D331TT`). 기능이 꺼지면 Passkey 로 인증할 수 없다. 그래서 TOTP 가 켜진 사용자는 TOTP 로 로그인한다. 사용자가 등록한 수단 가운데 남은 것을 쓰므로 2단계 인증을 건너뛰지 않는다. TOTP 가 없는 사용자는 막는다. 이유는 「Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다」 에 있다. 기능이 켜져 있을 때 Passkey 인증이 실패해도 TOTP 로 넘기지 않는 규칙은 그대로다.

### Passkey 환경 변수가 없으면 기능만 끈다

`WEBAUTHN_RP_ID`·`WEBAUTHN_ORIGIN` 이 없고 `WEBAUTHN_ALLOW_FALLBACK` 이 `1` 이 아니면 부팅을 거부하지 않고 `enabled=false` 로 둔다. 가용성 조회를 뺀 Passkey 엔드포인트는 503 을 준다. 로그인은 Passkey 만 등록하고 TOTP 가 꺼진 계정만 503 으로 막고 나머지 계정은 정상 동작한다.

- Passkey 는 부가 인증 수단이지 인증의 핵심 경로가 아니다. 그래서 기능이 꺼져도 부팅과 Passkey 를 등록하지 않은 사용자의 로그인, TOTP 로그인은 동작해야 한다. Passkey 만 등록한 사용자는 이 원칙 밖이다(넷째 불릿).
- 운영자가 환경 변수를 한 번에 다 설정하지 않는 셀프 호스팅 점진 도입을 막지 않는다.
- localhost 같은 잘못된 폴백으로 등록 데이터가 쌓이면 도메인을 정할 때 모두 무효가 된다. 자동 폴백보다 명시적 활성화가 안전하다.
- Passkey 만 쓰는 사용자(TOTP 꺼짐)는 설정이 꺼지면 비밀번호로 로그인하지 못한다(503 `WEBAUTHN_DISABLED`). 2026-10-17 에 구현이 이 사용자를 비밀번호만으로 로그인시킨다는 것을 찾았고 사람 결정으로 이 문장 쪽에 맞췄다(「Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다」). 운영자가 한 번 켰다면 그대로 두는 것이 정상 운영이다. 실수로 꺼지면 Passkey 복구 코드로 TOTP 를 등록하는 우회 경로가 없어 운영자 개입이 필요하다. 설정을 바꾸기 전에 사용자에게 공지하는 것을 권한다.
- 폴백이 필요한 개발·로컬·시연에는 `WEBAUTHN_ALLOW_FALLBACK=1` 을 남겨 둔다.

### Passkey 인증 챌린지는 한 번만 쓴다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 사람 결정으로 정했다. 같은 assertion 이 두 번 오는 일은 공격이 아니어도 생긴다. 버튼을 두 번 누르거나 네트워크 계층이 요청을 다시 보내는 경우다. 챌린지 기록이 없을 때 counter 를 올리는 인증기는 두 번째 요청이 counter 역행으로 처분됐다. credential 이 지워지고 첫 요청이 받은 로그인 세션까지 끝났다. counter 가 늘 0 인 인증기(대부분의 플랫폼 Passkey)는 같은 assertion 이 다시 통과해 토큰이 한 번 더 나왔다. 챌린지를 한 번만 쓰면 두 경우 모두 credential 을 지우지 않는 401 로 끝난다. 처음 쓰는 챌린지에서 서명이 맞는데 counter 가 역행한 응답만 복제 신호로 남는다.

- **기각: counter 가 같은 값과 작은 값을 나눠 처분한다.** counter 가 같으면 거부만 하고 작을 때만 지우는 안이다. 둘 다 0 인 경우는 어느 안에서도 역행이 아니다. 구현은 간단하다. 하지만 counter 가 늘 0 인 인증기의 재전송을 막지 못하고 같은 counter 를 내는 복제 인증기도 놓친다.
- **기각: 지금 동작을 문서에 적고 화면에서 중복 제출을 막는다.** 화면을 거치지 않는 재전송과 counter 0 인증기의 토큰 재발급이 남는다.
- **기록 시점**: 서명과 counter 를 판정하기 전에 기록한다. 판정 뒤에 기록하면 동시에 온 두 요청이 모두 판정으로 가서 지금과 같은 역행 처분이 난다. 검증 결과와 상관없이 기록하므로 실패한 사용자는 옵션을 다시 받아야 한다. 옵션 요청은 챌린지 토큰만 있으면 되고 로그인 화면은 이미 시도마다 옵션을 새로 받는다.
- **비용**: 쓴 챌린지를 만료 시각까지 담는 공유 저장소가 필요하다. 챌린지를 JWT 에 담아 발급하는 방식(「Passkey 챌린지를 stateless JWT 로 둔다」)은 그대로 둔다. 원자적 기록, 만료된 기록 정리, 저장소 장애 때의 동작은 구현 Task 가 정한다. 한 번만 쓰는 값을 원자적으로 소비하는 선례는 [계정과 워크스페이스 데이터 흐름 「OAuth state 를 한 번의 DELETE 로 소비한다」](CLE-ACCT-DATA.md#oauth-state-를-한-번의-delete-로-소비한다) 에 있다.

### Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 사람 결정으로 정했다. 구현은 기능이 꺼지면 credential 수를 0 으로 보고 Passkey 만 등록한 계정을 비밀번호만으로 로그인시켰다. 「Passkey 환경 변수가 없으면 기능만 끈다」 는 그런 사용자가 접근하지 못한다고 적어 반대였다. 구현대로라면 환경 변수 하나가 빠질 때 Passkey 로 2단계 인증을 등록한 계정이 모두 비밀번호만으로 들어온다. 그래서 막는 쪽으로 정했다. TOTP 가 켜진 사용자는 TOTP 로 로그인한다.

- **기각: 지금 동작을 문서에 적는다.** 아무도 잠기지 않는다. 하지만 설정 실수 하나로 2단계 인증이 꺼지고 사용자는 그 사실을 알 수 없다.
- **기각: 기능이 꺼진 동안 Passkey 복구 코드로만 로그인을 연다.** 2단계 인증이 유지되고 바로 잠기지 않는다. 하지만 로그인 응답에 새 `methods` 값과 화면이 필요해 바뀌는 곳이 가장 많다. 복구 코드는 10개뿐이라 설정이 꺼진 동안 매번 쓰면 곧 바닥난다.
- **비용**: 운영자가 변수를 되돌릴 때까지 Passkey 만 등록한 사용자는 비밀번호로 로그인하지 못한다. 그래서 `503` 을 쓴다. 운영자가 설정을 바꿔야 풀리는 상태다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 11).
- **바뀌는 계약**: `WebAuthnService.countCredentials()` 는 기능이 꺼지면 0 을 돌려준다. 로그인은 기능이 꺼져도 credential 이 있는지 알아야 하므로 이 계약을 바꾸거나 켜짐 여부와 credential 수를 따로 묻는다(「Passkey 도메인 모듈을 분리한다」).

### 이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 사람 결정으로 정했다. 구현은 비밀번호를 확인하기 전에 이메일 인증 여부를 보고 인증 전 계정에 다른 메시지를 줬다. 그래서 비밀번호를 몰라도 그 이메일로 가입한 인증 전 계정이 있는지 알 수 있었다. 확인을 비밀번호 뒤로 옮기면 비밀번호를 아는 본인만 계정 상태를 알게 된다. 인증 메일을 놓친 사용자는 왜 로그인이 안 되는지 알 수 있다.

- **기각: 인증 전 계정도 같은 메시지로 숨긴다.** 계정 상태는 드러나지 않는다. 하지만 인증 메일을 놓친 사용자가 이유를 알 수 없다.
- **기각: 지금 동작을 문서에 적는다.** 코드는 그대로지만 계정 존재와 인증 상태가 비밀번호 없이 드러난다.
- **잠금 순서는 그대로 둔다**: `ACCOUNT_LOCKED` 는 지금처럼 비밀번호 확인 전에 알린다. 그래서 비밀번호를 몰라도 그 이메일의 계정이 잠겼다는 것은 드러난다. 지금은 이 응답으로 사용자가 잠금을 안다([계정 잠금에 이메일 알림을 두지 않는다](#계정-잠금에-이메일-알림을-두지-않는다)). 잠금 순서는 이미 그렇게 동작하고 이번 결정 범위 밖이다.
- **새 코드로 알린다**: 비밀번호가 맞는 인증 전 계정은 401 `EMAIL_VERIFICATION_REQUIRED` 로 거부한다. 사용자가 할 일(인증 메일 확인)이 자격 증명을 고치는 것과 달라서 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 6 의 새 조건이다. 같은 코드로 묶는 경우는 구분하면 정보가 드러날 때인데 이 응답은 비밀번호가 맞을 때만 나서 거기에 들지 않는다. 화면은 메시지가 아닌 코드로 안내 문구를 고르고(같은 문서 규칙 4) 코드를 키로 한국어 문구를 매핑한다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 5). 401 은 같은 로그인 1단계의 `ACCOUNT_LOCKED` 를 따랐다. 이름은 로그인 이력 사유값 `EMAIL_NOT_VERIFIED` 와 겹치지 않게 골랐다. 구현 전까지는 카탈로그 §6.2 표에 넣지 않고 표 아래 문장으로 적는다(같은 문서 규칙 9).
- **기각: `LOGIN_FAILED` 에 메시지만 다르게 둔다.** 처음 초안이 이렇게 적었다. 화면이 코드로 인증 안내를 고를 수 없어 안내가 영문 서버 메시지에만 남는다. 그러면 위 두 규칙과 어긋나 2026-10-17 에 사람이 다시 정했다.
- **기각: `LOGIN_FAILED` 의 `error.details` 에 하위 사유를 싣는다.** 코드는 하나로 남지만 로그인 응답에 하위 사유 형식이 새로 생기고 화면이 `details` 로 분기해야 한다.

### Passkey 도메인 모듈을 분리한다

Passkey 관련 엔티티·서비스·DTO·컨트롤러·테스트는 `codebase/backend/src/modules/auth/webauthn/` 에 두고 `WebAuthnModule` 로 묶는다. `AuthModule` 이 `WebAuthnModule` 을 import 해 `WebAuthnService` 를 주입받는다. 의존 방향은 `AuthModule → WebAuthnModule` 한 방향이다.

| 위치 | 분류 |
| --- | --- |
| `auth/webauthn/webauthn.service.ts` | service |
| `auth/webauthn/entities/webauthn-credential.entity.ts` | entity |
| `auth/webauthn/dto/webauthn.dto.ts` | 요청 DTO |
| `auth/webauthn/dto/responses/webauthn-response.dto.ts` | 응답 DTO |
| `auth/webauthn/webauthn.module.ts` | NestJS module |
| `auth/webauthn/webauthn.controller.ts` | HTTP controller (`/auth/2fa/webauthn/...`) |

- `AuthService` 는 credential repository 를 직접 주입하지 않고 `WebAuthnService.countCredentials()` 를 쓴다. 이 함수가 기능이 꺼져 있으면 0 을 돌려주므로 `AuthService` 에 켜짐 분기가 필요 없다. 2026-10-17 정정(NERV Task `CLE-T-D331TT`): 이 계약은 「Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다」 와 맞지 않는다. 로그인은 기능이 꺼져도 credential 이 있는지 알아야 한다. 계약을 바꾸는 일은 NERV Task `CLE-T-RFSJXQ` 가 맡는다. 어느 쪽으로 바꿔도 `AuthService` 가 credential repository 를 직접 주입하지 않는 규칙은 그대로다.
- `LoginHistoryService` 는 `AuthModule` 과 `WebAuthnModule` 양쪽에 provider 로 둔다. 두 인스턴스가 같은 테이블에 INSERT 만 하므로 동작이 같다. 별도 모듈 분리는 후속 과제다.
- `WebAuthnController` 파일은 `webauthn/` 폴더에 두지만 모듈 등록은 `AuthModule` 의 `controllers` 에 한다. 컨트롤러가 챌린지 토큰 소비와 2단계 뒤 토큰 발급에 `AuthService` 를 써야 하기 때문이다. `WebAuthnModule` 에 등록하면 역방향 의존이 생긴다.
- `setRefreshTokenCookie`·`clearRefreshTokenCookie` 는 두 컨트롤러가 함께 쓰므로 `auth/utils/refresh-cookie.ts` 의 모듈 함수로 뺐다.
- 채택 이유: 로그인·가입·OAuth·로그인 세션·TOTP 에 Passkey 까지 한 모듈에 있으면 응집도가 낮다. 도메인 모듈로 나눠 경계를 드러내고 한 방향 의존으로 순환을 막는다.

### 로그인 응답에서 `requiresTotp` 필드를 없앴다

로그인 2단계 챌린지 응답에는 `requiresTotp?: boolean` 이 없다. 백엔드 `LoginChallengeDto`·`AuthService.login()`·프론트엔드 `TwoFactorChallengeResponse` 모두 그렇다. 클라이언트는 `requires2fa` 와 `methods` 만으로 가른다(`lib/api/auth.ts` 의 `isTwoFactorChallenge()`). 같은 뜻을 두 필드로 표현하면 Swagger·클라이언트 타입·DTO·테스트 mock 에 잡음이 생기고 "두 필드가 다르면 무엇을 따르나" 같은 규칙을 유지해야 한다.

### TOTP 라이브러리: `otplib` v13

TOTP 발급과 검증은 `otplib` v13 을 쓴다(`totp.service.ts`). secret 은 base32(RFC 6238)라 라이브러리를 바꿔도 호환된다. v12 에서 올린 이유는 다음과 같다.

- v12 는 2021 년 이후 릴리스가 멈췄다. 보안에 중요한 경로에서 CVE 패치 라인이 없는 위험이 있다. v13 은 감사받은 `@noble/hashes`·`@scure/base` 플러그인 기반의 활성 라인이다.
- v13 은 ESM 전용 전면 재작성이고 `authenticator` preset 이 없어졌다. 다만 `verifySync`·`generateSync` 가 기본 crypto 플러그인에서 동작해 서비스 메서드를 동기로 유지했다.
- v12 와 v13 모두 RFC 6238 을 따르므로 기존 secret 이 그대로 검증된다. RFC 6238 Appendix B 벡터로 교차 버전 단위 테스트를 둬 기존 사용자가 잠기지 않게 했다.
- v12 의 `window:1` 허용 오차는 v13 의 `epochTolerance: 30`(앞뒤 1 time step)으로 같게 맞췄다.

### 복구 코드는 SHA-256 으로 해시한다 (KDF 기각)

복구 코드는 `randomBytes(9)`(72비트) 기반의 고엔트로피 일회용 비밀이다. argon2id·bcrypt·scrypt 같은 KDF 의 느린 해시와 솔트는 저엔트로피 사용자 비밀번호의 사전 공격을 늦추려는 것이라 고엔트로피 값에는 이득이 없다. 2^50 이상의 탐색 공간은 GPU 로도 비현실적이다(OWASP 복구 코드 지침과 맞다). KDF 로 바꾸면 코드별 솔트 때문에 검증이 배열 `indexOf` 에서 최대 10회의 느린 비교로 바뀌어 복구 로그인이 느려지고, TOTP 와 Passkey 두 묶음을 함께 바꿔야 한다. 이득에 비해 비용이 커서 SHA-256 을 유지한다.

### OAuth 콜백에서 액세스 토큰을 URL 에 싣지 않는다

2026-05-31 결정이다. URL 에 액세스 토큰을 실으면 브라우저 기록·Referer·프록시 로그에 남는다. 그래서 리프레시 토큰만 HttpOnly 쿠키로 설정하고 콜백 페이지가 `POST /api/auth/refresh` 로 액세스 토큰을 받는다.

### 인증 화면 배경과 로고 자리

인증 화면 배경은 "제품 브랜드 색상 또는 그래디언트" 다. 현재 `codebase/frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴의 Shadcn neutral 그래디언트를 쓴다. 로고는 `<Logo theme="auto">` 로 배경 박스 없이 그래디언트 위에 바로 놓는다. 이 문서는 로고가 놓이는 자리만 정한다. 자리에 들어갈 변종과 라이트·다크 자산 선택은 [브랜드](../CLE-UI/CLE-UI-BRAND.md) 의 매트릭스와 노출 자리 규정을 따른다.

### TOTP 끄기에 비밀번호와 인증 코드를 함께 받는다 (2026-10-10)

NERV Task `CLE-T-75TDTN` 의 결정이다. 원문 인증 명세는 두 곳이 서로 달랐다. 2단계 인증 표는 끌 때 "비밀번호 재확인과 코드 입력" 을 요구했고 API 표는 "인증과 비밀번호 재확인" 만 적었다. 구현(`Disable2faDto`)은 비밀번호만 받았고 이 문서는 그 차이를 미결 사항으로 두었다. 이번에 비밀번호와 코드를 모두 받기로 정하고 그 미결 항목을 닫았다.

- **코드를 함께 받는 이유**: 비밀번호만으로 끌 수 있으면 비밀번호와 로그인 세션을 손에 넣은 사람이 두 번째 요소를 지울 수 있다. 2단계 인증이 막으려는 상황이 바로 그것이다. 요소를 지우려면 그 요소를 가졌다는 것을 보여야 한다. 다만 켜진 상태의 setup/verify 가 닫히기 전까지는 로그인 세션을 가진 사람이 새 secret 으로 코드 확인을 통과할 수 있다([미결 사항](#미결-사항), NERV Task `CLE-T-94FTMV`).
- **복구 코드도 받는 이유**: 인증 앱을 잃은 사용자는 TOTP 복구 코드로 로그인한다. 그 사용자는 TOTP 를 끄고 새 기기로 다시 설정해야 한다. TOTP 복구 코드만 따로 재발급하는 API 도 없다. 6자리 코드만 받으면 이 사용자는 TOTP 를 끌 수도 다시 설정할 수도 없다. 그래서 로그인 2단계와 같은 `verifyForLogin` 을 쓰고 복구 코드도 로그인처럼 소비한다.
- **필드 이름 `code`**: 로그인 2단계 `POST /api/auth/login/totp` 의 본문 필드가 `code` 이고 길이 규칙(6~32자)과 받는 값이 같다. 활성화 검증 `POST /api/auth/2fa/verify` 도 `code` 를 쓴다(6자리만). 계정 재인증의 `totpCode` 는 등록된 TOTP 코드만 받는 필드라서 따르지 않았다. 이름이 같으면 받는 값도 같다고 읽히기 때문이다.
- **확인 순서**: 비밀번호를 먼저 확인한다. 비밀번호가 틀린 요청은 코드를 확인하지 않으므로 복구 코드를 소비하지 않는다.
- **에러 코드**: 코드 불일치에는 기존 `TOTP_INVALID`(401)를 쓴다. 뜻이 같은 코드가 이미 있다. 코드 누락은 본문 검증의 400 `VALIDATION_ERROR` 가 맡는다. TOTP 가 꺼진 계정의 끄기 요청도 `TOTP_INVALID` 로 묶었다. 끄기 화면은 TOTP 가 켜진 계정에만 보인다. 그래서 꺼짐은 다른 탭에서 먼저 끈 경합에서만 나고 클라이언트가 따로 할 동작이 없다. `TOTP_NOT_ENABLED` 는 로그인 2단계 챌린지 전용 코드(401, 다시 로그인 안내)라서 다시 쓰지 않았다. 새 코드나 409 도 같은 이유로 두지 않았다.
- **로그인 이력**: 끄기의 코드 실패는 로그인 이력에 남기지 않는다. `totp_failed` 는 로그인 2단계 실패를 뜻하는 값이라 설정 화면의 실패를 섞으면 그 뜻이 흐려진다. 추측 시도는 요청 한도(사용자당 분당 10회)가 막는다.
- **설정 화면의 OAuth 전용 계정 문장**: 「2단계 인증 설정 화면」 의 "현재는 따로 막는 로직이 없다" 를 다시 확인했다. TOTP 끄기는 이전에도 비밀번호를 먼저 확인해서 OAuth 전용 계정은 끌 수 없었다. 그 문장은 Passkey 삭제에만 맞아서 그 범위로 좁혔다.

기각한 대안은 다음과 같다.

- 비밀번호만 받고 원문의 2단계 인증 표를 API 표에 맞춰 고치기: 위 첫째 이유로 기각했다.
- 6자리 코드만 받고 복구 코드는 거부하기: 인증 앱을 잃은 사용자가 TOTP 를 끄지도 다시 설정하지도 못한다.
- 계정 재인증 `verifyReauth` 를 그대로 쓰기: 비밀번호와 TOTP 가운데 하나만 통과하면 되는 규칙이다. 비밀번호만 받던 이전 구현과 달라지지 않는다.
- Passkey 복구 코드도 받기: 「복구 코드 묶음을 TOTP 와 Passkey 로 나눈다」 의 결정과 어긋난다. 한쪽 수단의 복구 코드로 다른 쪽 수단을 지우게 된다.
- 비밀번호를 빼고 코드만 받기: 원문과 기존 구현이 모두 비밀번호 확인을 요구했다. 이를 약하게 할 이유가 없다.
- 코드 누락용 새 에러 코드(`TOTP_REQUIRED`): 본문 검증이 이미 400 으로 막는다. 같은 상황에 코드를 둘 두지 않는다.

### 계정 재인증과 TOTP 끄기는 코드 규칙이 다르다 (2026-10-10)

NERV Task `CLE-T-75TDTN` 에서 TOTP 끄기 규칙을 정하며 함께 따졌다. 이메일 변경과 세션 강제 종료의 계정 재인증은 등록된 TOTP 코드만 받고 TOTP 복구 코드는 받지 않는다([세션과 토큰](CLE-ACCT-SESSION.md) 의 「세션 정책」 표 「강제 종료 재인증」 행). TOTP 끄기는 복구 코드도 받는다. 두 규칙은 일부러 다르게 두었다.

- 계정 재인증은 비밀번호와 TOTP 가운데 하나만 통과하면 된다. 비밀번호가 있는 사용자는 인증 앱을 잃어도 비밀번호로 계정 재인증을 한다. 복구 코드를 받지 않아도 잠기지 않는다.
- 비밀번호가 없는 OAuth 전용 계정만 TOTP 코드에 기댄다. 이 사용자도 [비밀번호 재설정](#비밀번호-재설정) 으로 비밀번호를 추가하면 비밀번호로 계정 재인증을 할 수 있다.
- TOTP 끄기는 비밀번호와 코드를 모두 요구한다. 코드 자리에 다른 길이 없어서 복구 코드를 받지 않으면 인증 앱을 잃은 사용자가 막힌다.
- 계정 재인증이 복구 코드를 받으면 비밀번호 없이 복구 코드 한 장만으로 이메일을 바꿀 수 있다. 복구 코드는 종이나 파일로 오래 보관하는 고정 값이다. 그 보관 방식 때문에 단독 수단으로는 약하다.

그래서 계정 재인증 규칙은 바꾸지 않았다. 계정 재인증의 동작은 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다. 요청 필드 이름도 받는 값에 따라 갈린다. 계정 재인증은 `totpCode`, TOTP 끄기와 로그인 2단계는 `code` 다.

계정 재인증에서 복구 코드를 막는 것은 지금 본문 검증이다. `totpCode` 는 6~8자로 묶여 있어 `xxxx-xxxx-xxxx` 꼴의 복구 코드가 서비스에 닿지 않는다. 서비스(`verifyReauth`)는 로그인과 같은 `verifyForLogin` 을 부른다. 그래서 이 길이 제한을 넓히면 계정 재인증에서도 복구 코드가 통과하고 소비된다.

### 에러 코드 표와 응답 표기를 구현에 맞췄다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 바로잡았다. 동작은 바꾸지 않았다.

- **발행하는데 표에 없던 코드**: `LOGIN_FAILED` · `CHALLENGE_METHOD_MISMATCH` · `WEBAUTHN_COUNTER_REGRESSION` · `WEBAUTHN_REQUIRED` 를 에러 코드 표에 더했다. API 표는 counter 역행을 "401" 로만 적었고 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 는 이 경우를 `WEBAUTHN_INVALID` 로 적었다. 구현은 응답 코드 `WEBAUTHN_COUNTER_REGRESSION` 을 돌려준다. `LOGIN_FAILED` 행의 이메일 인증 전 계정은 처음에 지금 동작만 적고 「미결 사항」 에 올렸다. 사람 결정이 나서 「이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다」 로 옮겼고 그 응답은 새 코드 `EMAIL_VERIFICATION_REQUIRED` 로 나눴다. `WEBAUTHN_REQUIRED` 의 조건도 구현대로 좁혔다. TOTP 가 꺼진 계정은 Passkey 가 있어도 먼저 `TOTP_NOT_ENABLED` 를 받는다.
- **계정 재인증 수단 없음의 조건**: 이메일 변경을 막는 조건을 "비밀번호도 2단계 인증도 없는 계정" 으로 적었다. 이 문서에서 2단계 인증은 TOTP 와 Passkey 를 함께 뜻한다. 구현(`SessionsService.verifyReauth`)은 비밀번호와 TOTP 만 본다. 그래서 Passkey 만 등록한 계정도 막힌다. 조건을 "비밀번호도 TOTP 도 없는 계정" 으로 고쳤다.
- **재설정 실패의 구분**: `POST /api/auth/reset-password` 는 실패를 모두 400 `VALIDATION_ERROR` 로 돌려준다. 지금 구현은 비밀번호 규칙 위반에만 `details` 를 싣는다. 이 Task 는 처음에 `details` 유무를 판별 규칙으로 적으려 했다. 이 규칙은 에러 코드 규약과 어긋난다. 에러 코드 규약은 원인이 갈리면 코드로 가르게 한다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 규칙 4 · 6). 그래서 API 표에는 현재 동작만 적고 코드를 나눌지는 「미결 사항」 에 올렸다. 재설정 화면은 지금 두 경우를 가르지 않는다.
- **응답 봉투 표기**: 어떤 곳은 봉투를 뺀 내용을, 어떤 곳은 봉투째 적었다. [API](#api) 첫머리에 봉투를 뺀 내용으로 적는다는 규칙을 두고 봉투째 적은 세 곳을 고쳤다.
- **counter 역행 뒤의 Passkey 복구 코드**: 사용자가 마지막 credential 을 지우면 복구 코드를 비우지만 counter 역행 삭제는 비우지 않는다. 이 지금 동작을 [복구 코드](#복구-코드) 표와 본문에 적었다. 이유는 「counter 역행이면 credential 을 지운다 (suspend 기각)」 에 날짜를 붙여 더했다.
- **`WEBAUTHN_DISABLED` 범위**: Passkey 엔드포인트의 503 요구사항, 「Passkey 기능 켜기와 환경 변수」 표, Rationale 「Passkey 환경 변수가 없으면 기능만 끈다」 는 Passkey 기능이 꺼지면 Passkey 엔드포인트가 모두 503 이라고 적었다. 가용성 조회는 기능이 꺼져도 200 `{ enabled: false }` 다. 세 곳에 이 예외를 적었다.
- **counter 0 경계**: counter 역행 요구사항은 "저장값 이하" 만 적어 저장값과 응답 값이 모두 0 인 인증기도 역행으로 읽혔다. 구현이 쓰는 `@simplewebauthn/server` 는 둘 다 0 이면 역행으로 보지 않는다. counter 가 늘 0 인 인증기(대부분의 플랫폼 Passkey)는 이 경계가 없으면 로그인할 때마다 지워진다. 그래서 문서를 라이브러리 판정에 맞췄다.
- **날짜가 붙은 Rationale 의 정정**: 「등록 검증은 transport 목록의 형식만 확인하고 값은 거르지 않는다」 의 첫 문단은 고치기 전 동작을 "문자열 배열이 아닌 값이 오면 500" 으로만 적었다. 실제로는 일부만 500 이었고 `null` 은 200 이었다. 첫 문단을 고치고 `null` 이 200 에서 400 으로 바뀐 항목을 더했다. 「`user.email_changed` 감사 details 에 이메일 값을 싣지 않는다」 의 "그 세션 워크스페이스" 는 "변경을 확정한 요청의 현재 워크스페이스" 로 고쳤다. 뜻은 같고 용어 표기만 바꿨다.

### 로그인 뒤 이동할 곳은 세션과 토큰 문서가 정한다 (2026-10-18)

NERV Task `CLE-T-7WZKFB` · `CLE-T-YZ9VEX` 에서 고쳤다. 이 문서의 「로그인 처리」 4번과 프론트엔드 `/callback` 동작은 로그인 뒤 늘 대시보드(`/dashboard`)로 간다고 적었다. 같은 절 끝 문단은 이동할 곳을 [세션과 토큰](CLE-ACCT-SESSION.md) 이 정한다고 적어 두 문장이 서로 맞지 않았다. 그래서 초대 링크에서 로그인 화면으로 온 기존 가입자를 로그인 뒤 초대 수락 페이지로 돌려보내는 규칙이 이 문서와 어긋났다.

- 이동 규칙은 [세션과 토큰 「로그인 뒤 이동」](CLE-ACCT-SESSION.md#로그인-뒤-이동) 한 곳에 두고 이 문서는 그 절을 링크한다. 두 문서에 규칙을 함께 적으면 한쪽만 고쳐지기 쉽다. 이번에 어긋난 것도 그 경우다.
- 로그인 화면의 초대 안내 문구와 「계정 만들기」 링크 동작은 화면 요소라서 이 문서의 [로그인 화면](#로그인-화면) 표가 정한다. 세션과 토큰 문서와 워크스페이스와 멤버 문서는 그 표를 링크한다.
- 소셜 로그인은 제공자를 거쳐 `/callback` 으로 돌아오므로 로그인 화면의 `redirect` 쿼리가 이어지지 않는다. 시작 요청의 `mode` 와 `rememberMe` 는 로그인 OAuth state(`auth_oauth_state`) 행에 실어 콜백까지 나른다. 복귀 경로도 같은 방식으로 나를 수 있다. 이번 범위는 백엔드 인증 API 를 바꾸지 않아서 탭의 sessionStorage 로 넘긴다. 다른 탭에서 돌아오거나 팝업 로그인이 필요해지면 state 행으로 옮긴다. 이유와 비용은 [세션과 토큰 「소셜 로그인의 복귀 경로는 sessionStorage 로 넘긴다」](CLE-ACCT-SESSION.md#소셜-로그인의-복귀-경로는-sessionstorage-로-넘긴다) 에 있다.
- 콜백은 이동하기 전에 `GET /api/users/me` 를 불러 로그인 상태를 표시한다. 이때 로그인 힌트 쿠키(`has_session`)가 심어진다. 쿠키 없이 보호 경로로 가면 proxy 가 다시 로그인 화면으로 보내기 때문이다. 자세한 내용은 같은 절에 있다.
- 이메일 인증 링크를 연 뒤의 자동 로그인은 이번 범위가 아니다. 지금처럼 대시보드로 보낸다.
- 초대 가입 화면의 가입 여부 확인 규칙은 [워크스페이스와 멤버 「초대 가입 화면」](CLE-ACCT-WS.md#초대-가입-화면) 에만 둔다. 이 문서는 가입 폼 이메일 입력란의 중복 확인 요구사항을 읽기 전용 입력란에서 건너뛰도록 고치고 그 절을 링크한다.
