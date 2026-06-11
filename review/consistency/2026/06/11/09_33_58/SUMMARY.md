# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 규약 직접 위반(invariant 파괴) 없음. 경고 3건은 모두 기존 상태 누락 또는 개선 권장 수준.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | cross_spec | `rememberMe` 시 30일 만료 분기가 data-flow 다이어그램·Schema 매핑표에서 누락 | `spec/data-flow/2-auth.md` §1.2, §2.1 `expires_at` 행 | `spec/1-data-model.md §2.18.1`, `spec/5-system/1-auth.md §2.3` | §1.2 INSERT 스텝에 `expires_at = rememberMe ? now+30d : now+7d` 조건 추가; §2.1 `expires_at` 컬럼 설명에 분기 주석 추가 |
| W-2 | cross_spec | WebAuthn counter 역행 시 refresh token 전체 revoke 가 data-flow 에서 미표현 | `spec/data-flow/2-auth.md` §1.2 WebAuthn 분기, §2.1 | `spec/5-system/1-auth.md §1.4.4` | §1.2 counter 역행 분기에 `UPDATE refresh_token SET is_revoked=true WHERE user_id=?` 스텝 + LoginHistory `webauthn_failed(WEBAUTHN_COUNTER_REGRESSION)` 추가; §2.1 Schema 매핑표에 해당 행 추가 |
| W-3 | convention_compliance | `spec/data-flow/` 영역 15개 파일이 `spec-impl-evidence §1 INCLUDE_PREFIXES` 미등재 — frontmatter 없음, lifecycle 추적 누락 | `spec/data-flow/` 하위 15개 파일 전체 | `spec/conventions/spec-impl-evidence.md §1` | `spec-impl-evidence §1 INCLUDE_PREFIXES` 에 `spec/data-flow/` 추가; 15개 파일에 frontmatter(`id`, `status: implemented`, `code:`) 일괄 추가; `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` `INCLUDE_PREFIXES` 동기 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | 로그아웃 시 `spec/5-system/1-auth.md §2.4` step 4 가 단일 토큰 무효화처럼 서술 — data-flow §1.6 "family 전체 revoke" 와 표현 불일치 (data-flow 직접 충돌 아님) | `spec/5-system/1-auth.md §2.4` step 4 | — | §2.4 step 4 에 "refresh 회전 시 단일 토큰 무효화 / 로그아웃 시 동일 family 전체 revoke" 구분 추가 |
| I-2 | cross_spec | 동시 세션 한도(5개) 초과 자동 종료 및 비활동 만료(30일) data mutation 이 data-flow §1.2 에서 미언급 | `spec/data-flow/2-auth.md` §1.2, §3.1 | `spec/5-system/1-auth.md §2.3` | §1.2 에 "동시 세션 초과 시 가장 오래된 family revoke" 스텝 또는 Note 추가; 비활동 만료 배치 존재 여부를 §2.3 에 명시 |
| I-3 | cross_spec | `email_verify_token` DB 저장(SHA-256 해시) vs 다이어그램 표기 불명확 | `spec/data-flow/2-auth.md` §1.1 다이어그램, §2.1 | `spec/1-data-model.md §2.1`, `spec/5-system/1-auth.md §1.1` | §1.1 INSERT 스텝에 `email_verify_token = sha256(rawToken)` 주석 추가 또는 step 5 에 raw/hash 분리 명시 |
| I-4 | cross_spec | OAuth 로그인 성공 시 `login_history.event=login_success` 기록이 §1.3 OAuth 다이어그램에서 누락 | `spec/data-flow/2-auth.md` §1.3 | `spec/data-flow/1-audit.md §1.2` | §1.3 말미에 `Svc->>Hist: event=login_success` 스텝 추가 또는 미기록 이유를 Rationale 에 명시 |
| I-5 | rationale_continuity | Rationale 의 `refactor/05-database.md C-1` 인라인 텍스트 참조가 하이퍼링크 없음 — 독자 추적 불가 | `spec/data-flow/2-auth.md` Rationale "Refresh token 회전 원자성" | — | `plan/complete/auth-refresh-rotation-atomic.md` 로 하이퍼링크 전환하거나 내용만 기술 |
| I-6 | rationale_continuity | 정상 회전 "기록 생략" 논거 vs WebAuthn "트랜잭션 밖 기록" 원칙의 차이가 미명시 | `spec/data-flow/2-auth.md` Rationale 마지막 단락 | `spec/5-system/1-auth.md §1.4` | "정상 회전은 기록 자체 생략, reuse/WebAuthn 이벤트는 기록하되 트랜잭션 밖" 한 문장 보완 선택적 |
| I-7 | convention_compliance | `spec/data-flow/0-overview.md` 도메인 인덱스 표 `파일` 열 display-text 가 실제 파일명(숫자 prefix 포함)과 불일치 | `spec/data-flow/0-overview.md §2` | — | 표 `파일` 열을 실제 파일명(`2-auth.md` 등)으로 통일하거나 display-text 를 도메인 이름으로 통일 |
| I-8 | convention_compliance | `spec/data-flow/2-auth.md` Rationale 의 `refactor/05-database.md` 참조가 하이퍼링크 없이 backtick 텍스트만 — 경로 미실존 | `spec/data-flow/2-auth.md` Rationale line 343 | — | 실존 경로(`plan/complete/…`)로 하이퍼링크 전환 또는 인용 생략 |
| I-9 | naming_collision | `TOKEN_INVALID` 설명 확장 — 기존 식별자에 새 발동 시나리오 추가, 신규 충돌 없음 | `spec/5-system/3-error-handling.md` line 36 | — | 장기적으로 `spec/5-system/14-external-interaction-api.md:315` 의 별도 기술을 SoT 참조 링크로 통합 권장 |
| I-10 | naming_collision | `spec/2-navigation/5-knowledge-base.md` frontmatter `pending_plans` 키 신규 추가 — 타 navigation spec 와 schema 일관성 미확인 | `spec/2-navigation/5-knowledge-base.md` frontmatter | — | 다른 navigation spec frontmatter 와 `pending_plans` 키 사용 일관성 확인 권장 |
| I-11 | plan_coherence | `refactor/05-database.md` C-2·C-3 미착수 — 본 변경과 무관 | `plan/in-progress/refactor/05-database.md` C-2, C-3 | — | 별도 worktree에서 이행 예정; 본 PR 차단 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `rememberMe` 만료 분기·WebAuthn 역행 revoke data-flow 누락(W-1·W-2); INFO 4건은 표현 누락 수준 |
| rationale_continuity | NONE | 기존 Rationale 과 완전 연속성 유지; 기각 대안 재도입·invariant 위반 없음 |
| convention_compliance | LOW | `spec/data-flow/` 영역 전체 `INCLUDE_PREFIXES` 미등재(W-3, 기존 상태); 변경 3파일 자체는 규약 준수 |
| plan_coherence | NONE | plan 이 권고한 옵션 A 정상 이행; 파일 충돌 없음; stale skip 0건 |
| naming_collision | NONE | 신규 에러 코드·엔티티·엔드포인트 없음; `TOKEN_INVALID` 확장은 기존 의미 부분집합 |

