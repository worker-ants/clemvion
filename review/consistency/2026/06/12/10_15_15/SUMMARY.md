# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 수준 이슈 6건, 차단 불필요.

## 전체 위험도
**MEDIUM** — Planned 감사 액션 동사 시제 규약 위반(convention_compliance)과 cross-spec 엔드포인트 누락·계약 불일치(cross_spec)가 주요 위험 요인. 현재는 미구현 단계라 수정 비용이 낮으나 방치 시 코드로 굳어질 수 있음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | cross_spec | OAuth-only 사용자 강제 종료 재인증 대체 수단 "이메일 OTP"가 data-flow 에 정의 없음 — `REAUTH_NOT_AVAILABLE` 반환 계약과 불일치 | `spec/5-system/1-auth.md §2.3` | `spec/data-flow/2-auth.md §1.5`, `spec/2-navigation/9-user-profile.md §6.1` | (a) "이메일 OTP"를 Planned 표기하거나 (b) 해당 엔드포인트 계약을 auth spec §5·data-flow/2-auth §1.5에 추가하거나 (c) "이메일 OTP" 문구 삭제 후 `REAUTH_NOT_AVAILABLE` 에 맞게 정렬 |
| W-2 | cross_spec | `POST /api/auth/verify-email`이 §5 API 표에 누락 — data-flow/2-auth §1.1 에서 회원가입 필수 2단계 엔드포인트로 명시됨 | `spec/5-system/1-auth.md §5` | `spec/data-flow/2-auth.md §1.1` | target §5에 `POST /api/auth/verify-email` 추가 및 응답 계약(personal workspace 생성 + 토큰 발급) 기술 |
| W-3 | cross_spec | `POST /auth/resend-verification` 경로에 `/api/` prefix 누락 | `spec/5-system/1-auth.md §1.1` 표 | `spec/data-flow/2-auth.md §1.7` | 경로를 `/api/auth/resend-verification`으로 수정 |
| W-4 | convention_compliance | Planned 감사 액션 `member.*`, `workflow.*`, `trigger.*`, `schedule.*`, `workspace.*`가 현재형 동사 사용 — §4.1 "audit는 과거분사" 규약 및 Rationale §4.1.A 위반 | `spec/5-system/1-auth.md §4.1` Planned 표 | 동일 문서 §4.1 Action naming 규약 + Rationale §4.1.A | Planned 표의 현재형 동사를 과거분사로 일괄 정정 (`invite`→`invited`, `role_change`→`role_changed`, `remove`→`removed`, `create`→`created`, `update`→`updated`, `delete`→`deleted`, `execute`→`executed`) |
| W-5 | convention_compliance | 구현된 액션 `workspace.transfer_ownership`이 동사 원형(명사형)으로 규약 이탈 — 예외 문서화 없음 | `spec/5-system/1-auth.md §4.1` 구현된 액션 표 | 동일 문서 §4.1 Action naming 규약 | (a) historical-artifact 예외로 명시 주석 달거나 (b) 신규 구현 전이면 `workspace.ownership_transferred`로 정정 |
| W-6 | plan_coherence | `spec/2-navigation/4-integration.md`를 target과 `pr4b-kb-embedding-retire` worktree가 동시에 편집 중 — merge conflict 가능 | `spec/2-navigation/4-integration.md §14.3` | worktree `pr4b-kb-embedding-retire` | 두 변경의 편집 위치 상이 여부 확인 후 진행. 겹치면 선제 조율 필요 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | RBAC 매트릭스 항목 세분화 비대칭 — user-profile §4.2 vs auth §3.2 | `spec/5-system/1-auth.md §3.2`, `spec/2-navigation/9-user-profile.md §4.2` | user-profile §4.2에 "상세 매트릭스는 auth spec §3.2 참고" 교차 링크 추가 |
| I-2 | cross_spec | §1.5.1 Rate Limit 행에 `/api/invitations/:token` 분당 30건 제한 미기술 | `spec/5-system/1-auth.md §1.5.1` | Rate Limit 행에 공개 토큰 메타 조회 30건 제한 추가 |
| I-3 | rationale_continuity | §4.1 Planned `user.*` dot-prefix 정정은 규약 준수 방향 정정이며 Rationale §4.1.A로 근거 문서화됨 — 불연속 없음 | `spec/5-system/1-auth.md §4.1` | 현행 유지 |
| I-4 | rationale_continuity | §4.1 "읽기측 계약" 산문 블록이 data-flow/1-audit §1.1과 내용 중복 — 향후 단일 SoT 정리 권장 | `spec/5-system/1-auth.md §4.1`, `spec/data-flow/1-audit.md §1.1` | 두 문서 중 하나를 SoT로 정하고 다른 쪽은 교차 참조 링크로 대체 (강제 아님) |
| I-5 | convention_compliance | Planned 표 `workspace.*` 액션에 backtick 누락 — 구현된 표와 형식 불일치 | `spec/5-system/1-auth.md §4.1` Planned 표 | Planned 표 action 문자열에 backtick 일관 적용 |
| I-6 | convention_compliance | `invitation_*` lower_snake_case 에러 코드가 `error-codes.md §3` 레지스트리와 정합 확인 — 정상 | `spec/5-system/1-auth.md §1.5.4` | 조치 불필요 |
| I-7 | plan_coherence | `auth-config-webhook-followups.md §3` reveal 엔드포인트 §5 등재 항목 — 이번 변경 범위 미포함, 미해소 | `spec/5-system/1-auth.md §5` | target 머지 후 §3 잔여 TODO 별도 처리 |
| I-8 | plan_coherence | `pending_plans`에서 `auth-config-webhook-followups.md` 제거 시점은 §2~4 완료 후 | spec frontmatter | §1 완료 반영 올바름, 현행 `partial` 상태 유지 |
| I-9 | naming_collision | `password_change` (data-flow/1-audit §1.1 구 표기) vs `user.password_changed` (target 확정) — 두 문서 불일치 | `spec/data-flow/1-audit.md §1.1` | data-flow §1.1의 `password_change`, `2fa_enable/disable`을 target 확정 명칭으로 갱신 |
| I-10 | naming_collision | target §5 API 표에 `GET /api/auth/oauth/providers` 누락 | `spec/5-system/1-auth.md §5` | §5에 행 추가 또는 `10-auth-flow.md §8` 보완 관계 명시 |
| I-11 | naming_collision | target §5 API 표에 `POST /api/auth/verify-email`, `POST /api/auth/check-email` 누락 (W-2와 중복 — 통합 처리) | `spec/5-system/1-auth.md §5` | §5에 행 추가 또는 보완 관계 명시 |
| I-12 | naming_collision | `auth_config.reveal` 표기 target과 기존 사용처(`6-config.md §120`, `12-webhook.md §368`) 일치 확인 — 충돌 없음 | `spec/5-system/1-auth.md §4.1` | 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §2.3 이메일 OTP 재인증 계약 불일치(W-1), §5 verify-email 엔드포인트 누락(W-2), resend-verification prefix 오기(W-3) |
| rationale_continuity | NONE | 변경 모두 규약 준수 방향의 정정, 과거 결정과 불연속 없음 |
| convention_compliance | MEDIUM | Planned 액션 동사 시제 규약 위반(W-4), workspace.transfer_ownership 예외 미문서화(W-5) |
| plan_coherence | LOW | pr4b-kb-embedding-retire worktree와 4-integration.md 동시 편집 경합(W-6), auth-config-webhook-followups 잔여 항목 미해소(INFO) |
| naming_collision | LOW | data-flow §1.1 구 표기 미갱신(I-9), §5 API 표 완전성 미흡(I-10, I-11) — 충돌 없음 |

