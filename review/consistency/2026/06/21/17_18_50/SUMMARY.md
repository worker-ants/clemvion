# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 4개 checker 모두 LOW. rationale_continuity 는 fatal(재시도 필요). Critical 위배 없음. Warning 4건(중복 통합 후 3건), INFO 다수.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Plan-Coherence | 재인증 계약 — "§2.3 강제 종료 재인증" 재사용 선언하나 이메일 OTP 브랜치 누락 | spec-draft §2.1.a, §확정 설계 item 1 | `spec/5-system/1-auth.md §2.3` ("OAuth-only → 이메일 OTP 대체" 문구) | 이메일 변경 흐름에서 이메일 OTP 허용 여부를 명시 결정: 배제 시 §2.3 레거시 문구를 이번 spec 반영 PR 에서 함께 정정(실제 구현·data-flow §1.5 와 일치) |
| 2 | Cross-Spec | `REAUTH_NOT_AVAILABLE` — "기존 §2.3 재사용" 표기이나 spec 레벨 정의 미등록 | spec-draft §4 에러 코드 표 | `spec/conventions/error-codes.md §3` 레지스트리 | naming_collision 이 `sessions.service.ts L239` 실존 확인 → 재사용 타당. `error-codes.md §3` 에 등록하거나 data-flow §1.5 가 SoT 임을 명시 |
| 3 | Convention-Compliance | 마이그레이션 버전 `V0xx` placeholder — spec 본문 반영 시 단조성 위반 위험 | spec-draft §1 데이터 모델 | `spec/conventions/migrations.md §1·§2` | spec 반영 시 `V100__add_email_change_fields.sql` 로 확정(현 max V099); 또는 draft 에 "구현 시 V100 사용" 주석 명시 |
| 4 | Convention-Compliance | `EMAIL_CHANGE_TOKEN_INVALID` — 기존 auth 에러 코드 패턴 정렬 미확인 | spec-draft §4 에러 코드 표 | `spec/5-system/1-auth.md` email_verify_token / password_reset_token 계열 에러 코드 | auth spec 동일 계열 코드 패턴 확인 후 일관성 유지; 단일 코드로 무효·만료 포괄 시 spec 에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 엔드포인트 SoT — auth §5 삽입 행이 포인터 형식인지 완전 정의인지 불명확 | spec-draft §2.5 + §3.4 | auth §5 삽입 행을 "[User Profile §6.1 참조]" 포인터 행으로 조정 |
| 2 | Cross-Spec / Convention / Naming | `user.email_changed` — `audit-actions.md §3` 레지스트리 및 `data-flow/1-audit.md §1.1` 미등록 | spec-draft §2.4, §4.1 | spec 반영 범위에 `audit-actions.md §3` user 행 `email_changed | 미구현` 추가를 명시적으로 포함 |
| 3 | Cross-Spec | `session_revoked` §4.3 행 설명 — 비밀번호 변경만 명시, 이메일 변경 누락 | `spec/5-system/1-auth.md §4.3` | §4.3 행에 "또는 이메일 변경 confirm 성공 시 전체 family revoke" 병기 |
| 4 | Cross-Spec | `pendingEmail` — UserProfileDto API 계약 spec 미명시 | spec-draft §5 프론트엔드 메모 | `spec/2-navigation/9-user-profile.md §6.1` GET 행에 `pendingEmail: string | null` 응답 필드 명시 |
| 5 | Convention-Compliance | plan draft Rationale 분배 — 다음 단계 체크리스트 미포함 | spec-draft §다음 단계 | §다음 단계 §2 에 "R1~R6 를 대상 spec 3파일 각 `## Rationale` 에 분배" 항목 추가 |
| 6 | Convention-Compliance | 에러 코드 주석 — spec 본문 반영 시 제거 필요 | spec-draft §4 하단 주석 | `1-auth.md §1.1.B` 반영 시 주석 라인 삭제 |
| 7 | Plan-Coherence | `spec-sync-user-profile-gaps.md` 연계 미기재 | spec-draft §다음 단계 | "spec 반영 시 user-profile-gaps.md 이메일 행 연동 확인" 한 줄 추가 |
| 8 | Plan-Coherence | `refactor-auth-reverify-unify.md` 미착수 §2.3 편집과 동일 표 충돌 위험 | spec-draft §2, `1-auth.md §2.3` | target plan 반영 시 refactor-auth-reverify-unify 미착수 항목 병행 처리 또는 선행 PR 확인 메모 추가 |
| 9 | Naming-Collision | API 경로 비대칭 (`change-password` vs `email-change`) | 신규 4개 엔드포인트 | 현행 패턴 유지; 향후 profile API 추가 시 동사-앞/명사-앞 혼재 주의 |
| 10 | Naming-Collision | `EMAIL_ALREADY_IN_USE` — register 엔드포인트 기존 코드명과 통일 여부 미확인 | spec-draft §4 | 구현 시 register 계열 기존 코드명 비교 후 별도임을 명시하거나 통일 |
| 11 | Naming-Collision | 마이그레이션 `V100` — 세 자리→네 자리 전환 시점 (Flyway 호환 이상 없음) | spec-draft §1 | spec 반영 시 `V100` 확정 또는 구현 위임 명기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Critical 없음. WARNING 2건(재인증 OTP 누락, REAUTH_NOT_AVAILABLE spec 미정의), INFO 4건 |
| Rationale-Continuity | **재시도 필요** (fatal — output_file 미생성) | 결과 없음 |
| Convention-Compliance | LOW | Critical 없음. WARNING 2건(마이그레이션 번호 placeholder, 에러 코드 패턴 미확인), INFO 3건 |
| Plan-Coherence | LOW | Critical 없음. WARNING 1건(§2.3 이메일 OTP 드리프트 표면 충돌), INFO 3건 |
| Naming-Collision | LOW | Critical·Warning 없음. INFO 5건(충돌 없음; 레지스트리 갱신·패턴 주의) |

