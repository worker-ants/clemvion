## 발견사항

### [CRITICAL] `ifElseConfigSchema`의 `defaultConfig`가 자체 스키마를 위반

- **위치**: `if-else.schema.ts` — `ifElseConfigSchema`(`.min(1)`) vs `defaultConfig: { conditions: [] }`
- **상세**: `conditions: z.array(conditionSchema).min(1)`로 최소 1개를 요구하지만, `defaultConfig`의 `conditions: []`는 빈 배열이므로 노드 초기화 시 검증이 실패합니다.
- **제안**: `defaultConfig`에 빈 조건 하나를 포함하거나, 스키마를 `.min(0)`으로 완화하세요.

---

### [CRITICAL] `chartConfigSchema`의 `defaultConfig`가 자체 스키마를 위반

- **위치**: `chart.schema.ts` — `xAxis: z.object({ field: z.string().min(1) })` vs `defaultConfig: { chartType: 'bar', xAxis: { field: '' } }`
- **상세**: `xAxis.field`에 `.min(1)` 제약이 있지만 `defaultConfig`의 `field: ''`는 빈 문자열이므로 검증이 즉시 실패합니다.
- **제안**: `defaultConfig`에서 placeholder(`'x'` 등)를 사용하거나, 초기 미설정 상태를 허용하려면 `.min(0)` 또는 `.optional()`로 변경하세요.

---

### [CRITICAL] `switchNodePorts.outputs`가 빈 배열

- **위치**: `switch.schema.ts:14` — `outputs: []`
- **상세**: 스펙에 따르면 Switch 노드는 `cases` 기반의 동적 출력 포트와 `default` fallback 포트를 가져야 합니다. 빈 outputs로는 실행 엔진이 케이스 라우팅을 할 수 없고, 노드 연결 자체가 불가능합니다.
- **제안**: 최소한 정적 `default` 출력 포트를 정의하고, 케이스 포트는 런타임에 동적으로 추가되는 구조로 처리하세요. 스펙의 dynamic port UUID 규칙 적용 필요.

---

### [WARNING] `if_else` 조건의 `operator` 필드 타입 검증 부재

- **위치**: `if-else.schema.ts:8-12` — `operator: z.string()`
- **상세**: 스펙은 `eq, neq, gt, gte, lt, lte, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty, regex, is_null, is_type` 등 열거된 연산자만 허용합니다. 임의의 문자열을 허용하면 실행 엔진 핸들러에서 지원하지 않는 연산자가 들어와 런타임 오류가 발생할 수 있습니다.
- **제안**: `z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'regex', 'is_null', 'is_type'])`로 변경하세요.

---

### [WARNING] `chart`에서 스펙 기준 chartType 누락 (`donut`, `area`)

- **위치**: `chart.schema.ts:18` — `chartType: z.enum(['bar', 'line', 'pie'])`
- **상세**: 스펙(`6-presentation-nodes.md`)은 `bar, line, pie, donut, area` 5가지를 정의합니다. `donut`과 `area`가 누락되었습니다.
- **제안**: `z.enum(['bar', 'line', 'pie', 'donut', 'area'])`로 확장하세요.

---

### [WARNING] `loop` 스키마에 핵심 설정 필드 미정의

- **위치**: `loop.schema.ts:7` — `loopNodeConfigSchema = z.object({}).passthrough()`
- **상세**: 스펙은 `count`(정수 또는 expression), `maxIterations`, `breakCondition`을 요구합니다. 스키마에 정의가 없어 잘못된 값(음수, 문자열 등)이 입력될 수 있으며, 핸들러에서 런타임 오류로 이어집니다. `defaultConfig: { count: 1 }`이 있지만 스키마 미정의로 보장이 없습니다.
- **제안**: `z.object({ count: z.union([z.number().int().positive(), z.string()]).optional(), maxIterations: z.number().int().positive().optional(), breakCondition: z.string().optional() })`을 정의하세요.

---

### [WARNING] `map` 스키마에 `inputField`, `errorPolicy` 미정의

- **위치**: `map.schema.ts:7` — 빈 passthrough 스키마
- **상세**: 스펙은 `inputField`(expression), `errorPolicy`(`stop`/`skip`/`continue`)를 필수 설정으로 정의합니다. `errorPolicy` 부재 시 오류 항목 처리 동작이 정의되지 않습니다.
- **제안**: `z.object({ inputField: z.string().optional(), errorPolicy: z.enum(['stop', 'skip', 'continue']).optional() })`을 추가하세요.

---

### [WARNING] `merge` 스키마에 전략 관련 핵심 필드 미정의

- **위치**: `merge.schema.ts:7` — 빈 passthrough 스키마
- **상세**: 스펙의 `strategy`(`wait_all`, `first`, `append`), `outputFormat`(`array`, `merge_object`, `indexed`), `timeout`, `partialOnTimeout`가 모두 스키마에 없습니다. 이 값들은 `defaultConfig`에는 있으나 타입 안전성이 없습니다. `partialOnTimeout`은 `defaultConfig`에도 누락되었습니다.
- **제안**: 스펙에 맞는 스키마를 정의하고 `partialOnTimeout: false`를 `defaultConfig`에 추가하세요.

