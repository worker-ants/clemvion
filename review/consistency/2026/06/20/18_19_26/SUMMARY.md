# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 INFO 등급이며 차단 사유 없음.

## 전체 위험도
**LOW** — 기능·계약·규약 모순 없음. 일부 spec 문서(data-flow 다이어그램, self-revoke 정책 미명시)의 동기화 권장 사항만 존재.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램이 `bcrypt.compare` 직접 심볼로 기술됨 (구현은 `comparePassword` 래퍼로 교체) | `spec/data-flow/2-auth.md` §1.1 (L43), §1.2 (L73) | 다이어그램 표기를 `comparePassword(password, password_hash)` / `hashPassword(password)` 로 갱신하거나 `(password.util 래퍼 경유)` 주석 추가. 필수 아님. |
| 2 | Cross-Spec | `spec/5-system/1-auth.md §1.1` 및 Rationale 에 `bcrypt` 직접 언급 2건 (알고리즘 수준 기술, 헬퍼 도입과 의미 모순 없음) | `spec/5-system/1-auth.md` §1.1, Rationale L618 | 필수 변경 아님. 필요 시 `(password.util.ts 의 hashPassword/comparePassword 경유)` 주석 추가. |
| 3 | Cross-Spec | `spec/data-flow/2-auth.md §1.5` self-revoke 차단 서술이 `currentRefreshToken` 5번째 파라미터 추가 흐름을 미기술 | `spec/data-flow/2-auth.md` §1.5 (L194, L201–203) | self-revoke 주석에 `currentRefreshToken` 파라미터 흐름(`sha256(token)` 으로 family 비교) 한 문장 보강. 필수 차단 아님. |
| 4 | Rationale Continuity | `data-flow/2-auth.md §1.2` 다이어그램 `bcrypt.compare` 표기가 구현 변경으로 stale화 (기능 모순 없음) | `spec/data-flow/2-auth.md §1.2` | `bcrypt.compare` → `comparePassword(password, password_hash)` 로 갱신해 코드와 일치. Rationale 추가 불필요. |
| 5 | Rationale Continuity | `AuthService.verifyPasswordForUser` 단일 경로 선택 근거 미문서화 | `spec/5-system/1-auth.md` Rationale | "비밀번호 재확인(re-verify)의 단일 서비스 경로 — `AuthService.verifyPasswordForUser`" 항목 추가 권장. |
| 6 | Convention Compliance | `PASSWORD_REQUIRED` · `PASSWORD_INVALID` 에러 코드가 `spec/5-system/1-auth.md §5` 엔드포인트 설명 및 `error-codes.ts` enum 에 미등재 (기존 패턴과 동일, 회귀 아님) | `auth.service.ts` L67, L74 | 향후 에러 카탈로그 정비 시 등재. `spec/5-system/1-auth.md §5` 또는 `3-error-handling.md §1` 에 추가 권장. |
| 7 | Plan Coherence | `revokeFamily` 5번째 인자 추가 및 self-revoke 방지 테스트 2건이 `refactor-auth-reverify-unify.md` §변경 3번 기술 범위를 초과 (미추적) | `plan/in-progress/refactor-auth-reverify-unify.md` §변경 3번 | plan §변경 3번에 "`revokeFamily` 5번째 인자(`currentRefreshToken`) 추가 + self-revoke(400) 방지 분기 신설" 기록. |
| 8 | Plan Coherence | `spec/5-system/1-auth.md §2` 에 self-revoke 방지(`400 CANNOT_REVOKE_CURRENT_SESSION`) 정책이 미명시 (구현됨) | `spec/5-system/1-auth.md §2·§4.3` | `refactor-auth-reverify-unify.md` §범위 밖/후속에 "self-revoke 방지 동작을 spec §2 에 명시 — planner 위임" 추적 항목 추가. |
| 9 | Naming Collision | `comparePassword`, `verifyPasswordForUser`, `currentRefreshToken`, `hashRaw` 모두 기존 네임스페이스와 충돌 없음 (사용처 확장) | 변경 파일 전반 | 없음. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | data-flow 다이어그램 bcrypt 심볼·self-revoke 서술 동기화 권장(INFO 3건). 기능·계약 모순 없음. |
| Rationale Continuity | LOW | data-flow §1.2 다이어그램 stale화(INFO). `verifyPasswordForUser` 선택 근거 미문서화(INFO). 기각된 대안 재도입 없음. |
| Convention Compliance | NONE | `PASSWORD_REQUIRED`/`PASSWORD_INVALID` enum 미등재(기존 패턴과 동일). frontmatter·3섹션 구조·UPPER_SNAKE_CASE 전부 준수. |
| Plan Coherence | LOW | `revokeFamily` 시그니처 변경·self-revoke 테스트가 plan §변경 3번 기술 초과(INFO). 선행 plan 미해소·미결정 충돌 없음. |
| Naming Collision | NONE | 신규 식별자 모두 기존 네임스페이스와 무충돌. 에러 코드 신규 도입 없음. |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 진행 가능) 현 변경 세트는 모든 spec 계약·레이어 원칙·규약을 준수하며 차단 사유가 없다.
2. (선택적, 단기) `plan/in-progress/refactor-auth-reverify-unify.md` §변경 3번에 `revokeFamily` 5번째 인자 및 self-revoke 방지 분기 신설 사항 기록 (plan 정합성 보완).
3. (선택적, 단기) `refactor-auth-reverify-unify.md` §범위 밖/후속에 "self-revoke 방지 동작 — `spec/5-system/1-auth.md §2` 명시, planner 위임" 추적 항목 추가.
4. (선택적, 중기) `spec/data-flow/2-auth.md §1.2` 다이어그램의 `bcrypt.compare` 표기를 `comparePassword(password, password_hash)` 로 갱신 (Cross-Spec #1 / Rationale #4 공통 해소, planner 수행).
5. (선택적, 중기) `spec/data-flow/2-auth.md §1.5` self-revoke 주석에 `currentRefreshToken` sha-256 흐름 한 문장 보강 (Cross-Spec #3 해소, planner 수행).
6. (선택적, 장기) `PASSWORD_REQUIRED` · `PASSWORD_INVALID` 를 `spec/5-system/1-auth.md §5` 엔드포인트 에러 목록 또는 `3-error-handling.md §1` 카탈로그에 등재 (Convention Compliance #6 해소, planner 수행).
7. (선택적, 장기) `spec/5-system/1-auth.md Rationale` 에 "비밀번호 재확인 단일 서비스 경로 — `AuthService.verifyPasswordForUser`" 항목 추가 (Rationale Continuity #5 해소, planner 수행).
