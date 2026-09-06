# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원이 전문을 정상 반환했다(재시도 필요 항목 없음).

## 전체 위험도
**MEDIUM** — 즉시 차단 사유는 없으나, 같은 known-gap(신규 검증자 2축 미등재 + `User` 노출 금지 규범 부재)을 3개 checker 가 독립적으로 재확인했고 아직 target 문서에 반영되지 않았다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이번 라운드에 Critical 발견이 없으므로 인계 대상도 없다. 다만 아래 WARNING 2건은
> developer 권한 밖(spec 쓰기 금지) 사안이며, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
> 에 planner 후속 항목으로 정식 등재되어 있어 별도 인계 표가 필요하지 않다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, plan_coherence (3개 독립 보고) | 신규 검증자 2축(구조 축 `user-entity-exposure-guard.ts`/`.spec.ts`/fixture, 이름 축 `user-secret-absence.ts`/`.spec.ts`)이 §5.4 "검증 층" 서술("**두 검증자**가 나눠 맡는다")·`code:` frontmatter 어디에도 등재되지 않음. `grep -rn "user-entity-exposure\|user-secret-absence" spec/` 0건, 정본 게이트(`review_guard._spec_linked_changes`) 확인 결과 신규 4파일 중 spec-linked 0건 — 이 가드가 나중에 약화·삭제돼도 `--impl-done` SPEC-CONSISTENCY 게이트가 안 걸림 | `spec/5-system/2-api-convention.md` §5.4 표 + frontmatter `code:`, `spec/conventions/swagger.md` §5-1, `spec/conventions/secret-store.md` §1.1 | "두 검증자/두 개 축" 서술 (직전 커밋 `21182db02` 이 확정한 "새 검증자는 관련 문서 양쪽 `code:` 에 등재" 관례와 불일치) | planner 턴에서 §5.4 표에 구조 축/이름 축 행 추가 + `code:` 에 두 파일 패턴 등재, `swagger.md`/`secret-store.md` "두 검증자" 문구를 실제 개수로 갱신. **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 대기 항목(`[ ]` 미완료)으로 등재됨 — 신규 항목 생성 불필요, 우선 처리만 권고** |
| 2 | cross_spec, rationale_continuity(INFO 등급), plan_coherence | `User` 엔티티 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`) 응답 노출 금지가 spec 규범 문장으로 존재하지 않음 — 불변식의 SoT 가 코드(`USER_SECRET_KEYS` 배열)뿐. 이번 PR 직전까지 `WorkflowVersionsService.findOne` 에서 실제로 유출되고 있었다 | `spec/1-data-model.md` §2.1 User, `spec/conventions/secret-store.md` §1.1 | `secret-store.md` §1.1 이 이미 `AuthConfig.config`·`Trigger.config.interaction.triggerToken`·`Trigger.notification_secret_v2` 에 대해서만 세워 둔 대칭 규범("비대상 필드도 응답 바디에는 나가지 않는다") — `User` 축은 그 대칭에서 빠져 있음 | planner 턴에서 `secret-store.md` §1.1 또는 `1-data-model.md` §2.1 에 `User` 7컬럼 노출 금지 절 + `## Rationale` 에 결정 근거(전수 열거·기각한 두 대안) 이관, 신규 가드 2종을 그 절의 `code:`/본문 링크로 연결. **위 항목 1과 같은 턴·같은 plan 항목으로 이미 등재됨** |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `select:false`/전역 `ClassSerializerInterceptor` 기각 근거가 spec `## Rationale` 대신 `plan/`·`CHANGELOG.md` 에만 있음(결론 자체는 `secret-store.md §1.1` 기존 원칙과 완전 정합, 번복 아님) | `spec/1-data-model.md §2.1`, `spec/conventions/secret-store.md §1.1` | WARNING 2와 같은 planner 작업에 근거 이관을 포함 |
| 2 | rationale_continuity | **정합 확인(위반 아님)**: `git log -S"select: false"` 로 `User` 모듈 이력 확인 결과 과거 기각 후 재도입 이력 없음 — 새 위반 아님, 참고용 | `codebase/backend/src/modules/users/` | 조치 불요 |
| 3 | convention_compliance | `2-api-convention.md` L971 `## Overview (제품 정의)` 가 동일 폴더 타 문서(`## Overview` 단독)와 표기 불일치 | `spec/5-system/2-api-convention.md` | 다음 편집 기회에 정리, 신규 항목 불요 |
| 4 | convention_compliance | `2-api-convention.md`/`3-error-handling.md` 가 "convention"·"policy" 성격이지만 `spec/conventions/` 가 아닌 `spec/5-system/` 에 위치 — 이 리포지토리의 기존 의도된 구조로 판단, 이번 PR 이 만든 드리프트 아님 | `spec/5-system/2-api-convention.md`, `3-error-handling.md` | 조치 불요, 필요 시 별도 planner 턴에서 배치 기준 명문화 |
| 5 | naming_collision | 신규 검증자 3축(`assertMatchesContract`/`swagger-dto-contract-guard`/`user-secret-absence`)이 이름은 다르나 개념적으로 인접 — 헤더 주석으로 경계는 명확, 혼동 위험 낮음 | `codebase/backend/src/shared/testing/user-secret-absence.ts`, `repo-guards/__tests__/user-entity-exposure-guard.ts` | 조치 불요. 검증자가 늘어나는 추세이므로 추후 `spec/conventions/` 에 "응답 노출 방어 축" 표 작성 고려 |
| 6 | naming_collision | e2e 테스트 레터 `J.` 가 `D.`/`E.` 사이에 물리적으로 삽입돼 알파벳-위치 순서가 깨짐(식별자 충돌 아님) | `codebase/backend/test/workspace-rbac.e2e-spec.ts` | 조치 불요(비차단), 여유 시 파일 끝으로 재배치 |
| 7 | naming_collision | `fixtures/user-relation-load.fixture.ts` 가 같은 디렉토리의 두 fixture 명명 컨벤션(평면+점 없음 vs 중첩+`.fixture.ts`) 중 기존 선례(`optional-nullable.fixture.ts`)를 따름 — 신규 충돌 아님 | `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` | 조치 불요. 정본 규약 명문화는 별도 사안 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §5.4 "두 검증자" 서술 실측 초과 + `User` 노출 금지 규범 부재, 둘 다 planner 후속 등재 확인 |
| rationale_continuity | LOW | 동일 gap 재확인, `select:false` 기각 논리는 기존 `secret-store.md §1.1` 과 완전 정합(번복 없음) |
| convention_compliance | LOW | 정식 규약 위반 없음, 인용 절 번호 전부 착지, INFO 2건(표기 일관성) |
| plan_coherence | MEDIUM | plan 이 완료 항목의 스핀오프 후속 2건을 정확히 추적 중이나 아직 미집행 — 방치 시 spec-consistency 게이트 사각지대 우려 |
| naming_collision | NONE | 신규 식별자 전부 고유, 기존 spec 요구사항/엔티티/엔드포인트와 충돌 없음, INFO 3건만 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — 이미 BLOCK: NO) 다음 project-planner 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 미완료 항목을 **같은 턴에** 처리: (a) `spec/5-system/2-api-convention.md` §5.4 표에 구조 축/이름 축 행 추가 + `code:` frontmatter 갱신, (b) `spec/1-data-model.md §2.1` 또는 `spec/conventions/secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 근거 이관.
2. 위 항목이 처리되기 전까지는 `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 를 약화·삭제하는 후속 PR 이 spec-consistency 게이트에 걸리지 않는다는 점을 리뷰어가 별도로 유의할 것(코드 리뷰 단계에서 수동 확인 필요).
3. INFO 항목(Overview 제목 표기, e2e 레터 순서, fixture 명명 이원화)은 비차단이므로 각 파일을 다음에 편집할 기회에 정리 — 별도 plan 항목 생성 불필요.