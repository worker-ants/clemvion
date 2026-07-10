# 신규 식별자 충돌 검토 — auth-reauth-spec-accuracy

- target: `plan/in-progress/auth-reauth-spec-accuracy.md`
- 대상 spec: `spec/5-system/1-auth.md` §2.3, `spec/5-system/3-error-handling.md` §1.2.1
- 모드: spec draft 검토 (--spec)
- 재실행 사유: 이전 Workflow 실행이 STATUS success 를 보고했으나 output_file 이 FS-write flakiness 로 유실되어 재수행. 특히 근접-네이밍 클러스터 `PASSWORD_INVALID`(reauth/2FA-mgmt) vs `INVALID_PASSWORD`(password-change, `users.service.ts`) vs `PASSWORD_REQUIRED`(`auth.service.ts`) 를 중점 검증.

## 발견사항

### [CRITICAL] `PASSWORD_INVALID` 신규 카탈로그 등재 서술 "로그인과 공용" — 실제 코드와 불일치

- **target 신규 식별자**: `PASSWORD_INVALID` (401) — `plan/in-progress/auth-reauth-spec-accuracy.md` 변경 1b (§2.3 note, plan line 76) `"비밀번호 불일치 → PASSWORD_INVALID(401, 로그인과 공용)"` 및 변경 2a (§1.2.1 표 신규 행, plan line 87) `"비밀번호 재확인 불일치 (재인증·로그인 공용)"`
- **기존 사용처**:
  - `codebase/backend/src/modules/auth/auth.service.ts:261-353` (`AuthService.login()`) — 비밀번호 불일치를 포함한 **모든** 로그인 실패 분기가 `code: 'LOGIN_FAILED'` (401) 로만 응답한다 (line 287, 318, 333, 350 — user-enumeration 방지를 위한 의도적 통일). 비밀번호 불일치의 경우 `login_history.failureReason` 감사값에만 `'INVALID_PASSWORD'` (line 347, **단어순서가 반대**인 별개 문자열) 를 남긴다.
  - `codebase/backend/src/modules/auth/auth.service.ts:81` (`AuthService.verifyPasswordForUser`, 2FA 비활성화 등 재인증 전용) 및 `codebase/backend/src/modules/auth/sessions.service.ts:267` (`SessionsService.verifyReauth`, 세션 강제종료·revoke-others·이메일 변경) 만 실제로 `code: 'PASSWORD_INVALID'` 를 던진다. 저장소 전체에서 `'PASSWORD_INVALID'` 문자열 throw 지점은 이 두 곳뿐이다 (`grep -rn "'PASSWORD_INVALID'" codebase/backend/src` 로 확인).
- **상세**: target 이 새로 등재하는 `PASSWORD_INVALID` 카탈로그 행·note 는 "로그인과 공용"(shared with login) 이라 명시하지만, `POST /api/auth/login` 은 `PASSWORD_INVALID` 를 **한 번도 응답하지 않는다** — 언제나 `LOGIN_FAILED` 다. 대조적으로 target 이 같은 문장에서 "로그인 2FA 와 공용"이라 서술하는 `TOTP_INVALID` 는 실제로 `totp.service.ts:106`·`auth.service.ts:453`(로그인 2FA)·`sessions.service.ts:280`(재인증) 세 곳에서 동일 문자열로 진짜 공유된다 — 이 대칭 서술 패턴이 `PASSWORD_INVALID` 에도 잘못 확장 적용된 것으로 보인다. 원인은 근접 식별자 두 개의 혼동으로 추정된다: 로그인이 실제로 공유하는 것은 `PASSWORD_INVALID` 가 아니라 감사로그 `failureReason` 값 `INVALID_PASSWORD`(단어순서 전치, API `code` 가 아님)이다. 이 오류가 SoT 문서(§1.2.1 카탈로그 + §2.3 note)에 그대로 등재되면, 프론트엔드/클라이언트 통합자가 `POST /auth/login` 실패 처리에서 `error.code === 'PASSWORD_INVALID'` 분기를 작성하는 등 도달 불가능한 코드를 작성하게 되고, 로그인 실패 UX 가 의도한 비밀번호-특화 분기 대신 항상 generic fallback 으로 빠지는 실질적 결함으로 이어질 수 있다.
- **제안**: §2.3 note 와 §1.2.1 표의 `PASSWORD_INVALID` 서술에서 "로그인과 공용"/"재인증·로그인 공용" 부분을 삭제하거나, "로그인은 동일 의미의 실패를 `LOGIN_FAILED`(401, user-enumeration 방지 통합 코드)로 응답하며 감사로그 `login_history.failure_reason='INVALID_PASSWORD'` 로만 세부 사유를 남긴다 — API `code` 자체는 로그인과 공유되지 않는다"로 정정. `TOTP_INVALID` 행은 실제로 공유되므로 현재 서술 유지.

