### 발견사항

---

**[WARNING] multi_turn 모드에서 첫 번째 턴(executeMultiTurn) 이후 실제 대화 루프(processMultiTurnMessage)의 조건 포트 결과가 execution-engine.service.ts로 올바르게 전달되는지 불명확**
- 위치: `execution-engine.service.ts` diff, `ai-agent.handler.ts` `processMultiTurnMessage`
- 상세: `waitForAiConversation`에서 `'port' in resultObj && 'data' in resultObj` 조건으로 감지하지만, `processMultiTurnMessage`가 조건 포트 결과를 반환할 때 해당 결과가 `resultObj`로 도달하는 경로(루프 내 result 할당)를 확인해야 합니다. 핸들러 내부 루프에서 `return this.buildConditionOutput(...)` 이 직접 반환되므로 service 레이어가 이를 받아서 처리하는 흐름이 맞는지 전체 file context가 truncate되어 완전히 검증하기 어렵습니다.
- 제안: `waitForAiConversation` 루프에서 `processMultiTurnMessage` 결과를 받는 부분에 조건 포트 결과가 실제로 전달되는지 통합 테스트 추가

---

**[WARNING] single_turn에서 conditions만 있고 정상 응답(tool call 없음)일 때 `port` 키가 없는 일반 output 반환 — 이는 의도된 동작이나, execution-engine의 포트 라우팅이 `port` 키로만 구분하기 때문에 정상 output의 `out` 포트 라우팅도 service에서 처리해야 함**
- 위치: `ai-agent.handler.ts` `executeSingleTurn` 반환부, `execution-engine.service.ts`
- 상세: 조건 미발동 시 `{ response, metadata }` 를 반환하며 `port` 키가 없음. service에서 `'port' in resultObj`로만 분기하므로 일반 output은 `else` 브랜치(maxTurns reached)로 처리됨. 하지만 single_turn은 이 경로를 타지 않을 수 있음 — diff에서 service의 `else if` 분기는 `waitForAiConversation` 내부인 것으로 보이므로 single_turn에는 해당 없음. 단, single_turn에서 `out` 포트 라우팅이 별도로 존재하는지 확인 필요.
- 제안: single_turn과 multi_turn 각각의 포트 라우팅 경로를 명시적으로 주석 또는 문서화

---

**[WARNING] 조건 + 일반 도구 혼합 호출(Case 2) 후 재평가 루프에서 다시 혼합 호출이 반복될 경우 무한 루프 위험**
- 위치: `ai-agent.handler.ts` `executeSingleTurn`, `executeMultiTurn` 내 while 루프
- 상세: Case 2(혼합)에서 조건 도구에 deferral 메시지를 보내고 재호출하지만, LLM이 다음 턴에서도 계속 혼합 호출을 반복할 경우 `maxToolCalls` 제한에 의해서만 종료됨. 조건 deferral 횟수에 별도 제한이 없음.
- 제안: 조건 deferral 횟수를 추적하여 N회 이상 반복 시 조건 발동으로 처리하거나 경고 처리

---

**[INFO] `buildConditionSystemPromptSuffix`의 조건 안내 텍스트가 한국어로 하드코딩**
- 위치: `ai-agent.handler.ts:buildConditionSystemPromptSuffix`
- 상세: `[조건 안내] 대화 중 아래 조건에 해당하는 상황이 감지되면...` 텍스트가 한국어 고정. 다국어 사용자나 영어 시스템 프롬프트와 혼용 시 LLM 혼동 가능성 존재.
- 제안: 현 단계에서는 허용 가능하나, 향후 locale 설정 또는 영어/한국어 선택 옵션 고려

---

**[INFO] `custom-node.tsx`의 ai_agent 동적 포트 생성 시 조건 id가 중복될 경우 React key 충돌**
- 위치: `custom-node.tsx` condPorts 생성부
- 상세: `conditions.filter((c) => c.id)` 로 빈 id를 걸러내지만, 동일한 UUID가 중복 입력된 경우(비정상 데이터) key 중복 발생. `crypto.randomUUID()`로 생성하므로 실제 발생 가능성은 낮으나 방어 코드 부재.
- 제안: 현재 수준에서 허용 가능. 필요 시 `Array.from(new Set(...))` 으로 중복 제거

---

**[INFO] 테스트에서 `buildMultiTurnFinalOutput`의 `'condition'` endReason 테스트는 있으나, 실제 multi_turn 대화 중 조건 발동 후 service 레이어에서의 포트 라우팅 E2E 테스트 없음**
- 위치: `ai-agent.handler.spec.ts`
- 상세: 핸들러 단위 테스트는 충분하지만, `execution-engine.service.ts`의 새 `else if` 분기에 대한 테스트가 diff에 포함되지 않음.
- 제안: `execution-engine.service` 테스트에 조건 포트 라우팅 케이스 추가

---

### 요약

AI Agent Conditions 기능 구현은 핵심 요구사항(조건 정의, 도구 등록, 분류, 포트 라우팅, UI 표시)을 전반적으로 잘 충족하고 있습니다. 백엔드 핸들러의 단위 테스트 커버리지가 풍부하고, 프론트엔드 포트 동적 렌더링과 config summary 표시도 스펙에 부합합니다. 다만 혼합 도구 호출(조건 + 일반) 반복 시 deferral 무한 루프 가능성, multi_turn 모드에서 service 레이어 조건 결과 수신 경로의 명시적 통합 테스트 부재, execution-engine.service의 새 분기에 대한 테스트 누락이 중요 보완 사항으로 확인됩니다.

### 위험도

**MEDIUM**