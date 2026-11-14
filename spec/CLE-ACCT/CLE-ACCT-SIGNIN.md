---
id: "CLE-ACCT-SIGNIN"
title: "가입과 로그인"
type: "feature"
version: 21
status: "approved"
requirements: ["REQ-SIGNIN-001", "REQ-SIGNIN-002", "REQ-SIGNIN-003", "REQ-SIGNIN-004", "REQ-SIGNIN-005", "REQ-SIGNIN-006", "REQ-SIGNIN-007", "REQ-SIGNIN-008", "REQ-SIGNIN-009", "REQ-SIGNIN-010", "REQ-SIGNIN-011", "REQ-SIGNIN-012", "REQ-SIGNIN-013", "REQ-SIGNIN-014", "REQ-SIGNIN-015", "REQ-SIGNIN-016", "REQ-SIGNIN-017", "REQ-SIGNIN-018", "REQ-SIGNIN-019", "REQ-SIGNIN-020", "REQ-SIGNIN-021", "REQ-SIGNIN-022", "REQ-SIGNIN-023", "REQ-SIGNIN-024", "REQ-SIGNIN-025", "REQ-SIGNIN-026", "REQ-SIGNIN-027", "REQ-SIGNIN-028", "REQ-SIGNIN-029", "REQ-SIGNIN-030", "REQ-SIGNIN-031", "REQ-SIGNIN-032", "REQ-SIGNIN-033", "REQ-SIGNIN-034", "REQ-SIGNIN-035", "REQ-SIGNIN-036", "REQ-SIGNIN-037", "REQ-SIGNIN-038", "REQ-SIGNIN-039", "REQ-SIGNIN-040", "REQ-SIGNIN-041", "REQ-SIGNIN-042", "REQ-SIGNIN-043", "REQ-SIGNIN-044", "REQ-SIGNIN-045", "REQ-SIGNIN-046", "REQ-SIGNIN-047", "REQ-SIGNIN-048", "REQ-SIGNIN-049", "REQ-SIGNIN-050", "REQ-SIGNIN-051", "REQ-SIGNIN-052", "REQ-SIGNIN-053", "REQ-SIGNIN-054", "REQ-SIGNIN-055", "REQ-SIGNIN-056", "REQ-SIGNIN-057", "REQ-SIGNIN-058", "REQ-SIGNIN-059", "REQ-SIGNIN-060", "REQ-SIGNIN-061", "REQ-SIGNIN-062", "REQ-SIGNIN-063", "REQ-SIGNIN-064", "REQ-SIGNIN-065", "REQ-SIGNIN-066", "REQ-SIGNIN-067", "REQ-SIGNIN-068", "REQ-SIGNIN-069", "REQ-SIGNIN-070", "REQ-SIGNIN-071", "REQ-SIGNIN-072", "REQ-SIGNIN-073", "REQ-SIGNIN-074", "REQ-SIGNIN-075", "REQ-SIGNIN-076", "REQ-SIGNIN-077", "REQ-SIGNIN-078", "REQ-SIGNIN-079", "REQ-SIGNIN-080", "REQ-SIGNIN-081", "REQ-SIGNIN-082", "REQ-SIGNIN-083", "REQ-SIGNIN-084", "REQ-SIGNIN-085", "REQ-SIGNIN-086", "REQ-SIGNIN-087", "REQ-SIGNIN-088", "REQ-SIGNIN-089", "REQ-SIGNIN-090", "REQ-SIGNIN-091", "REQ-SIGNIN-092", "REQ-SIGNIN-093", "REQ-SIGNIN-094", "REQ-SIGNIN-095"]
basis_superseded: false
parent: "CLE-ACCT"
ancestors: ["CLE-VISION", "CLE-ACCT"]
area: "CLE-ACCT"
content_hash: "bbec0242d6d2bf52ed9363dfff3cfbb7630f2df9e30d8bc438ccf02b7b0738ac"
read_as: "approved_fallback"
task: "CLE-T-Q6E11N"
source_paths: ["spec/2-navigation/10-auth-flow.md", "spec/2-navigation/9-user-profile.md", "spec/5-system/1-auth.md"]
mirror_sha256: "a6a56b0d746592d2f352413090fa1197e09ba3a4719b0a7e4a8fed644d1560a9"
etag: "sha256-8aac3d1217edb6ebfcdc9e6c5cfeb64972d642cd59848c1d3beaa8e6e16e17ab"
---
> 구현 상태: 부분 구현 (셀프 호스팅 LDAP·SAML 인증은 미구현) · 원문: `spec/5-system/1-auth.md` (§1.1~§1.4, §5, Rationale), `spec/2-navigation/10-auth-flow.md` (§1~§5, §8, Rationale), `spec/2-navigation/9-user-profile.md` (§2.0·§2.2 이메일 변경·2단계 인증 설정, §6.1 이메일 변경 행) · 용어: [용어 사전](../CLE-GLOSSARY.md)

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
- REQ-SIGNIN-014 IF 없는 이메일 · 비밀번호가 없는 계정 · 틀린 비밀번호로 로그인이 실패하면 THE SYSTEM SHALL 어느 경우인지 드러내지 않는 같은 문구를 보여 준다.
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
- REQ-SIGNIN-026 IF `WEBAUTHN_RP_ID`·`WEBAUTHN_ORIGIN` 이 설정되지 않았고 `WEBAUTHN_ALLOW_FALLBACK=1` 도 아니면 THE SYSTEM SHALL 부팅은 계속하되 가용성 조회(`GET /api/auth/2fa/webauthn/availability`)와 credential 목록 조회(`GET /api/auth/2fa/webauthn/credentials`)를 뺀 Passkey 엔드포인트를 모두 503 `WEBAUTHN_DISABLED` 로 응답한다. 목록 조회는 200 빈 목록을 돌려준다.
- REQ-SIGNIN-027 WHILE Passkey 기능이 꺼져 있는 동안 THE SYSTEM SHALL 로그인에서 `methods: ['webauthn']` 챌린지를 주지 않고 TOTP 가 켜진 사용자에게 `methods: ['totp']` 챌린지를 주며 저장된 credential 행은 보존한다.
- REQ-SIGNIN-028 IF 처음 쓰는 Passkey 인증 챌린지로 온 인증 응답이 서명 검증을 통과했는데 sign counter 가 저장값 이하이면(저장값과 응답 값이 모두 0 인 경우는 뺀다) THE SYSTEM SHALL 그 credential 행을 즉시 삭제하고 사용자의 활성 리프레시 토큰을 모두 무효화한다.
- REQ-SIGNIN-029 IF sign counter 역행으로 credential 을 삭제하면 THE SYSTEM SHALL 로그인 이력에 `webauthn_failed`(`failure_reason=WEBAUTHN_COUNTER_REGRESSION`)를 남긴다.
- REQ-SIGNIN-030 WHEN 같은 Passkey 인증 챌린지로 인증 검증 요청이 동시에 오면 THE SYSTEM SHALL 한 요청만 서명 · counter 판정으로 보내고 나머지는 credential 을 지우지 않고 401 `WEBAUTHN_INVALID` 로 거부한다.
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
- REQ-SIGNIN-065 WHEN 로그인 요청을 받으면 THE SYSTEM SHALL 이메일 인증 여부를 비밀번호 확인 뒤에 확인한다.
- REQ-SIGNIN-066 IF 비밀번호가 맞지만 이메일 인증을 마치지 않은 계정이 로그인하면 THE SYSTEM SHALL 토큰을 발급하지 않고 401 `EMAIL_VERIFICATION_REQUIRED` 로 거부한다.
- REQ-SIGNIN-067 IF Passkey 기능이 꺼져 있는 동안 Passkey credential 이 1개 이상 있고 TOTP 가 꺼진 사용자가 로그인 1단계를 통과하면 THE SYSTEM SHALL 토큰을 발급하지 않고 503 `WEBAUTHN_DISABLED` 로 거부한다.
- REQ-SIGNIN-068 WHEN 로그인 2단계 Passkey 인증 검증 요청을 받으면 THE SYSTEM SHALL 서명과 counter 를 판정하기 전에 그 요청의 Passkey 인증 챌린지(`optionsToken` 의 `challenge`)를 옵션 토큰의 만료 시각에 여유 시간을 더한 때까지 다시 쓰지 못하게 기록한다.
- REQ-SIGNIN-069 IF 이미 인증 검증에 쓴 Passkey 인증 챌린지로 인증 검증 요청이 오면 THE SYSTEM SHALL credential 과 리프레시 토큰을 건드리지 않고 401 `WEBAUTHN_INVALID` 로 거부한다.
- REQ-SIGNIN-070 IF Passkey 인증 응답이 서명 검증을 통과하지 못하면 THE SYSTEM SHALL counter 값과 상관없이 credential 을 지우지 않고 401 `WEBAUTHN_INVALID` 로 거부한다.
- REQ-SIGNIN-071 IF Passkey 인증 검증이 실패하면 THE SYSTEM SHALL 같은 챌린지 토큰(`challengeToken`)으로 새 옵션을 받거나 Passkey 복구 코드로 통과할 수 있게 둔다.
- REQ-SIGNIN-072 IF 로그인 2단계 Passkey 인증 검증에서 Passkey 인증 챌린지를 기록하지 못하면 THE SYSTEM SHALL 서명과 counter 를 판정하지 않고 503 `SERVICE_UNAVAILABLE` 로 거부한다.
- REQ-SIGNIN-073 WHEN TOTP 설정 시작 요청을 받으면 THE SYSTEM SHALL TOTP 가 켜져 있는지 보기 전에 비밀번호를 재확인한다.
- REQ-SIGNIN-074 IF TOTP 설정 시작 요청의 비밀번호 재확인이 실패하면 THE SYSTEM SHALL 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀린 비밀번호는 401 `PASSWORD_INVALID` 로 거부하고 TOTP secret 을 만들지 않는다.
- REQ-SIGNIN-075 IF TOTP 가 켜진 계정이 TOTP 설정 시작이나 TOTP 활성화 검증을 요청하면 THE SYSTEM SHALL 409 `TOTP_ALREADY_ENABLED` 로 거부하고 TOTP secret 과 TOTP 복구 코드를 바꾸지 않는다.
- REQ-SIGNIN-076 IF TOTP 설정 시작이나 TOTP 활성화 검증이 계정을 읽은 뒤 저장하기 전에 다른 요청이 TOTP 를 켜면 THE SYSTEM SHALL 409 `TOTP_ALREADY_ENABLED` 로 거부하고 켜진 계정의 TOTP secret 과 TOTP 복구 코드를 덮어쓰지 않는다.
- REQ-SIGNIN-077 IF TOTP 활성화 검증이 코드를 확인한 뒤 저장하기 전에 다른 설정 시작 요청이 TOTP secret 을 바꾸면 THE SYSTEM SHALL 401 `TOTP_INVALID` 로 거부하고 TOTP 를 켜지 않는다.
- REQ-SIGNIN-078 WHEN TOTP 설정 시작 요청을 받으면 THE SYSTEM SHALL 사용자당 분당 10회로 요청을 제한한다.
- REQ-SIGNIN-079 WHEN Passkey 등록 옵션 요청을 받으면 THE SYSTEM SHALL 비밀번호를 재확인한 뒤에만 등록 옵션과 옵션 토큰(`optionsToken`)을 준다.
- REQ-SIGNIN-080 IF Passkey 등록 옵션 요청의 비밀번호 재확인이 실패하면 THE SYSTEM SHALL 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀린 비밀번호는 401 `PASSWORD_INVALID` 로 거부하고 등록 옵션과 옵션 토큰을 만들지 않는다.
- REQ-SIGNIN-081 WHEN Passkey 등록 옵션 요청을 받으면 THE SYSTEM SHALL 사용자당 분당 10회로 요청을 제한한다.
- REQ-SIGNIN-082 WHEN Passkey 복구 코드 재발급 요청을 받으면 THE SYSTEM SHALL 사용자당 분당 10회로 요청을 제한한다.
- REQ-SIGNIN-083 WHEN TOTP 활성화 검증 요청을 받으면 THE SYSTEM SHALL 사용자당 분당 10회로 요청을 제한한다.
- REQ-SIGNIN-084 IF TOTP 가 꺼진 계정의 TOTP 활성화 검증 요청에서 설정 시작 시각이 없거나 설정 시작 뒤 10분이 지났으면 THE SYSTEM SHALL 코드를 확인하지 않고 대기 secret 과 설정 시작 시각을 비운 뒤 400 `TOTP_NOT_INITIALIZED` 로 거부한다.
- REQ-SIGNIN-085 WHEN TOTP 활성화 검증이 400 `TOTP_NOT_INITIALIZED` 로 끝나면 THE SYSTEM SHALL 설정 시간이 지났다는 안내를 보여 주고 설정 시작(비밀번호 입력) 단계로 돌아간다.
- REQ-SIGNIN-086 WHEN 일반 가입 · 초대 가입 · 소셜 로그인의 새 계정 · 이메일 변경이 이메일을 저장하면 THE SYSTEM SHALL 앞뒤 공백을 지우고 소문자로 바꿔 저장한다.
- REQ-SIGNIN-087 WHEN 로그인 · 비밀번호 재설정 요청 · 인증 메일 재발송 · 소셜 로그인의 이메일 연결이 이메일로 계정을 찾으면 THE SYSTEM SHALL 입력의 앞뒤 공백을 지운 뒤 대소문자를 구분하지 않고 비교한다.
- REQ-SIGNIN-088 IF 이메일로 계정을 찾을 때 대소문자만 다른 기존 계정이 둘 이상 맞으면 THE SYSTEM SHALL 입력과 대소문자까지 같은 계정을 쓰고, 그런 계정이 없으면 어느 계정도 쓰지 않는다. 로그인은 401 `LOGIN_FAILED`, 비밀번호 재설정 요청과 인증 메일 재발송은 메일 없이 같은 응답, 소셜 로그인은 연결과 가입 없이 `/callback?error=server_error` 로 끝난다.
- REQ-SIGNIN-089 WHEN 가입 중복 검사나 `POST /api/auth/check-email` 이 이메일을 확인하면 THE SYSTEM SHALL 대소문자만 다른 계정이 하나라도 있으면 이미 쓰는 이메일로 보고 가입은 409 `RESOURCE_CONFLICT`, 확인은 `available: false` 로 답한다.
- REQ-SIGNIN-090 WHEN Passkey 삭제 요청을 받으면 THE SYSTEM SHALL 비밀번호를 재확인한 뒤에만 credential 을 지운다.
- REQ-SIGNIN-091 IF Passkey 삭제 요청의 비밀번호 재확인이 실패하면 THE SYSTEM SHALL 비밀번호가 없는 계정은 401 `PASSWORD_REQUIRED`, 틀린 비밀번호는 401 `PASSWORD_INVALID` 로 거부하고 credential 을 지우지 않는다.
- REQ-SIGNIN-092 WHEN Passkey 삭제 요청을 받으면 THE SYSTEM SHALL 사용자당 분당 10회로 요청을 제한한다.
- REQ-SIGNIN-093 IF 같은 사용자의 Passkey 첫 등록 검증이 동시에 오면 THE SYSTEM SHALL 먼저 처리한 요청에만 Passkey 복구 코드를 발급해 복구 코드 묶음을 하나만 남긴다.
- REQ-SIGNIN-094 IF Passkey 등록 검증의 credential ID 가 이미 저장돼 있으면(동시 등록 포함) THE SYSTEM SHALL credential 과 복구 코드를 저장하지 않고 409 `WEBAUTHN_CREDENTIAL_EXISTS` 로 거부한다.
- REQ-SIGNIN-095 IF Passkey 등록 검증에서 첫 등록의 복구 코드를 저장하지 못하면 THE SYSTEM SHALL credential 저장도 되돌린다.

