# Code Review 통합 보고서

## 전체 위험도
**HIGH** - `defaultConfig`가 자체 Zod 스키마를 위반하는 런타임 오류 유발 버그 다수 존재, 스키마 계층 전반의 검증 부재로 인한 타입 안전성 손실, 테스트 파일 전무

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스키마/계약 | `ifElseConfigSchema`의 `defaultConfig`가 자체 스키마를 위반 — `conditions: z.array(...).min(1)`을 요구하지만 `defaultConfig.conditions: []`이므로 노드 초기화 시 `ZodError` 발생 | `if-else.schema.ts:14,35` | `defaultConfig`에 최소 1개의 조건 객체를 포함하거나, 스키마를 `.min(0)`으로 완화 |
| 2 | 스키마/계약 | `chartConfigSchema`의 `defaultConfig`가 자체 스키마를 위반 — `xAxis.field: z.string().min(1)` 요구 대비 `defaultConfig.xAxis.field: ''`로 즉시 검증 실패 | `chart.schema.ts` | `defaultConfig.xAxis.field`를 `'x'` 등 유효한 placeholder로 변경하거나 스키마를 `.optional()`로 완화 |
| 3 | 요구사항 | `switchNodePorts.outputs: []` — Switch 노드가 케이스 기반 출력 포트 없이는 실행 엔진에서 라우팅 불가, 노드 연결 자체가 불가능 | `switch.schema.ts:14` | 최소한 정적 `default` 출력 포트를 정의하고, 케이스 포트는 런타임 동적 추가 구조로 처리. `NodeComponentMetadata`에 `isDynamicPorts: true` 플래그 추가 |
| 4 | 테스트 | `backend/src/nodes/` 전체에 `.spec.ts`/`.test.ts` 파일이 단 하나도 존재하지 않음 (테스트 커버리지 0%) | `backend/src/nodes/**` | schema 유효성, `defaultConfig` 일치 검증, `NodeComponentRegistry` 단위/통합 테스트 작성 |
| 5 | 범위 | `if-else.component.ts` 파일 누락 — `index.ts`가 `./if-else.component`를 re-export하나 파일이 존재하지 않음 | `if-else/index.ts` | 파일 존재 여부 확인 및 `IfElseHandler` 연결 검증 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항 | `if-else` 조건의 `operator` 필드가 `z.string()`으로 무제한 허용 — 허용 목록 외 연산자가 실행 엔진에 유입되면 런타임 오류 또는 인젝션 경로 가능 | `if-else.schema.ts:8-12` | `z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'regex', 'is_null', 'is_type'])`로 제한 |
| 2 | 보안/스키마 | `chartConfigSchema.dataSource: z.unknown()` 및 `buttonDefSchema.value: z.unknown()` — 외부 URL, 파일 경로 등 임의값 허용으로 SSRF·경로 탐색·프로토타입 오염 위험 | `chart.schema.ts` | `dataSource`를 실제 사용 형태에 맞는 구체적 스키마로 정의; `buttonDefSchema.value`를 원시 타입 유니온으로 제한 |
| 3 | 스키마/유지보수 | 대다수 노드 configSchema가 `z.object({}).passthrough()`로 정의되어 실질적 검증 없음 — `loop(count)`, `merge(strategy/outputFormat/timeout)`, `map`, `split`, `switch`, `variable-*`, `form`, `carousel`, `table`, `template`, `pdf`, `manual-trigger` 전체 해당 | 각 `*.schema.ts` | 각 노드가 실제로 사용하는 config 필드를 스키마에 명시; 미구현 시 `// TODO: define config schema` 주석 추가 |
| 4 | 요구사항 | 스펙 대비 `loop` 스키마에 `count`, `maxIterations`, `breakCondition` 미정의; `defaultConfig: { count: 1 }`과 스키마 불일치 | `loop.schema.ts` | `z.object({ count: z.union([z.number().int().positive(), z.string()]).optional(), maxIterations: z.number().int().positive().optional(), breakCondition: z.string().optional() })` 정의 |
| 5 | 요구사항 | 스펙 대비 `map` 스키마에 `inputField`, `errorPolicy`(`stop`/`skip`/`continue`) 미정의 | `map.schema.ts` | `z.object({ inputField: z.string().optional(), errorPolicy: z.enum(['stop', 'skip', 'continue']).optional() })` 추가 |
| 6 | 요구사항 | 스펙 대비 `merge` 스키마에 `strategy`, `outputFormat`, `timeout`, `partialOnTimeout` 미정의; `defaultConfig`에서 `partialOnTimeout`도 누락 | `merge.schema.ts` | 스펙 기반 스키마 정의 및 `defaultConfig`에 `partialOnTimeout: false` 추가 |
| 7 | 요구사항 | 스펙 대비 `switch` 스키마에 `mode`, `field`, `cases` 배열 미정의 | `switch.schema.ts` | `z.object({ mode: z.enum(['value', 'expression']).optional(), field: z.string().optional(), cases: z.array(...).optional() })` 정의 |
| 8 | 요구사항 | `variable_declaration`(`variables` 배열), `variable_modification`(`variableName`, `operation`, `value`) 스키마 완전 미정의 | `variable-declaration.schema.ts`, `variable-modification.schema.ts` | 스펙에 명시된 필드 구조로 Zod 스키마 정의 |
| 9 | 요구사항 | Presentation 노드 전체(`carousel`, `form`, `pdf`, `table`, `template`) 스키마 미정의 — blocking mode, buttons, 필드 구조 등 스펙 요구사항 미반영 | 각 presentation `*.schema.ts` | 각 노드에 대해 스펙 기반 Zod 스키마 구현 |
| 10 | 요구사항 | `chart`의 `chartType`에서 스펙 정의 타입 `donut`, `area` 누락 | `chart.schema.ts:18` | `z.enum(['bar', 'line', 'pie', 'donut', 'area'])`로 확장 |
| 11 | 요구사항 | `manual_trigger` 스키마에 `parameters` 배열(`TriggerParameterDefinition[]`) 미정의 | `manual-trigger.schema.ts` | parameters 배열 스키마 정의 |
| 12 | 유지보수 | 카테고리별 색상 상수(`#3B82F6`, `#EC4899`, `#F59E0B`)가 10개 이상 파일에 하드코딩 반복 | 모든 `*.schema.ts` | 공유 상수 파일(`NODE_CATEGORY_COLORS`)에 카테고리별 색상 중앙화 |
| 13 | 보안 | 실행 엔진에서 핸들러 호출 전 `component.configSchema.parse(node.config)`가 실제로 수행되는지 불명확 | `execution-engine` 내부 | `ExecutionEngine`에서 핸들러 호출 전 반드시 configSchema 검증 코드 확인/추가 |
| 14 | 테스트 | `createHandler: (deps) => new Handler()` 패턴에서 대부분 `deps`를 무시해 핸들러 내 의존성을 mock 불가 | 모든 `*.component.ts` | `(deps) => new XxxHandler(deps)` 패턴 일관 적용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `createHandler: () => new XxxHandler()` 팩토리 패턴 — 핸들러가 stateless임에도 매 실행마다 새 인스턴스 생성 시 GC 압력 | 모든 `*.component.ts` | 핸들러 stateless 여부를 문서화하거나, stateless 확인 시 싱글턴 캐싱 고려 |
| 2 | 문서화 | `chart`만 `inputSchema`/`outputSchema`를 추가로 정의하나 타 노드와 패턴 불일치 — 의도적 차이인지 불명확 | `chart.component.ts`, `chart.schema.ts` | 공식 패턴으로 문서화하거나 점진적으로 다른 노드에도 적용 |
| 3 | 명명 | `chart.component.ts`의 export 이름이 `chartComponent`로 타 노드의 `[type]NodeComponent` 패턴과 불일치 | `chart.component.ts` | `chartNodeComponent`로 통일 |
| 4 | 문서화 | `switchNodePorts.outputs: []`가 의도적 동적 포트인지 미완성인지 코드에서 구분 불가 | `switch.schema.ts:12` | `// outputs are dynamically generated based on cases` 주석 또는 메타데이터 플래그로 명시 |
| 5 | 보안/성능 | `conditionSchema`의 `.passthrough()`로 임의 추가 필드 허용 — 다수 조건 시 불필요한 필드가 메모리에 유지 | `if-else.schema.ts:8-12` | 조건 필드 확정 후 `.strict()` 또는 필요 필드만 명시 |
| 6 | 아키텍처 | `NodeHandler` 인터페이스에 stateless 가정이 명시되지 않아 실수로 stateful 핸들러 등록 시 동시 실행 문제 가능 | `NodeHandler` 인터페이스 | stateless 가정을 인터페이스 문서 또는 구조적 제약으로 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | 테스트 파일 전무, if-else/chart defaultConfig 스키마 위반 무감지 |
| requirement | HIGH | 다수 노드 스키마가 스펙 대비 미구현, switch 출력 포트 누락으로 연결 불가 |
| side_effect | HIGH | if-else/chart defaultConfig가 자체 스키마 위반으로 런타임 ZodError 유발 |
| security | MEDIUM | 입력 검증 전반 부재, operator 허용 목록 없음, dataSource z.unknown() |
| maintainability | MEDIUM | passthrough 남용으로 스키마 계층 타입 안전성 훼손, defaultConfig/스키마 불일치 |
| api_contract | MEDIUM | defaultConfig/스키마 불일치로 런타임 계약 위반, switch 동적 포트 미문서화 |
| architecture | MEDIUM | 스키마-defaultConfig 계약 불일치, if-else component 누락, passthrough 남용 |
| scope | MEDIUM | if-else.component.ts 누락(CRITICAL), if-else/loop/merge/switch 스키마 불일치 |
| documentation | LOW | 스키마-defaultConfig 불일치 미문서화, 색상 하드코딩, 비표준 패턴 주석 부재 |
| dependency | LOW | if-else.component.ts 존재 여부 미확인, passthrough 스키마와 defaultConfig 불일치 |
| performance | LOW | passthrough 빈 스키마 남용, createHandler 매 호출 인스턴스 생성 |
| database | NONE | 해당 사항 없음 |
| concurrency | NONE | 해당 사항 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| database | 리뷰 대상이 순수 스키마/메타데이터 정의 파일로 DB 관련 코드 없음 |
| concurrency | 모든 파일이 불변 정적 선언으로 구성되어 동시성 문제 발생 여지 없음 |

