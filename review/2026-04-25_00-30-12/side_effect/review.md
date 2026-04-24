## 발견사항

---

### File 1: `anthropic.client.ts`

- **[WARNING]** `({ type: 'none' } as never)` TypeScript 강제 캐스팅
  - 위치: `chat()` / `stream()` 각각, `toolChoice === 'none'` 분기의 `base` 변수
  - 상세: `as never`는 TypeScript 타입 체커를 완전히 우회한다. 현재 SDK 버전에서 `tool_choice.type`이 `'none'`을 지원하지 않거나, 추후 SDK가 해당 유니언에서 `'none'`을 제거하면 빌드 타임 경고 없이 런타임 오류(API 400)가 발생한다. 그런데 `toolChoice === 'none'`이면 `if (params.toolChoice !== 'none')` 분기가 실행되지 않으므로 `disable_parallel_tool_use`가 붙지 않는 `base` 그대로 `requestParams.tool_choice`에 할당된다. `as never`의 실제 영향은 `base = { type: 'none' }` 대입에 그치며, 이 값은 tools 배열이 비어있지 않을 때만 세팅된다.
  - 제안: `as { type: 'none' }` 또는 `as Anthropic.ToolChoiceNone` 등 정확한 타입으로 교체. `as never`는 "이 코드는 절대 실행되지 않는다"는 의미로 사용되는 관용구라 의도와 불일치한다.

- **[WARNING]** `disable_parallel_tool_use: false` 전역 행동 변경
  - 위치: `chat()` 및 `stream()` 양쪽, tools 있을 때의 `requestParams.tool_choice`
  - 상세: 이 클라이언트를 통한 모든 툴 호출이 강제로 병렬 허용 상태가 된다. 주석에서 의도는 명확히 설명되어 있으나, 만약 다른 컨텍스트(예: 순차 실행이 필수인 특정 워크플로우)에서 이 클라이언트를 재사용할 경우 조용히 행동이 달라진다.
  - 제안: `ChatParams`에 `disableParallelToolUse?: boolean` 옵션을 추가해 호출자가 오버라이드할 수 있도록 하거나, 클래스 JSDoc에 이 기본값을 명시한다.

- **[INFO]** `chat()` / `stream()` 메시지 변환 로직 중복
  - 위치: 두 메서드의 `messages` 변환 `.map()` 블록 (assistant role, tool role 처리)
  - 상세: 완전히 동일한 코드가 두 곳에 분산되어 있다. 한 쪽을 수정하고 다른 쪽을 빠뜨리면 streaming/non-streaming 경로의 메시지 변환 결과가 달라지는 silent regression이 발생한다.
  - 제안: `private buildMessages(params: ChatParams)` 헬퍼로 추출.

- **[INFO]** `testConnection()`에 하드코딩된 모델 ID
  - 위치: `testConnection()`, fallback `'claude-haiku-4-5-20251001'`
  - 상세: 이 모델이 deprecate되면 커넥션 테스트가 항상 실패해 다른 모든 모델 설정도 사용 불가 판정을 받는다.
  - 제안: 상수로 분리하거나 `this.defaultModel` fallback을 사용.

---

### File 3: `system-prompt.ts`

- **[WARNING]** `resetExpressionCacheForTesting` 프로덕션 모듈에서 export
  - 위치: 파일 상단 named export
  - 상세: 이 함수는 모듈 스코프의 `expressionReferenceCache`를 `null`로 변경한다. 프로덕션 코드에서 임포트해 호출하면 이후 모든 `buildSystemPrompt()` 첫 호출마다 `getAllFunctionNames()`를 재실행해 불필요한 CPU 비용이 발생한다. 문서화는 되어 있으나 런타임 가드가 없다.
  - 제안: `if (process.env.NODE_ENV !== 'test') throw new Error(...)` 가드 추가, 또는 별도 test-utilities 파일로 이동 후 소스에서 분리.

- **[INFO]** `JSON.stringify(toWorkflowView(snapshot))` 예외 미처리
  - 위치: `buildSystemPrompt()` 함수 내 `snapshotJson` 할당
  - 상세: `toWorkflowView`가 순환 참조나 직렬화 불가 값을 포함하면 `JSON.stringify`가 예외를 던지고 전체 프롬프트 생성이 실패한다. 이 함수는 매 턴 호출되므로 특정 스냅샷 상태에서 어시스턴트 전체가 사용 불가해질 수 있다.
  - 제안: try-catch로 감싸고 오류 발생 시 `"(snapshot serialization failed)"` 같은 fallback 문자열로 대체.

- **[INFO]** 모듈 스코프 가변 캐시 (`expressionReferenceCache`)
  - 위치: `let expressionReferenceCache: string | null = null;`
  - 상세: 의도적 설계이며 Node.js 단일 스레드 특성상 race condition 위험 없음. Jest가 모듈을 공유할 때 spec 파일의 `resetExpressionCacheForTesting` 호출이 누락되면 다른 테스트 suite에 영향을 줄 수 있다. 현재 spec 파일은 이를 올바르게 사용 중.

---

### File 4: `tool-definitions.ts`

- **[INFO]** `Object.freeze` 얕은 동결
  - 위치: `ASSISTANT_TOOLS` 선언
  - 상세: 배열 자체는 동결되지만 내부 툴 정의 객체(`parameters.properties` 등)는 변경 가능하다. `buildAssistantTools()` 소비자가 반환된 객체를 직접 수정하면 공유 상태가 오염된다.
  - 제안: 현재 소비자 패턴에서는 문제 없을 가능성이 크나, 필요 시 `structuredClone` 후 반환하도록 변경.

---

### File 2 & 5: Spec 파일

- **[INFO]** `MockDeps` 인터페이스에 `candidateLookup` 누락
  - 위치: `workflow-assistant-stream.service.spec.ts`, `makeService()` 반환값
  - 상세: `candidateLookup`이 `mocks` 객체에 병합되어 반환되지만 `MockDeps` 타입에는 정의되어 있지 않아 타입 추론이 깨진다. 테스트 케이스에서 `mocks.candidateLookup.mockImplementation(...)` 호출 시 TypeScript 오류.
  - 제안: `MockDeps`에 `candidateLookup: { fillCandidates: jest.Mock }` 추가.

---

## 요약

전반적으로 코드는 의도가 명확하고 구조화되어 있으나, 두 가지 주목할 부작용이 있다. 첫째, `anthropic.client.ts`의 `as never` 캐스팅은 타입 안전성을 침묵시켜 API 계약 변경 시 런타임 에러가 빌드 타임에 포착되지 않는다. 둘째, `resetExpressionCacheForTesting`이 프로덕션 모듈에서 export되어 프로덕션 경로에서 호출될 경우 모든 후속 시스템 프롬프트 생성에 불필요한 재연산을 유발한다. `disable_parallel_tool_use: false` 강제 적용은 의도된 행동 변경으로 주석에 근거가 있지만, 클라이언트 재사용 시 예기치 않은 side effect가 될 수 있다. 나머지는 중복 코드 및 타입 표기 수준의 사소한 문제다.

## 위험도

**LOW**