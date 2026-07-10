# 정식 규약 준수 검토 — auth-reauth-spec-accuracy

target: `plan/in-progress/auth-reauth-spec-accuracy.md` (spec draft 검토, `--spec`)
대상 spec 변경: `spec/5-system/1-auth.md` §2.3/§1.1.B/Rationale, `spec/5-system/3-error-handling.md` §1.2.1/Rationale

## 발견사항

- **[WARNING]** `login_history.failure_reason` 에 `event` 값(`totp_failed`)을 오귀속
  - target 위치: "## 코드 검증" 절 불릿 (`실패 사유는 login_history.failure_reason(INVALID_PASSWORD/totp_failed 등, §4.3) 이벤트 문자열로만 감사 기록`) 및 이를 그대로 옮긴 실제 편집안 **변경 2 §2b)** (`3-error-handling.md §1.2.1` 하단 주석 교체문, `...실패 사유는 login_history.failure_reason(INVALID_PASSWORD·totp_failed 등, §4.3) 이벤트 문자열로 감사 기록된다...`)
  - 위반 규약: `spec/conventions/error-codes.md` §1 (`UPPER_SNAKE_CASE` 표기 규율 — `3-error-handling.md §1.2.1` 도입부가 "모두 `UPPER_SNAKE_CASE` 규약을 따른다"고 바로 이 절에서 명시적으로 선언한 직후 같은 절의 각주가 lower_snake_case 값을 뒤섞음). 보조 근거: `1-auth.md §4.3`(LoginHistory `event` enum, 전부 lower_snake — `login_success`/`login_failed`/`totp_failed`/`webauthn_failed`/…) vs `1-data-model.md §2.18.2`(LoginHistory `failure_reason` 값 목록, 전부 UPPER_SNAKE — `INVALID_PASSWORD`/`ACCOUNT_LOCKED`/`TOTP_INVALID`/`WEBAUTHN_INVALID`/`WEBAUTHN_COUNTER_REGRESSION`)가 이미 SoT 로 두 필드를 분리해둔 상태.
  - 상세: 코드 실측(`auth.service.ts:444-455`)에서 로그인 TOTP 실패는 `loginHistory.record({ event: 'totp_failed', failureReason: 'TOTP_INVALID' })` 로 **두 개의 별도 필드**에 각각 lower_snake(`event`)·UPPER_SNAKE(`failure_reason`) 값을 기록한다. `1-data-model.md:705` 도 `failure_reason` 값 목록에 `TOTP_INVALID`(UPPER_SNAKE)만 등재하고 `totp_failed` 는 없다. 그런데 draft 는 `login_history.failure_reason(INVALID_PASSWORD/totp_failed 등)` 로 적어 `totp_failed`(실제로는 `event` 값)를 `failure_reason` 값인 것처럼 귀속시킨다. 이 표현은 이번 draft 가 **새로 도입**한 것으로, 정정 전 원문(`3-error-handling.md` 현재 §1.2.1 각주)은 "이벤트값 `totp_failed`" 라고만 하고 어느 컬럼인지 단정하지 않아 이 오류가 없었다 — 이번 개정이 오히려 부정확도를 높이는 회귀다. `PASSWORD_INVALID`/`INVALID_PASSWORD` 오귀속(1차 consistency-check 가 CRITICAL 로 잡아 이미 정정됨)과 같은 계열의 근접명명 혼동이 한 겹 더 남아있는 셈.
  - 제안: 변경 2-b) 각주를 "로그인 2FA TOTP 실패는 `login_history.event='totp_failed'` 로 기록되며, 상세 사유는 `failure_reason='TOTP_INVALID'` 로 함께 남는다" 처럼 두 필드를 명시적으로 분리하거나, `failure_reason` 예시 나열에서 `totp_failed` 를 제거하고 `TOTP_INVALID` 로 교체할 것. "## 코드 검증" 배경 절의 동일 문구도 함께 정정.

