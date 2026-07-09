# 유지보수성(Maintainability) Review

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 수정 (IE `node_execution_id` 오적재 + AI Agent 메인 chat 미배선). 실질 코드 변경은 `ai-turn-executor.ts`(+테스트)·`information-extractor.handler.ts`(+테스트)·`execution-engine.service.ts`(주석만) 3곳이고, 나머지(`CHANGELOG.md`, `plan/in-progress/resume-llm-usage-attribution.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/7-llm-usage.md`, `review/**` 하위 다수 산출물)는 그 수정을 서술하는 문서/리포트다. `review/code/2026/07/10/01_46_28/**`·`review/consistency/2026/07/10/01_46_28/**` 는 이전 리뷰 세션이 생성한 산출물(md/json)로, 프로그래밍적 함수·네이밍·중첩 구조가 없어 본 관점(가독성/함수 길이/중첩/매직넘버/복잡도) 적용 대상이 아니다 — 별도 항목화하지 않음.

## 발견사항

- **[INFO]** 신규 `llmContext` 객체 리터럴에 export 된 `LlmCallContext` 타입 주석이 없어, 향후 필드명 오타가 있어도 tsc 가 잡지 못한다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2599-2603` (`const llmContext = { workflowId: ..., executionId, nodeExecutionId: ... };`)
  - 상세: `LlmCallContext`(`codebase/backend/src/modules/llm/llm.service.ts:41-45`, `{ workflowId?, executionId?, nodeExecutionId? }`, 전부 optional)는 export 된 타입이다. 지금처럼 `const llmContext = {...}` 로 타입 주석 없이 선언하면 TS 는 이 시점에 excess-property check 를 수행하지 않는다(fresh literal 이 target type 없이 추론될 뿐). 이후 `chat(llmConfig, params, llmContext)` 로 **이름 있는 변수**를 넘기는 자리에서는 구조적 할당 가능성만 검사하고, `LlmCallContext` 의 전 필드가 optional 이라 오탈자로 생긴 엉뚱한 프로퍼티(예: `workflwId`)가 있어도 "필수 필드 누락"으로 잡히지 않는다 — 결과적으로 그 필드는 조용히 `undefined` 로 빠져 attribution 컬럼이 다시 NULL 로 새는, 이번에 고친 것과 같은 클래스의 회귀가 컴파일 타임 없이 재발할 수 있다. `const llmContext: LlmCallContext = {...}` 로 명시적 타입 주석을 붙이면 그 시점에 object literal 이므로 TS 의 excess-property check 가 즉시 오탈자 프로퍼티를 컴파일 에러로 잡아준다.
  - 제안: `const llmContext: LlmCallContext = { workflowId: state.workflowId as string | undefined, executionId, nodeExecutionId: state.nodeExecutionId as string | undefined };` 로 타입 주석만 추가. 이번 PR 이 "attribution 오사입 재발 방지"를 핵심 목표로 삼고 있는 만큼(회귀 테스트 3건도 같은 동기) 이 한 줄 추가로 같은 목표를 컴파일 타임까지 확장할 수 있어 비용 대비 가치가 높다. 참고로 같은 함수 안에 이미 `narrowResumeState(state): ResumeState` 로 좁혀진 `resumeState`(동일 스코프, `resumeState.workflowId`/`resumeState.nodeExecutionId` 도 `string | undefined`) 가 존재하지만, 이 함수는 명시적 주석("상단 number 필드 읽기는 '존재 전제'(as number) 라 그대로 둔다", `ai-turn-executor.ts:2490-2492`)으로 스칼라 필드는 `state.X as Y` 직접 캐스트를 쓰고 `resumeState` 좁히기는 배열류 enrich 필드 전용으로 의도적으로 한정해 둔 것이 확인되므로, 신규 코드의 캐스트 스타일 자체는 기존 컨벤션과 **일관**된다(별도 지적 아님) — 다만 타입 주석 부재는 이 컨벤션과 무관하게 개선 여지가 있다.

- **[INFO]** 동일한 attribution 재구성 메커니즘 설명이 코드 주석 4곳 + spec 문서 2곳(§1.3 콜아웃 포함 3곳) 에 거의 같은 문장으로 반복된다
  - 위치: `execution-engine.service.ts:4910-4913`, `ai-turn-executor.ts:2594-2598`·`2686-2693`, `information-extractor.handler.ts:150-156`(JSDoc)·`886-890`·`1849-1850`, `spec/data-flow/7-llm-usage.md`(§1.3 콜아웃 + §Rationale)
  - 상세: 프로젝트가 이미 상세한 한국어 rationale 주석을 선호하는 스타일이라 이번 diff 가 새로 도입한 패턴은 아니며, 각 사이트가 "[Spec 7-llm-usage §1.3]" 로 SoT 를 일관되게 링크하고 있어 최소한의 앵커는 확보돼 있다. 다만 동기화 지점이 6곳으로 늘어, 향후 재구성 메커니즘이 다시 바뀌면(예: `buildRetryReentryState` 필드 구조 변경) drift 위험이 그만큼 커진다.
  - 제안: 조치 불필요 수준. 굳이 개선한다면 코드 주석은 "무엇을(자기 사이트가 뭘 하는지)"만 짧게 남기고 "왜(재구성 메커니즘 전체 설명)"는 spec §1.3 단일 진실로 위임하는 정도가 가능하나, 현재도 실질적 문제(오독·오해)는 없어 강제 아님.

- **[INFO]** `CHANGELOG.md` 신규 항목 1건이 두 개의 독립된 소비 사이트 수정 (a)/(b)를 하나의 길고 조밀한 단락(약 900자)에 욱여넣었다
  - 위치: `CHANGELOG.md:34-38`
  - 상세: 기존 CHANGELOG 항목들도 유사하게 고밀도 단일 문단 스타일이라(직후의 "Manual Trigger" 항목 등) 이번 diff 가 컨벤션에서 새로 벗어난 것은 아니다. 다만 (a) IE 오적재 교정과 (b) AI Agent 미배선 교정은 코드상 독립된 두 파일 변경이라, 서브 bullet(`- (a) ...` / `- (b) ...`)으로 나누면 향후 변경 이력을 스캔하는 사람이 더 빠르게 훑을 수 있다.
  - 제안: 선택적. 기존 파일 컨벤션을 따르는 것도 무방하므로 강제 아님.

- **[INFO]** `ai-turn-executor.ts` 의 `processMultiTurnMessage` 는 이미 약 495줄(2473–2968)에 달하는 매우 긴 메서드이며, 이번 diff 가 그 안에 새 로직(주석 5줄 + `llmContext` 4줄 + 호출 인자 확장 2곳)을 별도 추출 없이 추가로 얹었다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2473`(함수 시작)~`2968`(함수 끝), 신규 코드는 `:2594-2603`·`:2743-2757`
  - 상세: 같은 클래스에 `narrowResumeState`/`buildAiNodeRefFromState`/`threadHolderFromState` 같은 소규모 헬퍼로 로직을 분리해 온 선례가 있음에도(라인 619-644), 이번 attribution 배선 로직은 거대 함수 본문에 인라인으로 추가됐다. 이번 diff 자체는 15줄 내외로 작아 함수를 유의미하게 더 길게 만들지는 않았고, 로직도 단순(객체 리터럴 조립 + 인자 전달)해 즉각적인 가독성 저해는 크지 않다. 다만 이미 과도하게 큰 함수에 계속 인라인으로 누적되는 추세는 장기적으로 유지보수 비용을 키운다.
  - 제안: 이번 PR 범위 밖. 후속으로 `processMultiTurnMessage` 자체를 단계별(입력 파싱 → 메인 chat → tool 루프 → 종결)로 쪼개는 리팩터를 고려할 만하나, 국소 버그 수정 PR 에서 강제할 사항은 아님.

