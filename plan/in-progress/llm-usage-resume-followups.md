---
worktree: llm-usage-resume-followups
started: 2026-07-11
owner: developer
spec: spec/data-flow/7-llm-usage.md §1.3
precedent: PR #879/#900 resume attribution 후속 (B-track, INFO#3/#4 + resume state 타이핑)
---

# LLM-usage resume 후속 정리 (B-track: B2 doc + B3 test + B4 typing)

`resume-llm-usage-attribution.md` §최종 INFO 의 B2~B4. 착수 시 origin/main(`581d16811`) 대조로
셋 다 genuine 확인(A2/A4 처럼 이미 해소된 것 아님):

## 변경 세트

### B2 (doc) — Text Classifier 단발(resume 없음) 서술 정밀화
`§1.3` 콜아웃은 이미 "Text Classifier(단발 — resume 없음)" 로 정정됐으나, 두 곳이 아직 Text
Classifier 를 resume-capable 핸들러와 뭉뚱그린다:
- [x] `spec/5-system/4-execution-engine.md:713` (§6.1 ExecutionContext 표 `nodeExecutionId` 행):
      "AI·멀티턴 핸들러(AI Agent / **Text Classifier** / Information Extractor) … resume 턴은 …" →
      멀티턴(AI Agent / IE)만 resume 턴, Text Classifier 는 단발 `context.nodeExecutionId` 로 분리.
- [x] `CHANGELOG.md:39`: "노드 핸들러 3종 … 의 **첫 턴·resume 턴** attribution 이 모두 채워진다" →
      멀티턴은 첫 턴·resume 턴, Text Classifier 는 단발(resume 없음)로 분리.

### B3 (test) — IE collection-retry 루프 2번째 chat attribution 단언
`runTurnWithCollectionRetries`(IE handler)는 이미 `for(;;)` 각 iteration 의 `traceChat` 에
`params.llmContext` 를 전달한다(L1037, "WARNING#5"). 코드는 정상이나 **retry(2번째) chat 의
attribution 을 왕복 검증하는 테스트가 없다** — 기존 'collection retry loop' 의 "feeds tool_result
back and loops" 테스트(spec L994)는 `toHaveBeenCalledTimes(2)` 만 단언. ai_agent tool-loop 2번째
chat 단언과 대칭으로 회귀 고정:
- [x] `information-extractor.handler.spec.ts` collection-retry 테스트에 `chat.mock.calls[1][2]`
      (2번째 호출 llmContext)가 workflowId/executionId/nodeExecutionId 를 담는지 단언 추가.

### B4 (typing) — resume state attribution 접근 타입화
`ResumeState`(zod `resumeStateSchema`, `.partial()`)는 이미 `workflowId`/`executionId`/
`nodeExecutionId` 를 optional string 으로 보유하고 `narrowResumeState(state)` helper(L619)도 있다.
그러나 attribution llmContext 조립 2곳이 raw `state.X as string | undefined` 캐스트를 쓴다 — 필드명
오탈자를 컴파일 타임에 못 잡는다(B1 이 소비측 llmContext 를 타입화한 것의 **소스측 대칭**):
- [x] `ai-turn-executor.ts` `applyMultiTurnTurnMemory`(L2298 부근) + resume 메인 chat(L2614 부근)의
      attribution 필드를 `narrowResumeState(state).{workflowId,executionId,nodeExecutionId}` 로 교체.
      (summaryModelConfigId 등 non-attribution·catchall 필드는 범위 밖 — 계속 캐스트.)

## 워크플로 (developer)

- [x] consistency-check --impl-prep (cross_spec, `review/consistency/2026/07/11/00_46_31/`) — BLOCK:NO,
      B2 전제(Text Classifier=단발) 코드 확인, B4 3번째 캐스트 사이트(L2715) 힌트 반영.
- [x] B3 test → B4 typing → B2 doc 순 구현 (B4: 3 attribution 사이트 + nodeId; 리뷰 후 4번째 nodeId L2815 추가)
- [x] TEST WORKFLOW — lint/build/unit(backend 400·7963 + frontend 271·5319 전량)/e2e(249) **전량 PASS**
- [x] /ai-review (`review/code/2026/07/11/00_58_46/`) — Critical 0/Warning 0. INFO#1(L2815 잔여 캐스트) FIX. RESOLUTION.md
- [x] consistency-check --impl-done → PR → plan/complete/ 이동
