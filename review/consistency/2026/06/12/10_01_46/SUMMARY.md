# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Planned 감사 액션 `password_change`/`2fa_enable/disable` 이 동일 섹션 본문에서 선언한 `<resource>.<verb>` dot-prefix 필수 규약을 위반하며, 과거 동일 패턴(cross-audit G-02)에서 강제 정정된 선례가 있어 Critical로 판정됨. 나머지 발견은 WARNING/INFO 수준.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 합의된 `<resource>.<verb>` dot-prefix 규약을 위반 — 동일 규약(`re_run_initiated` → `execution.re_run`, cross-audit G-02)이 과거 강제 정정된 선례를 역행하는 자기모순 | `spec/5-system/1-auth.md §4.1` Planned 표 "인증 (워크스페이스 컨텍스트)" 행 | `spec/5-system/1-auth.md §4.1` Action naming 규약 선언("resource dot-prefix 가 필수다") + `spec/data-flow/1-audit.md §1.1` | `password_change` → `user.password_changed` (또는 `auth.password_changed`), `2fa_enable/disable` → `user.2fa_enabled` / `user.2fa_disabled`. resource 토큰 미확정 시 `TBD: <resource>.password_changed` 형식으로라도 dot-prefix 유지 필수 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 dot-prefix 명명 규약을 위반 (Critical #1 과 동일 위반, WARNING 등급으로 중복 보고) | `spec/5-system/1-auth.md §4.1` Planned 표 | `spec/5-system/1-auth.md §4.1` 명명 규약 선언 + `spec/data-flow/1-audit.md §1.1` | Critical #1 과 동일 조치 |
| 2 | Convention Compliance | Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 문서 자신이 정의한 `<resource>.<verb>` 규약을 위반 | `spec/5-system/1-auth.md §4.1` Planned 표 (line 389) | 동일 §4.1 Action naming 규약 | `user.password_change`, `totp.enabled`/`totp.disabled` (또는 `mfa.enabled`/`mfa.disabled`) 로 수정. 해당 이벤트가 LoginHistory 레이어인 경우 Planned 표에서 제거 검토 |
| 3 | Cross-Spec | RBAC 매트릭스 — `Integration (Org)` Editor/Viewer 읽기 권한이 user-profile §4.2 에 미기재로 혼선 유발 | `spec/5-system/1-auth.md §3.2` `Integration (Org)` 행 (Editor=R, Viewer=R) | `spec/2-navigation/9-user-profile.md §4.2` (Integration 생성만 등재, 읽기 행 없음) | `spec/2-navigation/9-user-profile.md §4.2` 에 `Integration (Org) 조회` 행(Editor=✅, Viewer=✅) 추가 또는 기존 행 제목을 "생성/수정/삭제"로 한정. SoT 가 `auth §3.2` 임을 user-profile 에서 명시적으로 참조 |
| 4 | Plan Coherence | `spec/5-system/1-auth.md §5` API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 미추가 | `spec/5-system/1-auth.md §5` (현재 `/api/audit-logs` 행에서 끝남) | `plan/in-progress/auth-config-webhook-followups.md §3` 첫 번째 항목 (미착수) | project-planner 가 §5 표에 `POST /api/auth-configs/:id/reveal` 행 추가 후 plan 체크박스 완료 처리 |
| 5 | Plan Coherence | `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 미열거 (SPEC-DRIFT) | `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` | `plan/in-progress/spec-fix-prod-guards-prose.md §SPEC-DRIFT` (미적용) | project-planner 가 Rationale 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 불릿 추가 후 plan SPEC-DRIFT 항목 체크 완료 처리 |
| 6 | Naming Collision | WebAuthn 전용 에러 코드 6종(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`)이 중앙 에러 카탈로그에 미등재 | `spec/5-system/1-auth.md §5` API 표 (WebAuthn 엔드포인트 에러 응답) | `spec/5-system/3-error-handling.md §1.2` (7종만 등재, WebAuthn 코드 없음) + `spec/conventions/error-codes.md` | `3-error-handling.md §1.2` 에 WebAuthn 서브섹션 신설 또는 기존 "인증/인가 에러" 행에 6종 추가. 또는 `1-auth.md §5` 에 "에러 코드 SoT 는 `3-error-handling.md §1.2` 참조" 주석 추가 |
| 7 | Naming Collision | `CANNOT_REVOKE_CURRENT_SESSION`, `REAUTH_NOT_AVAILABLE` 에러 코드가 auth spec 본문 및 중앙 카탈로그에 미등재 | `spec/5-system/1-auth.md §2.3` / §5 세션 엔드포인트 | `spec/data-flow/2-auth.md §1.5` (정의처 역할을 하고 있으나 auth spec 본문에 없음) | `1-auth.md §2.3` 또는 §5 세션 엔드포인트 주석에 두 코드 명시, 또는 `3-error-handling.md §1.2` 에 등재 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | RBAC SoT cross-reference 누락 — user-profile §4.2 가 auth §3.2 를 SoT 로 명시하지 않음 | `spec/2-navigation/9-user-profile.md §4.2` | 표 아래 "전체 리소스 권한 매트릭스는 auth §3.2 참조" 한 줄 추가 |
| 2 | Cross-Spec | Action naming 규약이 target 과 data-flow/1-audit.md 에 중복 서술 | `spec/data-flow/1-audit.md §1.1` | `data-flow/1-audit.md §1.1` 의 naming 규약 서술을 "규약 상세는 인증 spec §4.1 참조"로 대체해 단일 진실 집중 |
| 3 | Convention Compliance | §1.5.4 에러 코드 historical-artifact 예외(`invitation_*` / `forbidden` / `rate_limited`) — error-codes.md §3 등재 확인, 이상 없음 | `spec/5-system/1-auth.md §1.5.4` | 변경 불필요 |
| 4 | Convention Compliance | 문서 구조 — `## Overview` 섹션 없이 §1 로 시작 (CLAUDE.md 권장 3섹션 구조) | `spec/5-system/1-auth.md` 전체 구조 | 필수 아님. 일관성 제고 원할 시 상단에 `## Overview` 추가 |
| 5 | Convention Compliance | frontmatter `pending_plans` 파일 실존은 자동 빌드 가드(`spec-pending-plan-existence.test.ts`) 담당 | `spec/5-system/1-auth.md` frontmatter lines 33-35 | 변경 불필요 |
| 6 | Plan Coherence | `security-backlog-invitation-token-hash.md` — 초대 토큰 해시 저장 전환 저우선순위 미착수 추적 (충돌 없음) | `spec/5-system/1-auth.md §1.5.D Rationale` | 조치 불요. 착수 시 §1.5.D 변경을 project-planner 협의 경유 |
| 7 | Naming Collision | `password_change`, `2fa_enable/disable` dot-prefix 누락 (Critical #1 과 동일, INFO 등급으로 추가 보고) | `spec/5-system/1-auth.md §4.1` Planned 표 | Critical #1 조치와 동일 |
| 8 | Naming Collision | `forbidden`(lowercase) 과 `FORBIDDEN`(uppercase) 혼재 — error-codes.md §3 historical artifact 등재로 의도된 예외이나 표 내 가시성 낮음 | `spec/5-system/1-auth.md §1.5.4` 표 `forbidden` 행 | 표의 `forbidden` / `rate_limited` 셀에 `(historical artifact — error-codes.md §3 등재)` 각주 추가 |
| 9 | Naming Collision | `WEBAUTHN_COUNTER_REGRESSION` 이 `login_history.failure_reason` 값인지 HTTP 에러 코드인지 경계 불명확 | `spec/5-system/1-auth.md §1.4.4`, §4.3, §5 | §5 API 표 해당 행에 `(failure_reason=WEBAUTHN_COUNTER_REGRESSION, HTTP 에러 코드 아님)` 주석 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Planned 감사 액션 dot-prefix 위반(WARNING), Integration(Org) 읽기 권한 user-profile 미기재(WARNING), RBAC SoT cross-reference 누락(INFO) |
| Rationale Continuity | **MEDIUM** | Planned 감사 액션 `password_change`/`2fa_enable/disable` 이 합의된 dot-prefix 규약 위반 — cross-audit G-02 선례 역행(CRITICAL) |
| Convention Compliance | LOW | 동일 Planned 감사 액션 dot-prefix 위반(WARNING), 나머지 INFO 수준 |
| Plan Coherence | LOW | reveal 엔드포인트 §5 미추가(WARNING), `OAUTH_STUB_MODE`/`LLM_STUB_MODE` Rationale 미열거 SPEC-DRIFT(WARNING) |
| Naming Collision | LOW | WebAuthn 에러 코드 6종 중앙 카탈로그 미등재(WARNING), 세션 revoke 에러 코드 2종 auth spec 누락(WARNING) |

---

## 권장 조치사항

1. **(BLOCK 해소 — 최우선)** `spec/5-system/1-auth.md §4.1` Planned 표의 `password_change` → `user.password_changed`(또는 `auth.password_changed`), `2fa_enable/disable` → `user.2fa_enabled` / `user.2fa_disabled` 로 수정. resource prefix 미확정 시 `TBD: <resource>.password_changed` 형식으로라도 dot-prefix 형식 유지.
2. `spec/5-system/1-auth.md §5` API 표에 `POST /api/auth-configs/:id/reveal` 행 추가 (`auth-config-webhook-followups.md §3` 연동).
3. `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 불릿 추가 (`spec-fix-prod-guards-prose.md §SPEC-DRIFT` 연동).
4. `spec/5-system/3-error-handling.md §1.2` 에 WebAuthn 에러 코드 6종 및 세션 revoke 에러 코드 2종 등재.
5. `spec/2-navigation/9-user-profile.md §4.2` 에 `Integration (Org) 조회` 행 추가 또는 기존 행 제목 한정, SoT 참조 링크 추가.
6. `spec/data-flow/1-audit.md §1.1` 의 naming 규약 서술을 auth spec §4.1 단일 진실 참조로 대체.
7. (선택) `spec/5-system/1-auth.md §1.5.4` 표의 `forbidden`/`rate_limited` 셀에 historical artifact 각주 추가, §5 `WEBAUTHN_COUNTER_REGRESSION` 에 failure_reason 값 명시 주석 추가.