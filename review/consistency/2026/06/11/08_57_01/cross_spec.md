# Cross-Spec 일관성 검토 — `spec/data-flow/2-auth.md`

검토 대상: `spec/data-flow/2-auth.md`
검토 모드: `--impl-done`, `diff-base=origin/main`
검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] `email_verify_token` 저장 형태 — raw vs SHA-256 해시 표기 불명확

- **target 위치**: `spec/data-flow/2-auth.md §1.1` (line 44–45), `§2.1 Schema 매핑` (line 245)
- **충돌 대상**: `spec/5-system/1-auth.md §1.1` ("이메일 인증 토큰은 SHA-256 해시로만 저장"), `spec/1-data-model.md §2.1 User` (`email_verify_token | String? | 이메일 인증 토큰 SHA-256 해시`)
- **상세**: data-flow spec 의 시퀀스 다이어그램(§1.1 line 44)은 `INSERT INTO "user" (email_verify_token, ...)` 그리고 `발송 (email_verify_token)` 이라고 표기해, DB 에 저장되는 값과 메일로 발송되는 값이 동일한 것처럼 읽힌다. 실제로는 `auth.service.ts` 가 random 토큰을 생성해 메일에 raw 를 담고 DB 에는 SHA-256 해시만 저장하는 이중 경로다. `spec/1-data-model.md §2.1` 과 `spec/5-system/1-auth.md §1.1` 은 모두 "SHA-256 해시로만 저장" 을 명확히 기술하지만 data-flow spec 은 이 구분을 누락했다. 독자가 data-flow 문서만 읽으면 raw 토큰이 그대로 DB 에 들어간다고 오해할 수 있다.
- **제안**: `spec/data-flow/2-auth.md §1.1` 시퀀스 다이어그램 주석 또는 §2.1 Schema 매핑 행에 "DB: SHA-256 해시, 메일: raw 토큰" 구분 명시 추가. `spec/1-data-model.md §2.1` / `spec/5-system/1-auth.md §1.1` 은 이미 정확하므로 수정 불요.

---

### [WARNING] 세션 동시성·비활동 만료 정책 미기술 — `spec/5-system/1-auth.md §2.3` 항목 누락

- **target 위치**: `spec/data-flow/2-auth.md §2 Schema 매핑`, §3 상태 전이
- **충돌 대상**: `spec/5-system/1-auth.md §2.3 세션 정책` (`동시 세션 기본 5개`, `비활동 만료 30일간 미사용 시 Refresh Token 무효화`)
- **상세**: auth spec(`spec/5-system/1-auth.md §2.3`)은 동시 세션 기본 5개 제한 + 30일 미사용 비활동 만료를 명시하나, data-flow spec 은 이 정책을 전혀 기술하지 않는다. data-flow spec 의 §3.1 상태 전이 다이어그램은 `Active → Expired: now > expires_at (deny on use)` 만 담아 비활동 만료 경로가 없고, §2.1 Schema 매핑의 `refresh_token` INSERT 컬럼 목록에 `expires_at` 은 있으나 `rememberMe` 분기 (7일 기본, 30일) 가 없다. 한편 data-model spec(`spec/1-data-model.md §2.18.1`)은 `expires_at | 7일 기본, rememberMe 시 30일` 을 명시한다. 이중에서 "동시 5개 제한" 의 실제 구현 여부가 data-flow 에서 확인되지 않아 spec↔구현 정합성 불명확도 동반된다.
- **제안**: `spec/data-flow/2-auth.md §2.2 Redis` 또는 §3.1 에 다음을 보완 권장: (1) `expires_at` 결정 규칙(`rememberMe=false → 7일, true → 30일`), (2) 동시 세션 5개 초과 시 처리 흐름 또는 "현재 미구현/앱 레이어 미적용 시 명시" 여부. 내용이 미구현인 경우에는 data-flow 가 아닌 auth spec에 "(미구현)" 주석이 있어야 한다.

---

### [INFO] `refresh_token` 회전 시퀀스 — `expires_at` INSERT 필드 누락 (§1.4 다이어그램)

