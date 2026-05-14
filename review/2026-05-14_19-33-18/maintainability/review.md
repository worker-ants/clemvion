### 발견사항

- **[WARNING]** 인라인 dynamic import 타입으로 인한 가독성 저하
  - 위치: `node-handler.interface.ts:122`, `background-execution.queue.ts:32`, `node-component.interface.ts:277`
  - 상세: `conversationThread: import('../../...').ConversationThread` 형태의 인라인 import 타입이 세 군데 사용됨. 최상단 `import type` 문으로 올려야 파일 헤더에서 의존성을 한눈에 파악할 수 있고, IDE 탐색도 쉬워짐. 동일 파일에서 `ExecutionContext` 같은 다른 타입들은 모두 상단에서 import 하는 패턴인데 `ConversationThread` 만 예외.
  - 제안: 순환 의존성이 실제 문제라면 파일 분리 검토. 그렇지 않다면 상단에 `import type { ConversationThread } from '...'` 추가.

- **[WARNING]** `contextScopeN` 기본값 이중 정의
  - 위치: `ai-agent.handler.ts` `injectThreadContext` 내부 (`-Math.max(1, (args.config.contextScopeN as number) ?? 20)`)
  - 상세: `ai-agent.schema.ts`에서 이미 `contextScopeN: z.number().default(20)`으로 스키마 기본값이 정의되어 있음. 스키마 통과 후 들어오는 값에 `?? 20` 을 또 달면 두 곳에서 동일한 상수를 관리해야 함. 값이 바뀌면 두 곳 모두 수정해야 하고, 하나를 놓칠 위험이 있음.
  - 제안: 상수를 `DEFAULT_CONTEXT_SCOPE_N = 20` 으로 추출해 스키마와 핸들러가 같은 상수를 참조하거나, 스키마 기본값에 완전히 위임하고 핸들러의 `?? 20` fallback 제거.

- **[WARNING]** `injectThreadContext` 메서드 길이 및 책임 범위
  - 위치: `ai-agent.handler.ts:350~480` 범위 (약 130줄)
  - 상세: 메서드 하나가 scope 결정 → 범위 슬라이싱 → cap 적용 → `messages` 모드 변환 → `system_text` 모드 변환을 모두 처리함. 특히 `messages` 모드에서 `ConversationTurnSource` 별 ChatMessage 매핑 switch가 메서드 중간에 내포되어 있어 인지 부하가 높음.
  - 제안: `mapTurnsToChatMessages(turns)` 같은 순수함수로 분리하면 테스트와 가독성 모두 개선됨. `injectThreadContext`는 scope/cap/mode 결정만, 실제 변환은 위임.

- **[WARNING]** `makeContext` / `makeExecutionContext` 헬퍼 분산
  - 위치: `ai-agent.thread.spec.ts:23`, `conversation-thread.service.spec.ts:5`, `make-execution-context.ts`
  - 상세: 테스트 파일마다 로컬 `makeContext`를 별도 정의함. `make-execution-context.ts`의 `makeExecutionContext`에 `conversationThread` 기본값이 이번에 추가됐음에도 신규 spec 파일들은 이를 재사용하지 않고 자체 헬퍼를 만들었음. 30개 이상의 기존 테스트 파일도 인라인 객체 리터럴을 사용해 `createEmptyConversationThread()`를 직접 삽입함.
  - 제안: `ExecutionContext`에 필드가 추가될 때마다 수십 개 파일을 수정해야 하는 현재 구조를 개선하려면, 신규 spec 파일이라도 `makeExecutionContext`를 적극 재사용 권장.

- **[INFO]** `DEFAULT_THREAD_ID` 노트가 과도하게 상세
  - 위치: `conversation-thread.types.ts:15~20`
  - 상세: 출력 포트 예약어 `'default'`와 namespace 충돌이 없다는 설명이 5줄에 걸쳐 서술됨. 독자가 직접 확인할 수 있는 자명한 사실이고, 향후 다른 개발자가 불필요한 문맥을 읽어야 함.
  - 제안: 한 줄로 축약: `// v1 single-thread fixed ID. Distinct namespace from output port 'default'.`

- **[INFO]** `stringifyValue` 내 lint 회피 주석
  - 위치: `thread-renderer.ts:67`
  - 상세: `// ... lint 의 base-to-string 검사를 회피` 주석은 구현 의도(JSON 직렬화 실패 시 safe fallback)보다 lint 도구 세부 사항을 서술함. 주석이 미래 독자에게 혼란을 줄 수 있음.
  - 제안: `// JSON serialization with fallback for cycles and non-serializable values.`

- **[INFO]** `buildAiNodeRefFromContext` 내 `v2` 로드맵 언급
  - 위치: `ai-agent.handler.ts` `buildAiNodeRefFromContext` JSDoc
  - 상세: `// v2` 로드맵 언급은 spec Rationale이나 plan 문서에 둘 내용. 코드 주석에 남기면 버전이 출시돼도 갱신되지 않아 stale 주석이 될 위험이 높음.
  - 제안: 주석에서 로드맵 언급 제거, plan/spec에 기록.

---

### 요약

전체적으로 구조 설계는 견고하다. 타입 / 렌더러 / 서비스 / 엔진 통합을 파일 단위로 명확히 분리했고, `ConversationThreadService`가 단일 mutation 진입점으로 역할하며 `appendInternal`에 opt-out·seq·totalChars 갱신을 집중시킨 점은 유지보수성 측면에서 좋은 설계다. 다만 `injectThreadContext`의 단일 메서드 책임 과중, `contextScopeN` 기본값 이중 관리, 인라인 dynamic import 타입 세 군데가 향후 변경 시 잠재적 유지보수 비용으로 남는다. 가장 즉각적인 위험은 테스트 헬퍼 분산으로, `ExecutionContext`에 필드가 추가될 때마다 30개 이상의 파일을 수정해야 하는 구조가 이번에 실제로 발현됐으며 앞으로도 반복될 가능성이 높다.

### 위험도

**LOW**