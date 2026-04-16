### 발견사항

---

**[INFO] `TextClassifierHandler` 클래스 수준 JSDoc 부재**
- 위치: `text-classifier.handler.ts:14` (`TextClassifierHandler` 클래스 선언부)
- 상세: `NONE_SENTINEL`, `buildSingleLabelPrompt`, `buildMultiLabelPrompt`, `processSingleLabelResult`, `processMultiLabelResult` 등 여러 private 메서드가 추가되었으나 클래스 자체에 어떤 모드를 지원하는지, `NONE_SENTINEL`의 역할이 무엇인지를 설명하는 JSDoc이 없음.
- 제안:
  ```ts
  /**
   * Classifies input text into one or more predefined categories using an LLM.
   *
   * Supports two modes:
   * - **Single-label**: selects exactly one category (or routes to `fallback` via `__none__` sentinel).
   * - **Multi-label** (`multiLabel: true`): selects all applicable categories simultaneously,
   *   returning a `string[]` port to activate multiple downstream edges at once.
   *
   * The reserved sentinel `{@link NONE_SENTINEL}` (`"__none__"`) is injected into the
   * single-label JSON schema enum so the LLM can explicitly signal "no match" without
   * hallucinating a category name.
   */
  ```

---

**[INFO] `buildSingleLabelPrompt` / `buildMultiLabelPrompt` private 메서드 주석 부재**
- 위치: `text-classifier.handler.ts:118`, `165`
- 상세: 각 메서드가 반환하는 `{ systemPrompt, jsonSchema }` 객체의 의미와 `__none__` 센티널이 `schemaEnum`에만 추가되고 `buildMultiLabelPrompt`에는 추가되지 않는 설계 의도가 문서화되어 있지 않음. 유지보수자가 이 차이를 보고 버그라고 오해할 수 있음.
- 제안: 각 메서드 앞에 짧은 JSDoc 추가:
  ```ts
  /**
   * Builds the system prompt and JSON schema for single-label classification.
   * Appends `__none__` to the enum so the LLM can signal "no match" explicitly.
   * Multi-label mode does NOT use this sentinel — an empty array serves the same purpose.
   */
  ```

---

**[INFO] `processSingleLabelResult` / `processMultiLabelResult` 결과 타입 반환형 미명시**
- 위치: `text-classifier.handler.ts:196`, `261`
- 상세: 두 private 메서드 모두 반환형이 암시적(`implicit return type`)으로 추론됨. 반환 객체의 `port` 필드가 각각 `string`, `string | string[]`임이 시그니처에서 드러나지 않아 호출부에서 타입을 파악하기 어려움. 문서화 관점에서 명시적 반환 타입 또는 JSDoc `@returns` 추가 권장.
- 제안:
  ```ts
  private processSingleLabelResult(...): NodeHandlerOutput { ... }
  private processMultiLabelResult(...): NodeHandlerOutput { ... }
  ```

---

**[INFO] `handler-output.adapter.ts` JSDoc에 `string[]` port 지원 누락**
- 위치: `handler-output.adapter.ts:3–14` (파일 상단 JSDoc 블록)
- 상세: 기존 JSDoc은 `port` 필드를 언급하지 않음. `string[]` port 지원이 추가되었으나 어떤 핸들러가 배열 포트를 반환하는지, 엔진이 이를 어떻게 처리하는지에 대한 설명이 없음. `isPortFiltered`의 업데이트된 주석과 대응되는 설명이 필요.
- 제안: 기존 JSDoc 블록에 다음 내용 추가:
  ```
   * `port` may be a `string[]` (e.g. multi-label classification) to activate
   * multiple output edges simultaneously. The engine's `isPortFiltered` handles
   * both the scalar and array cases.
  ```

---

**[INFO] spec 문서의 설정 UI ASCII 다이어그램과 실제 컴포넌트 순서 불일치 가능성**
- 위치: `spec/4-nodes/3-ai-nodes.md:456–474`
- 상세: spec의 ASCII 다이어그램에서는 "Include confidence score"와 "Multi-label Classification" 체크박스가 Categories 섹션 위에 표시되어 있음. 그런데 `ai-configs.tsx`의 실제 렌더 순서도 동일(`CheckboxField` → `CheckboxField` → `SectionTitle`). 현재는 일치하나, spec 다이어그램에서 기존 "Include confidence score"가 Categories 하단에 있던 이전 상태의 잔재(삭제된 줄: `│  □ Include confidence score`)가 diff 맥락상 명확하지 않아 spec 최종 확인 필요.
- 제안: 현재 spec 다이어그램이 실제 UI와 일치하므로 추가 조치는 불필요. 단, spec 문서 내 기존 다이어그램에서 삭제된 줄(`│  □ Include confidence score` at bottom)이 실제로 제거되었는지 최종 렌더를 확인하는 것이 좋음.

---

**[INFO] `multiLabel` 필드 기본값 불일치: schema(`false`) vs UI(`?? false`)**
- 위치: `text-classifier.schema.ts:57`, `ai-configs.tsx:249`
- 상세: schema에서 `multiLabel`의 `default(false)` 정의와 프론트엔드의 `?? false` fallback은 기능상 동일하나, spec 테이블(`multiLabel | Boolean | Multi-label 분류 모드 (기본: false)`)에도 명시됨. 문서는 일관되게 작성되어 있음. 별도 조치 불필요.
- 위치: `spec/4-nodes/3-ai-nodes.md:438`

---

**[INFO] `NONE_SENTINEL` 상수의 Swagger/API 문서 반영 불명확**
- 위치: `text-classifier.handler.ts:17`
- 상세: `__none__`이 카테고리 이름으로 금지된 예약어임이 validator에서 강제되지만, API를 통해 노드를 설정하는 경우(예: 워크플로우 API로 직접 노드 config를 PUT 하는 경우) 이 제약이 Swagger 문서에 반영되어 있는지 확인 필요. 프론트엔드 설정 UI만으로는 API 직접 호출 클라이언트에게 이 제약이 노출되지 않음.
- 제안: `textClassifierNodeConfigSchema`의 `categories` 항목 또는 관련 Swagger decorator에 `__none__` 예약어 주석 추가 고려.

---

### 요약

이번 변경은 Text Classifier 노드에 Multi-label 모드와 `__none__` 센티널을 도입하는 중요한 기능 확장이다. spec 문서(`3-ai-nodes.md`)는 새로운 모드, 설정 필드, 출력 구조, 실행 로직을 잘 반영하였고, `NodeHandlerOutput` 인터페이스 주석도 `string[]` port 지원을 명시적으로 문서화하였다. `isPortFiltered`의 JSDoc 업데이트도 기능 변경과 일치한다. 다만 `TextClassifierHandler` 클래스 자체와 새로 추가된 private 메서드들(`buildSingleLabelPrompt`, `buildMultiLabelPrompt`, `processSingleLabelResult`, `processMultiLabelResult`)에 JSDoc이 전혀 없어, 특히 Multi-label에서 `__none__` 센티널을 사용하지 않는 설계 이유 등 비자명한 결정들이 문서화되지 않은 상태다. `handler-output.adapter.ts`의 상단 JSDoc 블록도 `string[]` port 지원 추가를 반영하지 않고 있다. 전체적으로 기능 구현 대비 코드 수준의 문서화는 다소 미흡하나, 스펙 문서는 충실히 업데이트되었다.

### 위험도

**LOW**