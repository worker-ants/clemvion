# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 전문 확보(인라인 authoritative). `plan_coherence.md` 는 output_file 이 디스크에 없어 인라인 전문을 그대로 영속화함(§작업 1 수행 완료). Critical 발견 0건.

## 전체 위험도
**MEDIUM** — Critical 은 없으나, "역할 거부 코드 불일치"·"precheck 필드 생략 미문서화/Rationale 모순"·"에러코드 미등재" 세 갈래의 WARNING 이 서로 다른 checker 에서 중복 지적되어 정식 채택 전 정리가 권장됨(rationale_continuity 단독 위험도 MEDIUM).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 판정 없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity + convention_compliance | Organization 통합 Admin-필요 거부를 신규 4개 지점에 generic `403 FORBIDDEN` 으로 명문화 — 같은 날(`#1399`) 확립된 "역할·멤버십 거부는 전용 코드(`ADMIN_REQUIRED` 등)를 싣는다" 원칙과 정합 여부가 draft 에 설명되지 않음. 다만 기존 `integrations.service.ts` 4개 발행처도 이미 module-local 로 `FORBIDDEN` 을 써 왔음(실측) | draft §(B) "Organization 통합의 변경은 Admin 이상이다" 불릿 | `spec/data-flow/12-workspace.md` Rationale "가드 거부의 오류 코드(2026-09-25)" / `spec/5-system/2-api-convention.md §5.3` / `workspace-roles.ts` `ROLE_REQUIRED.admin` | (C) Rationale 에 한 문장으로 명시 결정: (a) module-local 일관성 우선 `FORBIDDEN` 유지 사유, 또는 (b) 기존 4곳 포함 6곳 전체를 `ADMIN_REQUIRED` 로 승격(`error-codes.md §5` rename 이력 동반 등재) |
| 2 | convention_compliance + rationale_continuity | precheck 응답에 "충돌 행이 남의 personal 이면 `existingIntegrationId`/`existingName` 미포함" 신규 생략 규칙 추가 — (a) 그 필드의 문서화 절(§9.2)이 갱신되지 않아 `api-convention.md §5.4` "문서화 절에 사유 명시" 요구가 §8/Rationale 로만 우회 충족되고, (b) 같은 문서의 기존 Rationale "precheck endpoint — Organization-scope 도입 후에도 별도 RBAC 처리 불필요" 예측을 정정 없이 뒤집어 문서 내부 모순이 남음 | draft §(B) precheck 판정 규칙 + §(C) Rationale "받아들인 잔여" | `spec/2-navigation/4-integration.md §9.2` (`Cafe24PrecheckResultDto` 등 필드 정의 절) / 같은 문서 기존 Rationale "precheck endpoint — mall_id 입력 단계 사전 감지 UX" | (D) 변경안 추가해 §9.2 두 precheck 응답 행에 생략 조건 한 문장 + §8 역참조; 기존 "별도 RBAC 처리 불필요" 문장에 취소선/각주로 "(2026-09-25 정정 — personal 행 은닉은 예외)" 추가(원문 보존, 프로젝트 관례) |
| 3 | convention_compliance (WARNING) + cross_spec (INFO, 최강 등급으로 통합) | Rationale 이 안전 근거로 인용하는 `INTEGRATION_NAME_TAKEN` 이 공식 에러 카탈로그(§9.4, `error-handling.md §1`) 어디에도 미등재 — 실측: 코드에는 존재(`integrations.service.ts:1594`), spec 문서엔 부재. draft 가 이 코드를 "existence-oracle 잔여 위험을 사용자에게 받아들이게 하는 근거"로 승격시켰는데 근거 자체가 미등재 상태 | draft `## Rationale` "받아들인 잔여" 문단 | `spec/2-navigation/4-integration.md §9.4` / `spec/5-system/3-error-handling.md §1` / `spec/conventions/error-codes.md` | 같은 커밋에서 `INTEGRATION_NAME_TAKEN (409)` 을 §9.4(선택: error-handling.md §1)에 등재, 또는 draft 스코프 밖임을 명시 |
| 4 | cross_spec | `spec/4-nodes/4-integration/_product-overview.md` INT-MG-07("Personal↔Organization 전환은 Admin만 가능")이 draft 의 "영향 — 다른 spec" 감사에서 누락 — 새 §8 판정 규칙("자기 personal → organization 만")이 이 요구사항 서술보다 좁아 다음 구현자가 소유자 제약을 놓칠 수 있음 | draft §(B) 판정 규칙 블록 | `spec/4-nodes/4-integration/_product-overview.md:25` INT-MG-07 | "영향 — 다른 spec" 절에 해당 문서 추가 + "Admin만 가능은 필요조건, 소유자 제약은 §8 이 세부화"를 한 줄 명시, 또는 INT-MG-07 에 "(단, 자신의 Personal 통합일 때)" 보강 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + rationale_continuity | 404 채택 근거로 인용한 워크스페이스 경로 가드 선례(`data-flow/12-workspace.md`)는 실제로 **403 `NOT_A_MEMBER`** 를 채택 — status code 까지 같다는 인상을 줄 수 있음(원칙은 같으나 코드 계열 다름). 더 정확한 선례는 같은 Integration 도메인 자신의 §9.1(`requireEntity`)/§14.1 기존 404 관행 | draft §사용자 결정 2 / `## Rationale` 인용 | 인용을 `4-nodes/4-integration/0-common.md §4.2` 또는 `2-navigation/4-integration.md §9.1/§14.1` 기존 404 관행으로 교체하거나, 두 선례를 함께 들며 "원칙은 같고 status code 는 도메인마다 다르다" 명시(비블로킹, 결론 불변) |
| 2 | plan_coherence | 원 tracker 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:5760`, "personal-scope 통합 소유자 검증이 코드에 없다")을 착지 시 `[x]`+포인터로 닫는 계획이 target "동반 산출물" 절에 없음 | draft "## 동반 산출물 (같은 커밋)" 절 (라인 154-157) | 착지 커밋 계획에 "tracker `:5760` 항목을 `[x]` + 이 plan/커밋 포인터로 갱신" 한 항목 추가 |
| 3 | plan_coherence | `pending_plans: [integration-personal-owner-followup.md]` 참조 파일이 현재 미존재 — `spec-pending-plan-existence.test.ts` 가드는 frontmatter 갱신과 파일 생성이 같은 커밋일 것을 요구(설계는 이미 "동반 산출물"로 명시, 실제 착지 시 동시성 확인 필요) | draft 라인 69-75, 100, 156-157 | 착지 커밋에서 `4-integration.md` frontmatter 갱신과 `integration-personal-owner-followup.md` 신설을 같은 커밋에 포함 |
| 4 | plan_coherence | developer 구현 plan(`plan/in-progress/integration-personal-owner.md`) 미생성 — 다만 `#1399` 선례와 같은 정상 순서(spec 커밋 → developer plan 생성 → 구현)이며 미해소 선행조건 아님 | draft 라인 34 | 별도 조치 불요. 다음 턴 developer plan 생성 시 이 draft (A)(B)(C) 전문을 참조로 남길 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | INT-MG-07 감사 누락(WARNING), 404 인용 부정확·NAME_TAKEN 미등재(INFO) — 데이터모델/RBAC/OAuth/에러코드/lifecycle 5축 정합 확인 |
| rationale_continuity | MEDIUM | Admin 거부 코드 불일치, precheck 필드 은닉이 기존 "별도 RBAC 불필요" Rationale과 모순(WARNING x2) — 둘 다 새 Rationale은 있으나 기존 문장 미정정 |
| convention_compliance | LOW | §9.2 미갱신, Admin 거부 코드 불일치, NAME_TAKEN 미등재(WARNING x3) — frontmatter/에러코드 기본값/데이터모델/앵커/plan 네이밍 등 대부분 규약 정합 |
| plan_coherence | LOW | tracker 체크박스 종결 계획 누락, pending_plans 생성 순서, developer plan 부재(INFO x3, 전부 비블로킹) — 반대 방향 기존 결정 없음 확인(plan/in-progress 전수) |
| naming_collision | NONE | 신규 식별자 없음(요구사항ID/엔티티/endpoint/이벤트/ENV 6관점 전수 확인) — 충돌 0건 |

## 권장 조치사항
1. (WARNING 해소 우선) §(C) Rationale 에 Admin-필요 거부 코드 선택(`FORBIDDEN` 유지 or `ADMIN_REQUIRED` 승격)과 그 사유를 한 문장 추가.
2. §9.2 에 precheck 조건부 필드 생략 규칙 반영 + 기존 "별도 RBAC 처리 불필요" 문장에 취소선 정정 각주 추가(원문 보존).
3. 같은 커밋에서 `INTEGRATION_NAME_TAKEN (409)` 을 §9.4 (또는 `error-handling.md §1`)에 등재.
4. "영향 — 다른 spec" 절에 `_product-overview.md` INT-MG-07 을 추가하고 §8 규칙과의 정합 한 줄 명시.
5. (선택, 비블로킹) 404 인용 선례를 Integration 도메인 자신의 §9.1/§14.1 기존 관행으로 교체.
6. 착지 커밋 계획에 tracker(`:5760`) 체크박스 갱신과 `integration-personal-owner-followup.md` 동시 생성을 명시.
