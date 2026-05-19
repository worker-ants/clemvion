# 정식 규약 준수 검토 — ai-agent-turn-fail-finalize (impl-prep)

검토 모드: `--impl-prep`
대상 범위: multi-turn AI Agent turn 실패 시 NodeExecution.status=FAILED 전이 + finalize 누락 픽스
참조 plan: `plan/in-progress/ai-agent-turn-fail-finalize.md`
핵심 구현 파일: `execution-engine.service.ts`, `ai-agent.handler.ts`, 관련 `.spec.ts`

---

## 발견사항

### [WARNING] `finalizeAiNode` 확장 시 파라미터 이름 후보 (`endedWithError` / `finalStatus`) 가 규약 어휘와 거리 있음

- **target 위치**: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경 범위 1번 마지막 항목 — "이 호출에 `endedWithError: boolean` 또는 `finalStatus` 인자를 추가"
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.1 + `spec/5-system/4-execution-engine.md` §1.1·§1.3
- **상세**: spec 전체에서 에러 종결 판별 기준은 `output.error` 존재 여부 (`§7.9` 주석: "output.error 존재 여부로 에러/정상을 판단한다") 이며, DB 상태는 `COMPLETED | FAILED` 두 값만 허용한다. `endedWithError: boolean` 은 이 판별 기준을 함수 시그니처에 중복 투영하는 형태이고, `finalStatus` 는 `COMPLETED | FAILED` 를 직접 전달하는 더 명확한 어휘지만 spec 어디에도 이 파라미터 이름이 등장하지 않는다. 단순히 이름 선택의 문제이므로 CRITICAL 은 아니지만, spec 의 "output.error 존재 여부" 판별 원칙과 정합하려면 caller 에서 `endReason === 'error'` 또는 `output.error !== undefined` 로 판별한 결과를 `finalizeAiNode` 에 전달하는 방식을 명확히 해야 한다.
- **제안**: `endedWithError: boolean` 보다 `endReason: 'out' | 'condition' | 'user_ended' | 'max_turns' | 'error'` 를 그대로 받아 내부에서 분기하거나, `outcome: { port: string; hasError: boolean }` 형태를 쓰는 편이 spec §7.9 어휘와 직접 대응된다. 두 후보 중 `endedWithError` 는 최소 변경이고 `finalStatus` 는 더 명확하므로, 팀 컨벤션이 없다면 `finalStatus: 'COMPLETED' | 'FAILED'` 가 DB enum 과 1:1 대응돼 오해가 없다.

---

### [WARNING] plan §변경 범위 1번의 `endReason = 'error'` 신규 추가 기술이 기존 spec 과 불일치 가능

- **target 위치**: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경 범위 1번 catch 분기 — "endReason = 'error' 추가 (spec/5-system/4-execution-engine.md §54 `ended` 정의에 `error` 명시되어 있음)"
- **위반 규약**: `spec/5-system/4-execution-engine.md` §1.3 `ended` 행, `spec/4-nodes/3-ai/1-ai-agent.md` §7.7 주석
- **상세**: `spec/5-system/4-execution-engine.md` §1.3 에 `ended` 의 적용 사유로 `completed / user_ended / max_turns / max_retries / error` 가 이미 열거돼 있다. 그러나 ai-agent.handler.ts §7.7 주석에서 `endMultiTurnConversation` 의 진입점이 `user_ended` 인 경우를 명시("engine 이 누적된 `_resumeState` 로 `buildMultiTurnFinalOutput(..., 'user_ended')` 를 호출")하고 있으나, `max_turns` 의 경우에는 `endMultiTurnConversation` 경유 없이 핸들러가 직접 호출한다는 점도 명기돼 있다 (§7.8). `error` 케이스를 `endMultiTurnConversation` 으로 라우팅할지, 또는 새 helper `handleAiTurnError` 에서 독립 처리할지가 plan 내 비결정(§위험/비결정) 으로 남아 있다. plan 이 이를 open question 으로 인식하고 있으므로 직접적인 규약 위반은 아니지만, 구현 시 `endMultiTurnConversation` 에 `'error'` endReason 을 추가하는 경로는 해당 함수 시그니처 변경을 수반하므로 conversation-thread 컨벤션의 mutation 진입점 정의와 충돌하지 않는지 확인이 필요하다.
- **제안**: 구현 착수 전 `endMultiTurnConversation` 의 `endReason` union 을 `ai-agent.handler.ts` 에서 확인해 `'error'` 가 이미 포함돼 있는지 검증한다. 포함돼 있으면 기존 경로를 재사용하고 `handleAiTurnError` 는 단순 error-shape 빌더로 제한한다. 포함돼 있지 않으면 union 확장이 필요하며, 이는 spec §7.9 와 일치하는 변경이므로 규약 갱신 없이 진행 가능하다.

---

### [WARNING] `buildMultiTurnErrorOutput` 신규 도입 검토 시 기존 `buildMultiTurnFinalOutput` 과의 중복 가능성

- **target 위치**: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경 범위 2번 — "신규 메서드 `buildMultiTurnErrorOutput(state, error): NodeHandlerOutput` 가 필요한지 판단"
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (output.error 표준 형태)
- **상세**: spec §7.9 가 정의한 오류 shape 은 `output.error.{code, message, details?}` + `port: 'error'` + `status: 'ended'` 이고, `output.result.*` (messages/turnCount 등) 와 병존 가능하다. 신규 `buildMultiTurnErrorOutput` 을 도입할 경우 기존 `buildMultiTurnFinalOutput` 이 `output.result.*` 를 생성하는 책임과 겹쳐 두 함수 간 output 구조가 달라질 수 있다. Principle 3.2 는 `output.error` 표준 형태를 단일 구조로 정의하므로, 빌더가 두 개로 나뉘어도 최종 `NodeHandlerOutput` 의 형태는 동일해야 한다.
- **제안**: `buildMultiTurnFinalOutput` 에 `error?` 파라미터를 추가하거나, `buildMultiTurnErrorOutput` 내부에서 `buildMultiTurnFinalOutput` 을 호출해 `output.result.*` 부분을 위임하는 방식을 권장한다. 두 함수가 독립적으로 `output` 구조를 만들면 §7.9 의 "부분 결과와 output.error 병존" 요건을 각자 해석해 drift 가 생길 수 있다.

