---

### 발견사항

---

**[CRITICAL] Multi-turn 종료 포트 라우팅 오작동**
- 위치: `ai-agent.handler.ts:1127–1152` (`buildMultiTurnFinalOutput`), `endMultiTurnConversation` (`handler.ts:1077–1101`), `processMultiTurnMessageInner` 내 `isLastTurn` 분기 (`handler.ts:1023–1041`)
- 상세: `buildMultiTurnFinalOutput`이 `endReason` 파라미터(`'user_ended' | 'max_turns' | 'condition' | 'error'`)를 받음에도 항상 `port: 'out'`을 하드코딩하여 반환한다. PRD ND-AG-24는 "Multi Turn 모드: `user_ended` + `max_turns` + `error` 포트, `out` 없음"을 명시하고, Spec §포트 도 "※ `out` 포트 없음"을 강조한다. 결과적으로 `endMultiTurnConversation('user_ended')` 호출 시 `user_ended` 포트가 아닌 `out` 포트로 라우팅되어 후속 워크플로우가 잘못 실행된다.
- 제안: `buildMultiTurnFinalOutput`의 `port` 반환 값을 `endReason === 'max_turns' ? 'max_turns' : endReason === 'user_ended' ? 'user_ended' : endReason === 'error' ? 'error' : 'out'`으로 정정. 해당 케이스에 대한 테스트 추가.

---

**[CRITICAL] Spec 출력 구조가 실제 구현과 불일치 (spec 미갱신)**
- 위치: `spec/4-nodes/3-ai-nodes.md:287–355` (출력 구조 섹션)
- 상세: Spec은 Single Turn 정상 출력을 `{ "response": "...", "metadata": {...} }` 평탄 구조로 정의하지만, 핸들러는 `{ config, output: { result: { response, endReason, turnCount } }, meta, port, status }` 중첩 구조(CONVENTIONS §8)를 반환한다. 후속 노드가 `$node["AI Agent"].output.response`를 참조하면 `undefined`가 된다. 이 괴리는 워크플로우 작성자를 직접 오도한다.
- 제안: Spec 출력 구조 섹션을 실제 반환 형태(`output.result.response`, `meta.inputTokens` 등)로 전면 갱신.

---

**[CRITICAL] Multi-turn 첫 번째 턴 동작 — Spec과 구현 불일치**
- 위치: `spec/4-nodes/3-ai-nodes.md:254–269` vs `handler.ts:679–769` (`executeMultiTurn`)
- 상세: Spec §Multi Turn 모드 1항은 "첫 번째 턴: Single Turn과 동일하게 RAG 검색 + LLM 호출 + Tool/Condition 처리 수행"을 명시한다. 그러나 `executeMultiTurn`은 LLM을 호출하지 않고 즉시 `status: 'waiting_for_input'`을 반환한다. 구현 결정이 의도적이라면(주석상 userPrompt leak 방지) spec이 이를 반영해야 하며, 그렇지 않으면 구현이 버그다.
- 제안: 구현 결정(사용자 첫 메시지 대기)을 Spec에 명시적으로 갱신하거나, 첫 번째 턴 LLM 호출 로직을 구현에 추가.

---

**[WARNING] `conversationHistory` / `historyCount` 스키마에 정의되어 있으나 핸들러에서 미사용**
- 위치: `ai-agent.schema.ts:281–308`, PRD ND-AG-07 (상태: ✅), Spec 설정 config 표
- 상세: 스키마에 `conversationHistory: 'none' | 'last_n' | 'full'`과 `historyCount` 필드가 선언되어 있고 Spec config 표에도 포함된다. 그러나 `executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessageInner` 어디에도 이 값을 읽거나 적용하는 코드가 없다. PRD ND-AG-07 상태가 ✅로 표시되어 있으나 실제로는 동작하지 않는 기능이다.
- 제안: 핸들러에서 `conversationHistory`를 실제 읽어 `last_n` 시 `messages` 배열을 슬라이싱하거나, PRD 상태를 미구현으로 정정하고 스키마에서 해당 필드를 숨김 처리.

---

**[WARNING] `aiAgentNodeOutputSchema` — 레거시 평탄 구조로 autocomplete 오도**
- 위치: `ai-agent.schema.ts:343–383`
- 상세: `aiAgentNodeOutputSchema`가 `response`, `interactionType`, `conversationConfig`, `metadata` 등 레거시 평탄 구조 키를 정의한다. 실제 핸들러는 중첩 구조(`output.result.response`, `meta.*`)를 반환하므로, 워크플로우 에디터에서 `$node["AI Agent"].output.response`로 자동완성 제안되지만 실제로는 `undefined`다.
- 제안: `aiAgentNodeOutputSchema`를 현재 실제 출력 구조(`output.result.response`, `output.result.turnCount` 등)에 맞게 갱신.

