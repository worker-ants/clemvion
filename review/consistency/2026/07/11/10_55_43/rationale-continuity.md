# Rationale 연속성 검토 — resume 식별 필드 hydration 헬퍼 기각 기록 (task_6da430a3)

대상: `spec/5-system/4-execution-engine.md` §Rationale "resume/retry 턴 usage-log attribution — 식별
필드 재유도 불변식" 하위, "적용 범위 (재구성 vs. 소비)" 문단 직후 신설된 "기각된 대안 — 재개 식별
필드 hydration 전용 헬퍼" 문단 (`spec/5-system/4-execution-engine.md:1386`).

## 발견사항

### [Warning] PR 번호 오귀속 — "B1" 은 PR #907 이 아니라 PR #900 산출물

- target 위치: `spec/5-system/4-execution-engine.md:1386` — "...소비측은 `LlmCallContext` 명시 타입이
  대칭 보강한다(PR #907 B1)."
- 과거 결정 출처: `plan/in-progress/resume-llm-usage-attribution.md:83-86` (최종 /ai-review INFO
  후속 목록) — "`ai-turn-executor.ts` `llmContext` 에 `LlmCallContext` 명시 타입 주석 추가(INFO#1) →
  **후속 plan `ai-usage-attribution-hardening.md` B1 로 처리(PR-1)**." 및 커밋 `0c6e53b81`
  ("fix(ai): AI Agent 자동 메모리 롤링 요약 압축 chat 의 llm_usage_log attribution 배선 (#879
  follow-up **B1**+C1) (#900)", 본문: "B1: ai-turn-executor.ts resume llmContext 에
  `LlmCallContext` 명시 타입 주석 — attribution 필드 오탈자를 TS excess-property check 로 컴파일
  타임 차단").
- 상세: `git log --oneline` 으로 확인한 실제 이력은 B1(명시 `LlmCallContext` 타입 주석)이 **PR #900**
  (`ai-usage-attribution-hardening`)에서 완료됐고, PR #907(`bfa558f59`, "resume attribution 후속
  (B-track)")의 커밋 본문은 스스로 B2(doc)·B3(test)·B4(typing) 세 항목만 나열하며 B4 는 "raw state.X
  캐스트를 **기존** `narrowResumeState(state)` 로 교체"라고 명시한다 — B1 을 #907 의 산출물로 다루지
  않는다. 즉 target 이 "(PR #907 B1)" 이라고 인용한 것은 PR 번호가 틀렸다(정확히는 PR #900). 코드
  현실(`ai-turn-executor.ts:2618` `const llmContext: LlmCallContext = {...}`)은 target 의 기술적
  주장(명시 타입 주석 존재)과 일치하므로 **won't-do 의 결론 자체는 유효**하지만, 근거로 인용한 PR
  provenance 가 부정확해 향후 이 결정을 재검증할 때 잘못된 커밋을 추적하게 만든다.
- 제안: "(PR #907 B1)" → "(PR #900 B1)" 로 정정.

### [Warning] "필드 목록의 단일 진실은 이미 `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS` 가 보유" — IE 측엔 해당 SoT 가 실제로 연결돼 있지 않음

- target 위치: `spec/5-system/4-execution-engine.md:1386` 마지막 문장 — "필드 목록의 단일 진실은 이미
  `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS` 가 보유하며, 위 불변식이 그 재주입을 spec 으로
  강제한다." 및 바로 앞 "오탈자-안전이라는 원래 목적은 PR #907(B4)이 `narrowResumeState(state)` 타입
  접근으로 이미 달성했다" (이 문단은 "두 노드" — `ai-turn-executor`/`information-extractor.handler`
  — 모두를 대상으로 서술).
- 과거 결정 출처: 같은 문서 §Rationale "적용 범위 (재구성 vs. 소비)" 문단(`4-execution-engine.md:1384`)
  — `ai_agent`·`information_extractor` 두 노드가 §1.3 두 재유도 채널을 "정합 소비"한다고 서술.
- 상세: 코드 확인 결과 `narrowResumeState`/`ResumeState`(← `resumeStateSchema`)/`CREDENTIAL_CONTEXT_FIELDS`
  는 전부 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` +
  `.../resume-state.schema.ts` 전용이며 (`CREDENTIAL_CONTEXT_FIELDS` 참조처는
  `ai-agent.memory.spec.ts`/`execution-engine.service.spec.ts`/`resume-state.schema*.ts` 뿐,
  `grep -rn "CREDENTIAL_CONTEXT_FIELDS|resumeStateSchema" codebase/backend/src/nodes/ai/information-extractor/`
  결과 0건). `information-extractor.handler.ts:95-189` 는 `workflowId?: string; nodeExecutionId?: string;`
  를 포함한 완전히 별도의 손수 작성 `MultiTurnState` interface 를 유지하며(PR #879 에서 추가,
  `79669505c` 커밋 본문 "MultiTurnState/hydrateState 에 workflowId/nodeExecutionId 추가"), `resumeStateSchema`
  파생 타입과 아무 참조 관계가 없다. 즉 실제로는 두 개의 독립적인 필드-목록 SoT 가 존재한다 —
  (a) `ai_agent` 측 `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS`, (b) IE 측 손수 유지되는
  `MultiTurnState`. target 문단은 이를 하나의 SoT 인 것처럼 서술해, 두 목록이 향후 독립적으로
  drift(예: `CREDENTIAL_CONTEXT_FIELDS` 개편 시 IE `MultiTurnState` 미동기화)할 위험을 가린다. 또한
  "narrowResumeState(state) 타입 접근" 자체도 `information-extractor.handler.ts` 에는 전혀 존재하지
  않는(grep 0건) ai-turn-executor 전용 메서드이므로, "두 노드"의 오탈자-안전이 "PR #907(B4)"라는
  단일 메커니즘/단일 PR 로 달성됐다는 인상은 부정확하다 — IE 측 보호는 PR #879 에서 만들어진 별개의
  선재 메커니즘(hand-written `MultiTurnState`)이다.
  (결론 자체 — 공용 헬퍼 도입 불필요 — 는 두 메커니즘이 각자 독립적으로 이미 타입-안전하다는
  점에서 여전히 유지 가능하나, 이 근거 문장은 "단일 SoT" 라는 사실과 다른 인상을 준다.)
- 제안: 문장을 "ai_agent 측 필드 목록의 단일 진실은 `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS`
  가, IE 측은 별도의 `MultiTurnState` interface(PR #879)가 각각 보유하며, 두 목록은 현재 컴파일 타임
  cross-check 이 없다"는 식으로 정확히 구분해 기술하거나, 두 목록의 drift 위험을 별도 후속 항목으로
  기록.

### 상기 두 건 외 — 콘텐츠 정합 자체는 문제 없음

- 세 재개-hydration 사이트의 shape 서술(§ "(2)" 근거)은 코드와 정확히 일치함을 확인했다 —
  `ai-turn-executor.ts:2618-2622`(main chat, 3필드 `LlmCallContext` 명시 타입, fallback 없음),
  `ai-turn-executor.ts:2713-2721`(provider-tool batch, `executionId`/`nodeId`/`nodeExecutionId`/
  `workflowId`/`workspaceId` 5필드 + `?? ''` fallback), `information-extractor.handler.ts:891-897`
  (IE, `executionId`/`workflowId`/`nodeExecutionId` 3필드가 `state.executionId ? {...} : undefined`
  조건부 전체 블록으로 감싸짐). target 의 shape 묘사는 정확하다 — "이득 marginal" 논거는 이 부분에서
  성립한다.
- 이 신설 문단은 어떤 기존 결정도 뒤집지 않는다 — `#501` 불변식(식별 필드 재유도), "적용 범위"
  문단의 소비 계층 구분, `_resumeCheckpoint` "선례 일반화" 문단과 충돌 없음. 실제 코드에도
  `ResumeIdentificationFields`/`pickResumeIdentificationFields()` 심볼은 존재하지 않으며(grep 0건),
  어떤 `plan/` 문서도 이 헬퍼 도입을 커밋된 작업으로 등록한 바 없다 — 순수 결정-기록(won't-do)이며
  "결정의 무근거 번복"에 해당하지 않는다.
- 프로젝트의 기존 유사 선례(memory: "cafe24/makeshop 미러 중복은 의도(철회)" — DRY 통합보다 안정성/
  churn 회피를 우선한 결정)와도 스타일이 일관된다.

## 요약

신설 문단은 실제로 존재하지 않는 헬퍼(`ResumeIdentificationFields`/`pickResumeIdentificationFields()`)를
기각하는 순수 결정-기록으로, 기존 `#501` 불변식·"적용 범위"·`_resumeCheckpoint` 선례 문단과 충돌하거나
과거 결정을 무근거로 번복하지 않는다. 세 재개-hydration 사이트의 shape 차이 서술도 코드와 정확히
일치한다. 다만 근거로 인용한 PR provenance 에 오류가 있다 — "(PR #907 B1)"은 실제로 PR #900 산출물이며,
"필드 목록의 단일 진실은 이미 resumeStateSchema/CREDENTIAL_CONTEXT_FIELDS 가 보유"라는 서술은
`ai_agent` 측에만 참이고 `information_extractor` 측은 별도의 손수 유지되는 `MultiTurnState` 필드
목록(PR #879, `resumeStateSchema` 미참조)을 쓴다는 사실을 가린다. 두 건 모두 결론(공용 헬퍼 불필요)을
뒤집을 정도는 아니지만, Rationale 의 사실 정확성·향후 추적 가능성을 훼손하므로 WARNING 으로 기록하고
정정을 권고한다.

## 위험도

MEDIUM

STATUS: DONE
