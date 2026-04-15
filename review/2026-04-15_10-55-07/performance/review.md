### 발견사항

- **[INFO]** `listDefinitions()` 호출마다 `z.toJSONSchema()` 재계산
  - 위치: `node-component.registry.ts` — `listDefinitions()` 메서드
  - 상세: `GET /api/v1/nodes/definitions` 요청마다 등록된 모든 컴포넌트(현재 28개)의 Zod 스키마를 JSON Schema로 변환합니다. `z.toJSONSchema()`는 Zod 스키마 트리를 순회하는 비교적 무거운 연산이며, 스키마는 런타임 중 변경되지 않으므로 불필요한 반복 연산입니다.
  - 제안: `bootstrap()` 완료 시 또는 `listDefinitions()` 최초 호출 시 한 번만 직렬화하여 `private readonly definitionsCache: NodeDefinitionView[]` 에 저장하고 이후 호출은 캐시를 반환합니다.

```typescript
// node-component.registry.ts
private definitionsCache: NodeDefinitionView[] | null = null;

listDefinitions(): NodeDefinitionView[] {
  if (!this.definitionsCache) {
    this.definitionsCache = [...this.components.values()].map((c) => ({
      metadata: c.metadata,
      ports: c.ports,
      configSchema: z.toJSONSchema(c.configSchema),
      inputSchema: c.inputSchema ? z.toJSONSchema(c.inputSchema) : undefined,
      outputSchema: c.outputSchema ? z.toJSONSchema(c.outputSchema) : undefined,
    }));
  }
  return this.definitionsCache;
}
```

---

- **[INFO]** `listMetadata()`와 `listDefinitions()` 모두 `[...this.components.values()]` 스프레드로 전체 복사
  - 위치: `node-component.registry.ts` — `listMetadata()`, `listDefinitions()`
  - 상세: Map을 iterator로 직접 순회할 수 있음에도 Array로 스프레드 후 `map()`을 호출합니다. 현재 노드 수(28개)에서는 무시할 수준이나 커스텀 노드가 추가되면 불필요한 임시 배열을 생성합니다. 위 캐싱 제안 적용 시 자연히 해소됩니다.

---

- **[INFO]** `forwardRef` 순환 의존성으로 인한 초기화 비용
  - 위치: `nodes.module.ts` — `forwardRef(() => ExecutionEngineModule)`
  - 상세: `NodesModule`이 `ExecutionEngineModule`을, `ExecutionEngineModule`이 `NodesModule`의 엔티티를 참조하는 순환 구조입니다. 기능상 문제는 없으나 순환 참조는 NestJS 모듈 초기화 순서를 복잡하게 만들어 부팅 시 추가 해석 비용이 발생합니다. `NodeComponentRegistry`를 별도의 `NodeCoreModule`로 분리하면 순환 의존을 제거할 수 있습니다.

---

- **[INFO]** `bootstrap()` 중복 등록 감지 비용
  - 위치: `node-component.registry.ts` — `bootstrap()` 내 `this.components.has(type)`
  - 상세: Map을 사용하므로 `has()` + `set()` 모두 O(1)입니다. 현재 구현은 적절합니다.

---

- **[INFO]** `ALL_NODE_COMPONENTS` 모듈 로드 시 전체 임포트
  - 위치: `nodes/index.ts`
  - 상세: 28개 노드 컴포넌트 파일을 모두 정적 import합니다. 현재 규모에서는 무방하나 핸들러 클래스들도 함께 메모리에 올라갑니다. 추후 노드 수가 수백 개로 확장될 경우 동적 import(`import()`) 기반 lazy loading을 고려할 수 있습니다. 현 규모에서는 조치 불필요합니다.

---

### 요약

이번 변경은 핸들러 등록 방식을 명시적 배열에서 컴포넌트 레지스트리 패턴으로 전환한 아키텍처 리팩토링입니다. 성능 관점에서 전반적으로 양호하며 심각한 문제는 없습니다. 가장 실질적인 개선 포인트는 `listDefinitions()`의 결과 캐싱으로, Zod → JSON Schema 직렬화를 요청마다 반복하지 않도록 `bootstrap()` 이후 한 번만 수행하는 것이 권장됩니다. 나머지 사항들은 현재 노드 수(28개) 기준으로는 무시할 수 있는 수준의 INFO 등급입니다.

### 위험도
**LOW**