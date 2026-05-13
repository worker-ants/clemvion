### 발견사항

---

**[WARNING] `listAllCafe24Operations()` — 정적 데이터를 매 호출마다 재할당**
- 위치: `backend/src/nodes/integration/cafe24/metadata/index.ts` — `listAllCafe24Operations()`
- 상세: 약 80~100개의 operation 항목을 매 호출마다 새 배열로 flatten. `Cafe24McpToolProvider.buildTools`가 실행 단위(execution)마다 이를 호출하면, AI Agent가 실행될 때마다 불필요한 heap 할당 + GC 압력이 발생. 데이터가 완전히 정적(모듈 초기화 시 확정)이므로 캐싱이 적합.
- 제안: 모듈 최상위에서 한 번 계산하고 상수로 내보내거나 `let cached`로 lazy-init.

```ts
// 변경 전 (매 호출마다 새 배열)
export function listAllCafe24Operations(): Array<...> { ... }

// 변경 후
const _allOps: Array<{ resource: Cafe24Resource; operation: Cafe24OperationMetadata }> = (() => {
  const out = [];
  for (const [resource, ops] of Object.entries(CAFE24_OPERATIONS_BY_RESOURCE)) {
    for (const op of ops) out.push({ resource: resource as Cafe24Resource, operation: op });
  }
  return out;
})();
export function listAllCafe24Operations() { return _allOps; }
```

---

**[WARNING] `findCafe24Operation()` — 매 tool 실행마다 선형 탐색**
- 위치: `backend/src/nodes/integration/cafe24/metadata/index.ts` — `findCafe24Operation()`
- 상세: `ops.find(op => op.id === operationId)`는 O(M). AI Agent가 tool 1개를 실행할 때마다 호출되는 경로에 있으므로, 호출 빈도가 높다. 18개 리소스 × 평균 5개 operation ≒ 90개 항목이므로 현재는 미미하지만, `buildTools`에서 등록한 sid-to-integration 맵과 별개로 operation 해석도 같은 경로를 탄다면 중복 비용이 누적.
- 제안: 모듈 초기화 시 `Map<string, Map<string, Cafe24OperationMetadata>>` (resource → operationId → metadata) 또는 `Map<string, Cafe24OperationMetadata>` (`${resource}:${id}`)로 O(1) 조회 구조 사전 구축.

```ts
const _opIndex = new Map<string, Cafe24OperationMetadata>();
for (const [resource, ops] of Object.entries(CAFE24_OPERATIONS_BY_RESOURCE)) {
  for (const op of ops) _opIndex.set(`${resource}:${op.id}`, op);
}
export function findCafe24Operation(resource: string, operationId: string) {
  return _opIndex.get(`${resource}:${operationId}`);
}
```

---

**[WARNING] `Cafe24ApiClient` 모듈-레벨 lock Map — 메모리 누수 위험**
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (파일 19, diff 생략)
- 상세: `__resetCafe24LocksForTesting` export가 존재한다는 것은 모듈 레벨의 mutable Map(`integrationId → Promise` 형태 추정)이 있음을 암시. 토큰 갱신 완료 후 해당 엔트리가 삭제되지 않으면 `integrationId`가 계속 누적. 싱글턴 서비스이므로 프로세스 수명 동안 Map이 계속 증가.
- 제안: token refresh Promise가 resolve/reject된 뒤 반드시 `locks.delete(integrationId)`. `.finally(() => locks.delete(integrationId))` 패턴으로 정리.

---

**[WARNING] `Cafe24Config` fields 상태 타입 불일치 → 불필요한 리렌더 및 잠재적 런타임 오류**
- 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:248,262`
- 상세: `config.fields`를 `Array<{ key, value }>` 로 읽지만(`const fields = (config.fields as Array<...>) ?? []`), `onChange`에서는 `Record<string, string>` 객체로 저장. 최초 변경 이후 `config.fields`가 객체이므로 `(config.fields as Array<...>)` 캐스팅이 빈 배열이 아닌 객체를 반환하여 `fields.map(...)` 호출 시 런타임 TypeError 가능. UI가 매번 빈 배열로 폴백되면 KeyValueEditor가 모든 항목을 잃고 재렌더.
- 제안: `onChange`에서도 배열 형태를 유지하고 핸들러 내부에서 객체로 변환하거나, 읽을 때 `Object.entries`로 객체→배열 변환.

```tsx
// 읽기 시 정규화
const fields: Array<{ key: string; value: string }> = 
  Array.isArray(config.fields)
    ? config.fields
    : Object.entries(config.fields ?? {}).map(([key, value]) => ({ key, value: String(value) }));
```

---

**[INFO] `mcp-server-selector.tsx` — 매 렌더마다 `available.filter()` 2회 호출**
- 위치: `frontend/src/components/integrations/mcp-server-selector.tsx:186`
- 상세: `available.filter(i => i.serviceType === 'mcp')`, `available.filter(i => i.serviceType === 'cafe24')` 가 `.map()` 렌더 콜백 안에서 매 렌더마다 실행. `available` 리스트가 `MCP_LIST_LIMIT`으로 제한되어 현재는 무해하지만, 리스트가 커지거나 부모 컴포넌트 리렌더가 잦으면 낭비.
- 제안: `useMemo`로 그루핑 결과를 메모화.

```tsx
const grouped = useMemo(() => ({
  mcp: available.filter(i => i.serviceType === 'mcp'),
  cafe24: available.filter(i => i.serviceType === 'cafe24'),
}), [available]);
```

---

**[INFO] `lookupMcpServers` — 매 호출마다 배열 리터럴 생성**
- 위치: `backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:161`
- 상세: `serviceType: ['mcp', 'cafe24']`가 함수 호출마다 새 배열 인스턴스를 생성. 호출 빈도가 낮아 영향은 미미하나 상수로 분리하는 것이 의도를 명확히 함.
- 제안: `const MCP_CAPABLE_TYPES = ['mcp', 'cafe24'] as const` 를 모듈 상단에 선언.

---

**[INFO] `new/page.tsx` — validation마다 정규식 재컴파일**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx:233`
- 상세: `/^[a-z0-9-]{3,50}$/` 정규식이 `validate()` 함수 내부에서 매 호출마다 생성. 폼 submit 경로라 빈도가 낮아 실질 영향은 없지만.
- 제안: 모듈 상단에 `const MALL_ID_RE = /^[a-z0-9-]{3,50}$/` 로 추출.

---

### 요약

전반적으로 성능 설계는 양호하다. 싱글턴 `Cafe24ApiClient`, 모듈 상수로 분리된 메타데이터, 쿼리 결과에 `staleTime`을 지정한 프런트엔드 캐싱 전략 모두 적절하다. 그러나 **정적인 operation 메타데이터를 반복 조회 시마다 재탐색·재할당하는 구조**(`listAllCafe24Operations`, `findCafe24Operation`)가 AI Agent 실행 경로에 존재하여 불필요한 GC 압력과 선형 탐색 비용이 누적될 수 있다. 가장 즉각적인 위험은 `Cafe24ApiClient`의 모듈-레벨 lock Map 미정리로 인한 메모리 누수와, `Cafe24Config`의 `fields` 타입 불일치로 인한 UI 상태 붕괴다. 두 항목은 hot path이거나 가시적 버그로 이어지므로 우선 수정을 권장한다.

### 위험도

**MEDIUM**