### [CRITICAL] §1.2.1 note 의 `INVALID_PASSWORD` 스코프 서술 "비밀번호 변경·2FA 해지" — 2FA 해지는 실제로 `PASSWORD_INVALID` 를 던짐 (근접명 상호 교차 오귀속)

- **target 신규 식별자**: `INVALID_PASSWORD` (미등재, 후속 추적 대상) — `plan/in-progress/auth-reauth-spec-accuracy.md` 변경 2b After 텍스트(plan line 98) `"...INVALID_PASSWORD(비밀번호 변경·2FA 해지)는 ... 후속으로 남긴다"`
- **기존 사용처**:
  - `codebase/backend/src/modules/users/users.service.ts:61-87` (`UsersService.changePassword`, `POST /api/users/me/change-password`) — 유일하게 `code: 'INVALID_PASSWORD'` (line 76, 84) 를 던지는 지점.
  - `codebase/backend/src/modules/auth/auth.controller.ts:320-342` (`POST /api/auth/2fa/disable`) → `authService.verifyPasswordForUser(...)` 호출 → **`PASSWORD_INVALID`**(단어순서가 반대인 별개 코드, `auth.service.ts:81`) 를 던진다. `INVALID_PASSWORD` 가 아니다. (`codebase/backend/src/modules/auth/auth.controller.spec.ts:469-482` 테스트로 확인.)
- **상세**: target note 는 아직 미등재인 `INVALID_PASSWORD` 의 적용 범위를 "비밀번호 변경·2FA 해지" 두 엔드포인트로 서술하지만, 실제로 2FA 해지(`/auth/2fa/disable`)가 던지는 코드는 `INVALID_PASSWORD` 가 아니라 (동일 문장 바로 앞에서 target 이 카탈로그로 신규 등재하는) `PASSWORD_INVALID` 다. 즉 두 근접-네이밍 코드가 **문서 내에서 서로 뒤바뀌어 귀속**됐다 — 정확히는 "2FA 해지"는 `PASSWORD_INVALID`(reauth/2FA-mgmt 클러스터, `verifyPasswordForUser`) 쪽 사용처이고, `INVALID_PASSWORD`(변경 코드) 는 `changePassword` 단일 엔드포인트에만 쓰인다. 이는 근접-네이밍 충돌이 이미 spec 초안 작성 과정에서 실제 오류를 유발한 구체적 증거다.
- **제안**: 2b After 텍스트에서 `INVALID_PASSWORD` 의 괄호 설명을 "(비밀번호 변경)" 으로 정정하고, "2FA 해지"는 삭제하거나 `PASSWORD_INVALID` 서술 쪽(1b/§1.2.1 표) 에 "`POST /auth/2fa/disable`(2FA 비활성화, `AuthService.verifyPasswordForUser`)" 사용처로 명시 추가. §2.3 note(1b) 의 "강제 종료·revoke-others·이메일 변경 §1.1.B 공용" 서술에도 `verifyPasswordForUser` 경유 `/auth/2fa/disable` 사용처가 누락돼 있으므로 함께 보강 권고(§CRITICAL-1 의 원인과 동일한 두 메서드 혼동에서 기인).

### [WARNING] `PASSWORD_INVALID` ↔ `INVALID_PASSWORD` 단어순서 전치 — 카탈로그 정식 등재로 혼동 위험 확대

