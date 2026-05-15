## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] 광범위한 `passthrough()` 사용으로 인한 스키마 타입 안전성 훼손**
- 위치: 거의 모든 `.schema.ts` 파일 (loop, map, merge, split, switch, variable-declaration, variable-modification, carousel, form, pdf, table, template, manual-trigger)
- 상세: `z.object({}).passthrough()`로 선언된 스키마는 사실상 어떤 형태의 데이터도 통과시킵니다. 런타임 유효성 검사가 전혀 이루어지지 않아 잘못된 config 데이터가 핸들러까지 전달될 수 있습니다. Zod를 사용하는 의미가 없어집니다.
- 제안: 각 노드의 실제 config 필드를 `z.object({ ... })`로 명시적으로 정의하세요. 미구현 상태라면 `// TODO: define config schema` 주석과 함께 임시임을 명확히 하세요.

---

**[WARNING] `defaultConfig`와 스키마 간 불일치**
- 위치: `loop.schema.ts:27` (`defaultConfig: { count: 1 }`), `merge.schema.ts:18` (`defaultConfig: { strategy: 'wait_all', outputFormat: 'array', timeout: 300 }`)
- 상세: `loopNodeConfigSchema`는 `z.object({}).passthrough()`인데 `defaultConfig`에는 `count: 1`이 있습니다. `mergeNodeConfigSchema`도 마찬가지로 `strategy`, `outputFormat`, `timeout` 필드가 스키마에 없습니다. 스키마와 defaultConfig가 서로 다른 진실을 말하고 있어 어느 것이 정확한지 알 수 없습니다.
- 제안: `defaultConfig`에 있는 필드를 스키마에 반드시 반영하세요. `defaultConfig`는 스키마를 기반으로 도출되어야 합니다.

---

**[WARNING] `ifElseConfigSchema`의 `conditions: z.array(...).min(1)`과 `defaultConfig: { conditions: [] }` 불일치**
- 위치: `if-else.schema.ts:14`, `if-else.schema.ts:35`
- 상세: 스키마는 `conditions`가 최소 1개 이상이어야 한다고 선언하지만, `defaultConfig`는 빈 배열을 기본값으로 사용합니다. 이 기본값으로 생성된 노드는 스키마 검증을 통과하지 못합니다.
- 제안: `defaultConfig`의 `conditions`를 유효한 초기값으로 변경하거나, 스키마의 `.min(1)` 제약을 제거하세요.

---

**[WARNING] 노드 카테고리별 색상 상수 하드코딩 반복**
- 위치: 모든 logic 노드 (`#3B82F6`), 모든 presentation 노드 (`#EC4899`), trigger 노드 (`#F59E0B`)
- 상세: 동일한 hex 색상 값이 10개 이상의 파일에 반복됩니다. 카테고리 색상을 변경할 경우 모든 파일을 수정해야 합니다.
- 제안: 공유 상수 파일에 카테고리별 색상을 정의하세요.

```typescript
// core/node-colors.ts
export const NODE_COLORS = {
  logic: '#3B82F6',
  presentation: '#EC4899',
  trigger: '#F59E0B',
} as const;
```

---

**[INFO] `conditionSchema`의 `operator` 필드 타입이 `z.string()`으로 너무 광범위함**
- 위치: `if-else.schema.ts:8-12`
- 상세: `operator`가 `z.string()`으로 선언되어 있어 유효하지 않은 연산자(`'foobar'`)도 통과합니다. 실제로 허용할 연산자 목록이 있다면 `z.enum`을 사용해야 합니다.
- 제안: `z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', ...])` 형태로 명시하거나, 적어도 스펙 문서에 허용 값을 기록하세요.

---

**[INFO] `chartConfigSchema`의 `buttonDefSchema`가 파일 내에서만 사용되고 export되지 않음**
- 위치: `chart.schema.ts:8-13`
- 상세: `buttonDefSchema`는 로컬 상수로 선언되어 있는데, 다른 노드(form 등)에서도 유사한 버튼 정의가 필요할 경우 재사용할 수 없습니다. 반대로 chart에만 사용된다면 이는 문제가 없습니다. 다만 `chart`가 `buttons`를 가지는 이유가 메타데이터나 스펙과 연결되지 않아 의도가 불명확합니다.
- 제안: `buttons` 필드가 chart의 인터랙션을 위한 것임을 명확히 하거나, 공유 스키마로 분리하세요.

---

**[INFO] `switchNodePorts`의 `outputs: []`가 런타임 동적 생성과의 관계 불명확**
- 위치: `switch.schema.ts:13`
- 상세: Switch 노드는 케이스 수에 따라 출력 포트가 동적으로 결정되어야 할 것으로 보이지만, 스키마에서는 빈 배열로 선언되어 있습니다. 이것이 의도적인 동적 포트 패턴인지 미구현인지 알 수 없습니다.
- 제안: 주석으로 의도를 명시하세요. (`// outputs are dynamically generated based on cases`)

---

### 요약

코드는 일관된 `schema / component / index` 3-파일 패턴을 따르며 구조적 통일성은 우수합니다. 그러나 핵심 문제는 **스키마와 실제 구현 간의 신뢰 격차**입니다. 대부분의 노드 스키마가 `z.object({}).passthrough()`로 선언되어 있어 Zod를 사용하는 타입 안전성의 이점을 전혀 누리지 못하고 있으며, `defaultConfig`에 선언된 실제 필드들과 스키마가 괴리되어 어느 것이 진실인지 파악하기 어렵습니다. 카테고리별 색상 하드코딩 반복도 중장기 유지보수에 부담이 됩니다. 특히 `if-else`의 `conditions.min(1)` vs `defaultConfig: []` 불일치는 즉시 수정이 필요한 버그에 가깝습니다.

### 위험도

**MEDIUM**