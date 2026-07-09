# 유지보수성(Maintainability) Review

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 수정 (IE `node_execution_id` 오적재 + AI Agent 메인 chat 미배선) — 9개 파일(CHANGELOG, execution-engine.service.ts, ai-turn-executor.ts/.spec.ts, information-extractor.handler.ts/.spec.ts, plan, spec×2).

## 발견사항

- **[INFO]** `ai-turn-executor.ts` 의 resume state 는 여전히 `Record<string, unknown>` 로 느슨하게 타입돼 있어 이번 diff 도 `state.workflowId as string | undefined` / `state.nodeExecutionId as string | undefined` 캐스트를 추가로 얹었다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2473`(`processMultiTurnMessage(state: Record<string, unknown>, ...)`), `:2599-2603`(신규 `llmContext` 구성)
  - 상세: 같은 문제를 고치는 자매 파일 `information-extractor.handler.ts` 는 `MultiTurnState` interface + `hydrateState()` 로 resume state 를 한 번에 타입화해 `state.workflowId` 를 캐스트 없이 쓴다(`:1817-1859`). `ai-turn-executor.ts` 는 여전히 raw `Record<string, unknown>` 를 여러 지역 변수로 흩어 캐스트하는 기존 패턴을 따르는데, 이번 PR 이 그 패턴에 캐스트 2개를 더 추가해 기술부채가 소폭 늘었다. 오탈자(`state.workflwId` 같은) 가 있어도 컴파일 타임에 잡히지 않고 resume 턴에서 attribution 이 다시 NULL 로 새는 동일 유형 버그가 재발할 수 있는 소지가 여전히 남는다(이번 버그 자체가 유사 원인 — 값 오사입).
  - 제안: 이번 PR 범위는 아니지만, 후속으로 `processMultiTurnMessage` 의 resume state 도 IE 처럼 좁은 interface(`AiTurnResumeState` 등)로 타입화하면 이런 필드 오사입 회귀 클래스를 컴파일 타임에 차단할 수 있다. 최소한 신규 `llmContext` 객체에 `: LlmCallContext` 명시적 타입 주석을 붙이면(`llm.service.ts` 의 export 된 인터페이스) 캐스트 오탈자를 IDE/tsc 가 즉시 잡아준다.

- **[INFO]** 동일한 attribution 배경 설명(“resume 턴은 `buildRetryReentryState` 가 `state.workflowId`/`state.nodeExecutionId` 를 재주입 → NodeExecution row PK 로 소비”)이 코드 주석 4곳(`execution-engine.service.ts`, `ai-turn-executor.ts` 2곳, `information-extractor.handler.ts` 2곳) + spec 문서 2곳에 거의 같은 문장으로 반복된다.
  - 위치: `execution-engine.service.ts:4910-4913`, `ai-turn-executor.ts:2594-2598`·`2689-2693`, `information-extractor.handler.ts:150-156`·`886-890`·`1849-1850`
  - 상세: 프로젝트 기존 스타일이 이미 매우 상세한 한국어 rationale 주석을 선호하므로 이번 diff 가 새로 도입한 패턴은 아니다. 다만 향후 attribution 소스가 다시 바뀌면(예: resume state 구조 변경) 동기화해야 할 주석 지점이 6곳으로 늘어난 셈이라 drift 위험이 존재한다.
  - 제안: 각 사이트는 “[Spec 7-llm-usage §1.3] …” 로 SoT 를 링크하고 있어 최소한의 앵커는 확보돼 있다. 큰 문제는 아니며 현행 유지로 충분.

- **[INFO]** CHANGELOG.md 신규 항목 1개가 (a)/(b) 두 개의 독립적인 소비 사이트 수정을 한 문단짜리 단일 bullet 에 모두 욱여넣어 매우 길다(약 900자 1문단).
  - 위치: `CHANGELOG.md:34-38`
  - 상세: 기존 CHANGELOG 항목들도 이미 유사하게 밀도 높은 단일 문단 스타일이라(예: 바로 아래 “워크스페이스 슬러그” 항목들) 이번 diff 가 새로 벗어난 컨벤션은 아니다. 다만 (a) IE 오적재 교정과 (b) AI Agent 미배선 교정은 코드상 독립된 두 파일 변경이라 서브 bullet(`- (a) ...` / `- (b) ...`)로 쪼개면 향후 변경 이력을 스캔하는 사람이 더 빠르게 훑을 수 있다.
  - 제안: 선택적 개선. 기존 파일 컨벤션을 따르는 것도 무방하므로 강제 아님.

## 요약

이번 diff 는 이미 존재하던 “첫 턴은 `context.*`, resume 턴은 재구성 `state.*`” 대칭 패턴을 두 소비 사이트(Information Extractor resume, AI Agent resume 메인 chat 2곳)에 정확히 적용한 국소적 버그 수정이다. 새 함수 추가나 깊은 중첩·매직 넘버·복잡도 증가가 없고, `nodeExecutionId` vs 정의 `nodeId` 혼동을 막기 위해 회귀 테스트 3건(ai-turn-executor.spec.ts, information-extractor.handler.spec.ts 각 1건 + 기존 커버리지)을 명시적으로 추가해 재발 방지 장치도 갖췄다. 네이밍·주석 스타일·타입 캐스트 관용구 모두 기존 코드베이스 컨벤션과 일관되며, 유일한 아쉬운 점은 `ai-turn-executor.ts` 쪽 resume state 가 여전히 약하게 타입된 `Record<string, unknown>` 이라 이번 수정이 그 패턴에 캐스트를 소폭 더 얹었다는 것 — 다만 이는 사전에 존재하던 아키텍처 비대칭이고 이번 PR 이 새로 도입한 문제는 아니다.

## 위험도

LOW
