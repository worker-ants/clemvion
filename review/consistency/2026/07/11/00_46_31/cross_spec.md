# Cross-Spec 일관성 검토 — llm-usage-resume-followups (B-track: B2 doc + B3 test + B4 typing)

모드: `--impl-prep`. 대상 plan: `plan/in-progress/llm-usage-resume-followups.md`.
검토 시점 HEAD: `581d16811`(origin/main 과 동일 — 아직 B-track 코드 변경 미착수, plan 파일만 untracked).

## 발견사항

- **[INFO]** B2 의 전제("Text Classifier = 단발, resume 없음")는 코드·spec 양쪽에서 확인됨 — 정정 대상 산정이 정확함
  - target 위치: plan §B2 (`spec/5-system/4-execution-engine.md:713`, `CHANGELOG.md:39`)
  - 확인 근거:
    - `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts` 에 `processMultiTurnMessage`/`waiting_for_input`/`multiTurn` 관련 코드가 전혀 없음(`grep` 0건). 반면 `information-extractor.handler.ts`·`ai-agent.handler.ts`/`ai-turn-executor.ts` 는 `processMultiTurnMessage` 를 구현.
    - `spec/5-system/4-execution-engine.md:164`(§checkpoint 적용 범위)이 "**적용 범위**: `ai_agent` 와 `information_extractor` 의 multi-turn" 이라고 명문화 — `buildRetryReentryState`/checkpoint 재구성 메커니즘 자체가 애초에 Text Classifier 를 다루지 않음. 같은 파일 §1373 "`ai_agent` + `information_extractor` 지원(초기 `ai_agent` 한정에서 확장)" 도 2노드 한정을 재확인.
    - `spec/data-flow/7-llm-usage.md:106`(§1.3 표)과 `:113`(attribution 콜아웃)은 **이미** "Text Classifier 단발(`context.*`)" vs "멀티턴 AI 노드(AI Agent / Information Extractor)는 첫 턴·resume 턴 모두" 로 정확히 분리돼 있어 이 SoT 자체는 손댈 필요 없음.
  - 결론: `4-execution-engine.md:713`("AI·멀티턴 핸들러(AI Agent / Text Classifier / Information Extractor)")과 `CHANGELOG.md:39`("노드 핸들러 3종 … 첫 턴·resume 턴 attribution 이 모두 채워진다")만이 Text Classifier 를 resume-capable 로 뭉뚱그린 유이(有二)한 잔존 지점이며, plan 의 타겟팅이 정확함. 별도 조치 불필요.

- **[INFO]** B2 정정 대상 외 인접 spec 은 이미 정합 — 새 모순 생성 위험 낮음
  - target 위치: 전체 spec 교차 검색 결과
  - 상세: `AI Agent / Text Classifier / Information Extractor` 3종을 함께 언급하는 다른 지점들(`spec/0-overview.md:74`, `spec/2-navigation/14-execution-history.md:253/259`, `spec/3-workflow-editor/_product-overview.md:120`, `spec/3-workflow-editor/3-execution.md:471`, `spec/4-nodes/3-ai/0-common.md:39/122/171`, `spec/5-system/7-llm-client.md:28`, `spec/5-system/13-replay-rerun.md:181-182`, `spec/data-flow/7-llm-usage.md:163/200`)는 UI 탭 구성·LLM 추상화·dry-run 정책·attribution 채움 "완료 여부"처럼 resume 메커니즘 차이와 무관한 맥락에서만 3종을 그룹핑한다 — B2 정정(resume 턴 유무 분리)과 충돌하지 않음. `4-execution-engine.md` 내부에도 "Text Classifier" 언급은 §6.1 L713 단 한 곳뿐(다른 §7.x 절엔 등장하지 않음)이라 doc 정정 후 자기모순이 남지 않는다.
  - 제안: 없음(정보성 확인).

- **[INFO]** B3(IE collection-retry 2번째 chat 단언)는 순수 테스트 추가, spec 영향 없음 — AI Agent 측 기존 대칭 패턴 확인됨
  - target 위치: `information-extractor.handler.ts:1027-1037`(`traceChat(..., params.llmContext, ...)`), 대칭 테스트: `ai-turn-executor.spec.ts:520-522`(`chat.mock.calls[1][2]` 단언, "tool-loop 후속(2번째) chat 호출도 동일 llmContext 로" 주석)
  - 상세: IE 의 `runTurnWithCollectionRetries` 는 이미 매 iteration 에 `params.llmContext` 를 전달하며(코드 무변경), 기존 `collection retry loop` 테스트(`information-extractor.handler.spec.ts:994-1018`)는 `toHaveBeenCalledTimes(2)` 만 단언하고 2번째 호출의 `llmContext` 내용은 미검증. B3 은 AI Agent 쪽에 이미 존재하는 대칭 패턴을 그대로 IE 에 이식하는 회귀 고정 테스트로, spec 텍스트·behavior 어느 쪽에도 영향 없음.

