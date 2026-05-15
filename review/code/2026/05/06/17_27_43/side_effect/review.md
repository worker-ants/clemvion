이제 핵심 코드를 모두 파악했습니다. 리뷰를 작성합니다.

---

## Side Effect Code Review

### 발견사항

---

**[INFO] shallow freeze만 적용 — 중첩 객체는 가변**
- 위치: `execution-engine.service.ts:2327`, `execution-engine.service.ts:1591`
- 상세: `Object.freeze({ ...(node.config ?? {}) })` 는 top-level 프로퍼티만 동결합니다. `node.config`에 배열이나 중첩 객체(`{ fields: [...] }`, `{ options: { ... } }`)가 있으면, 핸들러에서 `ctx.rawConfig.fields[0].name = 'mutated'` 처럼 deep mutation이 여전히 가능합니다. 주석과 테스트는 모두 "top-level mutation 차단"으로 명시하고 있어 의도된 설계이지만, 핸들러 작성자가 "완전한 불변"으로 오해할 여지가 있습니다.
- 제안: 인터페이스 JSDoc에 "shallow freeze" 임을 명시적으로 강조하거나, 실제로 deep-freeze가 필요하다면 재귀 freeze 유틸리티를 도입하는 것을 검토하세요.

---

**[INFO] `resumeState` 직접 변이 — nodeOutputCache 내부 상태 변경**
- 위치: `execution-engine.service.ts:1590-1592`
- 상세: `resumeState`는 `context.nodeOutputCache[node.id]._resumeState`에 대한 참조입니다. `resumeState.rawConfig = Object.freeze(...)` 는 캐시 안에 있는 핸들러 반환 객체를 엔진이 직접 수정하는 부작용입니다. 핸들러가 반환한 `_resumeState`에 `rawConfig` 키가 없는 경우에만 실행되는 가드(`!('rawConfig' in resumeState)`)가 있어 핸들러의 명시적 설정은 보존되지만, 캐시된 객체가 함수 반환 후에 외부에서 수정된다는 점은 비직관적입니다.
- 제안: 현재는 `_resumeState`가 엔진 내부 전용 필드이므로 기능 문제는 없습니다. 다만 주석에 "캐시 내 객체 직접 변이"임을 명확히 기재하면 향후 유지보수 시 혼란을 줄일 수 있습니다.

---

**[INFO] `nodeContext` 이중 스프레드 — 미미한 비효율**
- 위치: `execution-engine.service.ts:2325-2338`
- 상세: `rawConfig` 주입과 `nodeId/nodeExecutionId` 주입이 별도의 스프레드 객체 생성으로 분리되어 있어 두 번의 얕은 복사가 발생합니다. 기능 오류는 없으나, 두 주입을 단일 스프레드로 합치면 불필요한 중간 객체 생성을 방지할 수 있습니다.
- 제안 (옵션):
  ```ts
  nodeContext = {
    ...nodeContext,
    rawConfig: Object.freeze({ ...(node.config ?? {}) }),
    nodeId: node.id,
    nodeExecutionId: nodeExecution.id,
  };
  ```

---

**[INFO] `ExecutionContext.rawConfig` 인터페이스 추가 — 하위 호환 유지됨**
- 위치: `node-handler.interface.ts:48`
- 상세: `rawConfig?: Readonly<Record<string, unknown>>` 는 optional 필드로 추가되었으므로, 기존 핸들러 및 테스트 픽스처가 이 필드를 포함하지 않아도 컴파일 오류가 발생하지 않습니다. 기존 호출자에 대한 breaking change 없음.

---

**[INFO] multi-turn 핸들러의 state rawConfig 복원 시 node.config 시점 의존**
- 위치: `execution-engine.service.ts:1591`
- 상세: `waitForAiConversation` 에서 `node` 객체는 `executeNode` 의 호출 스택에서 받아온 DB 로드 직후의 인스턴스입니다. 이 객체가 DB 로드 이후 엔진의 다른 경로에서 변이되지 않는다는 전제 하에 올바르게 동작합니다. 현재 코드 흐름에서 `node` 는 `subNodeMap.get(id)` 로 조회한 후 변이 없이 전달되므로 실질적 위험은 없습니다.

---

### 요약

이번 변경은 `ExecutionContext`에 `rawConfig` 필드를 선택적으로 추가하고 엔진이 각 핸들러 호출 직전에 원본 config 스냅샷을 주입하는 구조입니다. 인터페이스 변경은 optional 필드 추가라 완전히 하위 호환되며, 기존 핸들러/테스트에 대한 breaking change가 없습니다. 주목할 비의도적 부작용은 `waitForAiConversation`에서 `resumeState` 객체를 캐시 내 직접 변이하는 점이지만, 이는 `_resumeState`가 엔진 내부 전용 필드인 한 실용적 문제가 없습니다. `Object.freeze`가 shallow 적용이라 중첩 구조의 mutation을 막지 못하는 점은 향후 핸들러 작성 시 오해를 낳을 수 있어 문서화 보완을 권장합니다.

### 위험도

**LOW**