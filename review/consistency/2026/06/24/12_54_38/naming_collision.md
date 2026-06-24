# 신규 식별자 충돌 Check — spec-draft-m3-m1-ai-assistant-sync

## 발견사항

### [INFO] `MIN_NONTRIGGER_NODES_FOR_VERIFY` — spec 에 처음 등장하는 신규 상수명, 충돌 없음
- target 신규 식별자: `MIN_NONTRIGGER_NODES_FOR_VERIFY`
- 기존 사용처: 해당 상수는 현재 spec 에 등장하지 않음. `spec/3-workflow-editor/4-ai-assistant.md` L680/L945 에는 삭제 대상인 `MIN_EDITS_FOR_VERIFY`(가짜 상수) 만 존재.
- 상세: target 이 도입하는 이름이 spec 내 다른 의미로 쓰인 사례 없음. `MIN_EDITS_FOR_VERIFY` 와 이름 구조가 유사하나, target 의 편집(1-B/1-C)이 전자를 후자로 교체하는 것이므로 공존 충돌이 아니라 교체 관계.
- 제안: 이상 없음. 편집 완료 후 spec 전체에서 `MIN_EDITS_FOR_VERIFY` 잔존 여부를 재확인.

### [INFO] `MAX_REVIEW_ROUNDS` — spec 에 처음 도입되는 상수명, 충돌 없음
- target 신규 식별자: `MAX_REVIEW_ROUNDS`
- 기존 사용처: spec 내 0건. `spec/3-workflow-editor/4-ai-assistant.md` L958 에는 `state.reviewRoundCount >= 2` 라는 리터럴 숫자 표기만 있음.
- 상세: target 1-D 가 리터럴 `2` 를 `MAX_REVIEW_ROUNDS`(=2) 로 교체한다. 동일 이름이 다른 의미로 쓰인 곳은 없음. `plan/in-progress/refactor/02-architecture.md` 에서는 이미 이 이름으로 구현 언급이 있어 일관성에 부합.
- 제안: 이상 없음.

### [INFO] `AssistantFinishGuard` / `AssistantTurnPersistenceService` / `AssistantToolRouter` — spec 에 처음 도입되는 클래스명, 충돌 없음
- target 신규 식별자: 위 3개 클래스명 (1-H 의 Rationale 섹션 + 3-A 의 행위자 표기에서 신규 등장)
- 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md` 본문에는 미등장. `plan/in-progress/refactor/02-architecture.md` 의 구현 체크리스트(플랜 문서)에는 이미 존재하나, spec 문서에는 없음.
- 상세: 충돌 없음. 단, `plan/in-progress/refactor/02-architecture.md` L201 에 `AssistantFinishGuard`/`AssistantReviewGuard` 라는 병기 표현이 있는데, 실제 구현된 클래스명은 `AssistantFinishGuard` 단일 이름이다(같은 문서 L191 에서 확인). target 이 spec Rationale 에 삽입하는 `AssistantFinishGuard` 는 구현 실체와 일치하므로 문제없음. `AssistantReviewGuard` 는 초기 설계 후보명으로 L201 에 한 번 언급되나 실제 클래스로 존재하지 않으며 spec 에도 도입되지 않으므로 충돌 위험이 없다.
- 제안: 이상 없음. 향후 spec 독자 혼선 방지를 위해 plan 문서의 L201 `AssistantReviewGuard` 병기는 별도 plan 정리 기회에 `AssistantFinishGuard` 단일 표기로 통일하면 좋으나 spec-sync 차단 사유는 아님.

### [INFO] `AiConditionEvaluator` / `AiMemoryManager` / `AiTurnExecutor` — spec 에 처음 도입되는 클래스명, 충돌 없음
- target 신규 식별자: 위 3개 (2-A frontmatter, 2-B 본문 참조, 2-C Rationale)
- 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md` 본문에는 미등장. `spec/5-system/4-execution-engine.md` 에는 같은 nodes/ai 영역의 별도 클래스 `AiTurnOrchestrator` 가 여러 번 등장하나 이는 execution-engine 모듈의 클래스로 이름·영역·역할 모두 다름.
- 상세: `AiTurnExecutor`(nodes/ai/ai-agent 담당, single/multi turn LLM 루프)와 `AiTurnOrchestrator`(execution-engine 담당, AI 멀티턴 lifecycle park/resume)는 이름이 유사하나 다른 모듈·다른 역할이다. spec 에서 `AiTurnOrchestrator`는 `spec/4-nodes/3-ai/1-ai-agent.md` L1101·L12 에도 이미 포인터(`ai-turn-orchestrator.service.ts`)로 등재돼 있다. target 이 삽입하는 `AiTurnExecutor`(`ai-turn-executor.ts`)는 다른 파일이므로 경로 충돌은 없다.
- 제안: 이상 없음. 그러나 `AiTurnExecutor`(노드 turn loop 추출)와 `AiTurnOrchestrator`(엔진 park/resume)는 이름 유사성으로 독자 혼동 가능성이 있다. 2-C Rationale 서술에 "엔진의 `AiTurnOrchestrator`와 다른 영역(nodes/ai/ai-agent 내부, 행위 turn loop)" 구분 한 문장을 추가하면 혼동을 선제 방지할 수 있다.