- **target 신규 식별자**: `PASSWORD_INVALID` (§1.2.1 표 신규 행, 카탈로그 SoT 승격)
- **기존 사용처**: `INVALID_PASSWORD` — `codebase/backend/src/modules/users/users.service.ts:76,84`(API `code`, change-password), `codebase/backend/src/modules/auth/auth.service.ts:347`(login_history `failureReason`), `spec/1-data-model.md:705`, `spec/data-flow/2-auth.md:76`, `spec/5-system/1-auth.md:688`
- **상세**: 두 식별자는 단어 순서만 다르고(`PASSWORD_INVALID` vs `INVALID_PASSWORD`) 의미도 유사("비밀번호 자격증명 거부")해 API 소비자가 통합 코드 작성 시 혼동하기 쉽다. 지금까지는 `PASSWORD_INVALID` 가 코드에만 존재하고 spec 카탈로그에 등재되지 않아 노출도가 낮았으나, 이번 target 변경으로 `spec/5-system/3-error-handling.md` §1.2.1 정식 표(공용 카탈로그 SoT) 에 처음 등재되면서 가시성이 올라가고, 같은 절 note 안에 (등재하지 않는) `INVALID_PASSWORD` 도 나란히 언급된다(위 CRITICAL 항목 참고) — 두 문자열이 같은 단락에 병기되는 것 자체가 향후 편집·통합 과정에서 재차 혼동될 실질적 위험을 만든다. 두 코드는 이미 프로덕션 API 계약으로 출고돼 있어 리네이밍은 breaking change 이므로 즉시 통합은 권장하지 않는다.
- **제안**: §1.2.1 표의 `PASSWORD_INVALID` 행 또는 note 에 "⚠`INVALID_PASSWORD`(`/users/me/change-password` 전용, 별도 코드)와 혼동 주의" 같은 명시적 disambiguation 문구를 추가. 코드 리네이밍은 범위 밖(breaking change)이므로 문서 차원 명확화로 완화.

### [WARNING] `PASSWORD_REQUIRED` (2FA 해지 재인증) vs 신규 `REAUTH_REQUIRED` (세션/이메일 재인증) — 동일 상황(자격증명 미입력)에 다른 이름·다른 status, `PASSWORD_REQUIRED` 는 카탈로그 완전 누락

