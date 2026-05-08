## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] `resolvedConfig` 레퍼런스 공유 — 캐시 오염 잠재 위험**
- 위치: `execution-context.service.ts` `setEngineResolvedConfig` + `execution-engine.service.ts` ~L2474
- 상세: `setEngineResolvedConfig(executionId, node.id, resolvedConfig)`에 `resolvedConfig`를 복사 없이 그대로 전달한다. `engineResolvedConfigCache[nodeId]`는 동일 객체를 참조하게 되므로, 이후 동일 레퍼런스를 변이하는 코드가 추가될 경우 캐시 값이 조용히 오염될 수 있다. 현재 코드에서 `resolvedConfig`는 로컬 변수이고 핸들러 실행 완료 후에야 저장되므로 즉각적인 위험은 없지만, 미래 수정에 대한 안전망이 없다.
- 제안: `context.engineResolvedConfigCache[nodeId] = { ...resolvedConfig }` (shallow copy)로 방어적 복사를 적용. `rawConfig`에 `Object.freeze`를 적용하는 기존 패턴과 일관성을 맞추는 것도 고려.

---

**[WARNING] 캐시 미스 시 원본 raw config로 폴백 — 회귀 잠재 경로**
- 위치: `execution-engine.service.ts` — `runParallel` 및 `runContainerInner` 진입부
  ```ts
  const engineResolvedConfig =
    context.engineResolvedConfigCache?.[parallelNode.id] ??
    parallelNode.config ??   // ← raw config fallback
    {};
  ```
- 상세: `engineResolvedConfigCache`에 해당 노드 항목이 없으면 `parallelNode.config`(raw)로 폴백한다. 정상 순방향 실행에서는 `executeNode` → `setEngineResolvedConfig` → `runParallel/runContainerInner` 순서가 보장되므로 안전하다. 그러나 **resume 경로**, 또는 향후 컨테이너 노드가 캐시 없이 직접 호출되는 경우 수정 이전 NaN/silent-default 버그가 재발한다. `setStructuredOutput`에도 동일한 방어 폴백이 있어 선례는 있지만, 이 경로의 취약성은 주석이나 단언(assert)으로 명시화할 것을 권장한다.
- 제안: 폴백 시 최소 `Logger.warn`을 추가하거나, `if (!engineResolvedConfig || !context.engineResolvedConfigCache?.[node.id])` 경로에서 명시적 경고를 발생시켜 디버그 가시성을 확보.

---

**[WARNING] `setEngineResolvedConfig` 내부의 dead guard**
- 위치: `execution-context.service.ts:50-52`
  ```ts
  if (!context.engineResolvedConfigCache) {
    context.engineResolvedConfigCache = {};
  }
  ```
- 상세: `createContext`에서 항상 `engineResolvedConfigCache: {}`로 초기화하므로 이 guard는 절대 실행되지 않는다. `setStructuredOutput`의 동일 패턴을 따른 것으로 보이지만, 해당 필드는 optional이기 때문에 과거 컨텍스트를 불러올 때 의미가 있다. 단, `engineResolvedConfigCache`는 신규 필드로 레거시 컨텍스트 역직렬화 시나리오(Redis에서 이전 형식의 컨텍스트를 복원)에서는 이 guard가 실제로 필요할 수 있다 — 레거시 컨텍스트 복원 경로가 있다면 오히려 guard를 유지해야 한다.
- 제안: 레거시 Redis 컨텍스트 복원 경로가 없다면 guard를 제거하고, 있다면 주석으로 이유를 명시.

---

**[INFO] `ExecutionContext` 인터페이스 확장 — 하위 호환성**
- 위치: `node-handler.interface.ts` `ExecutionContext`
- 상세: `engineResolvedConfigCache?: Record<...>`로 optional 추가. 기존 `ExecutionContext` 객체를 생성하는 테스트 픽스처 등 모든 코드는 영향 없다. 인터페이스에 `readonly` 또는 `Readonly<>` 수식이 없어 핸들러 코드가 직접 쓸 수 있다. 현재는 `setEngineResolvedConfig` setter 경유가 암묵적 규약이지만, 타입 레벨에서 강제되지 않는다.
- 제안: 필드를 `readonly engineResolvedConfigCache?: Readonly<Record<string, Record<string, unknown>>>` 로 선언하면 핸들러의 직접 변이를 컴파일 시점에 차단 가능. spec 설계 의도(표현식 컨텍스트 미노출)와 부합.

---

**[INFO] `expression-resolver.service.ts` 노출 여부 미확인**
- 위치: `expression-resolver.service.ts` `buildExpressionContext` (diff 외부)
- 상세: spec과 주석 모두 `engineResolvedConfigCache`를 `$node[X]` 표현식 컨텍스트에 노출하지 말 것을 명시하지만, 이를 코드 레벨에서 강제하는 장치가 없다. 표현식 resolver가 `structuredOutputCache`를 `$node` 빌더에 매핑할 때 이 새 캐시를 포함하지 않는지 변경된 diff에서 확인이 불가능하다.
- 제안: `expression-resolver.service.ts`에서 `engineResolvedConfigCache`를 참조하지 않는다는 테스트 케이스 1건 추가 (또는 기존 `$node[X].config` invariant 테스트에 이 불변 조건을 추가로 검증).

---

**[INFO] Loop 테스트의 time-based wait 불일치**
- 위치: `execution-engine.service.spec.ts` — Loop 테스트 `await new Promise((r) => setTimeout(r, 200))`
- 상세: Parallel 테스트는 `await flushPromises()`를 사용하지만 Loop 테스트는 200ms timeout을 사용한다. CI 부하 시 플레이키 가능성이 있다. 기존 패턴 답습이므로 이번 PR의 직접 문제는 아니다.

---

### 요약

이번 변경은 `engineResolvedConfigCache`라는 새 슬롯을 도입하여 raw-echo 채널과 엔진 동작 채널을 명확히 분리한다. 전역 상태 변경, 파일시스템 부작용, 네트워크 호출, 이벤트 발생 등의 의도치 않은 부작용은 없다. 공개 인터페이스(`ExecutionContext`) 변경은 optional 필드 추가로 완전한 하위 호환성을 유지한다. 주요 위험은 두 가지다: (1) `resolvedConfig`가 복사 없이 저장되어 미래 코드 변경 시 캐시 오염이 가능하고, (2) 캐시 미스 시 raw config 폴백이 resume 등 비정상 경로에서 원래 버그를 재발시킬 수 있다. `engineResolvedConfigCache`의 표현식 컨텍스트 미노출 invariant는 코드로 강제되지 않아 향후 실수 가능성이 남아 있다.

### 위험도

**LOW** — 현재 실행 경로에서 즉각적인 부작용 없음. 다만 캐시 레퍼런스 공유 및 폴백 경로의 잠재 위험이 향후 수정 시 표면화될 수 있다.