---

## 권장 조치사항

1. **[즉시] `if-else` defaultConfig 수정** — `conditions: []`를 유효한 초기 조건 1개를 포함한 배열로 변경하거나, `conditions` 스키마에서 `.min(1)`을 제거
2. **[즉시] `chart` defaultConfig 수정** — `defaultConfig.xAxis.field: ''`를 `'x'` 등 유효한 값으로 변경하거나, `xAxis.field` 스키마를 `.optional()`로 완화
3. **[즉시] `if-else.component.ts` 존재 여부 확인** — 파일이 없다면 생성, `index.ts`의 re-export 연결 검증
4. **[즉시] `switch` 출력 포트 정의** — 최소 `default` 포트를 정적 정의하고, 케이스 포트 동적 생성 의도를 메타데이터 플래그 또는 주석으로 명시
5. **[높음] 핵심 노드 configSchema 구체화** — `loop(count)`, `merge(strategy/outputFormat/timeout)`, `switch(cases)`, `variable-declaration`, `variable-modification`, `if-else(operator enum)` 순으로 스펙 기반 스키마 정의
6. **[높음] 테스트 작성** — 각 노드의 schema 유효성 + `defaultConfig` 일치 검증 + `NodeComponentRegistry` 통합 테스트 최우선 작성
7. **[높음] `chart` chartType enum 확장** — `donut`, `area` 타입 추가
8. **[중간] Presentation 노드 스키마 구체화** — `form`, `table`, `carousel`, `template`, `pdf` 스펙 기반 Zod 스키마 구현, blocking mode 지원 포함
9. **[중간] `manual_trigger` parameters 스키마 정의** — `TriggerParameterDefinition[]` 구조 반영
10. **[중간] 카테고리 색상 중앙화** — `NODE_CATEGORY_COLORS` 공유 상수 파일 생성 및 모든 schema 파일에서 참조
11. **[낮음] `chart` export 명명 통일** — `chartComponent` → `chartNodeComponent`
12. **[낮음] ExecutionEngine에서 configSchema 검증 수행 확인** — 핸들러 호출 전 `component.configSchema.parse(node.config)` 코드 존재 여부 확인/추가