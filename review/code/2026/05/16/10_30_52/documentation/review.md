# 문서화(Documentation) 리뷰

## 발견사항

### 1. 독스트링/JSDoc

- **[INFO]** `withSourceMarker` 함수에 JSDoc 독스트링이 잘 작성됨
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` +89~+95
  - 상세: 함수 목적, 동작 방식, spec 참조(`spec/5-system/6-websocket-protocol.md §4.4.6`)까지 명확히 기술되어 있음. 모범적인 수준.
  - 제안: 현 상태 유지.

- **[INFO]** `buildConversationConfigFromOutput` 기존 JSDoc이 변경 내용을 반영해 적절히 갱신됨
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` +106~+112
  - 상세: 기존 "System messages are filtered out" 문장에 `source` 마커 보장 문구가 추가되어 주석과 동작이 일치함.
  - 제안: 현 상태 유지.

- **[INFO]** `ChatMessage.source` 필드에 JSDoc 주석이 상세히 작성됨
  - 위치: `backend/src/modules/llm/interfaces/llm-client.interface.ts` +183~+193
  - 상세: `'live'`·`'injected'` 두 값의 의미, transport-layer 전용임을 명시, LlmService 에서 strip 된다는 동작 흐름까지 기술. spec 섹션 참조도 포함.
  - 제안: 현 상태 유지.

- **[INFO]** `ConversationItem.isInjected` 필드에 JSDoc 주석이 상세히 작성됨
  - 위치: `frontend/src/lib/stores/execution-store.ts` +651~+659
  - 상세: 필드의 의미, WebSocket 페이로드 필드와의 대응 관계, UI 활용 용도까지 명시됨.
  - 제안: 현 상태 유지.

- **[INFO]** `RawMessage.source` 필드에 JSDoc 주석이 상세히 작성됨
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` +548~+556
  - 상세: 백엔드 origin 마커의 의미, 누락 시 `'live'` 처리(하위 호환) 정책 등 중요한 동작 규칙이 문서화됨.
  - 제안: 현 상태 유지.

- **[WARNING]** `mapTurnsToChatMessages` 함수에 함수 수준 JSDoc/독스트링 없음
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` +259~+311 (`mapTurnsToChatMessages` 함수 전체)
  - 상세: 이번 변경으로 `source: 'injected'` 마킹 책임이 이 함수에 부여되었고, 그 이유와 spec 참조가 함수 본문 첫 블록 주석으로만 설명됨. 함수 시그니처 위에 JSDoc이 없어 IDE hover 시 의도를 바로 파악하기 어렵다. 내부 주석(+262~+265)은 있으나, 이 함수가 모든 반환 메시지에 `source: 'injected'`를 부여하는 유일한 진입점임을 함수 수준으로 명시해야 한다.
  - 제안: 함수 선언 직전에 JSDoc 블록을 추가.
    ```ts
    /**
     * ConversationThread 에서 이전 노드의 대화 이력을 ChatMessage 배열로 변환한다.
     * 모든 반환 메시지는 `source: 'injected'` 마커를 가진다 —
     * 현재 핸들러의 push 사이트가 `source` 없이 추가하는 `'live'` 메시지와
     * WebSocket emit 계층(`buildConversationConfigFromOutput`)에서 구분하기 위함.
     * Spec: spec/5-system/6-websocket-protocol.md §4.4.6.
     */
    ```

- **[WARNING]** `use-execution-events.ts` 의 인라인 타입 리터럴에 spec 참조 주석만 있고 의미 설명이 없음
  - 위치: `frontend/src/lib/websocket/use-execution-events.ts` +683, +692
  - 상세: `// spec/5-system/6-websocket-protocol.md §4.4.6` 한 줄만 추가되어 있어 코드 탐색 중 `source` 필드의 의미(live/injected 구분)와 활용 목적을 즉시 파악하기 어렵다. 동일 파일이 두 군데(`+683`, `+692`)에 중복으로 같은 타입 정의를 갖고 있어 주석도 중복된다.
  - 제안: 주석을 최소한 `// origin marker: 'live'=현재 핸드러, 'injected'=thread 주입` 수준으로 보강하거나, 중복 인라인 타입 대신 공통 타입을 import 하여 한 곳에서만 문서화하는 구조를 검토.