---

### [WARNING] `switch` 스키마에 `cases` 배열 미정의

- **위치**: `switch.schema.ts:7` — 빈 passthrough 스키마
- **상세**: Switch 노드의 핵심은 케이스 목록(`cases`)과 라우팅 모드(`value`/`expression`)입니다. 스키마에 이 구조가 없으면 핸들러가 케이스 설정을 가져올 보장이 없습니다.
- **제안**: `z.object({ mode: z.enum(['value', 'expression']).optional(), field: z.string().optional(), cases: z.array(z.object({ id: z.string(), value: z.unknown() })).optional() })`을 정의하세요.

---

### [WARNING] `variable_declaration` / `variable_modification` 스키마에 핵심 구조 미정의

- **위치**: `variable-declaration.schema.ts:7`, `variable-modification.schema.ts:7`
- **상세**: 
  - `variable_declaration` 스펙: `variables` 배열(name, type, defaultValue) 필수.
  - `variable_modification` 스펙: `variableName`, `operation`(`set`/`increment`/`decrement`/`append`/`push`/`pop`/`set_field`/`delete_field`), `value` 필수.
  - 두 노드 모두 완전히 빈 스키마이므로 핸들러에서 받는 입력의 형태가 보장되지 않습니다.
- **제안**: 스펙에 명시된 필드를 Zod 스키마로 정의하세요.

---

### [WARNING] `manual_trigger` 스키마에 `parameters` 정의 미정의

- **위치**: `manual-trigger.schema.ts:7` — 빈 passthrough 스키마
- **상세**: 스펙은 `parameters` 배열(`TriggerParameterDefinition[]`: name, type, required, defaultValue, description)을 통해 실행 시 입력값 검증과 타입 강제 변환을 수행해야 합니다. 스키마 부재 시 파라미터 설정의 유효성이 보장되지 않으며 `{{ $params.<name> }}` 참조 신뢰도가 낮아집니다.
- **제안**: parameters 배열 스키마를 정의하세요.

---

### [WARNING] Presentation 노드들(carousel, form, pdf, table, template) 전체 스키마 미정의

- **위치**: 각 `*.schema.ts`의 `z.object({}).passthrough()`
- **상세**: 스펙은 각 노드에 대해 상세한 설정 구조를 요구합니다:
  - **carousel**: mode, items, source, titleField, descriptionField, imageField, maxItems, layout, buttons
  - **form**: fields(FormField[] — name, type, label, required, options, validation), title, description, submitLabel
  - **table**: columns(ColumnDef[]), dataSource, pagination, pageSize, sortBy, sortOrder, buttons
  - **template**: template, outputFormat(`html`/`markdown`/`text`), helpers, buttons
  - **pdf**: template, pageSize, orientation, margin, headerTemplate, footerTemplate, fileName
  - Blocking mode(buttons가 있는 경우 `waiting_for_input`)가 Carousel/Table/Chart/Template에 공통 적용되어야 하는데, 스키마 없이는 이 동작이 검증되지 않습니다.
- **제안**: 각 노드에 대해 스펙 기반의 Zod 스키마를 구현하세요.

---

### [INFO] `if-else.component.ts`가 리뷰 범위에 없음

- **위치**: `if-else/index.ts`에서 `./if-else.component` export 참조
- **상세**: 다른 노드들은 `*.component.ts`가 리뷰되었지만 `if-else.component.ts`는 포함되지 않았습니다. 핸들러 연결 여부를 확인해야 합니다.

---

### [INFO] `passthrough()` 광범위 사용

- **위치**: 모든 configSchema
- **상세**: `passthrough()`는 스펙에 없는 추가 필드를 허용합니다. 현재는 빈 스키마에 `passthrough()`를 조합하여 사실상 **any 타입**으로 동작하는 노드들이 다수입니다. 의도적 forward compatibility라면 수용 가능하지만, 스펙이 명확하게 정의된 필드들은 `strict()` 또는 명시적으로 정의되어야 합니다.

---

## 요약

리뷰 대상 노드들의 스키마 구현은 대부분 **실제 스펙 대비 최소한의 껍데기 수준**에 그칩니다. `if_else`와 `chart`에서는 `defaultConfig`가 자체 스키마 제약을 위반하는 즉각적인 런타임 오류 가능성이 있으며(`CRITICAL`), `switch` 노드는 출력 포트가 비어 있어 실제로 연결 자체가 불가능합니다. `loop`, `map`, `merge`, `switch`, `variable_declaration`, `variable_modification`, `manual_trigger` 및 모든 presentation 노드의 configSchema가 사실상 `unknown`으로 동작하여, 핸들러에서 설정값을 잘못 읽어도 컴파일/런타임 단계에서 감지할 수 없습니다. 스펙에 정의된 비즈니스 로직(loop count 검증, merge strategy 적용, form field 필수 여부, chart aggregation 규칙 등)이 스키마 레이어에서 전혀 보호되지 않는 상태입니다.

## 위험도

**HIGH**