- **[INFO]** `3-error-handling.md` §1.2 본표와 §1.2.1 하위표의 상태코드 컬럼명 불일치 (`HTTP` vs `status`)
  - target 위치: 변경 2-a) 신규 3행 추가 대상 표 (§1.2.1)
  - 위반 규약: 명시적 규약 위반은 아님 — `spec/conventions/error-codes.md` 자체는 컬럼명을 규정하지 않음. 다만 같은 문서 §1.2(`| 코드 | 이름 | 설명 | HTTP |`)와 바로 아래 §1.2.1(`| 코드 | status | 설명 | 도메인 SoT |`)의 상태코드 컬럼명이 다른 pre-existing 불일치.
  - 상세: 이번 draft 는 이 불일치를 새로 만든 것이 아니라 §1.2.1 의 기존 헤더(`status`)를 그대로 따라 3행을 추가할 뿐이라 draft 귀책은 아님. 다만 §1.2.1 을 이번에 직접 편집하는 김에 헤더를 `HTTP` 로 통일할 기회이기도 하다.
  - 제안: 이번 PR 범위 밖으로 두어도 무방. 통일하고 싶다면 §1.2.1 헤더를 `status`→`HTTP` 로 바꾸고 기존 5행(`WEBAUTHN_DISABLED` 등)도 함께 리네이밍.

검증 후 문제 없음으로 확인된 항목 (참고용, 발견사항 아님):
- 에러 코드 명명(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_NOT_AVAILABLE`) 은 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명으로 `error-codes.md §1` 준수. rename 이 아니라 기존 구현 코드의 신규 문서화이므로 §2 안정성 정책과도 무충돌.
- `PASSWORD_INVALID`(재인증/2FA·WebAuthn 재확인) vs `INVALID_PASSWORD`(비밀번호 변경) 근접명명 구분은 draft 전체에서 일관되게 유지됨 (1차 consistency-check CRITICAL 지적이 이번 개정에서 해소된 것으로 실측 확인 — `users.service.ts:76,84` = `INVALID_PASSWORD`, `sessions.service.ts:267/280`+`auth.service.ts:81` = `PASSWORD_INVALID`).
- 신규 카탈로그 3행의 status 값(`REAUTH_REQUIRED`=400, `PASSWORD_INVALID`=401, `TOTP_INVALID`=401)은 `sessions.service.ts:257-286`(`BadRequestException`/`UnauthorizedException` 실측)과 정확히 일치 — 기존 §1.2.1 각주의 status 오기(403/400)를 올바르게 정정.
- 신규 cross-ref 앵커 `1-auth.md#23-세션-정책`, `3-error-handling.md#121-2fa--webauthn--재인증-코드-도메인-spec-참조` 는 리포 안에서 이미 검증된 실제 slug 패턴(`4-integration.md §9.2 → #92-인증--회전--scope`, 슬래시 제거 후 공백이 hyphen 으로 collapse 되지 않는 github-slugger 동작)과 정확히 일치 — `spec-impl-evidence.md §4.2` 의 `spec-link-integrity.test.ts` 통과 예상.
- Rationale 신규 서브섹션(`2.3.D`)의 헤더 포맷(`### <id> — <title>`)·삽입 위치는 `1-auth.md` Rationale 절의 기존 관례(비-순차적 `2.3.x`/`1.5.x` 혼재 배치, `2.3.C` 직후 삽입)와 정합.
- `spec/conventions/error-codes.md §3`(historical-artifact 예외 레지스트리) 등재 불요 — 신규 3코드 이름은 부정확하지 않으므로 예외 등록 대상이 아님.
- 문서 구조(Overview/본문/Rationale) 규약: 두 대상 spec 문서 모두 기존 3섹션 구조를 유지하며 변경분은 본문·Rationale 각각에 올바르게 배치됨.

## 요약

이번 draft 는 §2.3 "강제 종료 재인증" drift 정정과 재인증 세부 에러코드 3종의 카탈로그 등재를 다루며, 에러 코드 명명(`UPPER_SNAKE_CASE`)·근접명명 구분(`PASSWORD_INVALID` vs `INVALID_PASSWORD`)·status 코드 정확성·cross-ref 앵커 슬러그 모두 실제 코드/기존 SoT 와 대조해 정확함을 확인했다. 다만 §1.2.1 각주 정정문(변경 2-b)이 `login_history.failure_reason` 예시에 실제로는 `event` 필드 값인 `totp_failed`(lower_snake)를 끼워 넣어, 같은 절이 명시한 `UPPER_SNAKE_CASE` 규약과 `1-data-model.md`/`1-auth.md §4.3` 의 기존 필드 구분을 어기는 새로운 근접명명 오류를 하나 더 만든다 — 1차 consistency-check 가 잡았던 `PASSWORD_INVALID`/`INVALID_PASSWORD` 오귀속과 같은 계열의 실수이므로 반영 전 정정이 필요하다. 그 외에는 정식 규약(`spec/conventions/**`) 관점에서 구조적 위반이 없다.

## 위험도
LOW
