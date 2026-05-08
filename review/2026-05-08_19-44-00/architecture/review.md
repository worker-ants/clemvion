### 발견사항

---

**[WARNING] `engineResolvedConfigCache`가 핸들러 공개 인터페이스에 노출됨 — ISP 위반**
- 위치: `node-handler.interface.ts` — `ExecutionContext.engineResolvedConfigCache`
- 상세: `ExecutionContext`는 `NodeHandler.execute(input, config, context)`를 통해 모든 핸들러에 전달되는 공개 계약이다. `engineResolvedConfigCache`는 JSDoc에 "NOT exposed to expression context", "engine paths only"라고 명시되어 있지만, 타입 시스템 수준에서는 핸들러가 이 필드를 읽거나 쓰는 것을 막을 수 없다. 엔진 내부 캐시가 핸들러-엔진 경계에 노출되어 인터페이스 분리 원칙을 위반한다.
- 제안: 두 가지 대안. ① `EngineContext`를 `ExecutionContext`와 분리하여 engine-only 필드를 별도 타입으로 관리하고 `execution-engine.service.ts` 내부에서만 사용. ② 혹은 현재 구조를 유지하되 `engineResolvedConfigCache`를 `ExecutionContext`에서 제거하고 `ExecutionContextService`에 `getEngineResolvedConfig(executionId, nodeId)` reader 메서드를 추가해 engine path가 서비스를 통해 접근하게 한다 (핸들러는 컨텍스트에서 직접 접근 불가).

---

**[WARNING] fallback 체인 로직이 두 caller에 중복 — 버그 은폐 위험**
- 위치: `execution-engine.service.ts` — `runParallel` 진입부, `runContainerInner` 진입부
- 상세: 두 곳 모두 동일한 패턴을 직접 구현한다.
  ```typescript
  const engineResolvedConfig =
    context.engineResolvedConfigCache?.[node.id] ??
    node.config ??
    {};
  ```
  `node.config` fallback은 "캐시 미스 시 원본으로 후퇴"처럼 보이지만, `engineResolvedConfigCache`는 `executeNode`에서 항상 설정된다. 이 fallback이 실제로 실행된다면 캐시 write가 누락된 버그를 조용히 숨긴다. 중복 자체도 향후 fallback 정책 변경 시 한 곳을 빠뜨릴 위험이 있다.
- 제안: `ExecutionContextService`에 `getEngineResolvedConfig(executionId, nodeId, fallback?: Record<string, unknown>)` 메서드를 추가해 fallback 정책을 한 곳에서 관리. 또는 캐시 미스를 `throw`로 처리해 silent fallback을 제거하고 버그를 즉시 노출.

---

**[INFO] `setEngineResolvedConfig` 내 방어적 null 체크가 불필요**
- 위치: `execution-context.service.ts:53–55`
- 상세:
  ```typescript
  if (!context.engineResolvedConfigCache) {
    context.engineResolvedConfigCache = {};
  }
  ```
  `createContext`에서 항상 `engineResolvedConfigCache: {}`로 초기화하므로 이 가드는 실행되지 않는다. `setStructuredOutput`의 동일 패턴을 그대로 복사한 것으로 보인다. 코드 자체는 무해하지만, "이 필드가 없을 수도 있다"는 오해를 유발한다.
- 제안: 두 메서드에서 모두 제거. 또는 `ExecutionContext` 타입에서 `engineResolvedConfigCache`를 optional(`?`)이 아닌 required로 변경해 타입 수준에서 보장.

---

**[INFO] `ExecutionContext` 인터페이스 비대화 — God Object 경향**
- 위치: `node-handler.interface.ts` — `ExecutionContext`
- 상세: 이번 변경으로 `ExecutionContext`는 execution identity, variables, output cache (2종), engine-resolved config cache, loop/item context, expression context, resume state, recursion depth, sub-workflow state 등 8개 이상의 서로 다른 관심사를 담게 됐다. 현 Phase에서는 관리 가능한 수준이지만, 필드가 추가될수록 핸들러-엔진-컨텍스트 경계가 흐려진다.
- 제안: 장기적으로 `ExecutionContext`를 관심사별 서브객체(예: `context.cache`, `context.iterState`, `context.engine`)로 구조화하는 것을 검토. 현 시점은 필수 대응 아님.

---

### 요약

이번 변경은 "echo 채널(raw)과 엔진 동작 채널(evaluated)의 분리"라는 핵심 아이디어가 명확하고, `coerce-container-param.ts`는 단일 책임이 명확한 잘 설계된 유틸리티다. 변경 범위도 계획대로 최소화되어 있다. 주요 아키텍처 리스크는 엔진 내부 캐시(`engineResolvedConfigCache`)가 핸들러에 직접 노출된다는 점으로, 현재는 컨벤션으로만 통제되고 타입 경계가 없다. 두 caller에 중복된 fallback 체인은 정책 변경 시 불일치 버그를 유발할 수 있으므로 중앙화를 권장한다.

### 위험도

**LOW** — 버그 수정 방향은 올바르고 동작 안전성은 높다. 식별된 이슈는 현재 기능을 손상시키지 않으나, 인터페이스 경계 설계(`engineResolvedConfigCache` 노출)는 향후 핸들러 코드가 늘어날수록 의도치 않은 오용 가능성이 증가한다.