---

### 2. 인라인 주석

- **[INFO]** `conversation-utils.ts` 의 핵심 로직 변경부에 설명적인 인라인 주석이 충분히 작성됨
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` +571~+576, +591~+595, +615~+619
  - 상세: `currentTurn` 증가 조건 변경, `assistantIdxInTurn` 스킵 이유, debug payload 제외 이유가 모두 주석으로 설명되어 있음.
  - 제안: 현 상태 유지.

- **[INFO]** `llm.service.ts` 의 `source` 필드 strip 로직에 맥락 설명 주석이 있음
  - 위치: `backend/src/modules/llm/llm.service.ts` +218~+225
  - 상세: 왜 strip 하는지, LLM API가 canonical 형태만 받아야 한다는 이유가 명시됨.
  - 제안: 현 상태 유지.

- **[WARNING]** `llm.service.ts` 에서 `void source;` 구문 설명 주석 누락
  - 위치: `backend/src/modules/llm/llm.service.ts` +225
  - 상세: `void source;`는 TypeScript에서 사용하지 않는 구조분해 변수에 대한 lint 경고를 억제하는 관용구인데, 이 의도를 모르는 독자는 의문을 가질 수 있다.
  - 제안: `// eslint-disable-next-line @typescript-eslint/no-unused-vars` 또는 `void source; // suppress unused-var lint` 형식으로 의도를 명시.

- **[INFO]** 테스트 파일의 주석이 스펙 조항과 회귀 시나리오를 충분히 설명함
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.spec.ts` +35~+37, `backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts` +332~+336, `frontend/src/lib/conversation/__tests__/conversation-utils.test.ts` +418~+422
  - 상세: 각 테스트의 동기·스펙 조항·회귀 시나리오가 블록 주석으로 선행 기술되어 있어 테스트 의도 파악이 용이함.
  - 제안: 현 상태 유지.

---

### 3. README 업데이트

- **[INFO]** 이번 변경은 transport-layer 내부 마커(`source` 필드) 도입으로, 외부 API 인터페이스나 사용자 대면 기능은 변경되지 않음
  - 상세: README는 제품 실행 방법과 최종 사용자 기능을 기술하므로, `source` 마커 같은 내부 WebSocket 페이로드 필드 변경은 README 갱신 대상이 아님.
  - 제안: README 업데이트 불필요.

---

### 4. API 문서 (Swagger/spec 업데이트)

- **[INFO]** `spec/5-system/6-websocket-protocol.md §4.4.6` 이 신규 추가되어 변경의 스펙 근거가 문서화되어 있음 (consistency-check SUMMARY 에서 확인됨)
  - 상세: consistency-check 세션(`review/consistency/2026/05/16/10_01_06/SUMMARY.md`)에 따르면 `spec/5-system/6-websocket-protocol.md §4.4.6` 신규 추가에 대해 Critical 없음으로 확인되었음.
  - 제안: spec 문서 업데이트는 이미 이루어진 것으로 판단. 추가 조치 불필요.

- **[INFO]** `spec/conventions/conversation-thread.md §5.1` 보강도 완료된 것으로 확인됨
  - 상세: consistency-check SUMMARY 에서 "spec/conventions/conversation-thread.md (§5.1 보강) — Critical 없음"으로 명시됨.
  - 제안: 추가 조치 불필요.

---

### 5. 주석 정확성

- **[INFO]** `llm.service.ts` 기존 주석(한국어, `disableInnerRetry` 설명)이 변경 이후에도 정확히 유지됨
  - 위치: `backend/src/modules/llm/llm.service.ts` +229~+234
  - 상세: 기존 주석이 `sanitized` 변수 도입으로 인한 `params` → `sanitized` 교체와 충돌 없이 그대로 정확하게 유지됨.
  - 제안: 현 상태 유지.

- **[INFO]** `execution-engine.service.spec.ts` 변경 전 기존 테스트 주석이 `source: 'live'` backfill 설명으로 갱신됨
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.spec.ts` +35~+37
  - 상세: 기존 테스트의 `expect(conv.messages).toEqual(...)` 직전에 왜 `source: 'live'`가 추가되는지 설명 주석이 추가되어 "오래된 주석" 문제 없음.
  - 제안: 현 상태 유지.