## 권장 조치사항

1. **(W-1) `rememberMe` 30일 만료 분기 data-flow 명시** — `spec/data-flow/2-auth.md §1.2` INSERT 스텝 및 §2.1 `expires_at` 컬럼에 `rememberMe ? now+30d : now+7d` 분기 추가. 구현자가 해당 조건을 data-flow 에서 확인하지 못해 빠뜨릴 위험 방지.
2. **(W-2) WebAuthn counter 역행 시 refresh token 전체 revoke data-flow 추가** — §1.2 counter 역행 분기에 `UPDATE refresh_token SET is_revoked=true WHERE user_id=?` 스텝 삽입; §2.1 Schema 매핑표에 해당 행 추가.
3. **(W-3) `spec/data-flow/` INCLUDE_PREFIXES 등재 + frontmatter 일괄 추가** — `spec/conventions/spec-impl-evidence.md §1` 및 `spec-frontmatter-parse.ts` 동기 갱신. 본 PR 범위가 아니라면 별도 plan으로 추적 권장.
4. **(I-1 ~ I-4, INFO) data-flow 표현 보완** — 필수 아님. 로그아웃 family revoke 구분(I-1), 동시 세션 한도 언급(I-2), email_verify_token SHA-256 표기(I-3), OAuth login_success 기록(I-4)은 후속 data-flow 정비 시 일괄 처리 권장.
5. **(I-5·I-8, INFO) Rationale 하이퍼링크 전환** — `refactor/05-database.md` 참조를 `plan/complete/auth-refresh-rotation-atomic.md` 링크로 교체하면 독자 추적성 향상.