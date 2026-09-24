# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — CRITICAL 없음. cafe24 카탈로그 파일명 표기 및 `id: common` 중복 등 문서-현실 간극 WARNING 2건과 INFO 다수만 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `id:` 기본 disambiguation 규약("같은 basename 이 영역을 달리해 중복될 때 영역 prefix 로 회피")이 `0-common.md` 6개(`spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md`)에서 지켜지지 않고 전부 동일 `id: common` 사용 | `spec/conventions/spec-impl-evidence.md` §2.1 `id` 행 | `spec/4-nodes/*/0-common.md` 6개 | (a) 6개 파일을 `logic-common`/`flow-common`/`ai-common`/`integration-common`/`data-common`/`trigger-common` 으로 재명명하고 참조·가드 fixture 동반 갱신, 또는 (b) §2.1 에 "`0-common.md` 류 카테고리-로컬 문서는 예외" 명시 |
| 2 | convention_compliance | cafe24 카탈로그 field-level 파일 222개 중 67개(약 30%)가 이중 밑줄(`__`) 계층 구분자를 쓰나 §7.1 은 단일 kebab-case 예시만 제시 | `spec/conventions/cafe24-api-catalog/_overview.md` §7.1 | 실제 파일명 패턴(`boards__articles__comments.md` 등) | §7.1 에 "sub-resource 중첩 시 `<parent>__<child>` 이중 밑줄로 계층 표기" 문장 + 실제 사례 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `pending_plans` 의 `plan/research/` 배제 근거가 `spec-impl-evidence.md` 자체 Rationale 에 명시되지 않음(근거는 plan·CLAUDE.md 표에만 존재) | `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행 | R-5 또는 신설 R-12 에 "`pending_plans` 는 완료 종착점이 있는 `plan/in-progress/`·`plan/complete/` 만 인정하고 `plan/research/`(완료 상태 없음)는 제외" 한 문장 추가 |
| 2 | convention_compliance | `node-output.md` 가 3섹션 권장 구조(`## Overview`/`## Rationale`) 중 `## Rationale` 헤딩 없음 | `spec/conventions/node-output.md` | 다음 개정 시 `## Rationale` 절 신설 |
| 3 | convention_compliance | `## Rationale` 헤딩 표기가 문서마다 갈림(번호 유무: `conversation-thread.md` `## 8. Rationale` 등) | `spec/conventions/*.md` 전반 | 헤딩을 `## Rationale` 로 통일 |
| 4 | convention_compliance | `makeshop-api-catalog` 전역 `makeshop-` id prefix 가 §2.1 "충돌 시" 조건보다 넓게(카탈로그 그룹 전체) 적용됨 | `spec/conventions/makeshop-api-catalog/*.md` | §2.1 각주에 "카탈로그 디렉토리는 충돌 여부와 무관하게 그룹 전체에 동일 prefix 적용 가능" 문장 추가 |
| 5 | plan_coherence | `pending-plan-is-plan.md` 의 `isPendingPlanPath` 처방이 SoT(`spec-impl-evidence.md` §2.1/§4)와 정확히 일치함을 재확인(정합 확인 기록) | `spec/conventions/spec-impl-evidence.md` §2.1/§4 | 없음(기록용) |
| 6 | plan_coherence | 새 검사를 기존 `pending_plans` 27개 항목 전수에 돌려 위반 0건 확인 — 회귀 위험 없음 | (횡단) | 없음 |
| 7 | plan_coherence | 인접 트래커 항목(`spec-draft-nullable-notation-followups.md` 의 CI 트리거 갭)은 이번 작업과 다른 축이라 범위 밖으로 올바르게 분리됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 없음(분리 적절함 확인) |
| 8 | naming_collision | 신규 식별자(`isPendingPlanPath`, `PENDING_PLAN_DIRS`) 저장소 전역 유일, 기존 `isApplicable`/`INCLUDE_PREFIXES` 계열과 명명 일관 — 충돌 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `id: common` 중복 6건(WARNING). 번들 다수 절단으로 완전성 한계 명시. 나머지는 클린. |
| rationale_continuity | NONE | 기각된 대안 재도입·무근거 번복·invariant 우회 없음. `pending_plans` Rationale 명시 보완 INFO 1건. |
| convention_compliance | LOW | cafe24 카탈로그 `__` 명명 미문서화(WARNING). 3섹션/헤딩/prefix 관련 INFO 3건. CRITICAL 없음. |
| plan_coherence | LOW | CRITICAL/WARNING 없음. spec/conventions 실질 미변경, 처방이 SoT 와 정합함을 확인하는 INFO 4건. |
| naming_collision | NONE | 신규 식별자 2개 전부 유일, 충돌 없음. |

## 완전성 한계 (명시)

5개 checker 전원이 조립 payload 의 컨텍스트 예산 초과로 `spec/conventions/**` 다수 대형 문서
(`chat-channel-adapter.md`·`conversation-thread.md`·`secret-store.md`·`error-codes.md`·`swagger.md`·
`node-output.md`·`node-cancellation.md` 등)와 타 영역 spec 상당수가 본문 없이 헤더만 제공됐다고
공통으로 보고했다. 각 checker 는 저장소 직접 읽기로 표본 보완했으나 전수 대조는 아니므로, 이번
"충돌 없음"/`BLOCK: NO` 판정은 절단된 영역(특히 실행엔진 교차 계약: `node-output.md`/
`node-cancellation.md`)에 대해서는 완전한 보증이 아니다. 이는 이번 대상 diff(`pending_plans` 가드
수정, `spec/` 변경 0건)의 결론 자체에는 영향이 없지만, 해당 예산 문제는 harness 차원의 기존
이슈로 재확인이 필요하다.

## 권장 조치사항
1. (BLOCK 해소 불요 — CRITICAL 없음) 현재 diff(`spec-frontmatter-parse.ts` 등, `spec/` 변경 0건)는
   그대로 진행 가능.
2. WARNING #1: `spec/4-nodes/*/0-common.md` 6개의 `id: common` 중복을 다음 spec 편집 세션에서
   재명명하거나 §2.1 에 예외 명시로 정리(선택은 (a) 재명명 / (b) 문구 보강 중 비용이 낮은 (b) 권장).
3. WARNING #2: `cafe24-api-catalog/_overview.md` §7.1 에 이중 밑줄 계층 표기 규칙을 추가해 문서와
   실제 산출물(222개 파일 중 67개)을 일치시킨다.
4. INFO 8건은 이번 PR 을 막을 사안이 아니며, 다음 conventions 문서 개정 세션에서 일괄 반영 권장.
