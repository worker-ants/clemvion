---
worktree: node-config-required-defaults-sweep
started: 2026-05-18
owner: developer
---

# 노드 설정 필수/기본값 sweep — spec ↔ schema UI hint 정합화

## 배경

사용자 보고: 노드 설정 패널에서 "필수인데 필수 표시 없음" 또는 "필수 아닌데 필수 표시" 항목이 다수 존재.

조사 결과 root cause 는:

- **frontend 의 `isFieldRequired`** (`auto-form/visibility.ts:36-46`) 는 세 source 를 본다 — ① `ui.required` 명시 ② JSON schema 의 `required` 배열 (zod 비-`.optional()` 필드) ③ `ui.requiredWhen` 조건부.
- 그러나 backend 의 다수 노드 schema 는 *저장 관용성* 을 위해 `.optional()` 또는 `.default([])` 로 선언 — JSON schema 의 `required` 배열에 등장하지 않음.
- "실질적 필수" 강제는 `warningRules` (캔버스 배지) + `validateConfig` (런타임) 두 곳에 있지만, frontend 패널 단의 **필수 표시(asterisk)** 와는 분리되어 있음.

즉 **버그가 아니라 메타데이터 누락** — `node-component.interface.ts:222-226` 의 `ui.required` / `ui.requiredWhen` 가 이미 존재하지만, sweep 대상 노드들에 일관 적용이 안 되어 있다. carousel/template/chart 등 일부 노드만 적용되어 있고 나머지가 누락.

## 방침

- **zod schema 자체는 건드리지 않는다** — `.optional()` / `.default(...)` 는 마이그레이션·LLM 도구 호출·부분 저장 등의 이유로 의도된 디자인.
- 각 노드의 `warningRules` 가 "이 필드는 비어 있으면 안 된다" 라고 선언한 필드에 대해 `.meta({ ui: { ..., required: true } })` 또는 `requiredWhen: { ... }` 를 추가.
- 카테고리별 commit 으로 분할 (Integration / Logic / Presentation).
- 각 commit 에 `*.schema.spec.ts` 단위 테스트 추가 — `z.toJSONSchema(...)` 결과의 `properties.<field>.ui.required` / `requiredWhen` 가 기대값과 일치하는지 검증 (carousel 의 기존 test 패턴 모방, `carousel.schema.spec.ts:70-96`).

## 적용 대상

### Commit 1 — Integration

| 노드 | 필드 | 적용 |
|---|---|---|
| http-request | `url` | `ui.required: true` |
| http-request | `integrationId` | `ui.requiredWhen: { field: 'authentication', equals: 'integration' }` |
| database-query | `integrationId` | `ui.required: true` |
| database-query | `query` | `ui.required: true` |
| send-email | `integrationId` | `ui.required: true` |
| send-email | `to` | `ui.required: true` |
| send-email | `subject` | `ui.required: true` |
| send-email | `body` | `ui.required: true` |

### Commit 2 — Logic

| 노드 | 필드 | 적용 |
|---|---|---|
| if-else | `conditions` | `ui.required: true` |
| variable-declaration | `variables` | `ui.required: true` |
| variable-modification | `modifications` | `ui.required: true` |
| loop | `count` | `ui.required: true` |
| switch | `switchValue` | `ui.requiredWhen: { field: 'mode', notEquals: 'expression' }` |
| switch | `cases` | `ui.required: true` |
| foreach | `arrayField` | `ui.required: true` |
| map | `inputField` | `ui.required: true` |
| filter | `inputField` | `ui.required: true` |
| filter | `conditions` | `ui.required: true` |
| split | `fieldPath` | `ui.required: true` |

### Commit 3 — Presentation Form

| 노드 | 필드 | 적용 |
|---|---|---|
| form | `fields` | `ui.required: true` |

