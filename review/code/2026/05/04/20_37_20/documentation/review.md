### 발견사항

---

**[WARNING]** `warnSpy`가 설정되었으나 경고 발생 자체를 어설트하지 않음
- 위치: `use-execution-events.test.ts`, "ai_message ignores payloads missing the messages snapshot" 테스트
- 상세: 테스트 주석은 "silently dropped (with a dev-only warning)"라고 명시하고 있으나, `warnSpy`는 콘솔 출력을 억제하는 용도로만 사용되고 있습니다. 경고가 실제로 발생했는지 검증하는 어설션이 없어 문서화된 동작(dev-only warning)이 깨져도 테스트가 통과합니다.
- 제안:
  ```ts
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining("[ws] execution.ai_message without messages snapshot"),
    expect.anything(),
  );
  ```

---

**[WARNING]** 3개 파일에 걸친 스펙 참조(`spec/5-system/6-websocket-protocol.md §4.4`)의 정합성 미검증
- 위치: `execution-engine.service.spec.ts` describe 블록 주석, `use-execution-events.test.ts` 테스트 주석, `use-execution-events.ts` `handleAiMessage` 주석
- 상세: 동일한 스펙 섹션 번호가 세 곳에 일관되게 참조되는 것은 좋은 관행입니다. 그러나 해당 파일이나 섹션이 존재하지 않거나 번호가 변경되면 세 군데가 동시에 stale reference가 됩니다. 또한 스펙 문서가 실제로 `llmCalls` 배열 포함 의무와 `requestPayload`/`responsePayload` 제거를 명시하고 있는지 외부에서 확인할 방법이 없습니다.
- 제안: `spec/5-system/6-websocket-protocol.md`가 실제로 존재하고 §4.4가 이번 변경 내용을 반영하고 있는지 확인. 스펙이 없다면 `spec/` 경로에 해당 문서를 생성하거나 기존 문서에 섹션을 추가할 것을 권장합니다.

---

**[INFO]** `handleAiMessage` 페이로드 타입에서 제거된 flat 필드에 대한 마이그레이션 주석 없음
- 위치: `use-execution-events.ts`, `handleAiMessage` 내부 타입 정의
- 상세: `requestPayload?: unknown`과 `responsePayload?: unknown`이 타입 정의에서 제거되었습니다. 이 제거는 프로토콜 계약 변경이지만 제거 이유를 설명하는 주석이 없어 후속 개발자가 해당 필드가 실수로 누락됐다고 오해할 수 있습니다.
- 제안: `llmCalls` 배열 위에 짧은 주석 추가:
  ```ts
  // requestPayload / responsePayload: 제거됨 — llmCalls 배열로 통합 (§4.4)
  llmCalls?: Array<{ ... }>;
  ```

---

**[INFO]** `makeAiAgentHandler` 팩토리 함수에 역할 설명 없음
- 위치: `execution-engine.service.spec.ts`, `makeAiAgentHandler` 함수
- 상세: `processReturn` 파라미터가 무엇을 제어하는지(즉, `processMultiTurnMessage`의 반환값 팩토리임) 명시적인 설명이 없습니다. 테스트 파일이므로 공식 JSDoc 수준은 불필요하지만, 두 개의 서로 다른 테스트 케이스가 이 함수를 공유하기 때문에 한 줄 설명이 있으면 가독성이 높아집니다.
- 제안:
  ```ts
  // processReturn: processMultiTurnMessage가 resolve할 값을 반환하는 팩토리
  function makeAiAgentHandler(processReturn: () => unknown): ...
  ```

---

**[INFO]** legacy fallback 제거에 대한 CHANGELOG 미확인
- 위치: `use-execution-events.ts` 전체 변경
- 상세: `addConversationMessage` 기반의 legacy single-append 경로 제거는 `messages` 스냅샷 없는 페이로드를 무시하는 동작 변경입니다. 프로젝트가 CHANGELOG를 관리한다면 이번 변경이 누락되어 있을 가능성이 있습니다.
- 제안: 프로젝트 루트의 CHANGELOG 또는 릴리즈 노트에 "execution.ai_message: messages 스냅샷 없는 페이로드의 legacy fallback 제거" 항목 추가.

---

### 요약

전반적인 문서화 품질은 양호합니다. 특히 `spec/5-system/6-websocket-protocol.md §4.4` 참조가 구현·테스트·스펙 세 레이어에 일관되게 기재되어 있고, describe 블록 주석이 "왜 이 테스트가 존재하는가"를 명확히 설명하는 점은 좋은 관행입니다. 주요 리스크는 두 가지입니다: `warnSpy` 어설션 누락으로 인해 문서화된 경고 동작이 검증되지 않는 점, 그리고 스펙 참조가 실제 `spec/` 파일의 내용과 정합한지 외부에서 확인할 수 없다는 점입니다.

### 위험도

**LOW**