# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원이 CRITICAL 없이 완료(전문 확보, 5개 output_file 모두 기존 존재 확인됨). 재시도 필요 항목 없음.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. `--impl-prep` 번들의 컨텍스트 예산 절단으로 인한 **검증 커버리지 결손**(cross_spec·convention_compliance 공동 지적)이 가장 무거운 항목이며, 그 외엔 문서 드리프트성 WARNING 4건과 참고용 INFO 다수.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 이 없으므로 인계 대상 자체가 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `--impl-prep` 번들이 `spec/` corpus 대다수를 컨텍스트 예산으로 절단 — cross-spec 비교·관례 준수(특히 출력 포맷·API 문서 규약) 판정이 사실상 불가능한 상태에서 진행됨. cross_spec 실측: 387개 `@bundle-file` 중 380개가 "본문 생략됨" 한 줄로 대체(완전 렌더 7개뿐). convention_compliance 실측: `error-codes.md`·`swagger.md`·`node-output.md`·`secret-store.md`·`spec-impl-evidence.md` 등 관점 2/4 판정에 직접 필요한 원본 전부 절단 | `_prompts/cross_spec.md`, `_prompts/convention_compliance.md` 전체 | 기존 기록 `feedback_consistency_spec_mode_budget.md`("conventions 를 통째로 떨군다")보다 절단 범위가 넓음(spec/ 트리 전체) | 이번 세션은 target 이 `codebase/**`(spec_impact: none)로 좁아 파일시스템 직접 열람으로 보완 가능했으나, `--impl-prep` 조립 스크립트의 예산/우선순위 로직 자체를 별도로 점검 요망. 관점 2/4는 "문제 없음"이 아니라 "미검증"으로 기록 |
| 2 | convention_compliance | `spec/conventions/cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter(`id`/`status`) 결여 — 같은 디렉토리의 형제 `<resource>.md` 18개(예: `category.md`/`store.md`/`translation.md`)는 전부 frontmatter 를 갖췄고, `_overview.md §7.1` 자신이 "카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로 계속 검증된다"고 서술함에도 `_overview.md` 자신은 그 예외 glob 에 명시적으로 포함/제외되어 있지 않음 | `spec/conventions/cafe24-api-catalog/_overview.md` 최상단 | `spec/conventions/spec-impl-evidence.md §1` (lifecycle frontmatter 의무), `_overview.md §7.1` 예외 서술 | (a) `_overview.md`에 frontmatter 추가하거나 (b) §7.1 예외 glob 에 `_overview.md`를 명시적으로 추가. `spec-impl-evidence.md` 원문이 절단되어 정규식까지는 미대조 — 재실행 시 확정 |
| 3 | convention_compliance | 실제 파일명 50개 이상이 쓰는 `<parent>__<child>` 더블언더스코어 중첩 entity-id 표기(`categories__decorationimages`, `boards__articles__comments` 등 3단 중첩 포함)가 `_overview.md §7.1` 의 "kebab-case, 예: `appstore-orders`" 서술만으로는 유도되지 않음 — `__` 의 의미(부모-자식 구분자)가 규약에 정의돼 있지 않음 | `spec/conventions/cafe24-api-catalog/_overview.md §7.1`, `category.md` 등 링크 목록 | §7.1 자신의 명명 규칙 서술 | §7.1 에 "중첩 sub-resource 는 `__` 로 부모-자식을 잇고 각 세그먼트는 kebab-case" 문장 추가 |
| 4 | plan_coherence | `plan/in-progress/trigger-canary-hardening.md` 가 출처 tracker(`spec-draft-nullable-notation-followups.md` L3935/3952/3982/3998, 전부 `[ ]`)의 4건을 "닫는다"고 명시하면서도, 자체 체크리스트에 tracker 쪽 체크박스 갱신·완료 각주 단계가 없음 — 완료 후에도 tracker 는 미해결로 남아 재작업/재조사 위험 | `plan/in-progress/trigger-canary-hardening.md §체크리스트` | `plan/in-progress/spec-draft-nullable-notation-followups.md:3935,3952,3982,3998` | `trigger-canary-hardening.md` 체크리스트에 "tracker 4건 체크 처리 + 근거(커밋/PR) 각주" 단계 추가, 완료 커밋에서 tracker 4줄을 `[x]`+각주로 갱신 |
| 5 | plan_coherence | tracker 의 "캐너리 주석 표기" 항목이 3개 세부 지적(①표기 갈림 ②리뷰 이력 누적 ③의역 인용이 실제 Jest 출력이 아님)을 등재했으나, `trigger-canary-hardening.md §A.3/§B.3` 는 ①②만 재서술하고 ③을 언급하지 않음 — tracker 종결 시 조용히 누락될 위험 | `plan/in-progress/trigger-canary-hardening.md §B.3` | `plan/in-progress/spec-draft-nullable-notation-followups.md` L3982-3996 (3번 행) | §B.3 에 3번(의역 인용 표시/실제 출력으로 교체) 명시 추가하거나, 제외 사유를 "하지 않는 것" 절에 명기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | plan 실작업 3항목(비밀 컬럼 repo-guard 대상·schedule workflow 관계·secret_store teardown 소유권)이 `secret-store.md §R4`·`data-flow/10-triggers.md`·실제 서비스 코드와 정합 확인(파일시스템 직접 열람으로 번들 절단 보완) | `plan/in-progress/trigger-canary-hardening.md §B` 1·2·4 | 그대로 진행 가능 |
| 2 | rationale_continuity | e2e teardown 처분(항목 4) 택일 시 `secret-store.md §R4`("explicit application 경로 정리, implicit cascade 기각")를 근거로 명시해야 연속성이 완성됨. 옵션(b) 채택 시 "테스트 인프라 한정 예외"임을 한 문장 남겨 다른 8개 e2e 파일로 확산 방지 | `plan/in-progress/trigger-canary-hardening.md §B.4`, `spec/conventions/secret-store.md §R4` | 착수 시 RESOLUTION/커밋에 R4 인용 |
| 3 | rationale_continuity | 항목 2(schedule workflow 양성 커버리지)는 위반이 아니라 `3-schedule.md §4`가 이미 "e2e 양성 3건 고정"이라 서술한 기존 계약의 미이행분을 채우는 작업 | `spec/2-navigation/3-schedule.md §4`, `schedule-trigger.e2e-spec.ts` | 커밋 메시지에 "spec 서술의 사후 이행" 한 문장 명시 |
| 4 | convention_compliance | `<resource>.md` 18개가 공유해야 할 섹션 템플릿 중 `## Rationale` 유무가 파일마다 갈림(store.md 有 / category·translation.md 無) | `cafe24-api-catalog/store.md` vs `category.md`/`translation.md` | 18개 전체 통일(위임 전용 Rationale 유무) — project-planner 판단 |
| 5 | convention_compliance | `## Overview` 명시적 헤더 유무가 파일마다 다름(`audit-actions.md` 有 / 나머지 無) | `spec/conventions/*` | 통일 여부는 project-planner 판단 |
| 6 | plan_coherence | 신규 repo-guard(항목 1)는 코드 3중 사본 정합만 보장 — spec 문서 2곳(`secret-store.md`/EIA §7.1)의 "함께 갱신" 의무는 여전히 사람 손 의존. 현재는 두 문서가 정합 상태라 조치 불요 | `spec/conventions/secret-store.md §1`, `spec/5-system/14-external-interaction-api.md §7.1` | 향후 4번째 비밀 컬럼 추가 PR 의 plan 에 "repo-guard 통과 ≠ spec 갱신 완료" 체크리스트 항목 참고 |
| 7 | naming_collision | 신설 예정 repo-guard 이름 후보가 기존 27개 repo-guard 명단과 grep 대조 결과 충돌 없음 | `codebase/backend/src/repo-guards/__tests__/*-guard.ts` (27개) | 구현 시 재확인 절차만 유지 |
| 8 | naming_collision | plan 이 인용하는 `expectTriggerWorkflowRef({present, expectedWorkflowId})` 는 신규 식별자가 아니라 이미 export 된 기존 헬퍼의 신규 호출 지점 | `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:106-140` | 해당 없음 |
| 9 | naming_collision | `audit-actions.md` 의 기존 trigger 비밀 회전 액션 3종(`notification_secret_rotated` 등)과 이번 plan 의 컬럼명은 레이어가 달라 이름공간 겹치지 않음 | `spec/conventions/audit-actions.md §3` | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 번들 절단(WARNING)을 제외하면 plan 3항목 모두 기존 spec/코드와 정합 확인 |
| rationale_continuity | LOW | 기각된 대안 재도입·원칙 위반 없음. teardown 항목만 R4 인용 권장(INFO) |
| convention_compliance | MEDIUM | frontmatter 결여·`__` 표기 미문서화 WARNING 2건 + 관점 2/4 미검증(번들 절단) |
| plan_coherence | LOW | tracker 체크박스 미동기화·세부지적 1건 누락 WARNING 2건, CRITICAL 없음 |
| naming_collision | NONE | 신규 식별자 도입 자체가 없음(spec_impact: none), 코드 심볼도 grep 대조로 충돌 0건 |

## 권장 조치사항
1. (WARNING #1 — 구조적) `--impl-prep` 번들링 예산/우선순위 로직을 harness 후속 항목으로 등재해 점검 — 이번 세션 자체는 파일 직접 열람으로 보완 완료라 즉시 차단 사유는 아님.
2. (WARNING #4·#5) `trigger-canary-hardening.md` 체크리스트에 tracker 4건 갱신 단계 + 캐너리 주석 3번째 지적 반영/명시적 배제를 추가한 뒤 착수.
3. (WARNING #2·#3) `spec/conventions/cafe24-api-catalog/_overview.md` frontmatter·`__` 표기 규약 보강은 project-planner 턴에서 처리(developer 권한 밖, 이번 plan 의 `spec_impact: none`과 별개 트랙).
4. (INFO) teardown 택일 시 `secret-store.md §R4` 인용, schedule workflow coverage 커밋 메시지에 "spec 서술 사후 이행" 명시.