## 하위 문서

요구사항은 이 문서가 소유하고 상세 규칙은 하위 문서가 정한다.

| 문서 | 내용 | 요구사항 |
| --- | --- | --- |
| [가입 · 재설정 · 이메일 변경](CLE-ACCT-SIGNIN-SIGNUP.md) | 인증 화면 공통, 가입과 이메일 인증, 이메일·비밀번호 인증 규칙, 이메일 비교 규칙, 비밀번호 재설정, 이메일 변경 | REQ-SIGNIN-001, REQ-SIGNIN-002, REQ-SIGNIN-003, REQ-SIGNIN-004, REQ-SIGNIN-005, REQ-SIGNIN-006, REQ-SIGNIN-007, REQ-SIGNIN-008, REQ-SIGNIN-009, REQ-SIGNIN-010, REQ-SIGNIN-011, REQ-SIGNIN-012, REQ-SIGNIN-013, REQ-SIGNIN-031, REQ-SIGNIN-032, REQ-SIGNIN-033, REQ-SIGNIN-034, REQ-SIGNIN-035, REQ-SIGNIN-036, REQ-SIGNIN-037, REQ-SIGNIN-038, REQ-SIGNIN-039, REQ-SIGNIN-040, REQ-SIGNIN-041, REQ-SIGNIN-042, REQ-SIGNIN-043, REQ-SIGNIN-044, REQ-SIGNIN-045, REQ-SIGNIN-046, REQ-SIGNIN-047, REQ-SIGNIN-086, REQ-SIGNIN-087, REQ-SIGNIN-088, REQ-SIGNIN-089 |
| [로그인과 소셜 로그인](CLE-ACCT-SIGNIN-LOGIN.md) | 로그인 화면과 처리 순서, 2단계 인증 방식 선택, TOTP 입력 · Passkey 인증 화면, 소셜 로그인 흐름 · 콜백 · 에러 처리 | REQ-SIGNIN-014, REQ-SIGNIN-015, REQ-SIGNIN-016, REQ-SIGNIN-017, REQ-SIGNIN-018, REQ-SIGNIN-019, REQ-SIGNIN-048, REQ-SIGNIN-049, REQ-SIGNIN-050, REQ-SIGNIN-051, REQ-SIGNIN-052, REQ-SIGNIN-053, REQ-SIGNIN-054, REQ-SIGNIN-065, REQ-SIGNIN-066, REQ-SIGNIN-067 |
| [2단계 인증 설정과 TOTP](CLE-ACCT-SIGNIN-TOTP.md) | 2단계 인증 수단과 설정 화면, TOTP 켜기 · 끄기, 복구 코드 | REQ-SIGNIN-020, REQ-SIGNIN-022, REQ-SIGNIN-023, REQ-SIGNIN-056, REQ-SIGNIN-057, REQ-SIGNIN-058, REQ-SIGNIN-059, REQ-SIGNIN-073, REQ-SIGNIN-074, REQ-SIGNIN-075, REQ-SIGNIN-076, REQ-SIGNIN-077, REQ-SIGNIN-078, REQ-SIGNIN-083, REQ-SIGNIN-084, REQ-SIGNIN-085 |
| [Passkey 기능과 등록](CLE-ACCT-SIGNIN-PASSKEY.md) | Passkey 기능 켜기와 환경 변수, 등록 흐름(비밀번호 재확인, 저장 원자성, 알고리즘, transport, 표시 이름), Passkey 삭제, 도메인 모듈 | REQ-SIGNIN-021, REQ-SIGNIN-024, REQ-SIGNIN-025, REQ-SIGNIN-026, REQ-SIGNIN-027, REQ-SIGNIN-060, REQ-SIGNIN-061, REQ-SIGNIN-062, REQ-SIGNIN-063, REQ-SIGNIN-064, REQ-SIGNIN-079, REQ-SIGNIN-080, REQ-SIGNIN-081, REQ-SIGNIN-082, REQ-SIGNIN-090, REQ-SIGNIN-091, REQ-SIGNIN-092, REQ-SIGNIN-093, REQ-SIGNIN-094, REQ-SIGNIN-095 |
| [Passkey 로그인 인증](CLE-ACCT-SIGNIN-PKAUTH.md) | 로그인 2단계 Passkey 인증 흐름, 인증 챌린지 한 번만 쓰기, sign counter 역행과 동시성 | REQ-SIGNIN-028, REQ-SIGNIN-029, REQ-SIGNIN-030, REQ-SIGNIN-068, REQ-SIGNIN-069, REQ-SIGNIN-070, REQ-SIGNIN-071, REQ-SIGNIN-072 |
| [API 와 에러 코드](CLE-ACCT-SIGNIN-API.md) | 엔드포인트 표와 에러 코드 표 | 위 요구사항 전체의 API 계약 |

