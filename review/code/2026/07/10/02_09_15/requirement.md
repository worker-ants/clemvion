# 요구사항(Requirement) Review — 멀티턴 resume 턴 llm_usage_log attribution (IE node_execution_id 오적재 + ai_agent 메인 chat)

## 검증 방법

diff 대상 실질 코드 파일 5개(`execution-engine.service.ts`, `ai-turn-executor.ts`/`.spec.ts`,
`information-extractor.handler.ts`/`.spec.ts`) + spec 2개(`spec/data-flow/7-llm-usage.md`,
`spec/5-system/4-execution-engine.md`) + `CHANGELOG.md`/plan 문서를 worktree HEAD 기준으로 직접
Read 하고, 서술된 데이터 흐름을 종단간 재추적했다(별도 review 산출물 파일 19개는 이전 리뷰 라운드의
결과물이며 본 PR 의 실질 diff 는 코드 5 + spec 2 + CHANGELOG + plan 총 9 파일):

- `execution-engine.service.ts:4845-4974` `buildRetryReentryState` — `workflowId: execution.workflowId`,
  `nodeExecutionId: opts?.nodeExecutionId` 확인 (opts 로만 주입, context 로는 안 옴 — 주석 서술과 일치).
- `retry-turn.service.ts:344-350` → `{ nodeExecutionId: spawnedRow.id }` / `ai-turn-orchestrator.service.ts:102-109`
  → `{ resumeMode: true, nodeExecutionId: ctx.nodeExec?.id }` — 두 호출측 모두 opts 로 실제 NodeExecution
  row PK 를 주입함을 확인.
- `resume-state.schema.ts:118,121,150-156` — `workflowId`/`nodeExecutionId` 가 `CREDENTIAL_CONTEXT_FIELDS`
  포함 스키마에 이미 등재(선행 PR #877) — 본 PR 소비 사이트가 실재하는 필드를 읽는 것 확인.
- `information-extractor.handler.ts:150-158`(`MultiTurnState` 신규 필드), `:886-897`(resume `llmContext`
  = `{ executionId: state.executionId, workflowId: state.workflowId, nodeExecutionId: state.nodeExecutionId }`),
  `:1849-1852`(`hydrateState` 가 `raw.workflowId`/`raw.nodeExecutionId` 역직렬화) — `state.nodeId`(정의 id)를
  더 이상 쓰지 않음을 확인. 회귀 전 상태(과거 `nodeExecutionId: state.nodeId`)는 git blame 상 존재했던
  패턴과 일치.
- `ai-turn-executor.ts:2550`(`const executionId = state.executionId ...`), `:2594-2615`(신규 `llmContext`
  const, 메인 chat 1차 호출 3번째 인자로 전달), `:2689-2757`(tool-loop 후속 chat 도 동일 `llmContext` 재사용) —
  두 `llmService.chat` 호출 사이트 모두 배선됨을 확인. `executeSingleTurn`(:1509-1528)이 `context.*` 를
  쓰는 것과 대칭.
- `llm.service.ts:41-45`(`LlmCallContext` 타입) → `:154-196`(`chat()` 3번째 인자 → `usageLogService.record({
  workflowId: context?.workflowId, executionId: context?.executionId, nodeExecutionId: context?.nodeExecutionId,
  ... })`) — attribution 체인 종단(컬럼 매핑)까지 확인.
- `text-classifier.handler.ts:197-210` — `processMultiTurnMessage`/resume 로직 부재(grep 결과 없음),
  `context.workflowId/executionId/nodeExecutionId` 로 단발 채움 — spec 표의 "Text Classifier(단발 — resume
  없음)" 서술과 정합.
- `agent-memory-injection.ts:372`, `graph-extraction.service.ts:276-295`(context 자리 `undefined` 명시),
  `agent-memory-extraction.processor.ts:71-80`, `rerank.service.ts:253-260` — 4곳 모두 context 미전달
  그대로(비변경) 확인, spec 의 "잔여 NULL" 목록과 일치.
- 관련 unit spec 2개 파일 직접 실행 — `npx jest ai-turn-executor.spec.ts information-extractor.handler.spec.ts`
  → **2 suites / 66 tests 전부 통과** (RESOLUTION.md 의 66/66 claim 과 일치).
