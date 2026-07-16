---
worktree: parallel-p2-w1w2
status: in-progress
spec:
  - spec/conventions/i18n-userguide.md
  - spec/conventions/cross-node-warning-rules.md
---

# 동적·코드 기반 backend 메시지 localization — 구현

> 작성일: 2026-06-02 / 선행 spec 확정: `i18n-userguide.md` Principle 3-C + `cross-node-warning-rules.md §3`
> 대체: [`parallel-p2-followups.md`](./parallel-p2-followups.md) §6
> 설계 근거·기각 대안: `i18n-userguide.md` Principle 3-C + `cross-node-warning-rules.md ## Rationale` (영문 SoT + 구조화 params, backend i18n 기각)

## 목표

ko 로케일에서 영문 노출되는 (a) errorCode(`GRAPH_VALIDATION_FAILED` 등) (b) 동적 graphWarningRule 메시지를, 영문 SoT 원칙을 유지한 채 frontend 매핑으로 한국어화한다.

## Phase 0 — 선행 spec (완료)

- [x] `i18n-userguide.md` §errorCode 갭 → Principle 3-C 승격 (`ERROR_KO`·`GRAPH_WARNING_KO`·`translateBackendError`/`translateGraphWarning`·`{{name}}`+`params`·가드 P3-C-1/P3-C-2·범위 의무/점진). frontmatter `status: partial` + 본 plan `pending_plans` 등록.
- [x] `cross-node-warning-rules.md §3` rule 계약에 `params?` 추가 + Rationale + localization 노트.
- [x] `node-output.md §3.2` ErrorCode localization cross-ref (점진).
- [x] `/consistency-check --spec` BLOCK: NO.

## Phase 1 — shared package 계약 (backend·frontend 공유, 하위호환) ✅

- [x] `codebase/packages/graph-warning-rules/src/types.ts`: `GraphWarningRule.evaluate` 반환 `{ message; params? }`, `GraphWarningRuleResult` 에 `params?: Record<string, string | number>` 추가.
- [x] `src/rules/parallel.ts` 2 rule(`nested-depth-exceeded`·`nested-concurrency-cap`)이 `params`(node/child/grand/effective/product 등) 노출. `message` 영문 유지.
- [x] 패키지 단위 테스트: params 키 존재 + 값 정확성 (10 passed).

## Phase 2 — backend 전파 ✅

- [x] `nodes/core/graph-warning-rule.ts` adapter — package 의 evaluator 가 `params` 를 result 로 전파하므로 thin adapter 는 자동 통과 (코드 변경 불요).
- [x] `modules/workflows/workflows.service.ts` save-reject 응답 `details.errors[]` 에 `params` 포함 — `results`(GraphWarningRuleResult) 를 그대로 담으므로 자동 전파 (코드 변경 불요).
- [x] `workflow-response.dto.ts` `GraphWarningResultDto` 에 `params?` 필드 + `@ApiPropertyOptional`.
- [x] e2e: 400 GRAPH_VALIDATION_FAILED 응답 `details.errors[].params`(node/child/grand) 전파 단언.

## Phase 3 — frontend 매핑 + 배선 ✅

- [x] `backend-labels.ts`: `ERROR_KO`(code→템플릿) + `GRAPH_WARNING_KO`(ruleId→템플릿) 신설. `GRAPH_VALIDATION_FAILED` + parallel 2 rule 의 ko 템플릿(`{{name}}`).
- [x] `translateBackendError(code, params, locale, fallback)` + `translateGraphWarning(result, locale)` — `core.ts` `interpolate` export·재사용.
- [x] `custom-node.tsx` 배지 tooltip / `editor-toolbar.tsx` 저장버튼 title 가 raw `message` 대신 `translateGraphWarning` 경유 렌더.
- [x] `GRAPH_VALIDATION_FAILED` 의 `translateBackendError` + `ERROR_KO` 매핑(저장 API 400 경로용) 신설. (저장 버튼은 hasError 시 local 평가로 이미 차단되어 title 은 translateGraphWarning 으로 rule 메시지 직접 표시.)

## Phase 4 — 자동 가드 (P3-C-1 / P3-C-2) ✅

- [x] `backend-labels.test.ts` 에 P3-C-1: `GRAPH_WARNING_RULES_BY_TYPE` 의 모든 ruleId ⊆ `GRAPH_WARNING_KO` 키.
- [x] P3-C-2: 등록된 user-facing error 코드 집합(`GRAPH_VALIDATION_FAILED`) ⊆ `ERROR_KO` 키.
- [x] `no-internal-refs.test.ts` 정규식에 `GRAPH_WARNING_KO` 추가 (Principle 6-B 금지 목록 일관).

## Phase 5 — user-guide 문서 (구 §6 item2/3) ✅

- [x] `05-run-and-debug/validation-errors.mdx` + `.en.mdx` — graph validation 저장 거부 안내(Parallel 중첩 깊이·concurrency 규칙, 사용자 가시 표현만). `user-guide-writer` sub-agent 작성, 내부 SoT/ruleId 비노출 가드 통과.
- [x] frontmatter(title/section/order:5/summary). 기존 섹션이라 `SECTION_LABELS_BY_LOCALE` 갱신 불요 (확인).
- [x] graph-warnings 엔드포인트 — 별도 API 참조 가이드 페이지가 없어 N/A. Swagger `@ApiPropertyOptional`(DTO) 이 API 문서 역할.

## Phase 6 — 검증 ✅

- [x] backend·frontend lint·unit(5416)·build·e2e(140) + package(10) 통과.
- [x] `/ai-review` (9 reviewer) Critical 0, Warning 5 → 2건 false positive 종결(spec 이 review base 에 있어 생긴 오탐) + 3건 테스트 공백 fix(commit d8e35889) + e2e 재통과. RESOLUTION: `review/code/2026/06/02/09_36_00/`.

## 완료 처리 (stacked PR — merge 시점)

> 본 plan 의 Phase 0~6 구현은 완료(DoD 충족)됐으나, **plan 이동(complete/) + spec status 승격은 merge 시점으로 보류**한다. 근거: 본 구현은 spec PR(`claude/spec-backend-msg-i18n`) 위에 stacked 된 별 PR(`claude/backend-msg-i18n-impl`)이라, `i18n-userguide.md`·`cross-node-warning-rules.md` 의 `status: partial`+`pending_plans` 를 impl 브랜치에서 `implemented` 로 승격하면 spec PR 경계를 침범한다. 두 PR 머지 후 본 plan 을 `complete/` 로 이동하고 동시에 두 spec 을 `implemented` 로 승격(pending_plans 비움)한다 (spec-status-lifecycle 가드 정합).
>
> 잔여 INFO(비의무, RESOLUTION 보류 항목): translateBackendError 호출처 배선(저장 API 400 path), editor-toolbar IIFE→useMemo, interpolate JSDoc, DTO @ApiResponse(400) params 등 — 후속 PR 후보.

## 수용 기준

- ko 로케일에서 `GRAPH_VALIDATION_FAILED` + parallel graphWarning 메시지가 한국어 노출.
- P3-C-1/P3-C-2 가드 그린. 신규 rule 누락 시 build fail.
- 비-ko / 매핑 누락은 영문 graceful fallback.

## 의존성·리스크

- shared package 계약 변경이 backend·frontend 동시 빌드 영향 — `params` optional 로 하위호환.
- `close-cross-node-warning-c4c4d9` worktree 가 `cross-node-warning-rules.md` frontmatter 수정 중(다른 줄) — merge 시 자동 해소 가능, 인지 필요 (consistency I-11).
