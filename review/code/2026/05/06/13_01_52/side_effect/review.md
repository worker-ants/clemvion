세 파일을 분석했습니다.

---

### 발견사항

---

- **[WARNING]** `buildConditionOutput`이 단일 턴 경로에서도 `config.mode: 'multi_turn'`을 하드코딩으로 반환
  - 위치: `handler.ts:1191`
  - 상세: `executeSingleTurn` (line 509)이 `buildConditionOutput`을 호출할 때, 반환 객체의 `config.mode`가 `'multi_turn'`으로 고정됩니다. 실제 단일 턴 조건 라우팅임에도 소비자(워크플로 엔진, 프론트엔드)는 `config.mode === 'multi_turn'`으로 읽게 됩니다. 단일 턴 조건 테스트(`spec.ts:1501~1532`)는 `config.mode`를 검증하지 않아 이 버그가 묵인됩니다.
  - 제안: `buildConditionOutput`에 `mode: 'single_turn' | 'multi_turn'` 파라미터를 추가하거나, 단일 턴용 분기에서 `mode` 값을 호출자가 주입하도록 변경

---

- **[WARNING]** 테스트 내 `process.env.NODE_ENV` 전역 변수 일시적 변경
  - 위치: `spec.ts:591~602`
  - 상세: `process.env.NODE_ENV = 'production'`을 `finally`로 복원하나, 동일 프로세스 내 병렬 실행 또는 비동기 타이밍에서 다른 코드가 `NODE_ENV`를 읽으면 `'production'`을 관측할 수 있습니다. Jest의 단일 파일 내 직렬 실행 덕분에 현재는 안전하지만, 워커 스레드 기반 병렬화 도입 시 취약해집니다.
  - 제안: `jest.replaceProperty(process.env, 'NODE_ENV', 'production')` 또는 `jest.spyOn`을 사용해 격리된 환경 변수 치환

---

- **[INFO]** `conditionToolCalls` 계수 방식이 단일/멀티 턴 간 불일치
  - 위치: `handler.ts:576` (단일 턴 — 미계수) vs `handler.ts:967` (멀티 턴 루프 — `toolCallCount++`)
  - 상세: 단일 턴에서는 조건 도구 호출이 `toolCallCount`에 포함되지 않는다고 주석에 명시됩니다. 그러나 멀티 턴의 혼합(provider + condition) 루프에서는 `toolCallCount++`가 실행됩니다. `maxToolCalls` 한도 도달 타이밍이 모드에 따라 달라져 혼합 시나리오에서 예상과 다른 루프 조기 종료가 발생할 수 있습니다.
  - 제안: 양쪽 경로 모두 동일한 계수 정책을 적용하거나, 불일치를 명시적으로 주석화

---

- **[INFO]** `RagAccumulator.getSources()`가 내부 배열 참조를 직접 반환
  - 위치: `handler.ts:165`
  - 상세: `getSources()`는 `return this.sources`로 내부 배열을 그대로 노출합니다. 반환값이 `_resumeState.ragSources`나 `meta.ragSources`에 직접 할당되어, 호출자가 해당 배열을 변경하면 accumulator 내부 상태가 오염될 수 있습니다. 현재 호출자들이 반환 배열을 변경하지 않아 표면화되지 않지만, 방어적이지 않은 설계입니다.
  - 제안: `return [...this.sources]`로 얕은 복사본을 반환

---

- **[INFO]** `aiAgentNodeOutputSchema`의 평탄(flat) 구조가 실제 핸들러의 중첩(nested) 출력과 불일치
  - 위치: `schema.ts:386~426`
  - 상세: 스키마는 `response`, `interactionType`을 최상위로 정의하지만, 핸들러 실제 출력은 `output.result.response`, `meta.interactionType`에 위치합니다. 주석에 "레거시 자동완성용"으로 명시되어 있으나, 이 스키마를 런타임 검증에 재사용할 경우 실제 값을 찾지 못합니다.
  - 제안: 스키마 주석을 강화하거나, 실제 출력 형태를 반영한 별도 스키마와 이름으로 분리

---

- **[INFO]** `_resumeState`의 `...state` 스프레드가 이전 배열 참조를 공유
  - 위치: `handler.ts:1063`
  - 상세: `...state` 스프레드는 `knowledgeBases`, `conditions` 등의 배열을 참조 복사합니다. 엔진이 반환된 `_resumeState`의 배열을 직접 변경하면 이전 턴 state와 공유 오염이 발생합니다. 현재 엔진이 state를 불변으로 취급하므로 표면화되지 않습니다.
  - 제안: 가변 배열 필드에 한해 얕은 복사 적용 고려

---

### 요약

핵심 부작용은 두 가지입니다. **`buildConditionOutput`가 `config.mode: 'multi_turn'`을 단일 턴 경로에도 하드코딩**하여 출력 계약을 위반하는 것, 그리고 **테스트 내 `process.env.NODE_ENV` 전역 변경**이 병렬 실행 환경에서 취약합니다. 나머지 발견 사항들은 현재 호출 패턴 내에서는 안전하지만, 특히 `getSources()` 내부 참조 노출과 `conditionToolCalls` 계수 불일치는 미래 기능 복원(feature-out 재활성화) 시 예상치 못한 동작을 유발할 수 있습니다. 전반적으로 외부 시스템이나 파일시스템에 대한 의도치 않은 사이드 이펙트는 없으며, 주입된 서비스(LLM, RAG, WebSocket)를 통해 부작용이 잘 격리되어 있습니다.

---

### 위험도

**LOW** — 운영 흐름에 즉각적인 장애를 유발하는 부작용은 없으나, 단일 턴 조건 라우팅의 `config.mode` 오염은 소비자 코드에 조용한 버그를 심을 수 있습니다.