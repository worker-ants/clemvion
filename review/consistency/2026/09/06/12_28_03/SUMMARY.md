# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 CRITICAL 없음. WARNING 2건은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 후속 항목으로 정확히 등재돼 있어 즉시 차단 사유가 아니다.

## 전체 위험도
**MEDIUM** — 코드 자체는 정합적이나(User 엔티티 유출 실수정 + 검출 2축 신설), 그 신규 검출 2축이 `spec/5-system/2-api-convention.md` §5.4·`spec/conventions/swagger.md` §5-1 의 "두 검증자" 서술을 사실과 다르게 만들었고 어느 spec `code:` 글롭에도 걸리지 않아, 향후 이 가드들이 약화·삭제돼도 `--impl-done` SPEC-CONSISTENCY 게이트가 못 잡는 사각지대가 생긴다(cross_spec 판정 근거).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — 이번 라운드는 Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance (plan_coherence 는 INFO 로 판정했으나 타 checker 의 WARNING 을 상향 유지) | 신규 검출 2축(구조 축 `user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`) 이 "정확히 두 검증자" 서술을 반증하는데 두 spec 문서 어디에도 등재/`code:` 연결이 안 됨 | `spec/5-system/2-api-convention.md` §5.4 「검증 층」표, `spec/conventions/swagger.md` §5-1 | 두 문서의 "그 자리를 **두 검증자**가 나눠 맡는다" / "두 검증자의 경계는 …" 문구 및 frontmatter `code:` (신규 파일 glob 미포함) | 다음 planner 턴에서 §5.4 표에 구조축·이름축 행 추가 + 두 문서 `code:` 에 `user-entity-exposure*.ts`·`user-secret-absence*.ts` 등재. "두 검증자" 같은 개수 고정 문구는 나열형으로 교체(이미 2회 개수-드리프트 반복 이력 — plan 항목이 스스로 이 지침을 남겨둠) |
| 2 | cross_spec, rationale_continuity, convention_compliance (plan_coherence 는 INFO 로 판정했으나 상향 유지) | `User` 엔티티 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`) 응답 비노출 불변식이 코드(`USER_SECRET_KEYS` 배열)에만 있고 spec 규범 문장이 없어 형제 도메인(Trigger/AuthConfig)과 비대칭 | `spec/1-data-model.md §2.1`(User) 또는 `spec/conventions/secret-store.md §1.1` | `secret-store.md §1.1` 이 Trigger/AuthConfig 축에는 이미 "비대상 필드도 응답 바디에는 나가지 않는다" 규범을 명문화했으나 User 축에는 대응 절이 없음 | 다음 planner 턴에서 해당 절에 User 7컬럼 비노출 규범 문장 추가 + `## Rationale` 에 결정 근거(전수 열거 수치·기각한 두 대안 `select:false`/전역 `ClassSerializerInterceptor`·채택 이유) 이관, `secret-store.md §1.1` 과 상호 링크 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `workspace-rbac.e2e-spec.ts` 파일 헤더의 `spec/5-system/1-auth.md §1.3` 참조가 실제 RBAC 절(§3)과 어긋남(이번 diff 밖, PR 이 만든 결함 아님) | `codebase/backend/test/workspace-rbac.e2e-spec.ts` 20행 | 다음에 이 파일을 편집할 때 헤더 참조를 `§3` 으로 정정(이번 PR 필수 항목 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | §5.4/swagger.md "두 검증자" 서술이 신규 2축으로 사실과 다름 + User 노출 금지 미명문화 — 둘 다 plan 에 planner 대상으로 이미 등재 |
| rationale_continuity | LOW | 5차 재확인 — `select:false`/전역 인터셉터 기각은 `secret-store.md §1.1` 원칙의 정합적 재적용(위반 아님). 동일 WARNING 2건 재확인 |
| convention_compliance | LOW | swagger.md §3/§5-1, review-citations.md §2/§3 실측 준수. 동일 WARNING/INFO 2건(신규 축 미등재, User 미명문화) 재확인 |
| plan_coherence | LOW | target(`spec/5-system/`) delta 0 과 plan 의 미해결 결정·후속 항목 정합. 두 갭 모두 이 브랜치 스스로 plan 에 planner 소유로 정확히 등재 |
| naming_collision | NONE | 신규 식별자 전수 grep 대조 — 충돌 없음. `SRC_ROOT` 동명 export 는 기존 "가드마다 독립 상수" 관례 반복 |

## 권장 조치사항

1. (BLOCK 해소 사유 아님이나 우선 권장) 다음 `project-planner` 턴에서 `spec/5-system/2-api-convention.md` §5.4 「검증 층」 표에 구조 축(`user-entity-exposure-guard.ts`)·이름 축(`user-secret-absence.ts`) 행을 추가하고 `spec/conventions/swagger.md` §5-1 대응 문구를 함께 갱신. 두 문서 frontmatter `code:` 에 신규 파일 glob 등재. "두 검증자" 개수 고정 문구는 나열형으로 교체.
2. 같은 planner 턴에서 `spec/1-data-model.md §2.1` 또는 `spec/conventions/secret-store.md §1.1` 에 `User` 민감 7컬럼 응답 비노출 규범 문장을 추가하고 `## Rationale` 에 결정 근거(전수 열거 수치·기각한 두 대안·채택 이유)를 이관.
3. (선택, 비필수) 다음에 `workspace-rbac.e2e-spec.ts` 를 편집할 기회에 파일 헤더의 `§1.3` 참조를 `§3` 으로 정정.
4. 두 WARNING 은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유·실행 순서까지 구체적으로 등재돼 있으므로, 별도 신규 plan 항목 생성은 불요 — 다음 planner 턴에서 그대로 집행.