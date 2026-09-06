# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — 활성 모순(CRITICAL)은 0건. 동일 성격의 WARNING 2건이 4라운드 연속(10_13_23→10_53_50→11_27_54→11_55_37) 재확인되고 있으나, 모두 developer 권한 밖(`spec/` 쓰기)이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 담당으로 등재되어 있어 이번 PR 자체를 막을 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> Critical 은 없으나, 아래 WARNING 2건은 근본 원인이 developer 권한 밖(`spec/` 쓰기)이라
> 그 사실을 명시적으로 인계한다. 등급은 WARNING 그대로이고 BLOCK 도 NO 그대로다 —
> 이 표는 차단 장치가 아니라 다음 행동 지정 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 신규 검출 가드 2축의 spec `code:` 등재는 `spec/conventions/**`·`spec/5-system/**` 쓰기 필요 — developer read-only | project-planner | `spec/5-system/2-api-convention.md` §5.4 「검증 층」표에 구조 축(`user-entity-exposure-guard.ts`)·이름 축(`user-secret-absence.ts`) 두 행 추가 + `spec/conventions/swagger.md` §5-1 "두 검증자" 개수 서술을 표/나열 형태로 교체 + 두 문서 frontmatter `code:` 에 신규 파일 패턴 등재 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-06 등재, 4차 연속 재확인: `review/consistency/2026/09/06/{10_13_23,10_53_50,11_27_54,11_55_37}`) |
| 2 | `User` 민감 7컬럼 응답 비노출 규범 문장 신설은 `spec/1-data-model.md`·`spec/conventions/secret-store.md` 쓰기 필요 — developer read-only | project-planner | `spec/1-data-model.md §2.1 User` 또는 `spec/conventions/secret-store.md §1.1` 에 "User 의 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은 응답 DTO 에 선언되어서도, 응답 바디에 실려서도 안 된다" 규범 문장 추가 + `## Rationale` 에 결정 근거(전수 열거 수치·기각한 대안 `select:false`/전역 `ClassSerializerInterceptor`) 이관 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-06 등재, 4차 연속 재확인) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence (4개 checker 독립 재확인) | 신규 `User` 노출 방어 가드 2벌(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)이 관련 spec 어디의 `code:` 에도 미등재, "두 검증자" 개수 서술이 실측(4개 축)과 불일치 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 등 신규 4파일 | `spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md` §5-1 | §planner 인계 #1 참조 |
| 2 | cross_spec, rationale_continuity, convention_compliance, plan_coherence (4개 checker 독립 재확인) | `User` 민감 7컬럼 응답 비노출 불변식이 spec 규범 문장 없이 코드(`USER_SECRET_KEYS`)에만 존재 — 대칭 도메인(`secret-store.md §1.1` Trigger/AuthConfig)과 비대칭 | `codebase/backend/src/shared/testing/user-secret-absence.ts` `USER_SECRET_KEYS` | `spec/1-data-model.md §2.1`, `spec/conventions/secret-store.md §1.1` | §planner 인계 #2 참조 |
| 3 | convention_compliance | 신규 `WorkspaceMemberDto.joinedAt` JSDoc 이 "JSDoc 은 공개 OpenAPI로 나간다 — 내부 서사 금지"(`swagger.md` §3, 2026-09-05 성문화) 규칙을 놓치고 §5.4 적용 근거·실측 날짜·내부 서비스 동작을 그대로 담음 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt` | `spec/conventions/swagger.md` §3 | JSDoc 을 소비자 최소 정보로 축소(예: "멤버가 워크스페이스에 합류한 시각. 상시 존재하며 값이 없으면 null.")하고 내부 근거·실측은 `//` 주석으로 이동. `alert-rule-response.dto.ts` `threshold` 필드가 정본 예시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `User` 민감 7컬럼 비노출 불변식의 SoT 가 코드에만 있음(WARNING #2 와 동일 갭의 다른 각도, 이미 추적됨) | `codebase/backend/src/shared/testing/user-secret-absence.ts` | §planner 인계 #2 로 통합 처리 |
| 2 | naming_collision | `repo-guards/__tests__/` 안에 fixture 배치 관례가 flat(`<name>-fixture.ts`)과 서브디렉터리(`fixtures/<name>.fixture.ts`) 두 갈래로 공존 — 신규 파일은 기존 선례(서브디렉터리)를 그대로 따름, 충돌 아님 | `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` | 이번 PR 조치 불요. 기회가 되면 `spec/conventions/` 에 fixture 배치 기준 한 줄 문서화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | CRITICAL 없음. §5.4 "두 검증자" 미등재 + User 7컬럼 노출 금지 미문서화, 4라운드 연속 재확인. 최신 커밋은 spec 표면 무변경(정밀화만) |
| rationale_continuity | LOW | 과거 기각 대안(select:false/전역 인터셉터) 재도입 없음, `secret-store.md §1.1` 원칙과 정합. 두 WARNING 은 known-gap 재확인 |
| convention_compliance | LOW | `joinedAt` JSDoc 내부 서사 노출(신규 WARNING, swagger.md §3 재발) + 두 축 미등재(기추적) |
| plan_coherence | LOW | 신규 커밋(`01b078379`)은 `plan/**`·`spec/**` 무변경, 코드 리뷰 WARNING 처분만. 두 WARNING 은 plan 에 정확히 등재된 미완 항목, 우회 없음 |
| naming_collision | NONE | CRITICAL/WARNING 급 식별자 충돌 없음. `joinedAt` 은 기존 엔티티/스키마와 일치하는 최초 노출. fixture 배치 갈래 공존은 INFO |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 조치 불요) 다음 `project-planner` 턴에서 §planner 인계 #1, #2 를 함께 집행: `spec/5-system/2-api-convention.md` §5.4 표 확장 + `spec/conventions/swagger.md` §5-1 개수 서술을 나열형으로 교체 + `spec/1-data-model.md §2.1`/`secret-store.md §1.1` 에 User 7컬럼 비노출 규범 문장과 `## Rationale` 신설.
2. (개발 계속 가능, 다음 developer 턴 권고) `WorkspaceMemberDto.joinedAt` JSDoc 을 `swagger.md` §3 규칙에 맞춰 정리 — 소비자 최소 정보만 남기고 내부 서사·실측 근거는 `//` 주석으로 이동 (`alert-rule-response.dto.ts threshold` 참조).
3. (선택, 비차단) `repo-guards/__tests__/` fixture 배치 기준(flat vs 서브디렉터리)을 `spec/conventions/` 에 한 줄 문서화할 기회가 있으면 반영.