- **target 위치**: `spec/data-flow/2-auth.md §1.4` (line 171)
- **충돌 대상**: `spec/data-flow/2-auth.md §2.1 Schema 매핑` (line 251–252), `spec/1-data-model.md §2.18.1`
- **상세**: §1.4 시퀀스 다이어그램의 신규 토큰 INSERT 행 `INSERT refresh_token (family_id=row.family_id, new token_hash, expires_at)` 에는 `user_id`, `ip_address`, `user_agent`, `device_label` 이 누락됐다. §2.1 Schema 매핑에는 `INSERT user_id, token_hash, family_id, is_revoked=false, expires_at, device_label, user_agent, ip_address` 로 전체 컬럼이 기재되어 있어 내부 불일치가 있다. 이는 다이어그램 가독성을 위한 의도적 생략일 수 있으나 두 섹션 독자가 서로 다른 필드 집합을 보게 된다.
- **제안**: §1.4 다이어그램 주석에 "전체 컬럼은 §2.1 Schema 매핑 참조" 한 줄 추가하거나, 생략된 컬럼을 `...` 으로 표시해 의도적 생략임을 명확히 한다.

---

### [INFO] `login_history` INSERT 에 `resend-verification` / `check-email` 이후 이벤트 누락

- **target 위치**: `spec/data-flow/2-auth.md §1.7`
- **충돌 대상**: `spec/data-flow/2-auth.md §2.1 Schema 매핑 login_history` 행, `spec/5-system/1-auth.md §4.3`
- **상세**: §1.7(비밀번호 재설정·이메일 보조 엔드포인트) 에서 `reset-password` 완료 후 `login_history` 이벤트 기록 여부가 명시되지 않았다. `spec/5-system/1-auth.md §4.3` 의 `LoginHistory` 이벤트 목록에는 비밀번호 재설정 관련 이벤트가 없으나, auth spec Rationale §1.1.A 는 "비밀번호 재설정 직후 모든 세션 강제 로그아웃" 을 언급한다. 이것이 `session_revoked` 이벤트를 발생시키는지 불명확하다. data-flow 독자가 해당 경로의 완전한 side-effect 를 추적하기 어렵다.
- **제안**: `spec/data-flow/2-auth.md §1.7` 에 `reset-password` 완료 후 `login_history` 이벤트 기록 여부(기록 없음 또는 이벤트명)를 명시 추가.

---

### [INFO] `auth_oauth_state` 컬럼 명명 불일치 — 시퀀스 vs Schema 매핑

- **target 위치**: `spec/data-flow/2-auth.md §1.3` (line 123) vs `§2.1 Schema 매핑` (line 254)
- **충돌 대상**: 내부 일관성
- **상세**: §1.3 시퀀스 다이어그램은 `INSERT auth_oauth_state (state, provider, mode, rememberMe, ...)` (camelCase) 로 표기하고, §2.1 Schema 매핑은 `INSERT state, provider, mode, remember_me, ...` (snake_case) 로 표기한다. DB 컬럼 명명이 문서 내에서 혼재돼 있다.
- **제안**: data-flow 문서 내 §1.3 시퀀스 다이어그램의 컬럼명을 DB 실제 컬럼명(snake_case `remember_me`) 으로 통일.

---

## 요약

`spec/data-flow/2-auth.md` 는 전반적으로 `spec/5-system/1-auth.md`, `spec/1-data-model.md` 와 높은 정합성을 보인다. 회전 원자성(TOCTOU 차단, 조건부 UPDATE, 단일 트랜잭션), reuse 탐지, 계정 잠금, OAuth state one-shot DELETE 등 보안 핵심 흐름은 다른 spec 과 일치한다. 발견된 주요 이슈는 두 가지다: (1) `email_verify_token` 의 SHA-256 해시 저장 사실이 data-flow 에서 기술되지 않아 raw-저장으로 오해할 여지가 있고(WARNING), (2) auth spec 이 명시하는 동시 세션 5개 제한 및 30일 비활동 만료 정책이 data-flow 에 전혀 반영되지 않아 구현 상태 불명확(WARNING)이다. 나머지는 내부 표기 비일관(INFO 2건) 으로 운영·보안에 직접 영향은 없다. CRITICAL 충돌은 발견되지 않았다.

---

## 위험도

LOW
