---
worktree: (미정 — 구현 착수 시 생성)
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

## Phase 1 — shared package 계약 (backend·frontend 공유, 하위호환)

- [ ] `codebase/packages/graph-warning-rules/src/types.ts`: `GraphWarningRule.evaluate` 반환 `{ message; params? }`, `GraphWarningRuleResult` 에 `params?: Record<string, string | number>` 추가.
- [ ] `src/rules/parallel.ts` 2 rule(`nested-depth-exceeded`·`nested-concurrency-cap`)이 `params`(node/child/grand/effective/product 등) 노출. `message` 영문 유지.
- [ ] 패키지 단위 테스트: params 키 존재 + 값 정확성.

## Phase 2 — backend 전파

- [ ] `nodes/core/graph-warning-rule.ts` adapter 가 `params` 를 결과에 전파.
- [ ] `modules/workflows/workflows.service.ts` save-reject(`GRAPH_VALIDATION_FAILED`) 응답 `details.errors[]` 에 `ruleId`+`params` 포함 (이미 ruleId 있음 — params 추가).
- [ ] `workflow-response.dto.ts` `GraphWarningResultDto` 에 `params?` 필드 + `@ApiProperty`.
- [ ] integration 테스트: 400 응답 shape 에 params 포함.

## Phase 3 — frontend 매핑 + 배선

- [ ] `backend-labels.ts`: `ERROR_KO`(code→템플릿) + `GRAPH_WARNING_KO`(ruleId→템플릿) 신설. `GRAPH_VALIDATION_FAILED` + parallel 2 rule 의 ko 템플릿(`{{name}}`).
- [ ] `translateBackendError(code, params, locale, fallback)` + `translateGraphWarning(result, locale)` — `core.ts` `interpolate` 재사용.
- [ ] `custom-node.tsx` L91-92 / `editor-toolbar.tsx` L323-325 가 raw `message` 대신 translate 경유 렌더 (`useLocale()` 이미 사용 중).
- [ ] 저장 거부 toast/title 이 `translateBackendError('GRAPH_VALIDATION_FAILED', ...)` 적용.

## Phase 4 — 자동 가드 (P3-C-1 / P3-C-2)

- [ ] `backend-labels.test.ts` 에 P3-C-1: `GRAPH_WARNING_RULES_BY_TYPE` 의 모든 ruleId ⊆ `GRAPH_WARNING_KO` 키.
- [ ] P3-C-2: 등록된 user-facing error 코드 집합(`GRAPH_VALIDATION_FAILED`) ⊆ `ERROR_KO` 키.
- [ ] `no-internal-refs.test.ts` L64 정규식에 `GRAPH_WARNING_KO` 추가 (I-14 — Principle 6-B 금지 목록 일관).

## Phase 5 — user-guide 문서 (구 §6 item2/3)

- [ ] `05-run-and-debug/validation-errors.mdx` + `.en.mdx` — graph validation 저장 거부 안내(Parallel 중첩 깊이·concurrency 규칙, 사용자 가시 표현만, 내부 SoT/ruleId 노출 금지). `user-guide-writer` sub-agent 위임.
- [ ] frontmatter(title/section/order/summary) + `SECTION_LABELS_BY_LOCALE` 불필요(기존 섹션).
- [ ] graph-warnings 엔드포인트를 API 참조 가이드(존재 시) 반영.

## Phase 6 — 검증

- [ ] backend·frontend lint/unit/build/e2e + `/ai-review`.

## 수용 기준

- ko 로케일에서 `GRAPH_VALIDATION_FAILED` + parallel graphWarning 메시지가 한국어 노출.
- P3-C-1/P3-C-2 가드 그린. 신규 rule 누락 시 build fail.
- 비-ko / 매핑 누락은 영문 graceful fallback.

## 의존성·리스크

- shared package 계약 변경이 backend·frontend 동시 빌드 영향 — `params` optional 로 하위호환.
- `close-cross-node-warning-c4c4d9` worktree 가 `cross-node-warning-rules.md` frontmatter 수정 중(다른 줄) — merge 시 자동 해소 가능, 인지 필요 (consistency I-11).