---

### 6. 변경 이력 (CHANGELOG)

- **[WARNING]** CHANGELOG 파일이 존재하는지 확인 불가하나, 이번 변경은 기능적 동작 변경(WebSocket 페이로드 스키마에 `source` 필드 추가, 프론트엔드 `turnIndex` 계산 로직 변경)을 포함함
  - 상세: `messages[].source` 필드는 WebSocket 페이로드에 새로 추가되는 필드로, 프론트엔드와 백엔드 계약 변경에 해당한다. CHANGELOG가 운영되고 있다면 이 변경(`feat: AI conversation messages source marker for WebSocket emit layer`)은 기록 대상.
  - 제안: 프로젝트에 CHANGELOG가 있다면 `feat` 또는 `chore` 항목으로 추가할 것을 권장. 없으면 무시.

---

### 7. 설정 문서

- **[INFO]** 이번 변경은 새로운 환경변수나 외부 설정 옵션을 도입하지 않음
  - 상세: `source` 마커는 코드 내부 로직으로 처리되며, 별도 설정값이 없음.
  - 제안: 설정 문서 업데이트 불필요.

---

### 8. 예제 코드

- **[INFO]** 테스트 파일들이 예제 코드 역할을 충분히 수행함
  - 위치: `frontend/src/lib/conversation/__tests__/conversation-utils.test.ts` +414~+528, `backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts` +337~+391
  - 상세: 4개의 신규 테스트 케이스가 `source: 'injected'` 및 `'live'` 메시지 처리의 다양한 시나리오(단순 case, 멀티 주입, tool call, backward compat)를 망라하여 사용법 예제로도 기능함.
  - 제안: 현 상태 유지.

- **[INFO]** `spec/5-system/6-websocket-protocol.md §4.4.6` 에 페이로드 예시가 포함되어 있을 것으로 기대됨
  - 상세: consistency-check에서 해당 섹션 신규 추가가 확인되었으나 spec 파일 내용을 직접 확인하지 못했음. spec 문서 내에 JSON 페이로드 예시(injected/live 혼재 케이스)가 없다면 추가하는 것이 권장됨.
  - 제안: spec 문서 담당자(project-planner)가 `§4.4.6`에 페이로드 예시 JSON이 있는지 확인하고, 없으면 추가.

---

## 요약

이번 AI 대화 메시지 `source` 마커(`'live'` / `'injected'`) 도입 변경은 전반적으로 문서화 품질이 높다. 공개 인터페이스(`ChatMessage.source`, `ConversationItem.isInjected`, `RawMessage.source`)에 상세한 JSDoc이 작성되었고, 핵심 로직 변경부에 충분한 인라인 주석이 있으며, 테스트 파일의 블록 주석이 스펙 조항과 회귀 시나리오를 명확히 설명한다. spec 업데이트(`§4.4.6` 신규, `§5.1` 보강)도 이미 완료되어 코드와 문서의 정합성이 유지된다. 개선 여지가 있는 부분은 `mapTurnsToChatMessages` 함수 수준 JSDoc 누락, `void source;` 관용구 설명 누락, `use-execution-events.ts` 중복 인라인 타입의 최소한의 의미 보완 정도로, 모두 WARNING 이하의 낮은 심각도다.

## 위험도

LOW