---

## 권장 조치사항

1. **(W-4 최우선)** `spec/5-system/1-auth.md §4.1` Planned 표의 `member.*`/`workflow.*`/`trigger.*`/`schedule.*`/`workspace.*` 현재형 동사를 과거분사로 일괄 정정. Rationale §4.1.A가 이미 근거를 제시했으므로 수정 비용이 낮다. 방치 시 구현 시 `AUDIT_ACTIONS` union에 잘못된 시제로 굳어짐.
2. **(W-5)** `workspace.transfer_ownership`에 historical-artifact 예외 주석을 명시적으로 추가하거나 `workspace.ownership_transferred`로 정정.
3. **(W-1)** `spec/5-system/1-auth.md §2.3` "이메일 OTP" 재인증 대체 수단을 현행 `REAUTH_NOT_AVAILABLE` 계약에 맞게 정렬하거나 Planned 명시.
4. **(W-2 + I-11 통합)** `spec/5-system/1-auth.md §5` API 표에 `POST /api/auth/verify-email`, `POST /api/auth/check-email` 행 추가.
5. **(W-3)** `spec/5-system/1-auth.md §1.1` 표의 `POST /auth/resend-verification`을 `/api/auth/resend-verification`으로 수정.
6. **(W-6)** `pr4b-kb-embedding-retire` worktree의 `spec/2-navigation/4-integration.md` 편집 영역을 확인해 충돌 선제 조율.
7. **(I-9)** `spec/data-flow/1-audit.md §1.1`의 `password_change`, `2fa_enable/disable` 구 표기를 target 확정 명칭(`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`)으로 갱신.
8. **(I-1)** `spec/2-navigation/9-user-profile.md §4.2`에 "상세 매트릭스는 auth spec §3.2 참고" 교차 링크 추가.