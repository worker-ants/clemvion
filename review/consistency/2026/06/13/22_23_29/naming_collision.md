# 신규 식별자 충돌 검토 결과

**대상 문서**: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`

---

## 발견사항

### 발견사항 없음 — 충돌 0건

6개 점검 관점을 모두 검토한 결과 실제 충돌은 발견되지 않았다. 아래는 검토 근거를 관점별로 기술한다.

---

### 1. 요구사항 ID 충돌

target 문서는 요구사항 ID(`R-*`, `NAV-*`, `ND-*` 등 형식)를 신규 부여하지 않는다. 변경 1~6번은 기존 spec 문서 내 서술 추가/수정이며 새 ID 할당이 없다. 충돌 없음.

---

### 2. 엔티티/타입명 충돌

target 이 새로 도입하는 이름:
- **응답 계약 변경**: `{ success: true }` → `{ accessToken: string }`. `accessToken` 필드는 `/auth/login`, `/auth/verify-email`, `/auth/refresh` 등 기존 토큰 발급 응답에서 이미 동일 의미로 사용 중이다. target 은 동일 semantics 를 `change-password` 응답에 확장 적용하는 것으로, 충돌이 아니라 **패턴 일관화**다.
- **Rationale 섹션 번호 `2.3.C`**: `spec/5-system/1-auth.md` 의 현재 Rationale 마지막 항은 `2.3.B`(`Refresh 쿠키 SameSite·CSRF`, 소재: line 572). `2.3.C` 는 미사용 번호이므로 충돌 없음.

---

### 3. API endpoint 충돌

target 이 명시하는 endpoint:
- `POST /api/users/me/change-password` — `spec/2-navigation/9-user-profile.md §6.1` L303에 이미 존재하는 endpoint다. target 은 이 endpoint 의 **응답 계약을 변경**하는 것이지 신규 endpoint 를 추가하는 것이 아니므로 endpoint 충돌이 아니다. 변경 전: `{ data: { success: true } }`, 변경 후: `{ data: { accessToken: string } }` + refresh 쿠키 회전.
- `POST /auth/reset-password` — target 에서 위협모델 비교 대상으로 언급만 하며, 이 endpoint 자체의 변경은 없다. 충돌 없음.

---

### 4. 이벤트/메시지명 충돌

target 이 언급하는 이벤트:
- `login_history.session_revoked` — target 은 이 이벤트의 의미를 **확장**한다(`familyId=null` bulk revoke 포함). 기존 `spec/5-system/1-auth.md §4.3` L400에 `session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료` 로 정의돼 있다. 신규 이름 도입이 아니라 기존 이벤트 설명 확장이므로 충돌 없음.
- `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` — `data-flow/1-audit.md §1.1` 표에 이미 등재된 기존 audit action 이다(L60~L64). target 의 변경 5(ipAddress 동반 추가)는 이 action 들의 **전송 payload 추가**이지 이름 변경이 아니다. 충돌 없음.

---

### 5. 환경변수·설정키 충돌

target 은 신규 ENV var 또는 설정키를 도입하지 않는다. 언급되는 `TRUST_CF_CONNECTING_IP`, `extractClientIp` 는 기존 `spec/5-system/1-auth.md Rationale 2.3.B` 및 `auth/utils/client-ip.ts` 의 기존 식별자로, 동일 의미로 재참조하는 것이다. 충돌 없음.

---

### 6. 파일 경로 충돌

target 이 편집 대상으로 지정하는 파일:
- `spec/5-system/1-auth.md` — 기존 파일. 신규 생성 아님.
- `spec/2-navigation/9-user-profile.md` — 기존 파일. 신규 생성 아님.
- `spec/data-flow/1-audit.md` — 기존 파일. 신규 생성 아님.

신규 spec 파일은 생성되지 않는다. 파일 경로 충돌 없음.

---

## 요약

target 문서(`spec-draft-pwchange-revoke-user-ip.md`)가 도입하는 식별자를 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·ENV var·파일 경로)에서 전수 검토했다. 모든 변경이 기존 spec 문서 내 서술 추가·확장이며, 신규 이름이 다른 의미로 이미 사용 중인 사례는 발견되지 않았다. 응답 필드 `accessToken` 은 기존 login/refresh 응답의 동일 semantics 를 `change-password` 에 수평 확장하는 것이고, `session_revoked` 이벤트 의미 확장(bulk revoke 포함)은 기존 DB CHECK 제약(`chk_login_history_event`) 변경을 요구하지 않으므로 스키마 충돌도 없다.

## 위험도

NONE

---

STATUS: OK
