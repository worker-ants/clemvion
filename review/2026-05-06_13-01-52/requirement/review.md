---

## 발견사항

### **[HIGH]** `conversationHistory` / `historyCount` 스키마 정의됐지만 핸들러 미구현
- **위치:** `ai-agent.schema.ts` L323–351, `ai-agent.handler.ts` 전체
- **상세:** 스키마에 `conversationHistory: 'none'|'last_n'|'full'`과 `historyCount` 필드가 정의되고 UI 위젯까지 노출되지만, `executeSingleTurn`·`processMultiTurnMessageInner` 어디에도 이 값을 읽거나 메시지 히스토리를 자르는 로직이 없다. 사용자가 "Last N Messages"를 선택해도 아무 효과가 없는 **silent feature gap**이다.
- **제안:** 핸들러에 구현하거나, 스키마에서 해당 필드를 제거(또는 `hidden: true`)하고 명시적으로 "미구현"임을 문서화할 것.

---

### **[HIGH]** `buildConditionOutput`이 single_turn에서도 `mode: 'multi_turn'`을 반환
- **위치:** `ai-agent.handler.ts` L1190–1191, 호출 위치 L509
- **상세:** `executeSingleTurn` 내부의 condition-only 분기(L499–539)가 `buildConditionOutput`을 호출하는데, 이 메서드는 `config: { mode: 'multi_turn' as const, ... }`를 항상 하드코딩한다. 단일 턴 조건 라우팅임에도 `config.mode`가 `'multi_turn'`으로 출력돼 다운스트림 소비자가 잘못된 모드로 처리할 수 있다.
- **제안:** `buildConditionOutput`에 `mode` 파라미터를 추가하거나, 호출 위치에서 `'single_turn'`으로 오버라이드할 것.

---

### **[MEDIUM]** single_turn vs multi_turn 간 condition tool `toolCallCount` 계산 불일치
- **위치:** `ai-agent.handler.ts` L575–585 (single_turn), L966–976 (multi_turn)
- **상세:** multi_turn 루프에서는 condition tool call 처리 시 `toolCallCount++`(L967)를 수행하지만, single_turn 루프에서는 condition tool call이 카운트되지 않는다. multi_turn에서 condition이 자주 감지되면 `maxToolCalls`가 빠르게 소진되고, single_turn과 동일 config 대비 KB 검색 가능 횟수가 줄어드는 **비대칭 동작**이 발생한다.
- **제안:** multi_turn의 condition tool도 `toolCallCount`에 포함하지 않도록 수정하거나, 두 경로의 카운팅 정책을 명시적으로 문서화할 것.

---

### **[MEDIUM]** `maxToolCalls` 도달 시 `result.content`가 null인 경우 `response: null` 반환
- **위치:** `ai-agent.handler.ts` L491–623, L626
- **상세:** while 루프가 `toolCallCount >= maxToolCalls`로 종료될 때, LLM이 아직 tool_calls 상태(content=null)라면 `response: null`이 출력된다. `spec.ts` L381–412 테스트는 이 경우 `meta.toolCalls`만 확인하고 `response` 값은 검증하지 않는다.
- **제안:** 루프 탈출 후 `result.content`가 null이면 "최대 도구 호출 횟수에 도달했습니다" 등 fallback 문자열을 넣거나, spec 테스트에 `res.response` 어서션을 추가할 것.

---

### **[MEDIUM]** 중복 condition ID 미검증 → silent 라우팅 버그
- **위치:** `ai-agent.schema.ts` L456–495 (`validateAiAgentConfig`), `ai-agent.handler.ts` L1232–1234
- **상세:** `validateAiAgentConfig`는 각 condition의 `id` 존재·예약어 충돌만 검사하고 배열 내 중복 ID를 검사하지 않는다. 중복 ID가 있으면 `condNameToCondition` Map에 마지막 조건만 남아 앞쪽 동일 ID 조건이 무시되고 예상치 못한 포트로 라우팅된다.
- **제안:** `validateAiAgentConfig`에 중복 ID 검사 로직 추가. 예: `new Set(ids).size !== ids.length`

---

### **[MEDIUM]** `aiAgentNodeOutputSchema` 출력 구조 불일치 (autocomplete 오동작)
- **위치:** `ai-agent.schema.ts` L379–384, L386–426
- **상세:** 주석에 "handler returns a legacy bare object (no config/output wrapper)"라고 적혀 있지만, 실제 핸들러는 `{ config, output: { result: { response, ... } }, meta, port, status }` 구조를 반환한다. 스키마는 `response`, `messages`, `condition` 등을 최상위로 기술해 워크플로우 작성자의 `$node["X"].output.response` 자동완성 힌트가 실제 경로(`$node["X"].output.result.response` 또는 어댑터 경유)와 다를 수 있다.
- **제안:** 스키마 주석과 필드 구조를 현재 반환 형식에 맞게 갱신하거나, 자동완성 스키마가 어댑터 이후 구조를 따름을 명확히 문서화할 것.

---

### **[LOW]** `ragThreshold` · `ragTopK` 범위 미검증
- **위치:** `ai-agent.schema.ts` L199–221
- **상세:** `ragThreshold`는 0–1 범위여야 하고 `ragTopK`는 1 이상 정수여야 하지만 스키마에 `min`/`max` 제약이 없어 잘못된 값이 RAG 서비스로 무언의 전달된다.
- **제안:** `ragThreshold: z.number().min(0).max(1)`, `ragTopK: z.number().int().min(1)` 적용.

---

### **[LOW]** `endReason: 'out'` 타입 일관성 부재
- **위치:** `ai-agent.handler.ts` L652
- **상세:** single_turn 정상 완료 시 `endReason: 'out' as const`를 사용하지만, `buildMultiTurnFinalOutput` 시그니처의 `endReason` 유니온(`'user_ended'|'max_turns'|'condition'|'error'`)에 `'out'`은 없다. 다운스트림에서 `endReason` 분기를 처리할 때 single-turn 경우가 누락될 수 있다.
- **제안:** `'completed'` 등 의미 있는 리터럴로 통일하고 유니온 타입에 포함시킬 것.

---

### **[INFO]** `maxTurns=0` (무제한) 동작 테스트 부재
- **위치:** `ai-agent.handler.spec.ts` validate·multi_turn 섹션 전반
- **상세:** `maxTurns=-1` 검증 실패 테스트(L83)는 있으나, `maxTurns=0`이 실제로 무제한 턴으로 동작하는지(`isLastTurn` 조건 우회) 검증하는 테스트가 없다.
- **제안:** `maxTurns: 0` 설정 시 `isLastTurn`이 절대 true가 되지 않음을 확인하는 테스트 추가.

---

## 요약

기본 흐름(single_turn/multi_turn 모드 전환, KB tool loop, condition 라우팅, 토큰 집계, 디버그 히스토리)은 견고하게 구현되어 있으며 테스트 커버리지도 광범위하다. 주요 요구사항 위반은 두 가지로, 스키마에 노출된 `conversationHistory`/`historyCount` 기능이 핸들러에 전혀 구현되지 않아 사용자 의도와 실제 동작이 불일치하며, single_turn condition 라우팅 시 `config.mode: 'multi_turn'` 오기입이 다운스트림 소비자를 오도할 수 있다. 중간 위험도 항목(condition toolCallCount 비대칭, maxToolCalls exhaustion 시 null response, autocomplete 스키마 불일치, 중복 condition ID 무검증)은 에러 발생 빈도는 낮지만 실제 운영 환경에서 silent bug로 이어질 수 있어 우선적으로 보완이 필요하다.

## 위험도

**HIGH**