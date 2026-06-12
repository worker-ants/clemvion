# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/1-auth.md`
검토 모드: spec draft 검토 (--spec)

---

### 발견사항

- **[CRITICAL]** Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 합의된 dot-prefix 규약을 위반
  - target 위치: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표 — `인증 (워크스페이스 컨텍스트)` 행, `password_change, 2fa_enable/disable`
  - 과거 결정 출처: `spec/5-system/1-auth.md` §4.1 본문 **Action naming 규약** — "`<resource>.<verb>` — resource dot-prefix 가 필수다"  `spec/data-flow/1-audit.md` §1.1 — "action 은 `<resource>.<verb>` 꼴로, resource dot-prefix 가 필수다 … 과거 `re_run_initiated` 가 dot-prefix 를 이탈했으나 `execution.re_run` 으로 정정됐다(cross-audit G-02)"
  - 상세: `password_change` 는 resource prefix 가 없고 단독 동사 명사 합성어다. `2fa_enable`/`2fa_disable` 도 dot-prefix 가 없으며 `2fa` 가 resource 토큰인지 불명확하다. 이 표기들은 과거 `re_run_initiated` 가 위반 판정을 받아 `execution.re_run` 으로 강제 정정된 것(cross-audit G-02)과 동일한 패턴 위반이다. 규약상 올바른 형식은 `user.password_changed`(또는 `auth.password_changed`) / `user.2fa_enabled` / `user.2fa_disabled` 등 `<resource>.<verb>` 꼴이어야 한다.  현재 문서에서 이 두 항목만 규약 밖 표기로 남아 있고, 해당 섹션 본문 자체가 "resource dot-prefix 필수" 를 명문화하고 있으므로 자기모순이다.
  - 제안: Planned 표의 `password_change` → `user.password_changed`(또는 도메인 결정 후 `auth.password_changed`), `2fa_enable/disable` → `user.2fa_enabled` / `user.2fa_disabled` 형식으로 수정하거나, 해당 resource prefix 를 명시적으로 결정해 표기한다. resource 토큰이 확정되지 않았다면 미결 표시(`TBD: <resource>.password_changed`)라도 dot-prefix 형식을 유지해야 한다.

---

### 요약

`spec/5-system/1-auth.md` 전반의 Rationale 연속성은 양호하다. 1.4.A–1.4.I, 1.5.A–1.5.D, 2.3.A, Production fail-closed 가드 항목 모두 과거 기각 대안과 합의 원칙을 일관되게 유지하고 있다. 단 §4.1 Planned 감사 액션 표의 `password_change`·`2fa_enable/disable` 두 항목이 동일 섹션 본문과 `spec/data-flow/1-audit.md` Rationale 에서 합의된 `<resource>.<verb>` dot-prefix 필수 규약을 이유 설명 없이 이탈하고 있다. 이 패턴은 과거 cross-audit G-02 에서 `re_run_initiated`를 `execution.re_run`으로 강제 정정한 바 있는 동일 위반 유형이므로, 신규 planned action 이 해당 precedent를 역행하는 모양새다. 나머지 설계 결정(WebAuthn 환경변수 비활성 동작·복구 코드 풀 분리·TOTP fallback 금지·counter 역행 삭제 정책 등)에서 기각된 대안의 재도입이나 invariant 우회는 발견되지 않았다.

### 위험도

MEDIUM
