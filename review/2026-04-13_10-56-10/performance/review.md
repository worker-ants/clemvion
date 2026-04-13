## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `loadTriggerParameterSchema` 메서드 중복 구현 및 매 요청마다 DB 조회
- **위치**: `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts`
- **상세**: 세 곳 모두 동일한 `loadTriggerParameterSchema` 로직을 독립적으로 구현하고 있으며, 요청마다 `nodeRepository.findOne()`을 호출해 DB를 조회한다. 단일 워크플로우에서 webhook 처리 → 스케줄 실행 → 수동 실행이 연달아 발생할 경우 동일한 트리거 노드 설정을 반복 조회하게 된다. 워크플로우 트리거 파라미터 스키마는 config가 변경되기 전까지 불변이므로 캐싱 효과가 크다.
- **제안**: `ExecutionEngineModule`에 트리거 파라미터 스키마를 TTL 기반으로 캐싱하는 서비스를 도입하거나, 최소한 세 곳에 산재한 동일 메서드를 단일 공유 서비스(예: `TriggerParameterService`)로 통합하여 향후 캐싱 적용이 용이하도록 구조화한다.

```typescript
// 예: 인메모리 Map 기반 단순 캐시 (TTL 60초)
private readonly schemaCache = new Map<string, { schema: ..., ts: number }>();

private async loadTriggerParameterSchema(workflowId: string) {
  const cached = this.schemaCache.get(workflowId);
  if (cached && Date.now() - cached.ts < 60_000) return cached.schema;
  const schema = await this.nodeRepository.findOne(...);
  this.schemaCache.set(workflowId, { schema, ts: Date.now() });
  return schema;
}
```

---

**[WARNING]** `resolveScheduleParameters`에서 순차적 표현식 평가 후 다시 `resolveTriggerParameters` 호출 — 이중 순회
- **위치**: `schedule-runner.service.ts:resolveScheduleParameters` (약 L44–L90)
- **상세**: `parameterValues`의 각 키에 대해 `resolveLimitedExpression`으로 한 번 순회(O(n))한 뒤, `resolveTriggerParameters` 내부에서 스키마 배열을 다시 순회(O(m))한다. 스케줄 파라미터 수(n)와 스키마 파라미터 수(m)는 동일 집합인 경우가 대부분이므로 실질적으로 O(2n) 순회가 발생한다. 데이터 규모가 작아 즉각적 문제는 아니지만, 불필요하게 두 번 객체를 생성한다(`resolvedRaw` → `resolved`).
- **제안**: `resolveTriggerParameters` 내부에 `valueTransformer?: (value: unknown) => unknown` 옵션을 추가해 표현식 평가를 통합하거나, 최소한 현재 구조를 주석으로 명시하여 의도를 분명히 한다.

---

**[WARNING]** `WorkflowsController`에 `@InjectRepository(Node)` 직접 주입 — 레이어 경계 위반 및 성능 제어 불가
- **위치**: `workflows.controller.ts:38`
- **상세**: 컨트롤러가 Repository를 직접 주입받아 DB 쿼리를 수행한다. 이는 레이어 분리 위반이기도 하지만, 성능 관점에서 쿼리 최적화(인덱스 힌트, select 컬럼 제한, 캐싱)를 컨트롤러 레벨에서 제어하기 어렵게 만든다. 또한 `WorkflowsModule`의 TypeORM feature 등록에 `Node` 엔티티가 추가되어 있는지 확인이 필요하다(누락 시 런타임 오류).
- **제안**: `WorkflowsService` 또는 공유 `TriggerParameterService`로 해당 로직을 이동한다.

---

**[INFO]** `$params` 컨텍스트 빌드 시 불필요한 타입 가드 중복
- **위치**: `expression-resolver.service.ts:67–78`
- **상세**: `inputObject`가 이미 `Record<string, unknown>`으로 캐스팅된 후, `typeof inputObject === 'object'` 체크를 다시 수행한다. 위에서 `(nodeInput ?? {}) as Record<string, unknown>`으로 할당했으므로 항상 객체임이 보장되어 중복 검사다.
- **제안**: `inputObject.parameters`의 존재 여부와 배열 여부만 확인하면 충분하다.

```typescript
const paramsFromInput =
  inputObject.parameters !== null &&
  typeof inputObject.parameters === 'object' &&
  !Array.isArray(inputObject.parameters)
    ? (inputObject.parameters as Record<string, unknown>)
    : {};
```

---

**[INFO]** `ManualTriggerHandler.execute`에서 스프레드 연산자로 불필요한 객체 복사
- **위치**: `manual-trigger.handler.ts:55–65`
- **상세**: `typedInput ?? {}`를 구조 분해하여 `rest`를 만들고, `{ parameters: resolvedParameters, ...rest }`로 새 객체를 생성한다. `typedInput`이 이미 `{ parameters, ...siblings }` 구조임을 알고 있으므로, 입력이 크거나 중첩이 깊은 경우 불필요한 얕은 복사가 발생한다. 이 핸들러는 트리거 노드이므로 실제 payload가 클 수 있다(webhook body).
- **제안**: 성능에 민감한 경우 복사 없이 직접 속성을 지정하거나, `Object.assign`으로 처리한다. 단, 현재 규모에서는 LOW 우선순위.

---

**[INFO]** 프론트엔드 Schedule 폼의 JSON 파싱을 submit 시에만 수행
- **위치**: `schedules/page.tsx:625–638`
- **상세**: `formParameterValuesJson`을 submit 시점에 `JSON.parse`하는 현재 방식은 적절하다. 단, `textarea` `onChange`에서 `setParameterValuesError(null)`만 호출하고 파싱 검증을 하지 않아, 사용자가 잘못된 JSON을 입력한 상태로 오랫동안 인지하지 못할 수 있다. 성능 이슈는 아니지만 UX 관점에서 디바운스된 유효성 검사를 고려할 수 있다.
- **제안**: `onChange`에서 debounce(300ms) 후 JSON 파싱 시도하여 `parameterValuesError`를 즉시 노출한다.

---

### 요약

이번 변경은 Manual Trigger 파라미터 스키마 기능을 Webhook, Schedule, 수동 실행 세 진입점에 걸쳐 일관되게 구현한 것으로, 알고리즘적 복잡도는 O(n) 수준으로 적절하다. 가장 주목할 성능 리스크는 `loadTriggerParameterSchema`가 세 곳에 중복 구현되어 매 요청마다 DB를 조회한다는 점이다. 특히 Webhook처럼 고빈도 진입점에서 동일한 워크플로우 트리거 설정을 반복 조회하면 불필요한 DB 부하가 발생할 수 있다. 나머지 이슈(이중 순회, 중복 타입 가드, 컨트롤러 직접 Repository 주입)는 현재 데이터 규모에서 즉각적인 성능 병목은 아니지만 코드 구조 개선과 함께 해결되면 유지보수성과 성능 제어 용이성이 향상된다.

### 위험도

**MEDIUM**