---

**[WARNING] conditionToolCalls 카운터 — Single Turn vs Multi Turn 비대칭**
- 위치: `handler.ts:570–580` (`executeSingleTurn`), `handler.ts:957–967` (`processMultiTurnMessageInner`)
- 상세: `executeSingleTurn`의 조건 도구 처리 루프에는 `toolCallCount++`가 없다("does not count toward toolCallCount" 주석). 반면 `processMultiTurnMessageInner`에서는 동일 조건 도구에 `toolCallCount++`를 수행한다. 같은 `maxToolCalls` 한도를 공유하지만 카운팅 정책이 다르다.
- 제안: 두 경로에서 조건 도구 카운팅 정책을 통일. plan 문서가 이미 "WARN #20"으로 추적 중이나 재작성 시 놓칠 위험이 있으므로 주석에 명시.

---

**[WARNING] `ragThreshold` 범위 검증 없음**
- 위치: `ai-agent.schema.ts:194–204`, `validateAiAgentConfig` (`schema.ts:413–453`)
- 상세: `ragThreshold`는 `z.number().default(0.7)`로 선언되어 있고, 스키마 힌트도 "0-1"이라 하지만 실제 범위 제약이 없다. `-0.5` 또는 `1.5` 같은 값이 그대로 `KbToolProvider`에 전달되어 검색 결과가 0건이 되거나 임계값 필터가 무의미해진다.
- 제안: `z.number().min(0).max(1).default(0.7)`로 schema 제약 추가 또는 `validateAiAgentConfig`에서 범위 검증.

---

**[WARNING] Multi-turn 종료 포트 관련 테스트 누락**
- 위치: `ai-agent.handler.spec.ts:730–775` (`should return final output when maxTurns is reached`)
- 상세: `processMultiTurnMessage`에서 `maxTurns` 도달 시 반환값의 `port` 필드를 검증하지 않는다. CRITICAL 이슈 1번(항상 `port: 'out'` 반환)을 테스트가 잡지 못하는 원인이다. `endMultiTurnConversation`에 대한 테스트도 존재하지 않는다.
- 제안: `max_turns` 종료 케이스에 `expect(r.port).toBe('max_turns')`, `user_ended` 케이스에 `expect(r.port).toBe('user_ended')` 검증 추가.

---

**[INFO] Single Turn `endReason: 'out'` — multi-turn endReason 유니온과 불일치**
- 위치: `handler.ts:647`, `buildMultiTurnFinalOutput` 시그니처 (`handler.ts:1107`)
- 상세: Single Turn 출력에 `endReason: 'out' as const`가 포함되지만 `buildMultiTurnFinalOutput`의 endReason 유니온(`'user_ended' | 'max_turns' | 'condition' | 'error'`)에는 `'out'`이 없다. Spec endReason enum(`condition | user_ended | max_turns | error`)도 `'out'`을 제외한다. 의미론적으로 `'out'`은 포트 이름이지 종료 사유가 아니다. plan 문서도 INFO #5로 추적 중.
- 제안: Single Turn 출력의 `endReason`을 제거하거나 `'completed'`로 변경하여 의미를 명확히.

---

**[INFO] `normalToolCalls` 스텁 경로 — 불필요한 dead code**
- 위치: `handler.ts:582–590`, `handler.ts:969–980`
- 상세: `toolNodeIds`/`toolOverrides` 제거 후 `normalToolCalls`는 항상 빈 배열이지만, stub 응답을 생성하고 `toolCallCount++`를 수행하는 루프가 두 경로 모두에 남아있다. 재작성 시 새 도구 연결 로직을 여기에 연결하겠다는 의도로 보이지만, 현재는 실행되지 않는 코드다.
- 제안: plan 문서에 이 stub 위치를 명시적으로 기록하거나, `/* STUB: normal tools rewrite hook */` 주석을 붙여 재작성 시 쉽게 찾을 수 있게 함.

---

### 요약

구현의 핵심 동작(KB tool calling, condition routing, tool loop, telemetry)은 대체로 스펙을 충족하며 테스트 커버리지도 충분하다. 그러나 **Multi-turn 종료 포트 라우팅 버그**(`buildMultiTurnFinalOutput`이 항상 `port: 'out'` 반환)는 PRD ND-AG-24와 Spec의 명시적 요구사항을 위반하는 실제 동작 결함이다. 또한 `conversationHistory` 필드가 스키마에 노출되고 PRD에 ✅로 표시되어 있음에도 핸들러에서 전혀 구현되지 않아 사용자가 설정해도 효과가 없다. Spec의 출력 구조와 Multi-turn 첫 번째 턴 동작이 실제 구현과 괴리되어 있어 스펙 문서의 신뢰성도 저하된다.

### 위험도

**HIGH**