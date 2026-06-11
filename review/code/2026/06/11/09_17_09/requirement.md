# Requirement Review — ai-node-override-fields

리뷰 대상: `ai-configs.tsx` 삭제 + `override-registry.ts` 수정 + `plan/in-progress` 상태 갱신

---

## 발견사항

### [INFO] 기능 완전성: 삭제된 bespoke 폼 대비 auto-form 커버리지 확인

- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (deleted)
- 상세: 삭제된 bespoke 폼이 렌더하던 필드 vs 자동 폼(zod schema → JSON Schema → SchemaForm)이 커버하는 필드를 비교한 결과:

  **TextClassifier 구 bespoke 폼 렌더 필드** (삭제된 코드 기준):
  - llmConfigId, model, inputField, instructions, includeConfidence, includeEvidence, multiLabel
  - categories[].name, categories[].description (예시 없음)
  - **없음**: contextScope/contextScopeN/contextInjectionMode/includeToolTurns/excludeFromConversationThread, includeSystemContext/systemContextSections, categories[].examples

  **textClassifierNodeConfigSchema(자동 폼) 커버 필드**:
  - 위 7개 + categories[].examples (FieldArrayWidget 내 string[] field-array) + 5개 Conversation Context 필드 + 2개 System Context 필드 = **합계 14개**
  - spec §1 Table 전 필드 (`contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`, `includeSystemContext`, `systemContextSections`) 모두 커버

  **InformationExtractor 구 bespoke 폼 렌더 필드**:
  - llmConfigId, model, inputField (conditional), mode, instructions
  - outputSchema[].name, type, description, required
  - maxTurns (conditional, multi_turn만)
  - **없음**: examples (few-shot), maxCollectionRetries, outputSchema[].enumValues, contextScope 계열 5필드, memoryStrategy 계열 7필드, includeSystemContext/systemContextSections

  **informationExtractorNodeConfigSchema(자동 폼) 커버 필드**:
  - 위 + examples (field-array), maxCollectionRetries, outputSchema[].enumValues + conversation context 5필드 + memory 7필드 + system context 2필드 = **합계 22개**
  - spec §1 Table 전 필드 커버 완료

- 제안: 구현이 spec 명세 필드를 오히려 더 완전하게 노출함. 이행 방향 타당.

---

### [INFO] 엣지 케이스: StructuredItemForm 내 중첩 field-array 렌더링

- 위치: `/codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx`, `StructuredItemForm`
- 상세: `categoryDefSchema.examples: z.array(z.string())` 는 `field-array` 위젯으로 schema에 표시된다. `StructuredItemForm`의 `PRIMITIVES` 에 `FieldArray: FieldArrayWidget` 이 포함되어 있고 `pickWidget`도 `type: 'array'`를 `FieldArray`로 매핑하므로, 카테고리 아이템 폼 내부에서 examples 배열도 렌더된다. string 배열의 비구조화 폼(JSON textarea fallback)이 아니라 `field-array`가 string 하나씩 편집할 수 있는지 여부는 `FieldArrayWidget`의 `isStructured = itemSchema?.properties != null` 분기에 달려 있다. `z.string()`의 items에는 `properties`가 없으므로 비구조화 textarea fallback으로 fallback될 가능성이 있다. 그러나 이는 UX 저하일 뿐 기능 불완전은 아니며, 기존 bespoke 폼은 이 필드 자체를 노출하지 않았으므로 기능 개선이다.
- 제안: 문제 없음. 필요 시 후속 개선.

---

### [INFO] spec §2 UI 와이어프레임과 auto-form 레이아웃 차이

- 위치: `spec/4-nodes/3-ai/2-text-classifier.md §2`, `spec/4-nodes/3-ai/3-information-extractor.md §2`
- 상세: spec §2 설정 UI 와이어프레임은 필드 순서를 특정하게 표현하나, 이는 'rendered example'이지 엄격한 구현 명세가 아니다. auto-form은 schema field의 `ui.order` 값으로 정렬하며, zod schema에서 order가 명시되어 있다. 따라서 이 차이는 구현 선택의 범위 내이다.
- 제안: 해당 없음.

---

### [INFO] spec §2 Information Extractor — Examples (Few-shot) 섹션 표기

- 위치: `spec/4-nodes/3-ai/3-information-extractor.md §2` (와이어프레임 line 98: `[+ Add Example]`)
- 상세: spec §2 와이어프레임에 Few-shot Examples 섹션이 명시되어 있고 `informationExtractorNodeConfigSchema`에 `examples` 필드(field-array, order 5)가 있어 일치한다. 구 bespoke 폼에는 이 필드가 누락되어 있었다. auto-form 이행으로 spec 준수가 회복되었다.
- 제안: 없음.

---

### [INFO] 반환값: NodeConfigRenderer 내 auto-form null guard

- 위치: `/codebase/frontend/src/components/editor/settings-panel/node-configs/index.tsx` line 31–32
- 상세: `definition?.configSchema`가 없으면 `null`을 반환한다. `text_classifier`와 `information_extractor`의 configSchema는 백엔드 registry의 `z.toJSONSchema(c.configSchema)` 경로로 생성되어 API 응답에 포함되므로, 정상 동작 시 null로 빠질 가능성은 없다. 다만 정의 로드 이전 렌더 시점(race)에는 null이 반환된다. 이는 기존 auto-form 패턴과 동일하며 신규 이슈가 아니다.
- 제안: 없음.

---

### [INFO] plan 파일 갱신 적절성

- 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: V-02 항목의 완료 체크가 정확하다. 구현 기술(information_extractor·text_classifier OVERRIDE_REGISTRY 제거, auto-form 이행, zod schema 커버리지 근거)이 실제 코드 변경과 일치한다. 잔여 항목 `V-04·V-05·V-09~V-14·V-18` 은 이 PR 범위 밖이므로 미완료 상태 유지 타당.
- 제안: 없음.

---

## 요약

이번 변경은 `text_classifier`와 `information_extractor`를 bespoke 수동 폼에서 schema-driven auto-form으로 이행하는 것이다. 삭제된 `ai-configs.tsx`는 spec §1에 정의된 필드 중 Conversation Context 5개, System Context 2개, categories[].examples, outputSchema[].enumValues, examples(few-shot), maxCollectionRetries, memoryStrategy 계열 7개를 누락하고 있었다. 이에 반해 두 노드의 zod 스키마(`textClassifierNodeConfigSchema`, `informationExtractorNodeConfigSchema`)는 spec §1 Table의 전 필드를 ui 힌트와 함께 완전히 방출하며, `SchemaForm` + `FieldArrayWidget` + `widget-registry.ts`가 해당 위젯(`llm-config-selector`, `expression`, `field-array`, `select`, `checkbox`, `number`, `multiselect`)을 모두 지원한다. `OVERRIDE_REGISTRY`에서 두 타입을 제거함으로써 `NodeConfigRenderer`가 자동으로 `SchemaForm`으로 fallthrough 하는 경로가 정상 작동한다. 구현이 의도한 기능을 완전히 충족하며, spec 명세 대비 기능 커버리지가 오히려 향상되었다. 차단 항목 없음.

---

## 위험도

NONE
