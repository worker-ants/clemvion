# Cross-Spec 일관성 검토 결과

대상 문서: `spec/5-system/1-auth.md` (§1.1.B 이메일 변경 흐름 신설 + §2.3/§4.1/§4.3/§5 갱신)
연관 변경: `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`
검토 날짜: 2026-06-21

---

## 발견사항

### [INFO] 엔드포인트 경로 표기 비일관성 — `/api/` prefix 유무 혼용
- **target 위치**: `spec/5-system/1-auth.md §2.3` (이메일 변경 시 처리 행, line 317) 및 §4.1 Planned 행 (line 412)
- **충돌 대상**: 동일 문서 §1.1.B line 80 (`POST /api/users/me/email-change/verify`), `spec/2-navigation/9-user-profile.md §6.1` (line 323, `POST /api/users/me/email-change/verify`)
- **상세**: §2.3 세션 정책 표의 "이메일 변경 시 처리" 행과 §4.1 Planned 행은 `POST /users/me/email-change/verify` (prefix `/api/` 없음)로 표기된다. §1.1.B 핵심 설계 및 user-profile §6.1 표에서는 `POST /api/users/me/email-change/verify` 로 표기된다. 이 패턴은 기존 change-password 행(§2.3)과 §4.1.B Rationale 에서도 `POST /users/me/change-password` (prefix 없음)를 쓰고 있어 auth §2.3/Rationale 내부의 pre-existing 스타일 차이다. 기능 작동에는 영향이 없으나 구현자가 경로를 참조할 때 혼동 가능성이 있다.
- **제안**: 동기화 권장. auth §2.3/§4.1 의 인라인 경로 참조를 `POST /api/users/me/email-change/verify` 로 통일하거나, 문서 헤더에 "인라인 경로는 `/api/` prefix 생략 표기" 관례를 명시하는 것으로 해소.

---

### [INFO] `spec/data-flow/2-auth.md` — 이메일 변경 흐름 시퀀스 미등록
- **target 위치**: 해당 없음 (data-flow/2-auth.md 는 이번 diff 에서 미수정)
- **충돌 대상**: `spec/data-flow/2-auth.md §1.7` ("비밀번호 재설정 · 이메일 보조 엔드포인트"), `spec/5-system/1-auth.md §1.1.B`
- **상세**: `data-flow/2-auth.md §1.7` 은 `forgot-password`, `reset-password`, `resend-verification`, `check-email` 흐름을 기술하나, 신설된 `/api/users/me/email-change/request|verify|resend|cancel` 4개 엔드포인트의 데이터 흐름(토큰 발급 → SHA-256 저장 → 메일 발송 → verify 시 세션 revoke + 재발급 시퀀스)이 전혀 없다. 기존 다른 흐름(비밀번호 변경 revoke 포함)도 `data-flow/2-auth.md` 에 시퀀스가 없으므로 이것이 즉각적 모순은 아니나, 감사 흐름이 `data-flow/1-audit.md` 에 갭으로 등록된 것과 대칭적으로 data-flow/2-auth.md 에도 이메일 변경 섹션이 누락된 상태다.
- **제안**: 구현 완료 후 `data-flow/2-auth.md §1.7` 에 이메일 변경 흐름(또는 별도 §1.8) 추가 권장. 현재 미구현 단계에서는 INFO 로 유지.

---

### [INFO] `spec/data-flow/2-auth.md §2.1 Schema 매핑` — 신규 User 컬럼 미반영
- **target 위치**: `spec/1-data-model.md §2.1 User` (신규 3개 필드: `pending_email`, `email_change_token`, `email_change_expires_at`)
- **충돌 대상**: `spec/data-flow/2-auth.md §2.1 Postgres` 스키마 매핑 섹션
- **상세**: `data-flow/2-auth.md §2.1` 의 Postgres 스키마 표가 `user` 테이블 컬럼을 일부 나열하고 있다면, 신규 3개 nullable 컬럼이 미반영될 수 있다. (data-flow/2-auth.md 는 이번 diff 에서 미수정이므로 해당 표의 상세 내용에 따라 갱신 필요 여부가 달라진다.)
- **제안**: `spec/data-flow/2-auth.md §2.1` 이 user 테이블을 명시적으로 기술하는 경우 `pending_email`, `email_change_token`, `email_change_expires_at` 컬럼 추가 동기화. 이미 미기술이면 불필요.

---

### [INFO] `audit-actions.md` 중복 resource 행 — `user` 리소스가 두 개의 별도 행으로 분리
- **target 위치**: `spec/conventions/audit-actions.md` (신규 line 51: `user | 과거분사(§2.1) | email_changed | 미구현`)
- **충돌 대상**: 동일 파일 기존 행 (`user | 과거분사(§2.1) | password_changed, 2fa_enabled, 2fa_disabled | 구현`)
- **상세**: 기존 `user` 리소스 행에 이미 3개 액션이 등록되어 있는데, `email_changed` 를 구현 상태(미구현)가 다르다는 이유로 별도 행으로 추가했다. 테이블 가독성 면에서 같은 resource·같은 패턴의 액션을 분리 행으로 두는 것이 audit-actions.md 의 다른 resource 행들과 스타일이 다르다 (기존 표는 resource 당 1행). CRITICAL/WARNING 사안은 아니나 명시적 이유(구현 상태 분리)가 있으므로 INFO 로 표기.
- **제안**: 기존 `user` 행에 `email_changed` 를 병기하거나(`password_changed, 2fa_enabled, 2fa_disabled, email_changed*`), 현행처럼 분리 유지 시 `*미구현` 각주 등 스타일 명시. 또는 기존 행을 `구현됨` 버전·`미구현` 버전 2행으로 통일하는 방식을 다른 resource 에도 확장.

---

## 요약

이번 diff 가 포함하는 실제 spec 변경(`spec/5-system/1-auth.md §1.1.B` 신설, `spec/1-data-model.md` User 3필드 추가, `spec/2-navigation/9-user-profile.md §6.1` 엔드포인트 4행 추가, `spec/conventions/audit-actions.md` 1행 추가, `spec/data-flow/1-audit.md` 갭 동기화)은 기존 spec 영역과 CRITICAL 또는 WARNING 수준의 직접 모순이 없다. 이전 draft 리뷰(17_18_50)에서 WARNING 으로 지적된 두 사안 — 재인증 계약의 이메일 OTP 배제 여부(Rationale 1.1.B-4 에서 명시적 결정·기술됨), REAUTH_NOT_AVAILABLE 코드의 기존/신규 여부(data-flow/2-auth.md §1.5 에서 `REAUTH_NOT_AVAILABLE` 이 이미 사용 중임을 확인, "재사용" 표기가 정확함) — 가 모두 해소되어 spec 에 반영됐다. INFO 4건은 data-flow/2-auth.md 이메일 변경 시퀀스 미등록, 신규 컬럼 스키마 매핑 동기화, 엔드포인트 경로 prefix 비일관성, audit-actions.md 중복 행 스타일이며, 이는 즉각적 차단 요인이 아니다.

## 위험도

LOW

STATUS: SUCCESS
