# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-update-engine-split.md`
검토 일시: 2026-06-18

---

## 발견사항

### [INFO] draft 제안 변경 대부분이 이미 spec 에 반영돼 있음 (중복 적용 위험 없음)

- target 위치: draft 전체 변경 목록 (§§1~6)
- 충돌 대상: 현재 spec 파일들 (아래 개별 검증)
- 상세: draft 가 제안하는 변경 항목 6개 중 5개는 이미 현재 spec 에 적용돼 있다. 아래는 파일별 검증 결과.

  **이미 반영된 항목 (5개)**

  1. `spec/5-system/4-execution-engine.md` — §Rationale "C-1 god-class strangler-fig 분할" 절 신설: 이미 L1456 에 존재. §1.3 / §7.5 메서드 소속 포인터 갱신: L193 에서 `AiTurnOrchestrator`·`FormInteractionService`·`ButtonInteractionService`·`RetryTurnService` 위치가 이미 기술돼 있음.

  2. `spec/4-nodes/0-overview.md §1.0` — bootstrap 트리거 서비스 명시: L55 에 "서버 부팅 시 `NodeBootstrapService.onModuleInit`이 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출"가 이미 기술돼 있음.

  3. `spec/4-nodes/3-ai/1-ai-agent.md` — frontmatter `code:` 에 `ai-turn-orchestrator.service.ts` 추가: 이미 L12 에 존재. §10 에러코드 표 `extractAiTurnErrorPayload` 구현 포인터: L1099 에 이미 존재.

  4. `spec/conventions/interaction-type-registry.md §1.1·§1.2` — frontmatter `code:` `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts`: 이미 L7-8 에 존재. §1.2 Backend emit 위치 열 갱신: L45-47 에서 `AiTurnOrchestrator`·`ButtonInteractionService` via 엔진 위임이 이미 기술돼 있음.

  5. `spec/conventions/node-output.md` — `button_continue` data shape `selectedItem?`·`url?` 등재: L259 에 이미 존재. `previousOutput` 보존 예외 `ButtonInteractionService`: L194 에 이미 존재.

  **확인이 필요한 항목 (1개)**

  6. `spec/4-nodes/6-presentation/0-common.md L426` — draft 는 "L426 구현 포인터 `ExecutionEngineService.continueAiConversation → AiTurnOrchestrator.processAiResumeTurn`으로 정정"을 제안한다. 실제 L426 은 이미 `AiTurnOrchestrator.processAiResumeTurn`을 가리키고 있으며, 파일 전체에서 `continueAiConversation`은 발견되지 않는다 → 이 변경도 이미 적용 완료.

- 제안: draft 를 적용 전 spec 의 실제 현재 상태와 대조해 적용 완료 항목을 건너뛰어야 한다. 이미 반영된 곳에 재적용하면 중복 서술이 생길 수 있으므로 diff 기반으로 잔여 항목만 처리할 것.

---

### [WARNING] `spec/data-flow/15-external-interaction.md` 의 `continueAiConversation` 포인터가 draft 변경 범위에서 누락됨

- target 위치: draft 변경 대상 파일 목록 (해당 파일 미포함)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/data-flow/15-external-interaction.md` L108
- 상세: 해당 파일 L108 의 dispatch 매핑 표에 `ExecutionEngineService.continueAiConversation(executionId, message)`가 남아 있다. draft 는 이 파일을 변경 대상으로 명시하지 않았으나, C-1 분할 이후 `continueAiConversation`은 엔진의 thin delegator facade 로 존재하므로 표면상 작동은 유지된다. 그러나 `AiTurnOrchestrator`로의 실제 위임 경로가 `4-execution-engine.md`·`interaction-type-registry.md`·`4-nodes/3-ai/1-ai-agent.md` 등 다른 spec 에는 이미 기술돼 있는데, 이 파일만 구 서술을 보존해 일관성이 깨진다.
- 제안: `spec/data-flow/15-external-interaction.md` L108 의 `submit_message` 행 비고에 "엔진 facade → `AiTurnOrchestrator.processAiResumeTurn` 위임 (C-1 분할)"을 추가하거나, 포인터를 `AiTurnOrchestrator`로 직접 갱신할 것. draft 변경 범위에 본 파일을 추가해야 함.

---

### [INFO] `spec/data-flow/3-execution.md` 시퀀스 다이어그램 actor 갱신 — draft 제안과 현재 spec 의 의도가 다를 수 있음

- target 위치: draft §`spec/data-flow/3-execution.md` — "시퀀스 다이어그램 actor 갱신: `Eng->>AiTurnOrchestrator` / `Eng->>FormInteraction` / ..."
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/data-flow/3-execution.md` L172
- 상세: 현재 spec 은 시퀀스 다이어그램의 `Eng` actor 를 **의도적으로 단일 actor 로 유지**하고, L172 의 prose 노트로 C-1 분할 후 in-process 위임을 설명한다 ("분산 분리가 아니라 클래스 경계 정리라 시퀀스 actor 는 `Eng` 로 유지한다"). draft 가 제안하는 "actor 갱신: `Eng->>AiTurnOrchestrator`..."은 현재 spec 의 명시적 의도("actor는 Eng 로 유지")와 방향이 다를 수 있다.
- 제안: draft 적용 시 L172 의 prose 노트와의 정합성을 확인할 것. 만약 actor 분리를 추가하면 "actor 는 Eng 로 유지한다" 주석을 함께 삭제하거나 조정해야 하며, prose 노트만 있는 현재 방식이 `data-flow/3-execution.md`의 의도였다면 draft 의 이 변경은 현재 spec 이 이미 선택한 표현과 충돌한다.

---

### [INFO] draft 의 §Rationale 신설 내용과 현재 spec Rationale 내용의 경미한 라인 카운트 차이

- target 위치: draft `spec/5-system/4-execution-engine.md §Rationale 신설 항`
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` L1456–L1467
- 상세: 현재 spec 의 Rationale "C-1 god-class strangler-fig 분할" (L1456-1467) 은 draft 가 제안하는 내용과 거의 동일하나, `7,035줄` (spec 현재) vs `~7,033줄` (draft 표기) 등 미세한 숫자 차이가 있다. 기능 의미 충돌은 없다.
- 제안: draft 적용 시 숫자를 현재 spec 의 실측 값으로 통일.

---

## 요약

Cross-Spec 일관성 관점에서 draft(`plan/in-progress/spec-update-engine-split.md`)가 제안하는 6개 변경 항목 중 5개는 이미 현재 spec 에 반영돼 있어 실질 충돌이 없다. 가장 주목할 발견은 `spec/data-flow/15-external-interaction.md` L108 의 `continueAiConversation` 포인터가 draft 의 변경 범위에 누락된 것으로, 다른 spec 파일들이 C-1 분할 이후 위임 경로를 기술하는 것과 불일치한다 (WARNING). `data-flow/3-execution.md` actor 갱신 제안은 현재 spec 이 의도적으로 `Eng` 단일 actor 를 유지하고 있는 결정과 방향이 다를 수 있어 명확화가 필요하다 (INFO). 나머지 항목은 이미 반영 완료이므로 중복 적용을 방지하기 위해 diff 기반으로 잔여 항목만 선별 적용해야 한다.

## 위험도

LOW

STATUS: OK
