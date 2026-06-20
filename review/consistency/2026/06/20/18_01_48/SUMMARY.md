# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 신규 에러 코드 카탈로그 미등재(WARNING) 및 코드 주석 spec 포인터 부정확(WARNING) 2건. 기능·보안·아키텍처 위반 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 신규 에러 코드 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 가 `spec/5-system/3-error-handling.md` 에 카탈로그 미등재 | `auth.service.ts` L67, L74 (`verifyPasswordForUser` 내 인라인 리터럴) | `spec/conventions/error-codes.md §1` (전체 에러 코드 카탈로그 SoT 원칙), `spec/5-system/3-error-handling.md §1` | `spec/5-system/3-error-handling.md §1` 에 두 코드 등재 (트리거 조건, HTTP 401, 적용 엔드포인트 명시). `spec/5-system/1-auth.md §5` 해당 행에도 에러 코드 보강. rename 불필요 (UPPER_SNAKE_CASE 형식은 규약 충족) |
| 2 | Convention Compliance | 코드 주석 spec 포인터 `data-flow/2-auth.md §1.2` 가 실제 내용과 불일치 (§1.2 는 로그인 흐름 다이어그램, 레이어 정렬 정책 선언 없음) | `auth.service.ts` L54 JSDoc, `webauthn.controller.ts` diff 코드 주석 `[refactor 02 C-3 §3]` | `spec/data-flow/2-auth.md §1.2` (로그인 시퀀스 다이어그램) | (A) `data-flow/2-auth.md` 에 비밀번호 재확인 서브섹션 신설 후 주석 포인터 수정, 또는 (B) 잘못된 포인터 제거·대체. spec Rationale 신설(하단 INFO 참조)과 함께 처리 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `verifyPasswordForUser` 신설에 대한 "비밀번호 재확인의 AuthService 단일 귀속" 설계 결정이 `spec/5-system/1-auth.md ## Rationale` 에 미등재 (코드 주석으로만 존재) | `auth.service.ts` L52–78, `webauthn.controller.ts`, `sessions.service.ts` | `spec/5-system/1-auth.md ## Rationale` 에 신규 항목 추가: (a) Controller raw bcrypt 기각 이유, (b) `AuthService.verifyPasswordForUser` 단일 게이트 결정, (c) `comparePassword` 유틸 단일 SoT 원칙. WARNING 2의 spec 포인터 수정과 함께 처리 시 효율적 |
| 2 | Rationale Continuity | `spec/5-system/1-auth.md ## Rationale 2.3.C` 의 "currentPassword bcrypt 검증" 표현이 구현 추상화(comparePassword 유틸)를 반영하지 않음 | `spec/5-system/1-auth.md ## Rationale 2.3.C` | INFO 1 Rationale 신설 시 선택적으로 "비밀번호 검증(comparePassword 유틸)" 수준 표현으로 갱신 |
| 3 | Cross-Spec | `auth.service.ts` L54 주석이 인용하는 SoT 섹션(`data-flow/2-auth.md §1.2`)이 실제 내용과 완전히 일치하지 않음 (WARNING 2와 동일 원인, 다른 각도) | `auth.service.ts` L54 | WARNING 2 조치로 해소 |
| 4 | Convention Compliance | `spec/5-system/1-auth.md §5` 의 `POST /api/auth/2fa/webauthn/recovery-codes/regenerate` 행에 에러 코드 미기재 (인접 엔드포인트 표기 패턴과 불일치) | `spec/5-system/1-auth.md §5` | WARNING 1 카탈로그 등재 시 해당 행에 `PASSWORD_REQUIRED` · `PASSWORD_INVALID` (401) 함께 기재 |
| 5 | Naming Collision | `auth-configs.service.ts:309` 에 `bcrypt.compare` 직접 호출 잔존 (에러 코드 `AUTH_FAILED` 로 상이). 본 diff 범위 밖이나 비밀번호 재확인 단일진실 완성 관점에서 후속 후보 | `auth-configs.service.ts:309` | plan `refactor-auth-reverify-unify.md §범위 밖` 또는 별도 후속 plan 에 추가 검토 기록 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 모든 spec 계약(bcrypt cost ≥ 12, 에러 코드 shape, 401, 세션 재인증 의미론, WebAuthn 모듈 의존 구조) 정합 확인. 코드 주석 포인터 부정확(INFO) |
| Rationale Continuity | NONE | `verifyPasswordForUser` 레이어 귀속 결정이 Rationale 미등재(INFO). 기각된 대안 재도입·invariant 위반 없음 |
| Convention Compliance | LOW | 신규 에러 코드 카탈로그 미등재(WARNING), 코드 주석 spec 포인터 부정확(WARNING). 명명 형식·API 문서화·응답 envelope 규약 위반 없음 |
| Plan Coherence | NONE | `refactor-auth-reverify-unify.md` 및 `refactor/02-architecture.md §C-3 후속(§3)` 설계와 정확히 일치. 미결 pending_plans 와 충돌 없음. 후속 spec 동기화 이미 plan 추적 중 |
| Naming Collision | NONE | 도입 식별자 전부 기존 코드베이스 확립 이름으로의 호출 통합. 신규 정의·충돌 없음 |

## 권장 조치사항

1. **(WARNING 1 해소)** `spec/5-system/3-error-handling.md §1` 에 `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 등재 (트리거 조건, HTTP 401, 적용 엔드포인트). `spec/5-system/1-auth.md §5` 해당 행에 에러 코드 보강. — project-planner 위임 (spec 쓰기).
2. **(WARNING 2 해소)** 방안 (A) `data-flow/2-auth.md` 에 비밀번호 재확인 서브섹션 신설 후 코드 주석 포인터 수정, 또는 (B) 잘못된 포인터 제거. 방안 A 선택 시 INFO 1 Rationale 신설과 동시 처리 권장. — project-planner 위임 (spec) + developer (코드 주석 수정).
3. **(INFO 1 권장)** `spec/5-system/1-auth.md ## Rationale` 에 `verifyPasswordForUser` 레이어 귀속 결정 항목 신설. WARNING 2 조치와 묶어 처리. — project-planner 위임.
4. **(INFO 5 후속)** `auth-configs.service.ts:309` 의 raw `bcrypt.compare` 잔존 및 `AUTH_FAILED` 에러 코드 처리 방향을 후속 plan 에 기록. 현재 diff 범위 밖이나 비밀번호 재확인 단일진실 완성을 위한 후보.
