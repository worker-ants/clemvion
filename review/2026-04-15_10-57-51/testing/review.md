---

## 발견사항

### **[CRITICAL]** 노드 컴포넌트 전체에 테스트 파일이 전무함
- **위치**: `backend/src/nodes/` 디렉토리 전체
- **상세**: 44개 파일 (schema, component, index)에 대해 `.spec.ts` 또는 `.test.ts` 파일이 단 하나도 존재하지 않음. `if-else`, `loop`, `map`, `merge`, `split`, `switch`, `variable-declaration`, `variable-modification`, `carousel`, `chart`, `form`, `pdf`, `table`, `template`, `manual-trigger` 모두 해당.
- **제안**: 각 노드에 대해 최소한 schema 유효성 검사 테스트와 component 구조 테스트를 작성해야 함.

---

### **[CRITICAL]** `ifElseConfigSchema`의 `defaultConfig`와 schema 불일치 — 테스트 없음
- **위치**: `if-else.schema.ts`
- **상세**: `defaultConfig`는 `{ conditions: [], combineMode: 'and' }`로 빈 배열을 설정하지만, schema는 `conditions: z.array(...).min(1)`로 최소 1개를 요구함. 즉 `defaultConfig` 자체가 자신의 schema를 통과하지 못하는 모순이 존재하며, 이를 검출할 테스트가 없음.
- **제안**: `ifElseConfigSchema.safeParse(ifElseMetadata.defaultConfig)` 를 검증하는 테스트를 추가하고, `defaultConfig`를 유효한 값으로 교정하거나 schema에서 `min(1)` 조건을 제거해야 함.

---

### **[CRITICAL]** `mergeNodeConfigSchema`가 `defaultConfig`의 필드(`strategy`, `outputFormat`, `timeout`)를 전혀 검증하지 않음
- **위치**: `merge.schema.ts`
- **상세**: schema는 `z.object({}).passthrough()`로 아무것도 강제하지 않지만 `defaultConfig`에 `strategy`, `outputFormat`, `timeout`을 포함함. 런타임에 잘못된 값이 들어와도 통과되며 이를 잡을 테스트가 없음.
- **제안**: schema에 실제 필드를 명시하거나, 적어도 `defaultConfig`의 각 필드가 예상 타입인지 검증하는 테스트를 작성해야 함.

---

### **[WARNING]** `loopNodeConfigSchema`가 `defaultConfig`의 `count` 필드를 검증하지 않음
- **위치**: `loop.schema.ts`
- **상세**: `defaultConfig: { count: 1 }`이나 schema는 `z.object({}).passthrough()`로 `count` 필드를 전혀 타입 체크하지 않음. 음수, 문자열 등이 허용됨.
- **제안**: `loopNodeConfigSchema`에 `count: z.number().int().positive()` 필드를 추가하거나, `defaultConfig` 검증 테스트를 작성.

---

### **[WARNING]** `chartConfigSchema`의 `xAxis.field`가 `defaultConfig`에서 빈 문자열로 초기화됨
- **위치**: `chart.schema.ts`
- **상세**: schema는 `xAxis: z.object({ field: z.string().min(1) })`로 최소 1글자를 강제하지만, `defaultConfig: { chartType: 'bar', xAxis: { field: '' } }`는 빈 문자열을 사용하므로 schema 검증을 통과하지 못함. 테스트가 없어 이 불일치가 탐지되지 않음.
- **제안**: `chartConfigSchema.safeParse(chartMetadata.defaultConfig)`를 검증하는 테스트 추가 및 `defaultConfig.xAxis.field`를 유효한 값으로 설정.

---

### **[WARNING]** `switchNodePorts`의 `outputs`가 빈 배열 — 의도 불명확하며 검증 없음
- **위치**: `switch.schema.ts`
- **상세**: switch 노드는 multi-path branching 을 설명하지만 `outputs: []`로 출력 포트가 없음. 동적 포트인지, 미완성인지 불분명하며, 이 동작을 명시하는 테스트가 없어 의도가 문서화되지 않음.
- **제안**: 빈 outputs가 의도적(동적 포트)이라면 주석 또는 테스트로 명시. 실수라면 포트를 추가.

---

### **[WARNING]** `NodeComponentRegistry` — `bootstrap()`, `listDefinitions()` 에 대한 테스트 없음
- **위치**: `backend/src/nodes/core/node-component.registry.ts`
- **상세**: 중복 등록 예외 처리, `z.toJSONSchema()` 직렬화, `getComponent()` 반환값 등 핵심 동작에 대한 단위 테스트가 없음. 특히 `ALL_NODE_COMPONENTS` 등록 시 중복 타입이 없는지 확인하는 통합 테스트가 필요함.
- **제안**: `NodeComponentRegistry.spec.ts`를 작성하고 중복 등록 예외, `listDefinitions()` schema 직렬화, `ALL_NODE_COMPONENTS` 전체 등록 성공 여부를 테스트.

---

### **[INFO]** `createHandler: () => new XxxHandler()` 패턴 — 의존성 주입 미사용
- **위치**: 대부분의 `*.component.ts` 파일
- **상세**: `createHandler`는 `HandlerDependencies`를 인자로 받지만 대부분 `() => new Handler()` 형태로 무시하여 Handler 내부 의존성을 직접 주입할 수 없음. 핸들러가 의존성을 사용하게 되면 테스트에서 mock이 불가능한 구조.
- **제안**: 테스트 가능성을 위해 `(deps) => new XxxHandler(deps)` 패턴을 일관되게 적용하거나, 단순 핸들러임을 테스트로 명시.

---

## 요약

리뷰 대상 코드(`backend/src/nodes/` 전체)에는 `.spec.ts` 파일이 단 하나도 존재하지 않아 테스트 커버리지가 0%입니다. 특히 `if-else`와 `chart` 노드의 `defaultConfig`가 자체 schema 검증을 통과하지 못하는 심각한 불일치가 있고, `merge`와 `loop` 노드의 schema가 `defaultConfig`에 포함된 핵심 필드를 전혀 검증하지 않는 문제도 존재합니다. 이러한 결함들은 테스트가 없어 런타임까지 탐지되지 않습니다. schema 유효성 테스트, `defaultConfig` 일치 검증, `NodeComponentRegistry` 단위/통합 테스트, 그리고 `ALL_NODE_COMPONENTS` 전체 등록 성공 여부를 확인하는 테스트가 최우선으로 필요합니다.

## 위험도

**HIGH**