---

### [INFO] plan §위험/비결정 에 기재된 "이벤트 channel 선택 (AI_MESSAGE vs NODE_FAILED 양발사)" 은 규약 비정의 영역

- **target 위치**: `plan/in-progress/ai-agent-turn-fail-finalize.md` §위험/비결정 첫 번째 항목
- **위반 규약**: 직접 위반 없음 — `spec/5-system/4-execution-engine.md` §§에 WS 이벤트 종류는 열거돼 있으나 error 종결 시 양발사 정책은 미정의
- **상세**: 현재 spec 어디에도 AI Agent multi-turn error 종결 시 `AI_MESSAGE` 와 `NODE_FAILED` 를 동시에 발사해야 한다는 규약이 없다. plan 이 "잠정: 둘 다 발사" 로 처리하고 있으나, 이는 구현 후 frontend 충돌 시 단일화할 의향도 함께 밝히고 있으므로 지금 단계에서는 open question 이다.
- **제안**: 구현 전 frontend 팀과 WS 이벤트 소비 패턴을 확인하거나, spec WebSocket Protocol 문서를 참고해 error 종결 시 단일 이벤트로 정리하는 방향을 우선 시도하고, 양발사가 필요하다면 spec 에 명문화 후 진행하는 것이 바람직하다. 현재 구현 착수를 차단하는 수준은 아니다.

---

### [INFO] `handleAiTurnError` 식별자 명명이 기존 패턴과 일관되나, spec 어디에도 등장하지 않음

- **target 위치**: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경 범위 1번 — "신규 helper `handleAiTurnError(executionId, node, resumeState, nodeExec, err)` 추출 — `handleAiEndConversation` 과 같은 패턴"
- **위반 규약**: 명시적 위반 없음. `spec/conventions/` 에 TypeScript 메서드 명명 규약은 별도 문서화되지 않음
- **상세**: `handleAiTurnError` 는 기존 `handleAiEndConversation` / `handleAiMessageTurn` 패턴을 따르는 camelCase 명명으로 일관성이 있다. spec 문서에는 등장하지 않는 신규 식별자이므로, 구현 후 spec 업데이트 대상은 아니나(신규 spec 없음 원칙) 코드 내 JSDoc 수준에서 §7.9 와의 매핑을 명시해두는 것이 권장된다.
- **제안**: 식별자 자체는 허용. 구현 시 `/** @see spec/4-nodes/3-ai/1-ai-agent.md §7.9 */` JSDoc 태그를 추가해 추적성을 확보한다.

---

### [INFO] `sanitizeToolError` / `sanitizeLastErrorMessage` 의 적용 범위가 plan 에서 암묵적으로만 언급됨

- **target 위치**: `plan/in-progress/ai-agent-turn-fail-finalize.md` §변경 범위 2번 마지막 항목
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (`message` 는 국제화 고려 없음 / 로그·디버깅용 원문) + `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 (`output.error.message`)
- **상세**: plan 이 "sanitize 적용" 을 언급하나 `output.error.message` 에 LLM provider raw message 를 그대로 사용할지 sanitize 할지가 명확하지 않다. Principle 3.2 의 `message` 는 "로그·디버깅용 원문" 이어야 하므로, 과도한 sanitize 로 `mall_id` / token 조각 외의 정보가 제거되면 디버깅 가치가 손상된다. 반면 §7.9 의 예시 message `"Anthropic API returned 429 (Too Many Requests)"` 는 이미 provider error 를 인간 가독 형태로 요약한 형태다.
- **제안**: sanitize 대상을 `output.error.message` 전체가 아닌 `output.error.details` 내 민감 토큰(mall_id, API key 조각)으로 한정하고, message 는 provider 의 status code + 간결한 설명 문자열 수준을 유지하도록 구현 시 명확히 한다. `output.error.code` 는 반드시 `UPPER_SNAKE_CASE` 를 유지해야 한다 (Principle 3.2).

---

## 요약

정식 규약 준수 관점에서 이번 구현 범위(`ai-agent-turn-fail-finalize`)의 핵심 목표인 §7.9 shape 구현과 `NodeExecution.status=FAILED` 전이는 `spec/4-nodes/3-ai/1-ai-agent.md` 및 `spec/5-system/4-execution-engine.md` 의 기존 정의와 정합한다. CRITICAL 급 규약 위반은 발견되지 않았다. 다만 `finalizeAiNode` 확장 파라미터 명명(`endedWithError` vs `finalStatus`), `buildMultiTurnErrorOutput` 신규 도입 시 기존 빌더와의 output 구조 중복, WS 이벤트 양발사 정책의 미정의 상태 등은 구현 착수 전에 명확히 해두어야 spec 을 기반으로 한 불일치 없는 구현이 가능하다. `output.error.{code, message, details}` 의 UPPER_SNAKE_CASE 코드, `port: 'error'`, `status: 'ended'` 3요소는 Principle 3.2 와 §7.9 가 이미 정의한 invariant 이므로 구현 시 반드시 준수한다.

## 위험도

LOW