### [INFO] `makeResumeMeta` — spec 의사코드에 새로 도입되는 helper 표기, 충돌 없음
- target 신규 식별자: `makeResumeMeta` (1-E/1-F/1-G 의사코드)
- 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md` L1293-1308 에 `this.persistAssistantTurn(...)` 과 `{ autoResumed: false, ... }` 리터럴만 존재. `makeResumeMeta`는 spec 에 미등장.
- 상세: target 이 도입하는 표기이며 다른 의미로 쓰인 곳 없음.
- 제안: 이상 없음.

### [INFO] `totalStallCount` — spec 에 처음 도입되는 카운터명, 기존의 `consecutiveStallRounds` 와 역할 분리 표기
- target 신규 식별자: `totalStallCount` (1-F)
- 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md` L1304: `autoResumed: consecutiveStallRounds > 0`. L1156/L1157/L1169 에도 `consecutiveStallRounds` 사용.
- 상세: target 이 L1304 의 `consecutiveStallRounds > 0` 를 `totalStallCount > 0` 로 교체하면 동일 spec 파일 내에 두 변수가 공존한다(L1156/1157/1169 의 `consecutiveStallRounds` 는 stall loop bound 용으로 유지). 이 공존은 의도적이며 충돌이 아니다 — target 1-F 자체가 두 카운터의 용도 차이를 설명한다.
- 제안: 이상 없음. spec 독자를 위해 각 변수의 용도 차이(consecutiveStallRounds = 루프 bound + SSE attempt; totalStallCount = 누적, 최종 persist 판정용)가 target 의 new_string 에 이미 서술돼 있어 혼동 위험 낮음.

### [INFO] `FinishGuardState` — spec 에 처음 도입되는 타입명, 충돌 없음
- target 신규 식별자: `FinishGuardState` (1-H Rationale)
- 기존 사용처: spec 전체 미등장.
- 상세: 이름 충돌 없음. 이미 `plan/in-progress/refactor/02-architecture.md` 에서 구현 사실로 기술됨.
- 제안: 이상 없음.

### [INFO] 파일 경로 — 새로 도입하는 spec 파일 경로 없음, 기존 3개 파일 편집만
- 대상 파일: `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/data-flow/7-llm-usage.md`
- 상세: 세 파일 모두 기존 파일. 신규 파일 생성 없음. 명명 컨벤션(`N-name.md`) 위반 없음.
- 제안: 이상 없음.

---

## 요약

target(`plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md`)이 도입하는 식별자는 모두 코드에서 이미 확정된 이름의 spec 반영이며, 기존 spec 영역에서 다른 의미로 쓰이고 있는 이름과 충돌하는 사례는 없다. 유일한 유사성 주의 사항은 `AiTurnExecutor`(노드 turn loop)와 기존 spec 의 `AiTurnOrchestrator`(엔진 park/resume lifecycle)의 이름 근접성이나, 두 클래스는 서로 다른 모듈·파일·역할이라 혼선이 생기면 독자 혼동 수준에 그치며 기능 충돌은 없다. 폐기 예정인 `MIN_EDITS_FOR_VERIFY` 는 target 의 편집이 완전히 교체하므로 공존 충돌이 아닌 교체 관계다.

## 위험도

NONE