요구사항 REQ-SIGNIN-055 는 아래 「셀프 호스팅 추가 인증 (미구현)」 이 다룬다.

## 공통 규칙

- 성공 응답 표기는 응답 봉투 `{ data: … }` 안의 내용이다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 규칙 5). 에러 응답 형식은 [에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md) 가 정한다.
- 이 문서에서 2단계 인증은 TOTP 와 Passkey 를 함께 뜻한다. Passkey 가 하나라도 있으면 로그인 2단계는 Passkey 로만 통과한다.
- 하위 문서는 요구사항을 다시 정하지 않는다. 요구사항과 하위 문서가 어긋나면 요구사항을 따른다.
- [2단계 인증 설정과 TOTP](CLE-ACCT-SIGNIN-TOTP.md) 의 TOTP 카드가 읽는 켜짐 여부 필드 `twoFactorEnabled` 는 [내 프로필](CLE-ACCT-PROFILE.md#api) 의 API 표(REQ-PROFILE-027)가 정한다.

## 셀프 호스팅 추가 인증 (미구현)

아래 두 방식은 아직 구현하지 않았다. 백엔드에 LDAP·SAML 핸들러, passport strategy, 의존성이 없다. 셀프 호스팅 운영자를 위한 선택 기능으로 계획만 정했다. 후속 Task 로 추적한다.

| 방식 | 설명 |
| --- | --- |
| LDAP | LDAP·Active Directory 연결 (선택, 미구현) |
| SAML 2.0 | 기업 SSO 연결 (선택, 미구현) |

## 미결 사항

미결 사항은 해당 하위 문서에 있다.

- 비밀번호 재설정 실패의 에러 코드: [가입 · 재설정 · 이메일 변경 「미결 사항」](CLE-ACCT-SIGNIN-SIGNUP.md#미결-사항)
- 다른 챌린지로 온 Passkey 응답의 순서가 뒤바뀐 경우의 역행 처분: [Passkey 로그인 인증 「미결 사항」](CLE-ACCT-SIGNIN-PKAUTH.md#미결-사항)
- 로그인 응답 시간으로 계정이 드러나는 문제: [로그인과 소셜 로그인 「미결 사항」](CLE-ACCT-SIGNIN-LOGIN.md#미결-사항)
- 복구 코드 소비의 원자성: [2단계 인증 설정과 TOTP 「미결 사항」](CLE-ACCT-SIGNIN-TOTP.md#미결-사항)

## 옮긴 절

다른 문서가 이 문서의 절을 가리키던 자리다. 내용은 하위 문서로 옮겼다.

### 2단계 인증 방식 선택

→ [2단계 인증 방식 선택](CLE-ACCT-SIGNIN-LOGIN.md#2단계-인증-방식-선택)

### 2단계 인증 설정 화면

→ [2단계 인증 설정 화면](CLE-ACCT-SIGNIN-TOTP.md#2단계-인증-설정-화면)

### API

→ [API](CLE-ACCT-SIGNIN-API.md#api)

### counter 역행이면 credential 을 지운다 (suspend 기각)

→ [counter 역행이면 credential 을 지운다 (suspend 기각)](CLE-ACCT-SIGNIN-PKAUTH.md#counter-역행이면-credential-을-지운다-suspend-기각)

### Passkey 기능 켜기와 환경 변수

→ [Passkey 기능 켜기와 환경 변수](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-기능-켜기와-환경-변수)

### Passkey 기능이 꺼져도 credential 목록 조회는 빈 목록을 준다 (2026-11-05)

→ [Passkey 기능이 꺼져도 credential 목록 조회는 빈 목록을 준다 (2026-11-05)](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-기능이-꺼져도-credential-목록-조회는-빈-목록을-준다-2026-11-05)

### Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다 (2026-10-17)

→ [Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다 (2026-10-17)](CLE-ACCT-SIGNIN-LOGIN.md#passkey-기능이-꺼지면-passkey-만-등록한-계정의-로그인을-막는다-2026-10-17)

### Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)

→ [Passkey 등록에도 비밀번호 재확인을 두고 TOTP 대기 secret 은 10분 뒤 버린다 (2026-11-02)](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록에도-비밀번호-재확인을-두고-totp-대기-secret-은-10분-뒤-버린다-2026-11-02)

### Passkey 인증 챌린지는 한 번만 쓴다 (2026-10-17)

→ [Passkey 인증 챌린지는 한 번만 쓴다 (2026-10-17)](CLE-ACCT-SIGNIN-PKAUTH.md#passkey-인증-챌린지는-한-번만-쓴다-2026-10-17)

### sign counter 역행과 동시성

→ [sign counter 역행과 동시성](CLE-ACCT-SIGNIN-PKAUTH.md#sign-counter-역행과-동시성)

### TOTP 끄기

→ [TOTP 끄기](CLE-ACCT-SIGNIN-TOTP.md#totp-끄기)

### TOTP 켜기

→ [TOTP 켜기](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기)

### TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다 (2026-11-01)

→ [TOTP 켜기는 비밀번호를 다시 확인하고 켜진 계정을 거부한다 (2026-11-01)](CLE-ACCT-SIGNIN-TOTP.md#totp-켜기는-비밀번호를-다시-확인하고-켜진-계정을-거부한다-2026-11-01)

### 대소문자만 다른 기존 계정은 대소문자까지 같은 계정만 쓰고 나머지는 모호로 거부한다 (2026-11-05)

→ [대소문자만 다른 기존 계정은 대소문자까지 같은 계정만 쓰고 나머지는 모호로 거부한다 (2026-11-05)](CLE-ACCT-SIGNIN-SIGNUP.md#대소문자만-다른-기존-계정은-대소문자까지-같은-계정만-쓰고-나머지는-모호로-거부한다-2026-11-05)

### 로그인 처리

→ [로그인 처리](CLE-ACCT-SIGNIN-LOGIN.md#로그인-처리)

### 로그인 화면

→ [로그인 화면](CLE-ACCT-SIGNIN-LOGIN.md#로그인-화면)

### 복구 코드

→ [복구 코드](CLE-ACCT-SIGNIN-TOTP.md#복구-코드)

### 소셜 로그인

→ [소셜 로그인](CLE-ACCT-SIGNIN-LOGIN.md#소셜-로그인)

### 에러 처리

→ [에러 처리](CLE-ACCT-SIGNIN-LOGIN.md#에러-처리)

### 에러 코드

→ [에러 코드](CLE-ACCT-SIGNIN-API.md#에러-코드)

### 역행은 서명 검증을 통과한 응답에서만 판정한다 (2026-10-30)

→ [역행은 서명 검증을 통과한 응답에서만 판정한다 (2026-10-30)](CLE-ACCT-SIGNIN-PKAUTH.md#역행은-서명-검증을-통과한-응답에서만-판정한다-2026-10-30)

### 이메일 변경

→ [이메일 변경](CLE-ACCT-SIGNIN-SIGNUP.md#이메일-변경)

### 이메일 변경 화면

→ [이메일 변경 화면](CLE-ACCT-SIGNIN-SIGNUP.md#이메일-변경-화면)

### 이메일 비교 규칙

→ [이메일 비교 규칙](CLE-ACCT-SIGNIN-SIGNUP.md#이메일-비교-규칙)

### 이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다 (2026-10-17)

→ [이메일 인증 전 계정은 비밀번호가 맞을 때만 알린다 (2026-10-17)](CLE-ACCT-SIGNIN-LOGIN.md#이메일-인증-전-계정은-비밀번호가-맞을-때만-알린다-2026-10-17)

### Passkey 등록·인증 흐름

→ [Passkey 등록 흐름](CLE-ACCT-SIGNIN-PASSKEY.md#passkey-등록-흐름) · [Passkey 로그인 인증 흐름](CLE-ACCT-SIGNIN-PKAUTH.md#passkey-로그인-인증-흐름)
