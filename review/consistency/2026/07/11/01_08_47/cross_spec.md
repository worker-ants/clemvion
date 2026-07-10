# Cross-Spec 일관성 검토 — llm-usage-resume-followups (B-track, --impl-done)

대상 커밋: `a6f0e8b91`(HEAD, `feat(ai): resume attribution 후속 — Text Classifier 단발 서술
정밀화 + collection-retry 단언 + resume state 타이핑`), base `581d16811`(origin/main).

## 검토 범위

- B2 (doc): `spec/5-system/4-execution-engine.md` §6.1 `nodeExecutionId` 행, `CHANGELOG.md:39`
- B3 (test-only): `information-extractor.handler.spec.ts` collection-retry 2번째 chat 단언
- B4 (typing-only): `ai-turn-executor.ts` resume attribution 조립 4개 사이트 `narrowResumeState()` 경유

## 발견사항

없음 (Critical/Warning/Info 모두 무 발견).

### 확인한 정합 지점 (참고용, 이슈 아님)

- **B2 ↔ SoT (`spec/data-flow/7-llm-usage.md` §1.3)**: target 이 `4-execution-engine.md:713`
  에 추가한 "멀티턴(AI Agent / Information Extractor)의 resume 턴은 … Text Classifier(단발 —
  resume 없음)는 첫 호출의 `context.nodeExecutionId` 만 쓴다" 문구는 §1.3 표(L105-106)·콜아웃
  (L113: "Text Classifier(단발 — resume 없음)")과 문자열 수준까지 정합. `CHANGELOG.md:39` 의
  "노드 핸들러 3종 … attribution 이 모두 채워진다 — 멀티턴(AI Agent·Information Extractor)은
  첫 턴·resume 턴 모두, Text Classifier 는 단발 호출(resume 없음)" 도 동일 구분을 반영.
- **코드 근거**: `text-classifier.handler.ts` 에는 `processMultiTurnMessage` 가 존재하지 않고
  (단발 핸들러), `llmContext: { nodeExecutionId: context.nodeExecutionId, ... }` 로 첫 호출
  `context.*` 만 소비 — B2 서술과 일치. `ai-turn-executor.ts`(AI Agent) ·
  `information-extractor.handler.ts`(IE) 만 `processMultiTurnMessage`/재구성 `state`
  경로를 가짐.
- **인접 spec 무모순 확인**: `4-execution-engine.md` 의 다른 resume 관련 서술(§6.2 적용 범위
  L164: "`ai_agent` 와 `information_extractor` 의 multi-turn", §7.5 Rationale L1373/L1384: "`ai_agent`
  + `information_extractor` 지원" — Text Classifier 미포함)과 target 의 B2 정정은 처음부터
  같은 스코프(멀티턴 2종)를 가리켜 왔으므로 새 모순 없음. `spec/4-nodes/3-ai/1-ai-agent.md`
  (L720 `buildRetryReentryState` 공유), `spec/4-nodes/3-ai/3-information-extractor.md`
  (L378 `_resumeCheckpoint`/식별 필드 재유도) 도 동일하게 AI Agent·IE 두 노드만 언급하며
  Text Classifier 를 resume-capable 로 서술하는 곳은 발견되지 않음
  (`spec/4-nodes/3-ai/2-text-classifier.md` 에도 resume/멀티턴 서술 자체가 없음).
- **B3 spec-impact 0**: 추가된 테스트는 `runTurnWithCollectionRetries`(기존 코드, 무변경)의
  2번째(재시도) chat 호출이 `llmContext`(workflowId/executionId/nodeExecutionId)를 올바르게
  전달하는지 왕복 검증하는 신규 assertion 뿐 — 코드 변경 없음, 기존 §1.3 IE resume 서술과
  어긋나는 신규 동작 없음.
- **B4 spec-impact 0**: `state.X as string | undefined` raw 캐스트 4개 사이트(memory 주입
  `selfNodeId`, 요약압축 `llmContext`, 메인 chat `executionId`/`llmContext`, provider-tool
  `logUsage` args, 추출 스케줄러 `selfNodeId`)를 `this.narrowResumeState(state)`(기존 helper,
  L619, 이미 `ResumeState` 캐스트를 캡슐화) 결과 재사용으로 교체한 것 뿐 — 컴파일 타임 캐스트
  경로만 바뀌고 런타임 값(모두 동일 `state` 객체의 동일 필드 읽기)은 불변. `4-execution-engine.md`
  §1.3/§7.5 의 "재구성 `state`" 서술, `7-llm-usage.md` §1.3 의 "resume 턴은 재구성 `state.*`"
  서술 모두 이 조립 방식(어떤 캐스트 헬퍼를 쓰는지)에 대해 구체적 계약을 걸지 않으므로 충돌 여지
  자체가 없음.
- CHANGELOG 변경분 외 `data-flow/7-llm-usage.md` 자체는 diff 대상에 없으며(§1.3 은 이미 target
  정합 상태였음), 다른 데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC 관련 서술과도 접점 없음
  (본 변경은 attribution 서술·테스트·타입 접근 경로에 국한).

## 요약

target 커밋은 이미 SoT(`7-llm-usage.md §1.3`)에 정합해 있던 "Text Classifier=단발, resume 없음"
구분을 나머지 두 서술처(`4-execution-engine.md` §6.1 표, `CHANGELOG.md`)에 소급 적용하는 순수
문서 정밀화이며, B3(테스트 단언 추가)·B4(캐스트 헬퍼 통일)는 런타임 동작·spec 계약에 영향이
없는 코드 품질 변경이다. 인접 spec(1-ai-agent, 2-text-classifier, 3-information-extractor,
4-execution-engine 의 다른 섹션들) 을 전수 대조한 결과 새로 도입되는 모순은 없었고, 오히려
기존에 산재해 있던 "AI 노드 3종을 뭉뚱그리는" 서술 2곳을 SoT 기준으로 정합화해 cross-spec
일관성을 개선했다. Critical 급 불일치 없음 — BLOCK 사유 없음.

## 위험도

NONE
