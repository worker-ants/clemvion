# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불필요

## 전체 위험도
**LOW** — 2개 checker 에서 WARNING 발견(표기 오류·레이블 혼동). 보안/아키텍처 충돌 없음. 나머지 3개 checker 는 NONE.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `email_verify_token` 저장 형태 — raw vs SHA-256 해시 구분 미기술로 오해 가능 | `spec/data-flow/2-auth.md §1.1` (line 44–45), `§2.1 Schema 매핑` (line 245) | `spec/5-system/1-auth.md §1.1`, `spec/1-data-model.md §2.1` ("SHA-256 해시로만 저장" 명시) | `§1.1` 시퀀스 다이어그램 또는 `§2.1` 에 "DB: SHA-256 해시, 메일: raw 토큰" 구분 주석 추가 |
| 2 | Cross-Spec | 동시 세션 5개 제한 + 30일 비활동 만료 정책이 data-flow spec 에 전혀 반영 안 됨 | `spec/data-flow/2-auth.md §2 Schema 매핑`, `§3 상태 전이` | `spec/5-system/1-auth.md §2.3 세션 정책`, `spec/1-data-model.md §2.18.1` (`rememberMe` 분기) | `§2.2 Redis` 또는 `§3.1` 에 `expires_at` 결정 규칙(`rememberMe` 분기) + 동시 세션 초과 처리 흐름 보완 (또는 미구현 시 auth spec 에 "(미구현)" 주석) |
| 3 | Convention Compliance | `§1.4` 내부에서 `§1.4` 를 선행 근거로 자기참조 — WebAuthn 단일 트랜잭션 명시 섹션이 이 문서에 없음 | `spec/data-flow/2-auth.md` line 184 추가 블록 | (내부 일관성) | 지칭 대상을 `spec/5-system/1-auth.md` 의 실제 경로로 교체하거나 자기참조 수식어 제거 |
| 4 | Naming Collision | `(05 C-1)` 레이블이 기존 consistency-check 결과 ID `C-1` 과 네임스페이스 혼동 유발 | `spec/data-flow/2-auth.md §1.4` 주석 + 코드 주석 `// 05 C-1` | `spec/conventions/execution-context.md:44`, `spec/4-nodes/1-logic/10-parallel.md:230` (기존 `C-1`) | `(refactor/05-database.md C-1)` 또는 `(DB-C-1)` 으로 교체, 또는 plan 참조임을 한 줄 주석 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `§1.4` refresh 회전 INSERT 다이어그램에 `user_id`, `ip_address`, `user_agent`, `device_label` 생략 — `§2.1` 전체 컬럼과 불일치 | `spec/data-flow/2-auth.md §1.4` line 171 | 다이어그램에 "전체 컬럼은 §2.1 참조" 한 줄 추가 또는 생략된 컬럼을 `...` 으로 표시 |
| 2 | Cross-Spec | `reset-password` 완료 후 `login_history` 이벤트 기록 여부 미명시 | `spec/data-flow/2-auth.md §1.7` | `§1.7` 에 이벤트 기록 여부(기록 없음 또는 이벤트명) 명시 |
| 3 | Cross-Spec | `§1.3` 시퀀스 다이어그램에 `rememberMe` (camelCase), `§2.1` 에 `remember_me` (snake_case) 혼재 | `spec/data-flow/2-auth.md §1.3` vs `§2.1` | `§1.3` 컬럼명을 DB 실제 snake_case(`remember_me`)로 통일 |
| 4 | Convention Compliance | 비표준 요구사항 라벨 `(05 C-1)` — plan 내부 ticket 번호를 spec 규범 ID 로 사용 | `spec/data-flow/2-auth.md` line 179 | 도메인 prefix 기반 표준 ID(`AUTH-ROT-01` 등) 로 교체하거나 라벨 제거, 또는 폴더 정식 규약으로 채택 후 `0-overview.md` 에 명시 |
| 5 | Convention Compliance | `spec/data-flow/` 폴더 파일 전체에 frontmatter 없음 — 현재 의무 범위에 미포함이므로 위반 아님 | `spec/data-flow/` 폴더 15개 파일 | 향후 coverage tracking 대상으로 확장 시 `spec-impl-evidence.md §1` 적용 범위에 추가 |
| 6 | Naming Collision | `TOKEN_INVALID` 에 TOCTOU 동시 회전 경합 케이스가 추가됐으나 에러 코드 SoT 에 미기재 | `spec/data-flow/2-auth.md §1.4` | `spec/5-system/3-error-handling.md` `TOKEN_INVALID` 행에 "TOCTOU 동시 회전 경합" 발생 케이스 병기 |
| 7 | Naming Collision | `generateTokens` optional `EntityManager` 파라미터 추가의 external 노출 금지 계약이 spec 에 미기술 | `spec/data-flow/2-auth.md §1.4` (암묵 반영) | `§1.4` 또는 진입점 섹션에 "`generateTokens` — private, 트랜잭션 컨텍스트 전파 전용" 한 줄 추가 (선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `email_verify_token` SHA-256/raw 구분 누락(W), 세션 정책 미반영(W), 내부 표기 불일치 3건(I) |
| Rationale Continuity | NONE | 기각된 대안 재도입 없음. WebAuthn 선례와 일관된 원자성 확장. 이슈 없음 |
| Convention Compliance | LOW | `§1.4` 자기참조 오류(W), plan 번호 레이블 비표준(I), frontmatter 면제 확인(I) |
| Plan Coherence | NONE | 미해결 결정 우회 없음, 파일 경합 없음, 선행 구현 완료 확인 |
| Naming Collision | LOW | `C-1` 네임스페이스 혼동(W), `TOKEN_INVALID` SoT 미갱신(I), `generateTokens` 계약 미기술(I) |

## 권장 조치사항

1. **(W3 — 즉시 해소 권장)** `spec/data-flow/2-auth.md` line 184 의 자기참조를 `spec/5-system/1-auth.md` 실제 경로로 교체 또는 제거. 독자 오독 직접 유발.
2. **(W4 + I4 중복 — 함께 처리)** `§1.4` 인라인 노트의 `(05 C-1)` 레이블을 `(refactor/05-database.md C-1)` 또는 `(DB-C-1)` 으로 교체. 코드 주석 `// 05 C-1` 도 동일하게 갱신.
3. **(W1)** `spec/data-flow/2-auth.md §1.1` 또는 `§2.1` 에 `email_verify_token` 저장 구분(DB: 해시, 메일: raw) 주석 추가.
4. **(W2)** `spec/data-flow/2-auth.md §3.1` 상태 전이 다이어그램에 `rememberMe` 분기(`expires_at` 결정 규칙) 보완. 동시 세션 5개 제한이 미구현인 경우 `spec/5-system/1-auth.md §2.3` 에 "(미구현)" 주석.
5. **(I6)** `spec/5-system/3-error-handling.md` `TOKEN_INVALID` 행에 TOCTOU 동시 회전 케이스 병기 (에러 코드 SoT 보완).
6. **(I1, I3)** `§1.4` 다이어그램에 생략 컬럼 표시(`...`) + `§1.3` camelCase 컬럼명을 snake_case 로 통일 (표기 정합성).