## 권장 조치사항
1. **(WARNING 1 — 재인증 계약 해소)** spec-draft §2.1.a 에 "이메일 OTP 배제 — 이메일 변경 특성상 옛 메일함 접근이 재인증 증거로 부적합, R-n 참조" 명시. `spec/5-system/1-auth.md §2.3` 의 "이메일 OTP" 레거시 문구를 이번 spec 반영 PR 에서 함께 정정.
2. **(WARNING 2 — REAUTH_NOT_AVAILABLE)** `spec/conventions/error-codes.md §3` 레지스트리에 `REAUTH_NOT_AVAILABLE` 추가 등록하거나, data-flow §1.5 가 SoT 임을 error-codes.md 에 포인터로 명시.
3. **(WARNING 3 — 마이그레이션 번호)** spec 본문 반영 시 `V0xx` → `V100__add_email_change_fields.sql` 확정. draft 단계라면 "구현 시 V100 사용" 주석 추가.
4. **(WARNING 4 — EMAIL_CHANGE_TOKEN_INVALID)** `spec/5-system/1-auth.md` 기존 `email_verify_token` 계열 에러 코드 명칭 확인 후 패턴 정렬; 단일 코드 포괄 시 spec 에 명시.
5. **(INFO 우선순위 — audit-actions.md)** spec 반영 범위에 `spec/conventions/audit-actions.md §3` user 행 `email_changed (미구현)` 등재 명시(현재 다음 단계 §3 에 미기재).
6. **(INFO — pendingEmail DTO)** `spec/2-navigation/9-user-profile.md §6.1` GET 응답 shape 에 `pendingEmail: string | null` 필드 추가 명시.
7. **(재시도 필요)** rationale_continuity checker 가 fatal 로 종료 — output_file 미생성. 재실행 후 결과 통합 권장.
