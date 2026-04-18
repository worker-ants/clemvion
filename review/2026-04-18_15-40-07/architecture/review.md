### 발견사항

---

**[WARNING] 정보 추출기 노드 특수 처리가 범용 훅에 직접 임베딩됨 (OCP/SRP 위반)**
- 위치: `use-expression-context.ts` — `enrichInfoExtractorOutputSchema` 함수, 두 곳의 `if (nodeType === "information_extractor")` 분기
- 상세: expression 컨텍스트 훅이 특정 노드 타입의 내부 스키마 구조(`.properties?.output?.properties?.extracted`)를 직접 알고 있습니다. 향후 동적 스키마를 가진 노드(Form Builder, Variable Extractor 등)가 추가될 때마다 이 훅에 `if (nodeType === "X")` 분기를 추가해야 합니다.
- 제안: `NodeDefinition`에 `enrichOutputSchema?: (config: unknown, baseSchema: JsonSchemaNode) => JsonSchemaNode` 옵셔널 함수를 추가하고, 훅은 해당 함수를 호출하기만 하도록 변경. 노드별 로직은 각 노드 정의 파일에 격리

```typescript
// node-definitions/types.ts에 추가
enrichOutputSchema?: (config: unknown, base: JsonSchemaNode) => JsonSchemaNode;

// use-expression-context.ts (개선 후)
let outputSchema = definition?.outputSchema;
if (outputSchema && definition?.enrichOutputSchema) {
  outputSchema = definition.enrichOutputSchema(config, outputSchema);
}
```

---

**[WARNING] outputSchema가 validation 없는 문서화 역할만 수행 (추상화 목적 불명확)**
- 위치: `ai-agent.schema.ts`, `information-extractor.schema.ts`, `text-classifier.schema.ts` — 모든 신규 `outputSchema`
- 상세: 세 스키마 모두 모든 필드가 `.optional()` + 최상위 `.passthrough()`로 설정되어 있습니다. 이 조합은 어떤 객체도 통과시키므로 런타임 validation 기능이 없습니다. 스키마가 autocomplete 힌트 전달용이라는 의도는 주석에 명시되어 있지만, `z.object()` 대신 단순한 JSON Schema 타입을 사용하는 것이 이 목적에 더 적합합니다.
- 제안: 목적을 명확히 분리하거나, 최소한 필수 필드(`response`, `category` 등)는 `.optional()` 없이 정의하여 스키마가 실제 계약 역할을 하도록 강화

---

**[WARNING] `dropStaleEdges`의 데이터 정합성 — 로드 시 암묵적 변형이 서버에 반영되지 않음**
- 위치: `editor-loader.tsx` 72-80행, `edge-utils.ts` — `dropStaleEdges`
- 상세: 스테일 엣지를 로드 시 클라이언트에서 조용히 제거하지만, 이 변경은 서버에 저장되지 않습니다. 사용자가 저장하지 않으면 다음 로드 시 동일한 경고가 반복됩니다. `console.warn`만으로는 사용자가 이 상황을 인지하지 못합니다.
- 제안: 스테일 엣지 감지 시 사용자에게 "워크플로우가 변경되었습니다. 저장하시겠습니까?" 알림 표시, 또는 로드 직후 자동 저장 트리거

---

**[INFO] 프론트엔드에 백엔드 타입 매핑 중복 (`INFO_EXTRACTOR_TYPE_MAP`)**
- 위치: `use-expression-context.ts` 54-61행
- 상세: `string/number/boolean/array/object` 타입 매핑이 백엔드 `information-extractor.schema.ts`의 `fieldDefSchema` 열거형과 동일합니다. 이 매핑은 두 곳에서 독립적으로 유지해야 합니다.
- 제안: 백엔드가 API를 통해 `outputSchema`를 이미 JSON Schema 형태로 내려준다면 프론트엔드에서 재매핑할 필요가 없음. 백엔드 `informationExtractorNodeOutputSchema`의 `extracted` 필드를 동적으로 구성하는 방식을 검토

---

**[INFO] `JSON.parse(JSON.stringify(...))` 딥 클론 사용**
- 위치: `use-expression-context.ts` — `enrichInfoExtractorOutputSchema` 내부
- 상세: 이 패턴은 JSON-직렬화 불가능한 값(함수, undefined, Symbol)이 포함되면 데이터를 손실합니다. `JsonSchemaNode`는 현재 순수 데이터이므로 즉각적인 버그는 없지만, 타입이 확장되면 취약해집니다.
- 제안: structuredClone() 사용 또는 필요한 경로만 얕게 복사하는 방식으로 변경

---

**[INFO] `dropStaleEdges`의 빈 Set 와일드카드 의미론 모호성**
- 위치: `edge-utils.ts` — `validOutputs`, `validInputs` 내부 unknown 타입 처리
- 상세: 알 수 없는 노드 타입에 대해 빈 `Set<string>`을 반환하고, 이를 `size > 0` 조건으로 검사하여 검증을 건너뜁니다. "빈 집합 = 모든 것 허용"이라는 역직관적 의미론입니다.
- 제안: `null`을 반환하여 "알 수 없음(검증 건너뜀)"을 명시적으로 표현

```typescript
function validOutputs(node: Node): Set<string> | null {
  // ...
  if (!def) return null; // 명시적 "알 수 없음"
  // ...
}

// 사용 측
const sourceOutputs = validOutputs(source);
if (sourceOutputs !== null && edge.sourceHandle) {
  if (!sourceOutputs.has(edge.sourceHandle)) return false;
}
```

---

**[INFO] `getSchemaKeys`가 `resolve-nested-path.ts`에 위치함 — 모듈 경계 검토 필요**
- 위치: `resolve-nested-path.ts` 하단 추가된 함수들
- 상세: 기존 파일은 런타임 샘플 객체 탐색 유틸리티였는데, JSON Schema 탐색 기능이 동일 파일에 추가되었습니다. 두 기능은 독립적으로 사용될 수 있습니다.
- 제안: 파일 분리가 권장되나, 현재 규모에서는 `INFO` 수준 — 파일명을 `resolve-expression-path.ts`로 변경하거나 별도 `json-schema-utils.ts`로 분리 검토

---

### 요약

이번 변경의 핵심 아키텍처 패턴 — 백엔드 `outputSchema` 등록, 프론트엔드 autocomplete의 스키마 기반 힌트, 로드 시 스테일 엣지 제거 — 은 방향성이 올바릅니다. 다만 `information_extractor` 특수 처리 로직이 범용 expression 컨텍스트 훅에 직접 임베딩된 것이 가장 큰 구조적 문제입니다. 이 패턴은 OCP를 위반하며, 동적 스키마를 가진 노드가 추가될 때마다 반복 수정이 필요한 확장성 부채가 됩니다. 노드 정의에 `enrichOutputSchema` 함수를 추가하는 방식으로 리팩토링하면 확장성과 모듈 경계를 동시에 개선할 수 있습니다.

### 위험도

**MEDIUM**