- **target 신규 식별자**: `REAUTH_REQUIRED` (400, §1.2.1 표 신규 행)
- **기존 사용처**: `PASSWORD_REQUIRED` (401) — `codebase/backend/src/modules/auth/auth.service.ts:69-76` (`AuthService.verifyPasswordForUser`, 사용자 미존재 또는 `passwordHash` 부재 시). `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` 어디에도 `PASSWORD_REQUIRED` 문자열이 등장하지 않는다(전수 검색 결과 0건) — 완전 미문서 상태.
- **상세**: `verifyReauth`(세션 강제종료/revoke-others/이메일변경)의 "자격증명 미입력" 케이스는 `REAUTH_REQUIRED`(400)이고, `verifyPasswordForUser`(2FA 해지)의 대응 케이스는 `PASSWORD_REQUIRED`(401)다. 두 코드는 같은 도메인(비밀번호/2FA 재인증)의 유사 상황을 가리키지만 이름 규칙(REAUTH_ vs PASSWORD_)과 HTTP status(400 vs 401)가 서로 달라 API 소비자가 "재인증 필요" 상황을 한 가지로 다룰 때 혼동 소지가 있다. 더 중요하게는, target 의 변경 2b Before 텍스트는 제외 대상 3코드(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`) 를 명시적으로 나열했고 After 텍스트도 미등재 잔여 항목(`NOT_A_MEMBER`/`INVALID_PASSWORD`)을 명시적으로 "후속 추적" 대상으로 남기지만, `PASSWORD_REQUIRED` 는 Before/After 어느 쪽에도 언급되지 않아 후속 추적 목록에서조차 누락된 채 완전히 묻힌다.
- **제안**: §2.3 note 또는 §1.2.1 note 의 "추적 대상" 목록에 `PASSWORD_REQUIRED`(`/auth/2fa/disable`) 를 명시적으로 추가해 다른 미등재 코드와 동일하게 후속 추적을 보장. 여력이 되면 `REAUTH_REQUIRED` 신규 행 옆에 "cf. 2FA 해지 전용 `PASSWORD_REQUIRED`(401, 별도 미등재)" cross-reference 를 남겨 두 코드가 다른 메서드/status 임을 명시.

### [INFO] `REAUTH_REQUIRED` ↔ 기존 `AUTH_REQUIRED` 시각적 유사성 (낮은 위험)

- **target 신규 식별자**: `REAUTH_REQUIRED` (400)
- **기존 사용처**: `AUTH_REQUIRED` (401) — `spec/5-system/3-error-handling.md:42` ("토큰 없음")
- **상세**: 접두 "RE" 한 글자 차이지만 의미(재인증 vs 최초 인증 토큰 부재)와 섹션(§1.2 vs §1.2.1)이 뚜렷이 구분되고 status 도 다르다(401 vs 400). 실질 혼동 위험은 낮음.
- **제안**: 별도 조치 불요. 신규 등재 시 필요하면 §1.2.1 도입부 문장에 "`AUTH_REQUIRED`(토큰 자체 부재)와 구분되는 재인증 전용 코드"라는 1줄 각주만 고려 가능.

## 그 외 점검 관점 (충돌 없음)

- **요구사항 ID**: target 은 신규 요구사항 ID(`NAV-*`/`ND-*` 등)를 부여하지 않는다. 해당 없음.
- **엔티티/DTO/인터페이스명**: 신규 엔티티·타입 도입 없음(기존 `SessionsService.verifyReauth`/`AuthService.verifyPasswordForUser` 서술 정정뿐). 해당 없음.
- **API endpoint**: 신규 endpoint 없음. 기존 endpoint(`/auth/login`, `/auth/2fa/disable`, `/users/me/*`, `/sessions/*` 등)의 에러 응답 문서화만 수행. 해당 없음.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음. `login_history` 이벤트값(`totp_failed` 등) 은 기존 값 그대로 인용. 해당 없음.
- **환경변수/설정키**: 신규 ENV/설정키 없음. 해당 없음.
- **파일 경로**: 신규 spec 파일 생성 없음. 기존 `1-auth.md`/`3-error-handling.md` 편집만. 해당 없음.

## 요약

target 이 §1.2.1 카탈로그에 처음 정식 등재하는 `PASSWORD_INVALID` 자체는(코드상 `verifyPasswordForUser`·`verifyReauth` 두 지점에서 일관된 의미로 이미 쓰이고 있어) 식별자 재정의 충돌은 아니지만, 그 서술 텍스트가 근접-네이밍 3-way 클러스터(`PASSWORD_INVALID` / `INVALID_PASSWORD` / `PASSWORD_REQUIRED`)를 정확히 구분하지 못해 이미 두 군데에서 실제 사용처를 잘못 귀속했다 — (1) `PASSWORD_INVALID`를 "로그인과 공용"이라 서술했지만 로그인은 `LOGIN_FAILED`만 반환하고 실제 로그인 공유분은 감사로그 `failureReason='INVALID_PASSWORD'`(단어순서 반대)일 뿐이며, (2) `INVALID_PASSWORD`의 적용범위에 "2FA 해지"를 넣었지만 2FA 해지는 실제로 `PASSWORD_INVALID`를 던진다. 두 오류 모두 이번 draft가 새로 작성한 SoT 서술 안에서 발생했고, 그대로 반영되면 클라이언트 통합 코드가 도달 불가능한 분기를 갖거나 실제 응답 코드를 못 잡는 실질적 결함으로 이어질 수 있어 반영 전 정정이 필요하다. 추가로 `PASSWORD_REQUIRED`가 이번에도 카탈로그·후속 추적 어디에도 언급되지 않고 완전히 누락되는 점은 WARNING 으로 별도 정정을 권고한다.

## 위험도

HIGH
