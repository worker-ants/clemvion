---
worktree: requiredwhen-dsl-whitelist
started: 2026-05-19
owner: developer
---

# `requiredWhen` DSL — `notEquals` 제거 + `equals` array 화이트리스트 확장

## 배경

`requiredWhen` 의 현 DSL 3 형태:
- `{ field, equals: value }` — 단일 값 일치
- `{ field, notEquals: value }` — 단일 값 불일치
- `{ field, oneOf: [v1, v2] }` — 화이트리스트

사용처 `switch.schema.ts:85`:
```ts
switchValue: { requiredWhen: { field: 'mode', notEquals: 'expression' } }
```
의미: mode 가 `'expression'` 이 아닐 때 (= `'value'` / `'range'` 일 때) required.

문제: mode 가 향후 추가되면 (`'literal'`, `'rangeAdvanced'` 등) `notEquals` 가 자동으로 신규 mode 에도 적용됨 — **의도된 화이트리스트가 아니라 블랙리스트**. consistency-check I-4 지적사항.

## 결정 (사용자, 2026-05-19)

② DSL 을 `equals: ['value', 'range']` 처럼 화이트리스트로 전환 (메커니즘 확장).

해석:
- `equals` 시그니처를 `unknown | readonly unknown[]` 로 확장 — **단일 값이면 동등 비교 (`===`), array 면 화이트리스트 (`Array.includes(value)`) 평가**
- `notEquals` 는 deprecate / 제거 (블랙리스트 의미가 mode 확장 시 위험)
- `oneOf` 는 기존 사용처 없음 → `equals` array 형태와 의미 중복 → 단순화 위해 deprecate

> **범위 한정**: deprecate / 제거는 **`requiredWhen` DSL 한정**. `visibleWhen` DSL 은 `notEquals`/`oneOf` 형태를 한시 유지한다 — `ai-agent.schema.ts:151` (`visibleWhen: { field: 'mode', notEquals: 'multi_turn' }`) 등 능동 사용처 존재. `visibleWhen` 통합 정리는 별 follow-up.

> 단순화 선택지: `notEquals` 만 제거하고 `oneOf` 보존하는 안도 가능. 사용자 메시지의 `equals: [...]` 키워드를 그대로 살리려면 `equals` 확장이 명확.

## 작업 항목

> 모든 변경은 **단일 commit** — 인터페이스 + 사용처 마이그레이션 + frontend + spec 동시 정렬.

- [x] plan 생성
- [x] **backend `node-component.interface.ts`**: `requiredWhen` 타입 갱신
  - `{ field, equals: unknown | readonly unknown[] }` 단일 shape
  - `notEquals` / `oneOf` 형태 삭제 + 정준화 의도 JSDoc 명시
- [x] **frontend `types.ts`**: backend mirror 갱신 (동일 단일 shape + JSDoc)
- [x] **frontend `visibility.ts`**: `matches()` 분리 (`matchesVisible` / `matchesRequired`) — required 는 `Array.isArray(equals)` 분기로 화이트리스트 평가
- [x] **마이그레이션** `switch.schema.ts:85`: `notEquals: 'expression'` → `equals: ['value']` (switch.mode = `['value', 'expression']` 2개 enum 중 'value' 일 때만 필수)
- [x] 기존 사용처 `http-request.schema.ts:132` (equals 단일) / `carousel.schema.ts:188, 217` (equals 단일) 영향 없음 확인 — 모두 단일 값 형태
- [x] **frontend visibility.test.ts**: equals whitelist 케이스 + 빈 배열 케이스 추가, oneOf 케이스 → equals array 마이그레이션
- [x] **backend tests**: `logic-ui-required.spec.ts:50-51` `switch.switchValue.requiredWhen` 어설션 → `equals: ['value']`
- [x] **spec 갱신**:
  - `spec/4-nodes/1-logic/2-switch.md` §1 표의 switchValue 행에 새 DSL 명시 + §8 Rationale 참조
  - **§8 Rationale 신설** — DSL 정준화 결정 + 3개 선택지 비교 + §8.2 신규 mode 추가 가이드라인 (consistency I-4 해소)
- [x] 본 sweep plan `node-config-required-defaults-sweep.md` 후속 follow-up "switch mode 확장 가이드" → "requiredwhen-dsl-whitelist 로 분리 + 해소" 마킹
- [x] consistency-check BLOCK NO (09_26_22 — WARNING 3 모두 fix)
- [x] tests + lint + typecheck (backend 89 pass, frontend 14 pass — +1 신규 케이스)
- [x] /ai-review (LOW, Critical 0, WARNING 6 모두 fix — review/code/2026/05/19/09_38_26)
- [x] PR merge (#204, 2026-05-21)
- [x] `git mv plan/in-progress/requiredwhen-dsl-whitelist.md plan/complete/` (PR #204 가 이미 merge 되어 별도 chore commit 으로 처리)

## 관련 문서

- 원 sweep plan: [`node-config-required-defaults-sweep`](./node-config-required-defaults-sweep.md)
- 병행 PR: A `loop-count-policy` (#192), B `send-email-to-array-only` (#199), C `button-cap-spec-validator` (#203)
- ai-review/consistency 원 지적: `review/consistency/2026/05/18/23_26_44/SUMMARY.md` I-4 + `review/code/2026/05/18/23_11_13/SUMMARY.md` W-3 (switch requiredWhen mode 확장)
- 정준화 결정 spec: `spec/4-nodes/1-logic/2-switch.md` §8 Rationale (8.1 화이트리스트 정책 + 8.2 신규 mode 추가 가이드라인)
- 본 PR consistency-check 산출물: `review/consistency/2026/05/19/09_26_22/SUMMARY.md`
- 본 PR ai-review 산출물: `review/code/2026/05/19/09_38_26/SUMMARY.md`