- **[INFO]** B4(resume attribution 타이핑 교체) 선언 범위 "2곳" 외에 동일 패턴의 raw cast 가 1곳 더 존재 — B4 자체엔 무해하나 완결성 참고
  - target 위치: `ai-turn-executor.ts` (plan 이 명시한 L2298 부근 `applyMultiTurnTurnMemory`, L2614 부근 resume 메인 chat 은 실측 라인 `2299/2301`, `2615/2617` 과 일치)
  - 상세: 동일 raw cast 패턴(`state.workflowId as string | undefined` / `state.nodeExecutionId as string | undefined`)이 `executeProviderToolBatch` 호출부(실측 `2715-2716`, tool-batch attribution 인자)에도 존재한다. plan 은 "(summaryModelConfigId 등 non-attribution·catchall 필드는 범위 밖 — 계속 캐스트.)" 로 제외 필드를 명시했지만 tool-batch site 는 이 제외 사유에 해당하지 않는 **attribution 필드의 동일 raw cast**이며 명시적으로 스코프에서 빠져 있다(CHANGELOG 상 "tool-batch 는 이미 소비 중" — 즉 이미 값은 올바르게 전달되고 있어 **behavior** 이슈는 없음, 타이핑 일관성만 남는 문제).
  - 제안: spec/behavior 에는 무영향이므로 B4 를 막을 사유는 아님. 다만 "attribution 필드를 narrowResumeState 로 통일" 이라는 B4 의 목표를 완전히 달성하려면 이 3번째 site 도 같은 커밋에서 함께 교체하거나, 범위 제외를 plan/커밋 메시지에 명시적으로 남겨 향후 "왜 여기만 raw cast 로 남았는지" 재질문이 없도록 하는 것을 권장(선택 사항, blocking 아님).

- **[INFO]** IE 의 resume attribution 은 이미 `ResumeState` 타입 파라미터를 직접 사용 — B4 가 ai-turn-executor.ts 만 다루는 것과 비대칭이지만 정합
  - target 위치: `information-extractor.handler.ts:886-895`
  - 상세: IE 핸들러의 resume 경로는 `state: ResumeState` 를 함수 파라미터로 직접 받아 `state.executionId`/`state.workflowId`/`state.nodeExecutionId` 를 캐스트 없이 타입 접근한다(AI Agent 의 in-memory `_resumeState: Record<string, unknown>` 와 달리 이미 타입화됨). 따라서 B4 를 `ai-turn-executor.ts` 한정으로 좁힌 plan 의 스코프는 "IE 는 이미 해결됨" 전제와 정합하며 누락이 아니다.

## 요약

이번 B-track 은 (1) `spec/5-system/4-execution-engine.md:713`·`CHANGELOG.md:39` 두 곳에 남아있던 "Text Classifier 도 resume 턴을 가진다"는 오기(誤記)를 정정하는 문서 전용 변경(B2), (2) IE collection-retry 2번째 chat 의 attribution 회귀 고정 테스트 추가(B3, 코드 무변경), (3) AI Agent resume attribution 조립부의 raw cast 를 `narrowResumeState` 로 교체하는 behavior-preserving 타이핑 변경(B4)으로 구성된다. 코드(`processMultiTurnMessage` 구현 유무)와 실행 엔진 checkpoint 적용 범위 명세(§6.1 "적용 범위: ai_agent 와 information_extractor") 양쪽 모두 Text Classifier 의 단발/resume-불가 특성을 뒷받침하므로 B2 의 전제와 타겟 산정은 정확하고, 정정 후에도 다른 spec 영역과 새로운 모순이 생기지 않는다. B3/B4 는 선언대로 spec 영향이 없는 code-only 변경이며, B4 스코프에서 제외된 tool-batch 사이트(실측 L2715-2716)의 동일 패턴 raw cast 는 behavior 상 문제가 없는 순수 타이핑 완결성 참고사항(권장, 비차단)이다. 이 접근으로 구현할 때 예견되는 Critical 급 spec 충돌은 없다.

## 위험도

LOW
