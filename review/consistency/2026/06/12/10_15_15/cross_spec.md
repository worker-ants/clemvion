# Cross-Spec 일관성 검토 — spec/5-system/1-auth.md

## 발견사항

### [WARNING] §2.3 강제 종료 재인증: "이메일 OTP" 대체 수단이 다른 spec 에 없음
- target 위치: `spec/5-system/1-auth.md §2.3` 세션 정책 표 "강제 종료 재인증" 행
- 충돌 대상:
  - `spec/data-flow/2-auth.md §1.5` — "OAuth-only (password_hash 없음 + 2FA 미설정) 는 403 `REAUTH_NOT_AVAILABLE`"
  - `spec/2-navigation/9-user-profile.md §6.1` — revoke 엔드포인트 설명이 "비밀번호/TOTP 재인증" 만 언급, 이메일 OTP 없음
- 상세: target §2.3 은 OAuth-only 사용자의 강제 종료 재인증 대체 수단으로 "이메일 OTP" 를 열거한다. 그러나 data-flow/2-auth 의 세션 revoke 흐름은 이메일 OTP 분기를 전혀 기술하지 않으며, 재인증 수단이 전혀 없는 OAuth-only 사용자(비밀번호·2FA 모두 없음) 에게 그대로 `REAUTH_NOT_AVAILABLE` 를 반환한다고 명시한다. user-profile spec 의 API 표도 "비밀번호/TOTP 재인증" 만 언급한다. "이메일 OTP" 가 실제로 구현된 별도 엔드포인트인지, 아니면 미구현 계획인지 spec 어디에도 정의가 없다.
- 제안: (a) "이메일 OTP" 를 Planned(미구현) 로 표기하거나, (b) 해당 엔드포인트 계약을 auth spec §5 API 표와 data-flow/2-auth §1.5 에 추가하거나, (c) 현재 구현(REAUTH_NOT_AVAILABLE) 에 맞춰 target §2.3 의 "이메일 OTP" 문구를 삭제

---

### [WARNING] §5 API 표: `POST /api/auth/verify-email` 엔드포인트 누락
- target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- 충돌 대상: `spec/data-flow/2-auth.md §1.1` — "personal workspace 생성과 토큰·Set-Cookie 는 이후 `POST /api/auth/verify-email` 단계에서 일어난다"
- 상세: data-flow/2-auth §1.1 은 `POST /api/auth/verify-email` 을 회원가입의 필수 2단계로 명시하며, 이 엔드포인트에서 personal workspace 자동 생성과 access/refresh 토큰 발급이 일어난다고 설명한다. 그러나 target §5 API 표에는 이 엔드포인트가 등재되어 있지 않다. `POST /api/auth/resend-verification` 은 §1.1 표(인증 메일 재발송)에 언급되지만 `verify-email` 자체는 누락이다.
- 제안: target §5 API 표에 `POST /api/auth/verify-email` 을 추가하고 응답 계약(personal workspace 생성 + access token + Refresh-Token 쿠키)을 기술. 아울러 §1.1 테이블의 "회원가입" 행에도 2단계 흐름을 명시

---

### [WARNING] §1.1 `POST /auth/resend-verification` 경로: `/api/` prefix 누락
- target 위치: `spec/5-system/1-auth.md §1.1` 표 "인증 메일 재발송" 행
- 충돌 대상: `spec/data-flow/2-auth.md §1.7` — `POST /api/auth/resend-verification` (api prefix 포함)
- 상세: target §1.1 표에는 경로가 `` `POST /auth/resend-verification` `` 으로 표기되어 `/api/` prefix 가 빠져 있다. §5 API 표의 나머지 모든 엔드포인트는 `/api/auth/...` 형식이며, data-flow §1.7 도 `/api/auth/resend-verification` 으로 기술한다. spec 표기 내 경로 불일치는 독자 혼란을 야기한다.
- 제안: target §1.1 표의 "인증 메일 재발송" 행 경로를 `/api/auth/resend-verification` 으로 수정하고 §5 API 표에도 동일 엔드포인트를 추가

