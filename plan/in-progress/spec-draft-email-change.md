---
worktree: spec-email-change-0fcba4
started: 2026-06-21
owner: planner
status: draft
spec_targets:
  - spec/5-system/1-auth.md
  - spec/2-navigation/9-user-profile.md
  - spec/1-data-model.md
  - spec/conventions/audit-actions.md
  - spec/data-flow/1-audit.md
---

# Spec draft: 이메일 변경 프로세스 (별도 프로세스)

> `/profile` 의 "이메일은 별도 프로세스로 변경할 수 있어요 (곧 지원 예정)" 안내를 실제 동작으로 구현하기 위한 spec 변경안.
> 관련: [Auth §1.1/§2.3/§4.1](../../spec/5-system/1-auth.md) · [User Profile §2/§6.1](../../spec/2-navigation/9-user-profile.md) · [Data Model §2.1 User](../../spec/1-data-model.md#21-user)
> consistency-check: review/consistency/2026/06/21/17_18_50/SUMMARY.md — **BLOCK: NO**. 본 draft 는 그 Warning 4 / INFO 다수를 흡수한 갱신본.

## 확정된 설계 (사용자 결정 2026-06-21)

1. **시작 시 재인증** — 변경을 시작하려면 비밀번호(보유 시) 또는 등록된 2FA factor(TOTP·WebAuthn)로 재인증한다. **이메일 OTP 는 배제**(R7). 사용자의 "2FA 있을 때는 신규만 인증" 직관은 *별도 분기 로직이 아니라* 재인증 강도가 계정 상태에 따라 자동 스케일되는 것으로 흡수된다.
2. **신규 이메일만 인증** — 신규 이메일로만 확인 링크 발송. 기존(옛) 이메일에는 **차단 없는 통지**만(보안 안내). "기존+신규 둘 다 클릭" 차단 방식은 **기각** — 옛 메일함 접근을 잃은 사용자(이메일 변경의 주 사유)를 영구히 막고, 재인증이 이미 메일함 소유보다 강한 본인 증명을 제공하므로 보안 이득이 없음.
3. **OAuth 전용·재인증 수단 없는 계정 차단** — `password_hash` 도 2FA(TOTP/WebAuthn)도 없는 계정은 `REAUTH_NOT_AVAILABLE` 로 이메일 변경 차단(self-service 불가, 안내만).
4. **커밋 시 세션 처리** — 비밀번호 변경과 동일: 확인 완료 시 전 family revoke + 현재 디바이스 재발급(§2.3 / Rationale 2.3.C 패턴 재사용).

---

## 1. 데이터 모델 — `spec/1-data-model.md` §2.1 User

기존 `email_verify_token` 3필드 패턴을 그대로 복제해 **3개 컬럼 추가**:

| 필드 | 타입 | 설명 |
|------|------|------|
| pending_email | String? | 확인 대기 중인 신규 이메일. 확인 완료/취소 시 NULL |
| email_change_token | String? | 이메일 변경 확인 토큰 **SHA-256 해시** (1h 유효). 확인/취소/만료 시 NULL |
| email_change_expires_at | Timestamp? | 변경 확인 토큰 만료 시각 |

- 마이그레이션: 구현 시 `V100__add_email_change_fields.sql` (현 max V099 — [migrations.md §1·§2](../../spec/conventions/migrations.md) 단조성). 3 컬럼 nullable ADD — 기존 row 영향 없어 NOT VALID/VALIDATE 2-step 불요.
- **data-model.md spec 본문에는 마이그레이션 번호를 싣지 않고 컬럼만 기술**(번호는 구현 시점 확정 — 기존 §2.1 표기 관례와 동일).
- `email` 컬럼의 UNIQUE 제약이 커밋 시 최종 가드(아래 §2 race 처리).

## 2. Auth spec — `spec/5-system/1-auth.md`

### 2.1 신규 본문 §1.1.B "이메일 변경 흐름"

`§1.1.A 비밀번호 재설정 흐름` 바로 뒤에 §1.1.B 신설:

**흐름**
```
1. POST /api/users/me/email-change/request { newEmail, password? | totpCode? }   (JWT 인증)
   a. 재인증: password_hash 보유 → 비밀번호 / 없으면 등록된 2FA factor(TOTP·WebAuthn).
      · 이메일 OTP 는 배제(R7) — §2.3 세션 강제종료 reauth 와 달리 이메일 변경은 메일함 소유 자체가
        변경 대상이라 OTP 가 순환·부적합. 재인증 실패/필요 코드는 §2.3 verifyReauth 와 동일
        (REAUTH_REQUIRED / PASSWORD_INVALID / TOTP_INVALID — 신규 코드 없음)
      · 재인증 수단 전무(OAuth-only, 무 2FA) → 403 REAUTH_NOT_AVAILABLE (변경 불가)
   b. newEmail 검증: 형식 + 현재 email 과 동일 금지 + 다른 계정 사용 중 금지(대소문자 무시)
   c. uuidv4 토큰 생성 → SHA-256 해시를 email_change_token 에 저장, pending_email=newEmail,
      email_change_expires_at = NOW()+1h. (기존 pending 이 있으면 덮어씀 — 항상 0~1개 유효)
   d. 신규 이메일로 확인 링크 발송: {frontendUrl}/profile/change-email/verify?token={raw}
   e. throttle 5/min

2. [신규 메일함에서 링크 클릭 → 프론트 /profile/change-email/verify 페이지]
   · 미로그인 시 로그인(아직 옛 이메일)으로 보낸 뒤 복귀해 토큰 제출

3. POST /api/users/me/email-change/verify { token }   (JWT 인증)
   a. 입력 token 을 SHA-256 해시 → 인증된 사용자의 email_change_token 과 비교 + 만료 검증
      (토큰이 인증 사용자에 바인딩됨 — 누출 링크 단독으로는 무용. R2 참조)
   b. 트랜잭션 내:
      - pending_email 이 그 사이 타 계정에 선점됐는지 재검사(UNIQUE) → 선점 시 409 + pending NULL화
      - email = pending_email, email_verified = true
      - pending_email / email_change_token / email_change_expires_at = NULL
   c. 전 family revoke + 현재 디바이스 새 세션 재발급 → { accessToken } 반환 + refresh 쿠키 회전
      (§2.3 / Rationale 2.3.C 와 동일. login_history 에 session_revoked bulk(familyId=null) 1건)
   d. 옛 이메일로 통지 메일 발송(best-effort): "이메일이 …로 변경됨. 본인이 아니면 비밀번호 재설정으로 보안 조치"
   e. 감사: user.email_changed (§4.1)

(선택) POST /api/users/me/email-change/resend  — pending 으로 재발송(토큰 재발급, throttle 5/min). pending 없으면 400 VALIDATION_ERROR
(선택) POST /api/users/me/email-change/cancel  — pending 3필드 NULL화(재인증 불요). pending 없어도 멱등(200 no-op)
```

**설계 원칙 (본문에 명시)**
- **신규 이메일만 인증**: 옛 이메일은 통지(비차단). 본인 증명은 재인증이 담당.
- **토큰 at-rest SHA-256**: `email_verify_token`/`password_reset_token` 과 동일(§1.1 표에 `email_change_token` 추가).
- **verify 는 인증 필수**: 신규 이메일 토큰을 인증 사용자에 바인딩(signup verify-email 의 `@Public` 과 대비) — 더 강한 가드.
- **OAuth-only 무 2FA 차단**: 재인증 수단 없으면 변경 불가.

운영 시나리오 표(§1.1.A 와 유사 형식): 일반/2FA보유/OAuth-only(무2FA, 차단)/토큰만료/신규이메일 선점.

### 2.2 §1.1 표 — 토큰 at-rest 행 갱신
`이메일 인증 토큰·비밀번호 재설정 토큰 ... SHA-256` → **이메일 변경 토큰(`email_change_token`) 도 동일 SHA-256 저장** 추가.

### 2.3 §2.3 세션 정책 + §4.3 LoginHistory
- §2.3 표에 `이메일 변경 시 처리` 행 추가: "이메일 변경 확인(`POST /users/me/email-change/verify`) 성공 시 비밀번호 변경과 동일하게 전 family revoke + 현재 디바이스 재발급. 근거 Rationale 2.3.C 공유." (verify 가 `/api/users/me/*` 라 refresh 쿠키 Path `/api/auth` 미첨부 → 현재 family 식별 불가 → 전체 revoke+재발급으로 수렴, 비번 변경과 동형.)
- §4.3 `session_revoked` 행 설명에 "또는 **이메일 변경 confirm 성공 시 전체 family revoke**" 병기. **enum 값 재사용 — DB CHECK·마이그레이션 불요**(비번 변경과 동일 근거).
- **§2.3 의 기존 '강제 종료 재인증' 행(이메일 OTP 문구 포함)은 건드리지 않는다** — 그 reauth 정합은 `plan/in-progress/refactor-auth-reverify-unify.md` 영역(§범위 밖/후속). 이메일 변경 reauth 는 §1.1.B 에서 self-contained 로 좁게 정의.

### 2.4 §4.1 감사 — Planned 에 `user.email_changed` 추가 + 레지스트리 동반 등록
- §4.1.A Rationale 이 이미 "향후 user-profile 계열 감사(예: `user.email_changed`)" 로 예고 → 정합.
- 분류: `user.*` 과거분사, 액터 현재 세션 workspaceId 귀속(verify 는 인증 세션이라 workspaceId 보유 — §4.1.B 충족), resourceType `user`, resourceId `<userId>`.
- **details 에 raw 이메일 미저장**(워크스페이스 admin 노출 최소화, R6) — "변경 발생" 사실만(+ `ipAddress` 포렌식, 기존 user.* 와 동일).
- **레지스트리 동반 등록 (단일 진실 정합)**:
  - `spec/conventions/audit-actions.md §3` 표에 `user | 과거분사 (§2.1) | email_changed | 미구현` 행 추가(기존 `user ... 구현` 행과 별도 — workspace 구현/미구현 분리 선례 동형).
  - `spec/data-flow/1-audit.md §1.1` 커버리지 갭 prose 에 `user.email_changed` (Planned·미구현) 명시(§1.1 구현 표에는 미기재 — 아직 미구현).
- 구현 시 `AUDIT_ACTIONS` union 에 추가.

### 2.5 §5 API 엔드포인트 표 — 포인터 행 추가
auth §5 에는 **포인터 행만** 추가(완전 정의는 user-profile §6.1 — 기존 sessions/login-history/invitations 처리와 동일, L455-457):
"사용자 본인 이메일 변경 엔드포인트(`/api/users/me/email-change/request|verify|resend|cancel`)는 [사용자 프로필 spec §6.1](../2-navigation/9-user-profile.md#61-사용자워크스페이스-api) 에 정의. 흐름·토큰·세션·감사는 본 문서 §1.1.B."

## 3. User Profile spec — `spec/2-navigation/9-user-profile.md`

### 3.1 §2.0 편집 흐름 표 — 이메일 행 갱신
`별도 프로세스 | 이메일 | 본 화면 readonly. 변경은 확인 메일 발송 플로우로 분리 (현 단계 미구현)`
→ `전용 페이지(sub-route) | 이메일 | /profile/change-email 로 이동. 재인증 → 신규 이메일 확인 메일 → 링크 클릭 시 확정. 상세 [Auth §1.1.B]`

### 3.2 §2.1 프로필 필드 표 — 이메일 행 갱신
`이메일 | X (별도 변경) | 별도 프로세스 | 이메일 변경 시 확인 메일 발송 플로우`
→ `이메일 | O (별도 변경) | 전용 페이지 /profile/change-email | 재인증 + 신규 이메일 확인 메일. 확인 완료 시 전 세션 revoke + 현재 디바이스 재발급`

### 3.3 §2 와이어프레임 — 이메일 줄 + 변경 카드
- 사용자 정보 카드의 `Email: …(변경 불가, 별도)` → `Email: …  [변경하기 →]` (비밀번호 카드와 동형 CTA). pending 있으면 "확인 대기 중: new@…  [재발송] [취소]" 표시.
- `/profile/change-email` 와이어프레임 추가(비밀번호 페이지 형식): 신규 이메일 입력 + 재인증(비번/2FA) → [확인 메일 보내기] → "메일을 보냈어요" 상태.

### 3.4 §6.1 API 표 — 4개 행 추가 (여기가 SoT) + GET 응답 shape
- `POST /api/users/me/email-change/request|verify|resend|cancel` 추가(설명은 §2.1 흐름과 §2.5 포인터 일치).
- `GET /api/users/me` 응답 shape 에 **`pendingEmail: string | null`** 필드 명시(본인 데이터, UI pending 표시용 — `UserProfileDto` 동반).

### 3.5 frontmatter `code:` 갱신
신규 frontend 라우트(`/profile/change-email/**`)는 기존 `profile/**` glob 에 포함 — 변경 불요. status `partial` 은 본 항목과 무관(아바타/알림 등 잔여로 유지).

## 4. 에러 코드 (전부 기존 코드 재사용 — 신규 코드 0개)

| 상황 | HTTP | 코드 | 출처/근거 |
|------|------|------|-----------|
| 신규=현재 이메일 / 형식 오류 / 토큰 무효·만료 | 400 | `VALIDATION_ERROR` | verify-email·reset-password 토큰 처리 선례(전역 공용 코드, [error-codes.md §1](../../spec/conventions/error-codes.md)) |
| 신규 이메일 타 계정 사용 중 (request·verify 양쪽) | 409 | `RESOURCE_CONFLICT` | register 중복 이메일과 **동일 코드**(`auth.service.ts:96` ConflictException) |
| 재인증 필요/실패 | 401/400 | `REAUTH_REQUIRED` · `PASSWORD_INVALID` · `TOTP_INVALID` | §2.3 강제 종료 재인증(verifyReauth) 재사용 |
| 재인증 수단 없음(OAuth-only 무2FA) | 403 | `REAUTH_NOT_AVAILABLE` | §2.3 reauth 상류 코드 재사용(`sessions.service.ts`) |
| resend 인데 pending 없음 | 400 | `VALIDATION_ERROR` | (cancel 은 멱등 no-op — 에러 아님) |

> 신규 도메인 코드(`EMAIL_*`)를 만들지 않는다 — register·verify-email·reset·verifyReauth 의 기존 코드로 전부 커버됨. [error-codes.md §2](../../spec/conventions/error-codes.md) "이름 정확성만을 위한 신설 금지" 정합.

## 5. 프론트엔드 (구현 메모, spec 본문 아님)
- `/profile/change-email` (page) + `/profile/change-email/verify` (link 랜딩) sub-route — change-password 복제.
- `profile-info-card.tsx`: `emailReadonlyHint` 의 "(곧 지원 예정)" 제거 + [변경하기 →] CTA + pending 상태 표시.
- `GET /api/users/me` 응답에 `pendingEmail` 노출(본인 데이터) — `UserProfileDto` 에 추가(§3.4).
- i18n KO/EN 신규 키(메일 템플릿 포함). MailService 신규: `sendEmailChangeVerification`, `sendEmailChangedNotice`.

---

## Rationale (spec 반영 시 각 문서 ## Rationale 에 분배 — R1·R2·R3·R7→1-auth, R4→1-auth, R5→1-auth, R6→1-auth)

### R1. 왜 "둘 다 인증" 이 아니라 "재인증 + 신규만 인증 + 옛 통지" 인가
옛 이메일을 *차단 조건*으로 두면 옛 메일함 접근을 잃은 사용자(이메일 변경의 주된 사유 — 퇴사·서비스 종료)가 영구히 변경 불가. 옛 이메일의 두 역할(통제 증명 / 알림 채널) 중 "통제 증명"은 재인증(비번·2FA)이 메일함 소유보다 강하게 대체하므로, 옛 이메일은 비차단 통지(알림 채널)로만 둔다. 결과적으로 "둘 다 인증"보다 보안이 강하면서 UX·복구성이 낫다.

### R2. verify 를 `@Public` 이 아니라 인증 필수로
signup `verify-email` 은 계정 활성화(아직 세션 없음)라 `@Public`. 이메일 *변경* 은 이미 로그인된 계정의 식별자 교체라, 토큰을 인증 사용자에 바인딩하면 누출된 링크 단독으로는 변경 불가(공격자가 그 사용자로 로그인돼 있어야 함) — signup 보다 강한 가드. 비용은 링크 클릭 시 로그인 1스텝(옛 이메일로).
- 기각: `@Public` verify(누구나 클릭 시 커밋) — 링크 누출 시 제3자가 피해자 이메일을 임의 주소로 바꿀 위협.

### R3. 커밋 시 전 family revoke + 현재 디바이스 재발급 (비번 변경과 동일)
email 은 로그인 식별자다. 변경 시 탈취 가능한 모든 세션을 무효화하는 것이 OWASP 정합. verify 가 `/api/users/me/*` 라 refresh 쿠키(Path `/api/auth`) 미첨부 → 현재 family 식별 불가 → 비밀번호 변경과 동일하게 전체 revoke + 현재 디바이스 재발급으로 수렴(Rationale 2.3.C 그대로 재사용, `session_revoked` enum 재사용 — 마이그레이션 불요).

### R4. TTL 1h
signup 인증 24h(가입 후 여유) 와 비번 재설정 30분(탈취 시나리오) 사이. 로그인 상태에서 능동 수행하는 in-flow 동작이라 짧게 두되, 신규 메일함 확인 여유로 1h.

### R5. OAuth-only 무2FA 차단 (사용자 결정)
재인증 수단이 없는 계정은 self-service 변경 차단(REAUTH_NOT_AVAILABLE). 세션 탈취만으로 식별자 교체→계정 탈취 위협 차단. 기존 OAuth provider 링크는 provider account id 기준이라 이메일 변경과 독립(구현 시 확인). 강제 2FA·계정 복구는 별개 결정(§4.1.B 의 "OAuth-only 마지막 2FA 비활성화" 와 동일 분리 원칙).

### R6. 감사 details 에 raw 이메일 미저장
`user.email_changed` 는 액터 세션 workspace 의 admin 이 조회 가능(§4.2). 변경 전/후 주소를 details 에 넣으면 필요 이상 PII 노출 → "변경 발생" 사실만 기록(+ ipAddress 포렌식).

### R7. 이메일 변경 reauth 는 이메일 OTP 를 배제 (§2.3 세션-revoke reauth 와 차등)
§2.3 강제 종료 reauth 는 OAuth-only 대안으로 이메일 OTP 를 언급하지만, 이메일 *변경* 에서는 메일함 소유 자체가 변경 대상이라 이메일 OTP 가 본인 증명으로 순환·부적합하다(공격자가 새 메일함 OTP 로 통과 가능). 따라서 이메일 변경 reauth 는 비밀번호 또는 등록 2FA(TOTP/WebAuthn)로 좁히고 이메일 OTP 를 배제한다. §2.3 의 세션-revoke reauth 정의 자체는 본 작업에서 변경하지 않는다(그 정합은 `refactor-auth-reverify-unify` 영역).

---

## 다음 단계
1. [x] `/consistency-check --spec` (review/consistency/.../17_18_50) — BLOCK:NO, 5 checker 전원 LOW·Critical 0. rationale_continuity 재실행 완료(RISK=LOW, 유일 WARNING=이메일 OTP 배제 근거 → R7 로 해소).
2. [x] §1~4 를 실제 spec 5개 파일에 반영 — data-model §2.1(+3컬럼), 1-auth(§1.1 토큰행·신규 §1.1.B·§2.3 행·§4.1 Planned·§4.3 행·§5 포인터·Rationale 1.1.B-1~6), user-profile(§2.0·§2.1·§2 와이어프레임·§6.1 4행+pendingEmail·Rationale), audit-actions §3, data-flow/1-audit §1.1. 주석류는 plan 에만 잔류.
3. [x] side-effect: `audit-actions.md §3` + `data-flow/1-audit.md §1.1` 에 `user.email_changed` 등록 완료. `spec-sync-user-profile-gaps.md` 미구현 목록에 이메일 변경 없음 확인(별도 deferred 항목, 충돌 없음).
4. [x] `refactor-auth-reverify-unify` 와 §2.3 충돌 회피 — 기존 reauth 행 미변경, 신규 "이메일 변경 시 처리" 행만 추가.
5. [x] 구현은 **본 PR 에 포함**(spec + impl 한 PR, 사용자 지시). developer track 완료 — `plan/in-progress/impl-email-change.md` 참조. 구현 범위: data-model 마이그레이션 `V100`, users 모듈 email-change controller/service/DTO, MailService 2개 템플릿, frontend `/profile/change-email` + `profile-info-card` CTA + i18n, `AUDIT_ACTIONS` 에 `user.email_changed` 추가 — 전부 반영.
