# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. 발견된 위배는 전부 WARNING/INFO 등급이며,
그중 실질적인 두 WARNING 은 developer 권한 밖(spec 쓰기 금지)이라 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 담당 미완료
항목으로 정확히 등재돼 추적 중이다.

## 전체 위험도
**MEDIUM** — 활성 모순은 없으나, §5.4 검증 층이 "동일 사각지대(신규 검출 코드가 spec
`code:` 게이트 밖에 남는 것)를 재현한 것이 이번이 세 번째"라는 반복 패턴이라 cross_spec
checker 가 매긴 MEDIUM 을 그대로 유지한다(하향 없음 원칙에 따라 최고 등급 채택).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 Critical 0건)

## planner 인계 (권한 밖 Critical)

(없음 — 아래 WARNING 두 건은 이미 developer 가 planner 담당으로 정확히 위임해 plan 에
등재해 두었으므로, 이 표는 Critical 전용이라 해당 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence (4개 checker 동일 지적, 3차 재확인) | 신규 `User` 노출 방어 가드 2종(`user-entity-exposure-guard.ts`=구조 축, `user-secret-absence.ts`=이름 축)이 도입되어 §5.4 노출 검증을 실제로 시행하는 축이 넷이 됐는데, `2-api-convention.md` §5.4 「검증 층」과 `swagger.md` §5-1 은 여전히 "**두 검증자**"라고 서술하고, 두 문서 frontmatter `code:` 에도 신규 4개 파일이 등재되지 않음 | `spec/5-system/2-api-convention.md` §5.4 「검증 층」(표+본문) / `spec/conventions/swagger.md` §5-1 | 신규 가드 코드 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts`, `codebase/backend/src/shared/testing/user-secret-absence*.ts` | `project-planner` 턴에서 §5.4 표에 구조 축·이름 축 두 행 추가 + 두 문서 `code:` 에 신규 파일 패턴 등재. "두 검증자" 같은 개수 서술은 새 숫자로 교체 말고 **표/나열 형태**로 바꿀 것(같은 실패가 이미 3회 반복). **이미 plan 에 등재됨** — `plan/in-progress/spec-draft-nullable-notation-followups.md` (planner 담당, 미완료, 출처 `review/consistency/2026/09/06/10_13_23` W1) |
| 2 | cross_spec, rationale_continuity, plan_coherence (3개 checker 동일 지적, 3차 재확인) | `User` 엔티티 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)의 "응답 비노출" 불변식이 코드(`USER_SECRET_KEYS` 상수)에만 존재하고 spec 규범 문장이 없음 — 대칭 도메인(`Trigger`/`AuthConfig`)은 `secret-store.md §1.1` 이 이미 이 규범을 갖췄는데 `User` 축만 없음 | `spec/1-data-model.md §2.1 User` 또는 `spec/conventions/secret-store.md §1.1` (둘 다 이번 리뷰 scope `spec/5-system/` 밖) | `codebase/backend/src/shared/testing/user-secret-absence.ts` 의 `USER_SECRET_KEYS` | `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 에 결정 근거(전수 열거 수치·기각한 대안 `select:false`/전역 `ClassSerializerInterceptor`) 추가. **이미 plan 에 등재됨** — 동일 plan 파일 W2 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 사전 존재 `optional+nullable` DTO 동시 선언(`WorkflowVersionCreatorDto.creator?: T \| null`) — 이번 PR 범위 밖, 동일 패턴이 레포 전역 21개 파일에 존재 | `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` | 별도 planner/developer 티켓으로 `swagger-dto-contract-guard.ts` 에 "옵셔널+nullable 동시 선언" 정적 검출 축 추가 고려. 이번 PR 차단 사유 아님 |
| 2 | convention_compliance | `## Overview (제품 정의)` 제목 표기가 동일 폴더 자매 문서(`1-auth.md`, `3-error-handling.md`)의 순수 `## Overview` 와 다름 — 이월 항목 | `spec/5-system/2-api-convention.md` | 다음 편집 기회에 정리. 신규 항목 생성 불필요 |
| 3 | plan_coherence | 신규 커밋(`4d49aa575`, `9a186fa31`)은 직전 코드 리뷰 처분이며 plan-coherence 중립 | (해당 없음, 코드 전용) | 조치 불요 |
| 4 | plan_coherence | §5.4 drift 스윕 2단계 카운트가 이번 라운드로 갱신됐을 가능성 — plan 이 이미 "착수 시점 재실측" 을 명시해 현재 불일치 아님 | `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 — 2단계" | 스윕 2차 착수 시 자연 해소, 조치 불요 |
| 5 | naming_collision | `SRC_ROOT` 상수명이 형제 guard 파일(`nullable-type-lie-cast-guard.ts`)과 반복 선언 — import 충돌 없음, 의도된 반복 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:14` | 조치 불요. guard 3개 이상으로 늘면 공용 헬퍼 고려(선택) |
| 6 | naming_collision | `USER_SECRET_KEYS` 가 기존 `*_STRIP_KEYS`/`SECRET_CONFIG_KEYS` 명명 계열과 패턴만 유사(strip 용 아닌 detect 용) — 충돌 아님 | `codebase/backend/src/shared/testing/user-secret-absence.ts` | 추후 유사 상수 추가 시 `*_LEAK_DETECTION_KEYS` 류 접미사 분화 고려(선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §5.4 검증 층 사각지대 재현(3회째) + `User` 노출 금지 규범 부재. 둘 다 plan 에 이미 planner 담당 등재 |
| rationale_continuity | LOW | 두 WARNING 미해소 확인(3차), 새 Rationale 충돌·기각 대안 재도입 없음. `CREATOR_PROJECTION` 통합은 기존 원칙과 정합 |
| convention_compliance | LOW | 신규 DTO 필드·비밀 컬럼 목록·명명 패턴 모두 §5.4/§2.1/swagger §5-1 과 정확히 부합. §5.4 개수 서술 WARNING 은 이미 올바르게 planner 위임됨 |
| plan_coherence | LOW | 두 WARNING 모두 plan 에 정확히 등재된 known-gap. 신규 커밋 2건은 plan 범위·수치를 바꾸지 않음 |
| naming_collision | NONE | 신규 식별자·API endpoint·이벤트명·ENV 변수 충돌 0건. `spec/5-system/` 델타 0으로 신규 spec 식별자 없음 |

## 권장 조치사항
1. (최우선, BLOCK 대상은 아니나 반복 3회) `project-planner` 턴에서 `spec/5-system/2-api-convention.md` §5.4 표에 신규 검출 2축(구조/이름) 등재 + `code:` frontmatter 갱신, `spec/conventions/swagger.md` §5-1 의 "두 검증자" 개수 서술을 표/나열 형태로 교체 — plan 항목 W1 그대로 집행.
2. 같은 planner 턴에서 `spec/1-data-model.md §2.1` 또는 `spec/conventions/secret-store.md §1.1` 에 `User` 7컬럼 응답 노출 금지 규범 문장 + `## Rationale` 근거 추가 — plan 항목 W2 그대로 집행.
3. (선택, 비차단) `WorkflowVersionCreatorDto` 등 21개 파일의 `optional+nullable` 동시 선언 패턴을 별도 티켓으로 정리하고, `swagger-dto-contract-guard.ts` 에 해당 정적 검출 축 추가 검토.
4. (선택, 비차단) `2-api-convention.md` `## Overview (제품 정의)` 제목을 자매 문서와 통일.