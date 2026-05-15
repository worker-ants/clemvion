이제 충분한 맥락을 확보했습니다. 아키텍처 리뷰를 작성하겠습니다.

---

### 발견사항

---

**[WARNING]** `AiAgentHandler` 단일 클래스의 책임 과다 (SRP 위반)
- 위치: `ai-agent.handler.ts` 전체 (1347줄)
- 상세: 하나의 클래스가 ① LLM 호출 조율, ② tool loop 실행, ③ RAG 누적·진단, ④ 조건 분류·라우팅, ⑤ WS 이벤트 발행, ⑥ 프롬프트 구성, ⑦ 출력 포맷 조립 등 7가지 이상의 독립적 책임을 모두 담당한다. 이는 SOLID의 SRP를 명백히 위반하며, plan 문서(`ai-agent-tool-connection-rewrite.md:47`)도 `runToolLoop` 추출 필요성을 이미 인지하고 있다.
- 제안: `ToolLoopOrchestrator`, `ConditionRouter`, `OutputBuilder` 등 책임 단위로 분리. 단, tool connection 재작성 시 함께 진행하는 것이 자연스러우므로 plan backlog로 추적 중인 현 상태는 적절함.

---

**[WARNING]** `executeSingleTurn` / `processMultiTurnMessageInner` tool loop 구조적 중복
- 위치: `handler.ts:487–618` (single-turn) / `handler.ts:868–1001` (multi-turn)
- 상세: 두 메서드의 tool loop는 ① `classifyToolCalls`, ② provider 실행, ③ condition 처리, ④ normal tool stub, ⑤ 다음 LLM 호출 패턴이 ~130줄 분량으로 거의 동일하게 중복된다. 조건 카운팅 비대칭(condition tool call: single-turn은 `toolCallCount` 미증가, multi-turn은 증가 — `handler.ts:571` vs `handler.ts:958`)도 이 중복에서 기인한 버그 가능성이 있다. plan 문서에도 기록됨(WARN #9, #20).
- 제안: `runToolLoop(params: ToolLoopParams): Promise<ToolLoopResult>` 추출로 두 경로 일원화. condition 카운팅 정책도 이때 명시적으로 결정.

---

**[WARNING]** `_resumeState` 스프레드로 인한 암묵적 state 경계 붕괴 (모듈 경계 위반)
- 위치: `handler.ts:1053–1068` (`_resumeState: { ...state, ... }`)
- 상세: multi-turn resume 시 이전 state를 스프레드하여 신규 키를 덮는 방식은 알 수 없는 임의 필드가 state를 통해 암묵적으로 전파된다. state의 계약(contract)이 타입 시스템 밖에 있어, 재작성 시 필드 누락·오염 탐지가 불가능하다. plan 문서 WARN #11에서도 지적됨.
- 제안: `MultiTurnResumeState` 명시적 인터페이스 정의 후 스프레드 대신 명시적 필드 열거.

---

**[INFO]** `AiAgentHandler` 생성자의 `toolProviders` 배열이 구체 타입 없이 외부 주입
- 위치: `handler.ts:239–250`
- 상세: `AgentToolProvider[]`는 인터페이스 배열로 DIP가 잘 적용되어 있고 테스트에서도 `KbToolProvider`만 주입하여 독립 검증이 가능하다. WS 서비스도 optional로 처리되어 테스트 환경에서 누락해도 정상 작동한다. 이 부분은 설계가 양호하다.
- 제안: 현상 유지. 단, NestJS DI 모듈에서 provider 등록 순서가 tool 우선순위에 영향을 미치므로, 이 순서 의존성을 모듈 등록 코드에 주석으로 명시하는 것을 권장.

---

**[INFO]** `RagAccumulatorGroup`의 추상화 수준은 적절하나 두 accumulator 간 dedupe 비대칭이 존재
- 위치: `handler.ts:219–234`, `handler.ts:123–212`
- 상세: `RagAccumulatorGroup`이 node-level과 turn-level 두 accumulator를 동기화하는 thin wrapper는 설계 의도가 명확하다. 그러나 `turnRagAcc`는 `fromState`로 hydrate되지 않아 node-level accumulator의 `seenChunkIds`와 dedupe 집합이 분리된다. 테스트(`handler.spec.ts:958–968`)가 이 비대칭 동작을 의도적 스펙으로 검증하고 있어 현재는 문제없으나, 추후 로직 변경 시 혼동 가능성이 있다.
- 제안: 코드 주석으로 "turnRagAcc는 의도적으로 hydrate하지 않음 — turn-delta 분리를 위해 노드 전체 dedupe와 독립 유지" 명시.

---

**[INFO]** `aiAgentNodeOutputSchema`가 실제 handler 출력 구조와 乖離
- 위치: `ai-agent.schema.ts:343–383`
- 상세: 스키마 주석에 "autocomplete hint only"로 명시되어 있고 flat 구조로 정의되었으나, 실제 handler는 `{ config, output: { result: {...} }, meta, port, status }` 중첩 구조를 반환한다. 프론트엔드 자동완성이 `$node["X"].output.result.response`가 아닌 `$node["X"].output.response`를 제안하면 런타임에 `undefined`가 된다.
- 제안: 스키마를 실제 output 구조(`output.result.*`)와 일치하도록 갱신하거나, 불일치 위험을 주석으로 더 명확히 경고.

---

**[INFO]** `buildTools` 내 `normalTools` 배열이 영구적으로 비어있음
- 위치: `handler.ts:1308`
- 상세: `const normalTools: ToolDef[] = []`로 선언 후 채워지지 않으며 `[...providerTools, ...normalTools, ...conditionTools]`에 합산된다. tool connection 재작성 전 의도적 빈 배열이나, 코드를 처음 보는 독자에게는 미완성 코드처럼 보인다. plan 문서에서 이 맥락을 설명하고 있으나 코드 내 링크가 없다.
- 제안: 주석을 `// tool connection 재작성 전까지 비어있음 — plan/in-progress/ai-agent-tool-connection-rewrite.md` 형태로 구체화.

---

**[INFO]** `classifyToolCalls` 내 `condNameToCondition` Map 매 이터레이션 재구성
- 위치: `handler.ts:1223–1226`
- 상세: tool loop가 반복될 때마다 `conditions` 배열 전체를 순회하여 Map을 재구성한다. 조건 수가 최대 20개이고 Map 생성 비용이 O(n)이라 현재는 성능 문제가 없다. 그러나 `runToolLoop` 추출 시 자연스럽게 Map을 루프 외부로 이동할 수 있다. plan 문서 WARN #17 참조.
- 제안: 현재는 큰 문제 없음. 재작성 시 함께 개선.

---

### 요약

`AiAgentHandler`는 KB/MCP provider 추상화(`AgentToolProvider` 인터페이스), optional WS 의존성, `RagAccumulatorGroup`을 통한 이중 누적 등 핵심 확장 지점이 인터페이스 수준에서 잘 설계되어 있다. 그러나 단일 클래스에 7가지 이상의 책임이 집중되어 있고, single-turn과 multi-turn의 tool loop가 ~130줄 중복되어 있으며, `_resumeState` 스프레드로 state 계약이 타입 시스템 밖에 있는 점이 가장 큰 구조적 취약점이다. 이 세 가지 문제는 모두 plan 문서(`ai-agent-tool-connection-rewrite.md`)에서 인지하고 있으며, 도구 연결 재작성 시 함께 해소하도록 backlog로 추적 중이다. `outputSchema`와 실제 handler 반환 구조의 乖離는 재작성을 기다리지 않고 즉시 정정하는 것이 안전하다.

### 위험도

**MEDIUM** — 현재 동작에 즉각적 결함은 없으나, tool loop 중복에서 비롯된 condition 카운팅 비대칭과 state 스프레드의 암묵적 전파는 재작성 중 회귀 버그를 유발할 수 있는 구조적 취약점이다.