## 아키텍처 코드 리뷰 — AI Agent Conditions

---

### 발견사항

---

- **[WARNING]** 도구 호출 루프 로직 3중 복제 (DRY 위반 + SRP 위반)
  - 위치: `ai-agent.handler.ts` — `executeSingleTurn` (L162~), `executeMultiTurn` first-turn loop (L385~), `processMultiTurnMessage` (L563~)
  - 상세: `classifyToolCalls` → 조건/일반 분기 → tool message 빌드 → 재귀 LLM 호출 패턴이 세 군데에 거의 동일하게 복제되어 있음. 조건 처리 로직이 수정될 때마다 세 곳을 동시에 변경해야 하며, 누락 시 모드별 동작 불일치가 발생함.
  - 제안: `runToolCallLoop(messages, result, conditions, llmConfig, ...): Promise<ToolLoopResult>` 형태의 추상 메서드로 추출. 세 실행 경로 모두 이 메서드를 위임 호출하도록 리팩터링.

---

- **[WARNING]** 조건 라우팅 감지에 덕 타이핑 사용 — 암묵적 레이어 계약
  - 위치: `execution-engine.service.ts` L926 — `'port' in resultObj && 'data' in resultObj`
  - 상세: 핸들러의 반환 형태를 실행 엔진이 구조 검사로 식별함. 이는 두 레이어 사이의 명시적 계약 없이 암묵적 결합을 만들어냄. 다른 핸들러가 우연히 `port`/`data` 키를 반환하거나, 조건 결과 구조가 변경될 경우 조용히 잘못 동작할 수 있음.
  - 제안: `PortRoutedResult` 타입 (discriminated union) 도입. 예:
    ```ts
    interface PortRoutedResult { __type: 'port_routed'; port: string; data: unknown; }
    ```
    핸들러는 이 타입을 반환하고, 서비스는 `__type` 필드로 명시적으로 판별.

---

- **[WARNING]** 조건 결과 출력 구조 불일치 (single_turn vs multi_turn)
  - 위치: `ai-agent.handler.ts` — `executeSingleTurn` 내 인라인 반환 (L172~185) vs `buildConditionOutput` (L722~)
  - 상세: single_turn 조건 트리거 시 인라인으로 `{ port, data: { response, condition, metadata: { inputTokens, outputTokens } } }` 형태를 반환하고, multi_turn은 `buildConditionOutput`을 통해 `{ port, data: { messages, turnCount, endReason, ... } }` 형태를 반환함. 소비자 (실행 엔진, 프론트엔드)가 두 구조를 다르게 처리해야 하는지 불분명하며 유지보수 부담이 생김.
  - 제안: `buildConditionOutput`을 single_turn에도 통일 적용하거나, 두 모드에 공통 출력 인터페이스 `ConditionRoutedOutput`을 정의하여 구조를 통일.

---

- **[WARNING]** `ConditionDef` 타입이 백엔드 핸들러 내부에 고립 — 프론트엔드와 암묵적 중복
  - 위치: `ai-agent.handler.ts` L7~, `ai-configs.tsx` L16, `custom-node.tsx` L40
  - 상세: 조건 구조(`{ id, label, prompt }`)가 백엔드 핸들러 인터페이스, 프론트엔드 컴포넌트, config 패널에 각각 `as Array<{ id: string; label: string; prompt: string }>` 형태로 독립 정의됨. 스키마가 변경될 때 세 곳을 동기화해야 하는 구조적 취약점.
  - 제안: 단기적으로 프론트엔드에 `types/condition.ts`로 공유 타입 추출. 장기적으로 백엔드-프론트 간 타입 공유 레이어 (예: `shared/` 패키지) 고려.

---

- **[INFO]** 포트 ID 상수 미공유 — 프론트엔드·백엔드 간 문자열 결합
  - 위치: `custom-node.tsx` L51~64 (`"timeout"`, `"user_ended"`, `"max_turns"`, `"error"`), `node-definitions/index.ts`
  - 상세: 출력 포트 ID 문자열이 프론트엔드에 하드코딩되어 있으며, 백엔드 핸들러의 반환 키와 암묵적으로 일치해야 함. 포트 이름 변경 시 프론트가 자동으로 감지할 방법이 없음.
  - 제안: 공유 상수 파일에 `AI_AGENT_PORTS = { OUT: 'out', TIMEOUT: 'timeout', ... }` 정의.

---

- **[INFO]** 실행 로직 내 한국어 하드코딩 문자열
  - 위치: `ai-agent.handler.ts` L201, L432, L599 — `'확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.'`
  - 상세: LLM에게 전달되는 도구 응답 메시지가 한국어로 고정되어 있음. 다국어 워크플로우나 영어 LLM 모델 사용 시 응답 품질에 영향을 줄 수 있으며, 이 문자열이 핵심 라우팅 동작에 영향을 미치는 점에서 비즈니스 로직과 혼재됨.
  - 제안: 상수로 추출하거나, LLM config의 언어 설정을 반영하도록 개선.

---

- **[INFO]** `buildMultiTurnFinalOutput`의 `endReason` 유니온 타입 확장 방식 — OCP 경계 사례
  - 위치: `ai-agent.handler.ts` L697 — `'user_ended' | 'max_turns' | 'timeout' | 'condition' | 'error'`
  - 상세: 새 종료 사유가 생길 때마다 유니온을 열어 수정해야 하는 패턴. 현재 스케일에서는 수용 가능하지만, 종료 사유 타입이 외부 컨슈머(실행 엔진, 프론트엔드 결과 표시)에서도 사용된다면 버전 관리 부담이 생김.
  - 제안: 별도 `EndReason` 타입 파일로 분리하여 변경 추적을 명확히 함.

---

### 요약

전반적인 구현 방향성은 올바르며, 조건 도구를 LLM 네이티브 tool-calling 패턴으로 처리하는 설계는 적절하다. 그러나 핵심 문제는 **도구 호출 루프 로직의 3중 복제**로, 이는 SRP와 DRY를 동시에 위반하여 조건 처리 수정 시 세 곳의 동기화 실패 위험을 내포한다. 또한 실행 엔진이 덕 타이핑으로 핸들러 결과를 식별하는 암묵적 레이어 계약은 `PortRoutedResult` 같은 명시적 타입으로 대체해야 구조적 안정성이 확보된다. single_turn과 multi_turn 조건 출력 구조의 불일치는 소비자 레이어에 불필요한 복잡도를 야기하므로 통일이 필요하다.

### 위험도

**MEDIUM**