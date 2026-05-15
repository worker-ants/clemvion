## 발견사항

### [CRITICAL] `ifElseConfigSchema` - `defaultConfig`가 자체 스키마를 위반
- **위치**: `if-else.schema.ts` — `ifElseConfigSchema` + `ifElseMetadata.defaultConfig`
- **상세**: `ifElseConfigSchema`는 `conditions: z.array(...).min(1)`로 최소 1개의 조건을 요구하지만, `defaultConfig: { conditions: [], combineMode: 'and' }`는 빈 배열을 제공합니다. 이 defaultConfig를 해당 스키마로 검증하면 `ZodError`가 발생합니다. 노드 생성 시 defaultConfig를 자동 검증하는 경로에서 런타임 오류가 발생할 수 있습니다.
- **제안**: `defaultConfig`에 최소 1개의 조건 객체를 포함하거나, 스키마를 `z.array(...).min(0)`으로 완화하고 실행 시 검증하도록 변경

---

### [CRITICAL] `chartConfigSchema` - `defaultConfig`가 자체 스키마를 위반
- **위치**: `chart.schema.ts` — `chartConfigSchema.xAxis` + `chartMetadata.defaultConfig`
- **상세**: `xAxis: z.object({ field: z.string().min(1) })`는 필드에 최소 1자 이상을 요구하지만, `defaultConfig: { chartType: 'bar', xAxis: { field: '' } }`는 빈 문자열을 제공합니다. if-else와 동일하게 스키마 검증 경로에서 `ZodError`를 발생시킵니다.
- **제안**: `defaultConfig.xAxis.field`를 `''` 대신 의미 있는 placeholder(예: `'x'`)로 변경하거나, 스키마를 `z.string().optional()`로 완화

---

### [WARNING] `loopNodeConfigSchema` - `defaultConfig`의 `count` 필드가 스키마에 없음
- **위치**: `loop.schema.ts` — `loopNodeConfigSchema` + `loopNodeMetadata.defaultConfig`
- **상세**: 스키마는 `z.object({}).passthrough()`로 정의되어 `count` 필드가 타입에 포함되지 않습니다. `LoopConfig` 타입으로 추론된 객체에서 `config.count`를 읽으려면 타입 캐스팅이 필요하며, 타입 안전성이 없습니다. `.passthrough()`가 런타임 오류는 막지만, TypeScript 컴파일 타임 보호가 전혀 없습니다.
- **제안**: `z.object({ count: z.number().int().min(1).default(1) }).passthrough()`로 명시적 선언

---

### [WARNING] `switchNodePorts.outputs` - 빈 배열
- **위치**: `switch.schema.ts` — `switchNodePorts`
- **상세**: `outputs: []`로 정적 출력 포트가 없습니다. 실행 엔진이 노드에 최소 1개 이상의 출력 포트를 가정하거나, 출력 포트로 다음 노드를 라우팅하는 로직이 있다면 예상치 못한 동작이 발생할 수 있습니다. `SwitchHandler`가 동적으로 출력을 관리하는 경우라면 의도적이겠지만, 이 패턴이 나머지 노드들과 불일치합니다.
- **제안**: 동적 출력 의도라면 주석으로 명시. 아니라면 최소한 `default` 출력 포트를 추가

---

### [INFO] 전반적인 `.passthrough()` 남용 — 타입 안전성 손실
- **위치**: `loop`, `map`, `merge`, `split`, `switch`, `variable-declaration`, `variable-modification`, `form`, `pdf`, `table`, `template`, `carousel` 스키마 전체
- **상세**: 대부분의 configSchema가 `z.object({}).passthrough()`로 정의되어 있습니다. 이는 어떤 데이터든 검증 없이 통과하므로, 잘못 구성된 노드가 오류 없이 실행 엔진에 진입합니다. 의도적으로 유연하게 설계한 것이라도, 각 노드가 실제로 읽는 필드는 명시적으로 선언하는 것이 안전합니다.
- **제안**: 각 핸들러가 실제로 사용하는 config 필드를 파악하여 스키마에 명시적으로 선언

---

### [INFO] `createHandler: () => new Handler()` — 매 호출 시 새 인스턴스 생성
- **위치**: 모든 `.component.ts` 파일
- **상세**: 팩토리 패턴 자체는 문제없으나, 핸들러가 내부 상태(캐시, 연결 등)를 초기화하는 비용이 있다면 호출마다 해당 비용이 발생합니다. 현재 코드에서는 확인 불가하나, 핸들러 구현 시 주의가 필요합니다.
- **제안**: 핸들러가 stateless임을 문서화하거나, 비용이 큰 초기화는 지연 초기화 패턴 사용

---

## 요약

전체 44개 파일은 스키마-컴포넌트-인덱스의 일관된 구조를 따르며, 모듈 간 상태 공유나 전역 변수 수정, 파일시스템/네트워크 호출 등의 외부 부작용은 없습니다. 그러나 **if-else와 chart 노드에서 `defaultConfig`가 자신의 Zod 스키마를 위반**하는 것이 가장 심각한 문제로, 노드 생성/검증 경로에서 런타임 오류를 일으킬 수 있습니다. 나머지 대부분의 스키마가 `z.object({}).passthrough()`로 정의되어 타입 안전성이 사실상 포기된 상태이며, 이는 잘못된 config가 런타임까지 감지되지 않는 잠재적 위험을 내포합니다.

## 위험도

**HIGH** (defaultConfig ↔ schema 불일치 2건이 런타임 오류를 유발할 가능성)