> 참고: `form.fields[i].required` (체크박스로 노출되는 폼 항목별 필수 여부) 는 의미가 다른 layer — 폼 사용자에게 입력을 강제할 것인지의 정책. 기본값 false 가 의도된 동작이므로 sweep 대상 아님. UX 명확화는 별도 follow-up.

> 참고: carousel/table/chart/template 의 핵심 필드 (`items` / `titleField` / `dataSource` / `template` 등) 는 이미 `required` / `requiredWhen` 적용되어 있어 본 sweep 대상 아님.

## 진행 체크리스트

- [x] 분석 보고 + 적용 표 작성
- [x] commit 1 — Integration (http-request, database-query, send-email) + tests
- [x] commit 2 — Logic (if-else, variable-declaration, variable-modification, loop, switch, foreach, map, filter, split) + tests
- [x] commit 3 — Presentation Form + tests
- [ ] PR 본문 작성 + push
- [ ] /ai-review + /consistency-check 실행 결과 RESOLUTION.md 처리
- [ ] PR merge 후 본 plan `git mv` to `plan/complete/`

## 후속 follow-up (별 plan/PR)

ai-review (`review/code/2026/05/18/23_11_13/SUMMARY.md`) 에서 식별된 별 작업들:

- **loop.count default 합의** — `default('1')` 이라 `loop:no-count` warningRule 이 dead. `default('')` 변경 시 신규 노드 UX·기존 workflow 영향 검토 필요.
- **send-email.to zod ↔ validator 정준화** — zod 는 array 전용 / validator 는 string 도 허용. 단일 string `to` 로 저장된 기존 workflow 영향 (DB 조사) 후 한쪽으로 통일.
- **shared `VALID_OPS` enum 파생화** — `variable-modification.VALID_OPERATIONS`, `filter.VALID_OPS` 가 enum option 을 리터럴 중복. `Schema.options` 에서 직접 파생하도록 리팩토링.
- **테스트 패턴 통일** — Integration/Form 의 인라인 `z.toJSONSchema` vs Logic 의 공유 spec(`logic-ui-required.spec.ts`) 혼재. 공유 `getUiMeta` 헬퍼 추출.
- **`uiMeta` 시그니처 확장** — `ZodObject` 캐스트 강제 → `z.ZodTypeAny` 등 generic.
- **주석 상세도 통일 + 동명 충돌 명시** — `form.fields.ui.required` vs `formFieldSchema.required` 동명 혼동(본 PR 에서 spec 단문·schema 주석으로 1차 완화), `send-email subject/body` `.default('')`+`ui.required` 조합 의도 등.
- **spec Rationale 공식화** — 노드 schema `.optional()` / `.default()` 의 설계 원칙 (저장 관용성·마이그레이션·LLM 도구 호출 부분 인자 허용) 과 `ui.required` 의 분리 관리 방침을 `spec/4-nodes/0-overview.md` 또는 카테고리별 `0-common.md` Rationale 에 공식화. consistency-check I-5 지적사항.
- **loop.count Rationale 명문화** — `default('1')` 로 인해 `loop:no-count` warningRule 이 dead 상태임을 `spec/4-nodes/1-logic/3-loop.md` Rationale 에 인지 명문화 또는 default('') 변경 결정. consistency-check I-1.
- **switch mode 확장 가이드** — `switchValue.requiredWhen.notEquals` 가 mode 확장 시 의도보다 넓어질 수 있음을 `spec/4-nodes/1-logic/2-switch.md` Rationale 에 명기. consistency-check I-4.

각 항목은 본 PR 머지 후 별 worktree·plan 으로 분리.

## 관련 문서

- 메커니즘: `codebase/backend/src/nodes/core/node-component.interface.ts:222-236` (ui.required / requiredWhen)
- 사용 예시: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts:188, 217` + `carousel.schema.spec.ts:70-96`
- frontend 소비: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts:36-46`
- 프리젠테이션 버튼 누락 (별 티켓): [presentation-button-render-investigation](./presentation-button-render-investigation.md)