---

### [INFO] §3.2 RBAC 매트릭스 vs spec/2-navigation/9-user-profile.md §4.2 매트릭스 — 항목 세분화 비대칭
- target 위치: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스`
- 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2 역할 권한 매트릭스`
- 상세: 두 매트릭스가 동일 역할(Owner/Admin/Editor/Viewer)을 다루지만 항목 세트가 다르다. user-profile §4.2 는 워크플로우·Integration(Org)·멤버 관리·워크스페이스 설정·Admin 역할 부여·워크스페이스 삭제 6개 행만 열거한다. target §3.2 는 Workflow/Trigger/Schedule/Knowledge Base/Auth Config/Model Config/Statistics/System Status/Marketplace/Audit Log 를 포함해 훨씬 상세하다. user-profile §4.2 에 Integration(Org) 생성만 Owner+Admin 으로 표기되어 있는데, target §3.2 에는 "Integration (Org) CRUD = Owner/Admin CRUD, Editor R, Viewer R" 로 적혀 있어 Editor 의 Integration(Org) 조회 권한 표현이 있다. 모순은 아니지만 같은 개념을 두 문서가 다른 수준으로 기술해 유지보수 시 두 군데를 함께 갱신해야 하는 sync 부담이 있다.
- 제안: user-profile §4.2 에 "더 상세한 매트릭스는 auth spec §3.2 참고" 교차 링크를 추가해 단일 진실을 auth spec §3.2 로 명시하거나, user-profile §4.2 범위를 명시적으로 "UI 관련 핵심 항목만" 으로 한정 표기

---

### [INFO] §1.5.1 Rate Limit 참조 대상이 data-flow §1.2 이지만 실제 SoT 는 §1.2 가 아닌 §1.2 이내 항목
- target 위치: `spec/5-system/1-auth.md §1.5.1` 표 "Rate Limit" 행
- 충돌 대상: `spec/data-flow/12-workspace.md §1.2` — 분당 10건(`INVITATION_THROTTLE`)
- 상세: target §1.5.1 은 "Rate Limit 분당 10건 (`INVITATION_THROTTLE`) … [data-flow §1.2] 와 동일 값" 이라고 명시한다. data-flow §1.2 는 분당 10건과 함께 공개 토큰 메타 조회(`GET /api/invitations/:token`) 는 분당 30건으로 다르게 적용된다고도 언급한다. target §1.5.1 이 "30건" 을 전혀 언급하지 않아 두 rate limit 의 비대칭이 반쪽만 기술된다. 모순은 아니지만 target 독자는 `/invitations/:token` 의 30건 limit 을 알기 어렵다.
- 제안: target §1.5.1 Rate Limit 행에 "공개 토큰 메타 조회(`GET /api/invitations/:token`)는 분당 30건" 을 추가

---

## 요약

`spec/5-system/1-auth.md` (target) 는 전반적으로 데이터 모델(`spec/1-data-model.md`)·감사 로그 흐름(`spec/data-flow/1-audit.md`)·인증 흐름(`spec/data-flow/2-auth.md`)·워크스페이스 흐름(`spec/data-flow/12-workspace.md`) 과 잘 정렬되어 있다. RBAC 매트릭스·WebAuthn 흐름·복구 코드 정책·감사 액션 명명 규약은 다른 spec 과 일관적이다. 다만 §2.3 의 "이메일 OTP" 재인증 대체 수단이 data-flow/2-auth 의 `REAUTH_NOT_AVAILABLE` 반환 계약과 충돌하고, 이메일 인증 2단계 핵심 엔드포인트(`POST /api/auth/verify-email`) 가 §5 API 표에서 누락된 점은 구현 계약의 공백을 만든다. `POST /auth/resend-verification` 의 prefix 오기(WARNING)는 경미하지만 표기 일관성에 어긋난다.

## 위험도

MEDIUM
