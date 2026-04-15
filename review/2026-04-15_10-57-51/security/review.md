## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] `if-else` 조건 스키마의 과도한 `.passthrough()` 사용**
- 위치: `if-else/if-else.schema.ts` — `conditionSchema`, `ifElseConfigSchema`
- 상세: `conditionSchema`의 `field`, `operator`, `value` 필드가 모두 열린 타입이며 `.passthrough()`로 임의 추가 필드를 허용합니다. 특히 `operator`가 `z.string()`으로 정의되어 허용 연산자가 제한되지 않습니다. 런타임 핸들러가 `operator` 값을 기반으로 동적 코드 평가(eval, Function 생성 등)나 DB 쿼리 생성에 사용할 경우 인젝션 경로가 됩니다.
- 제안: `operator`를 `z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'startsWith', 'endsWith'])` 등으로 허용 목록을 제한하세요. `field` 역시 `.regex(/^[\w.[\]]+$/)` 정도의 패턴 제한을 권장합니다.

---

**[WARNING] 대다수 노드 스키마가 `z.object({}).passthrough()`로 정의됨**
- 위치: `loop.schema.ts`, `map.schema.ts`, `merge.schema.ts`, `split.schema.ts`, `switch.schema.ts`, `variable-declaration.schema.ts`, `variable-modification.schema.ts`, `form.schema.ts`, `carousel.schema.ts`, `table.schema.ts`, `template.schema.ts`, `pdf.schema.ts`, `manual-trigger.schema.ts`
- 상세: `z.object({}).passthrough()`는 사실상 유효성 검증을 하지 않는 것과 동일합니다. 임의의 필드가 그대로 통과되므로, 핸들러가 해당 config를 신뢰하고 처리할 경우 예상치 못한 데이터가 실행 경로에 유입됩니다. `variable-declaration`, `variable-modification`, `form` 등 사용자 입력과 밀접한 노드일수록 위험도가 높습니다.
- 제안: 각 노드가 실제로 사용하는 config 필드를 스키마에 명시적으로 정의하고 `.strict()` 또는 최소한 `.strip()`을 적용해 불필요한 필드를 제거하세요. 스펙이 확정되지 않은 경우라도, 현재 사용되는 필드는 타입과 범위를 정의해야 합니다.

---

**[WARNING] `chartConfigSchema`의 `dataSource: z.unknown()` 및 `buttonDefSchema.value: z.unknown()`**
- 위치: `chart/chart.schema.ts` — `chartConfigSchema.dataSource`, `buttonDefSchema.value`
- 상세: `z.unknown()`은 어떤 값도 허용합니다. `dataSource`가 외부 URL, 파일 경로, 객체 참조 등 다양한 형태로 입력될 수 있고, 핸들러에서 이를 그대로 사용하면 SSRF(서버 측 요청 위조), 경로 탐색, 오브젝트 인젝션 위험이 있습니다. `buttonDefSchema.value`도 임의 타입 허용으로 직렬화/역직렬화 과정에서 프로토타입 오염 가능성이 있습니다.
- 제안: `dataSource`는 실제 사용 형태(배열, 특정 객체 구조 등)에 맞는 구체적인 스키마로 정의하세요. `buttonDefSchema.value`는 허용 범위를 `z.string() | z.number() | z.boolean() | z.null()` 등 원시 타입으로 제한하는 것을 권장합니다.

---

**[INFO] `if-else` defaultConfig의 조건 배열이 비어 있음**
- 위치: `if-else/if-else.schema.ts` — `ifElseMetadata.defaultConfig`
- 상세: `defaultConfig: { conditions: [], combineMode: 'and' }`는 `conditions: z.array(conditionSchema).min(1)` 스키마와 불일치합니다. 핸들러가 `defaultConfig`를 그대로 검증 없이 사용하면 런타임 오류가 발생할 수 있습니다. 보안적 영향은 낮으나, 방어적 코딩 관점에서 일관성이 필요합니다.
- 제안: `defaultConfig`의 `conditions`에 기본 조건 항목 하나를 포함하거나, 스키마의 `min(1)` 조건을 제거하고 빈 배열 처리 로직을 핸들러에서 명시적으로 다루세요.

---

**[INFO] 모든 노드 configSchema가 공유 핸들러에 전달되는 경로에서 재검증 여부 불명확**
- 위치: 전체 `.component.ts` 파일들 — `configSchema` 필드
- 상세: `NodeComponent`에 `configSchema`가 선언되어 있으나, 실행 엔진(execution-engine)에서 핸들러 실행 전 이 스키마로 config를 실제로 파싱/검증하는지 이 파일들만으로는 확인 불가합니다. 검증이 누락된다면 스키마 정의가 무의미한 dead-code가 됩니다.
- 제안: `ExecutionEngine`에서 핸들러 호출 전 반드시 `component.configSchema.parse(node.config)`를 수행하는 코드가 있는지 확인하고, 없다면 추가하세요.

---

### 요약

리뷰 대상 파일들은 노드 컴포넌트의 스키마 정의 계층으로, 직접적인 하드코딩 시크릿이나 인증 우회 등의 심각한 취약점은 없습니다. 그러나 전반적으로 **입력 검증이 매우 느슨한 설계**가 핵심 문제입니다. 대부분의 스키마가 `z.object({}).passthrough()`로 정의되어 실질적인 유효성 검사를 수행하지 않으며, `if-else` 노드의 `operator`와 chart 노드의 `dataSource`는 다운스트림 핸들러의 구현에 따라 인젝션 또는 SSRF 취약점으로 이어질 수 있는 경로입니다. 스키마 계층은 시스템 경계에서의 첫 번째 방어선이므로, 허용 목록 기반의 엄격한 검증으로 전환하는 것이 필요합니다.

---

### 위험도

**MEDIUM**