- `spec/data-flow/7-llm-usage.md` §1.3 표·attribution 콜아웃(Text Classifier 를 별도 절로 분리한
  갱신본 확인 — 직전 리뷰 라운드 INFO#11 fix 반영됨)·§4 표·Rationale, `spec/5-system/4-execution-engine.md`
  §6.1 `nodeExecutionId` 행을 실제 코드 상태와 line-level 대조 — 전부 일치.

## 발견사항

- **[INFO]** CHANGELOG 본문의 "노드 핸들러 3종(AI Agent·Text Classifier·Information Extractor)의 첫
  턴·resume 턴 attribution 이 모두 채워진다" 문장이, 이미 spec §1.3 콜아웃에서 분리된("Text
  Classifier(단발 — resume 없음)") 구분을 CHANGELOG 자체에는 반영하지 않아 Text Classifier 도 resume
  턴을 갖는 것으로 오독될 여지가 남아 있음
  - 위치: `CHANGELOG.md:39` ("이로써 노드 핸들러 3종(AI Agent·Text Classifier·Information Extractor)의
    첫 턴·resume 턴 attribution 이 모두 채워진다.")
  - 상세: 직전 리뷰 라운드에서 동일한 모호성이 `spec/data-flow/7-llm-usage.md` §1.3 콜아웃에 있던 것을
    INFO#11 로 지적해 "Text Classifier(단발)" 로 분리 수정했다(현재 spec 본문은 정확함, 직접 확인).
    그러나 같은 문구 패턴이 CHANGELOG 에는 그대로 남아 있다. CHANGELOG 는 spec 처럼 line-level 정합
    의무 대상은 아니고 실질 오정보도 아니지만(문장을 "3종 모두 attribution 이 채워진다"는 의미로 읽으면
    사실과 부합 — Text Classifier 는 애초부터 단발로 채워짐), "첫 턴·resume 턴" 이라는 병렬 표현이
    Text Classifier 에도 적용되는 것처럼 읽힐 수 있다는 점에서 spec 과 동일한 사소한 리스크.
  - 제안: 조치 불요(차단 아님). 후속 CHANGELOG 편집 시 "AI Agent/IE 는 첫 턴·resume 턴, Text
    Classifier(단발)는 호출 시점" 으로 spec 표현과 맞추면 더 명확.

- **[INFO]** `hydrateState`/`ai-turn-executor.ts` 의 신규 `workflowId`/`nodeExecutionId` 필드 모두
  런타임 스키마 검증 없이 `as string | undefined` 캐스트만 거침 — 레거시(배포 이전) 영속 checkpoint 에
  해당 필드가 없으면 조용히 `undefined` → `llm_usage_log` 컬럼 NULL 로 저하
  - 위치: `information-extractor.handler.ts:1851-1852`, `ai-turn-executor.ts:2599-2603`
  - 상세: 직접 코드 추적으로 확인 — 두 사이트 모두 크래시 없이 `undefined` 로 안전하게 저하하며(옵셔널
    필드, `llmService.chat`/`usageLogService.record` 는 이를 읽기 전용으로만 사용), 신규 실행부터는
    `buildRetryReentryState`(#877)가 항상 채우므로 실무 영향은 in-flight 레거시 checkpoint 한정
    과도기적 갭이다. 기존 관례(동일 파일의 다른 필드들도 무검증 캐스트)를 그대로 따른 것이라 이번
    diff 가 새로 도입한 리스크는 아니다. 이전 리뷰 라운드(security/testing INFO)에서 이미 동일하게
    포착·처분(defer)됨.
  - 제안: 이번 PR 범위에서는 조치 불요. 후속 강화 시 zod 등 resume-state 스키마 검증을 handler 측까지
    확장 권장(엔진 측 `resume-state.schema.ts` 는 이미 등재돼 있음).

- **[INFO]** spec fidelity — `spec/data-flow/7-llm-usage.md` §1.3 캐탈로그 표·attribution 콜아웃·§4 표·
  Rationale, `spec/5-system/4-execution-engine.md` §6.1 `nodeExecutionId` 행이 실제 코드(위 end-to-end
  추적 결과)와 line-level 로 일치. 잔여 NULL 대상(GraphExtractionService·RerankService listwise·
  AgentMemory 추출 processor·AI Agent 메모리 롤링 요약 압축)도 코드 대조로 확인된 그대로 서술됨. spec
  결함 없음, SPEC-DRIFT 아님(코드와 spec 이 이번 PR 로 함께 갱신되어 동기 상태).

## 요약

`buildRetryReentryState`(선행 PR #877)가 재구성 state 에 실어주는 `workflowId`/`nodeExecutionId`(현재
turn 의 NodeExecution row PK)를, 미교정 상태였던 두 소비 사이트(Information Extractor resume 턴의
`traceChat` llmContext, AI Agent `ai-turn-executor.ts` `processMultiTurnMessage` 의 메인 chat 2곳 —
최초 진입 + tool-call 루프 후속 호출)가 이제 정확히 소비하도록 고쳤다. IE 쪽은 과거 `state.nodeId`
(노드 정의 id)를 `node_execution_id` 자리에 오적재하던 FK 오류와 `workflow_id` 누락을 모두 교정했고,
AI Agent 쪽은 `LlmCallContext` 자체가 전달되지 않아 3컬럼이 NULL이던 갭을 해소했다. 실제 코드를
`retry-turn.service.ts`/`ai-turn-orchestrator.service.ts`(주입원) → handler(소비) → `llm.service.ts`
(전달) → `usageLogService.record`(INSERT 컬럼 매핑) 까지 전 구간을 직접 Read 로 재추적한 결과, 문서화된
데이터 흐름이 실제 코드와 정확히 일치한다. `text-classifier.handler.ts`(단발, 비변경)와
`agent-memory-injection.ts`/`graph-extraction.service.ts`/`rerank.service.ts`/
`agent-memory-extraction.processor.ts`(잔여 NULL, 비변경) 도 대조 확인해 spec 의 "채움/미채움" 구분과
정확히 부합함을 확인했다. 신규 회귀 테스트 2건(row PK vs 정의 id 를 서로 다른 값으로 부여해 혼동을
배제하는 설계 + tool-loop 2차 호출 직접 단언)을 포함해 관련 unit spec 66/66 이 실제로 통과함을 직접
재실행으로 확인했다. `execution-engine.service.ts` 는 주석 2줄 추가뿐이며 `buildRetryReentryState`
로직 자체는 무변경이라는 CHANGELOG/plan 서술도 diff 와 정확히 일치한다. `spec/data-flow/7-llm-usage.md`·
`spec/5-system/4-execution-engine.md` 갱신도 실측 코드 상태와 line-level 로 부합해 spec fidelity 이슈가
없다. TODO/FIXME, 미완성 분기, 반환값 누락, 처리되지 않은 에러 시나리오는 발견되지 않았다. 발견된 2건은
모두 이전 리뷰 라운드에서 이미 동일하게 포착·처분(defer)된 항목의 재확인 수준의 INFO 로, 신규 결함은
없다.

## 위험도

NONE