## 긍정적 관찰

- `nodeId`(노드 **정의** id)와 `nodeExecutionId`(NodeExecution **row PK**)는 이름이 비슷해 혼동하기 쉬운데(이번에 고친 버그의 근본 원인), `MultiTurnState` 신규 필드 JSDoc(`information-extractor.handler.ts:147-156`)이 그 구분을 명시적으로 설명하고, 신규 회귀 테스트 2건(`ai-turn-executor.spec.ts`, `information-extractor.handler.spec.ts`) 모두 두 id 를 의도적으로 다른 값으로 세팅한 뒤 `expect(...).not.toBe(정의 id)` 로 혼동을 적극적으로 차단한다. 같은 실수의 재발을 코드 리뷰 가독성뿐 아니라 테스트로도 방어하는 좋은 패턴이다.
- 이번 diff 는 새 매직 넘버·새 중첩 깊이·새 순환 복잡도를 도입하지 않았다. `chat(a, b)` → `chat(a, b, llmContext)` 로 인자가 늘며 멀티라인으로 재포맷된 부분도 기존 코드 포맷터 컨벤션을 그대로 따른다.

## 요약

이번 diff 는 이미 존재하던 "첫 턴은 `context.*`, resume 턴은 재구성 `state.*`" 대칭 패턴을 두 소비 사이트(Information Extractor resume, AI Agent resume 메인 chat 2곳)에 정확히 적용한 국소적 버그 수정으로, 새 함수·깊은 중첩·매직 넘버·순환 복잡도 증가가 없다. 네이밍·주석 스타일·타입 캐스트 관용구는 기존 코드베이스 컨벤션과 대체로 일관되며(캐스트 스타일 차이는 "일관성 위반"이 아니라 `ai-turn-executor.ts` 자체의 기존 정책임을 코드 주석으로 직접 확인했다), `nodeId` vs `nodeExecutionId` 혼동을 막기 위한 JSDoc·회귀 테스트 장치도 갖췄다. 발견된 항목은 전부 INFO 수준으로: (1) 신규 `llmContext` 리터럴에 export 된 `LlmCallContext` 타입 주석을 붙이면 이번 버그와 동일 클래스의 오탈자를 컴파일 타임에 잡을 수 있는 저비용·고가치 개선 여지가 남아 있고, (2) 동일 rationale 설명이 6곳(코드 4 + spec 2)에 반복돼 향후 drift 동기화 부담이 있으며, (3) CHANGELOG 단일 항목이 두 독립 수정을 한 문단에 압축했고, (4) 이미 495줄에 달하는 `processMultiTurnMessage` 에 로직이 계속 인라인으로 누적되는 추세가 이번에도 소폭 이어졌다. 넷 다 차단 사유는 아니며 선택적 개선 제안 수준이다.

## 위험도

LOW
