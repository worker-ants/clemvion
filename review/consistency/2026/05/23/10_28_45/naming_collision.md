# 신규 식별자 충돌 검토

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/4-nodes/)
검토 대상 plan: `plan/in-progress/render-presentation-button-click-fix.md`
검토 기준 문서: `spec/4-nodes/` 전체 (Presentation 카테고리 집중)

---

## 발견사항

### [INFO] `normalizeButtonIds` — 신규 helper 함수 이름, 기존 충돌 없음

- target 신규 식별자: `normalizeButtonIds(type, payload)` — `render-tool-provider.ts` 에 추가 예정인 backend helper
- 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 내부 어디에도 이 이름이 존재하지 않음. 코드베이스 전체 grep 결과 0건.
- 상세: 충돌 없음. 단, `render-tool-provider.ts` 안에는 `overlayDefaults`, `applyOneMbCap`, `buildJsonSchemaFor`, `checkRenderToolSemanticIssues`, `makeSchemaViolationResult` 등 private 함수들이 이미 정의되어 있다. `normalizeButtonIds` 는 해당 파일 내 기존 함수와 이름이 겹치지 않는다.
- 제안: 변경 없이 진행 가능. 다만 파일 내부 함수 배치 순서 관점에서, cap(`applyOneMbCap`) 이후 단계임을 명확히 하기 위해 함수 내부 JSDoc 에 "cap 이후에 호출" 을 명시하는 것을 권장 (plan §(C) 와 정합).

---

### [INFO] `isSelected` 가드 변경 — 기존 변수명 재사용, 의미 변경

- target 신규 식별자: `const isSelected = selectedButtonId != null && selectedButtonId === btn.id;` (수정된 평가식)
- 기존 사용처:
  - `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` line 242 (CarouselContent per-item)
  - 동 파일 line 591 (PresentationContent global)
  - 현재 코드: `const isSelected = selectedButtonId === btn.id;`
- 상세: 변수명 자체는 재사용이며 신규 도입 식별자가 아니다. 평가식 의미를 `undefined === undefined → true` 에서 `null 체크 후 비교 → false` 로 수정하는 것이 목적. 충돌이 아니라 버그 수정. 동일 파일 내 다른 위치에 `isSelected` 변수가 존재하지 않아 섀도잉 충돌도 없음.
- 제안: 변경 없이 진행 가능.

---

### [INFO] `buttonDefSchema.id` — 기존 schema 에서 optional, spec 은 required 로 정의

- target 신규 식별자: plan §(C) 는 `id` 가 누락된 버튼을 `normalizeButtonIds` 가 채운다고 정의
- 기존 사용처:
  - `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts` line 10: `id: z.string().optional()`
  - `codebase/backend/src/nodes/presentation/_shared/button.types.ts` line 1: `ButtonDef.id: string` (required — interface 수준)
  - `spec/4-nodes/6-presentation/0-common.md` §1: `id | String (UUID v4) | 자동 생성` — ButtonDef.id 는 자동 생성되는 불변 값
- 상세: carousel(및 다른 presentation 노드) 의 carousel.schema.ts 내 `buttonDefSchema.id` 는 `optional()` 로 선언되어 있어 zod validate 를 통과하고 id 없이 저장될 수 있다. `ButtonDef` interface 는 `id: string` (required) 이지만 zod schema 와 TS interface 간 drift 가 존재한다. `normalizeButtonIds` 가 cap 이후에 id 를 채우는 것은 이 drift 를 런타임에서 보완하는 것이므로 충돌이 아니나, spec 의 "자동 생성" 보장이 backend 에서 두 층(zod schema 와 normalizeButtonIds)에 분산된다. 이는 충돌이 아닌 설계 중복 지점이다.
- 제안: 이번 fix PR scope 내에서는 충돌 없으므로 진행 가능. 단, 이후 follow-up 으로 carousel.schema.ts 의 `buttonDefSchema.id` 를 `z.string().optional().default(() => crypto.randomUUID())` 로 통일해 zod 레이어에서도 자동 생성을 보장하고 `normalizeButtonIds` 호출을 제거하거나 단순화하는 것을 권장.

---

### [INFO] `PresentationToolDef` — 동명 식별자가 두 위치에 정의됨 (이미 존재하는 상황)

- target 신규 식별자: spec `spec/4-nodes/6-presentation/0-common.md` §10 의 `PresentationToolDef` 개념
- 기존 사용처:
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` line 98: `export type PresentationToolDef = z.infer<typeof presentationToolDefSchema>;`
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` line 84: `interface PresentationToolDef { ... }` (private interface, 동명)
- 상세: 두 위치 모두 이미 존재하는 기존 코드이며, 이번 fix plan 이 새로 도입하는 것이 아니다. 단, ai-agent.schema.ts 의 exported type 과 render-tool-provider.ts 의 private interface 가 동명이라는 기존 불일치가 있다. 이번 fix plan 범위에서는 이 식별자에 변경이 없으므로 충돌 문제가 새로 발생하지 않는다.
- 제안: 이번 fix PR 에서는 무관. 기존 drift 는 별도 follow-up 으로 처리 권장 (예: render-tool-provider.ts 내부 interface 를 `RenderPresentationToolDef` 로 rename 또는 ai-agent.schema.ts export 를 직접 사용).

---

### [INFO] `zodToToolParams` — spec 에 언급되나 코드베이스에 존재하지 않음

- target 신규 식별자: `spec/4-nodes/6-presentation/0-common.md` §10.1 `zodToToolParams` — "단일 유틸을 통해 zod → JSON Schema 변환"
- 기존 사용처: 코드베이스 전체에서 `zodToToolParams` 는 존재하지 않음. 실제 구현은 `render-tool-provider.ts` 내 `buildJsonSchemaFor(type)` 가 `z.toJSONSchema()` 를 직접 호출하는 방식을 사용.
- 상세: spec 이 `zodToToolParams` 라는 유틸 이름을 언급하지만 코드베이스에는 해당 이름이 없다. 이는 이번 fix plan 에서 새로 도입되는 것이 아니며, spec §10.1 이 미래 정리 의도를 기술한 것으로 보인다. 이번 fix plan scope 에서는 이 함수가 도입되지 않으므로 충돌 발생 없음.
- 제안: 이번 fix PR scope 외. 이후 리팩토링 시 `buildJsonSchemaFor` 를 `zodToToolParams` 로 rename 하거나 spec 을 실제 구현 함수명 `buildJsonSchemaFor` 로 업데이트하는 작업을 별도 plan 에 추가.

---

## 요약

`render-presentation-button-click-fix` plan 이 도입하는 신규 식별자는 두 가지다: backend `normalizeButtonIds` helper 함수와 frontend `isSelected` 평가식 수정. 두 식별자 모두 기존 코드베이스에서 다른 의미로 사용 중인 이름과 충돌하지 않는다. `normalizeButtonIds` 는 `render-tool-provider.ts` 에 새로 추가되는 private 함수로 기존 함수명과 겹치지 않으며, `isSelected` 는 동일 위치의 기존 변수 평가식을 수정하는 것이라 신규 식별자 도입이 아니다. spec §10.1 의 `zodToToolParams` 명칭과 코드베이스의 실제 `buildJsonSchemaFor` 간 drift, 그리고 `PresentationToolDef` 이중 정의는 이번 plan 이전부터 존재하던 기존 상태이므로 이번 fix 에서 새로운 충돌이 발생하지 않는다. carousel 의 `buttonDefSchema.id` optional/required 불일치는 `normalizeButtonIds` 가 보완하는 대상이므로 이번 fix 의 설계 의도와 일관된다.

## 위험도

NONE
