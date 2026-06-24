# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md`
검토 일시: 2026-06-24

---

## 발견사항

### [WARNING] L957 `reviewRoundCount >= 2` 하드코딩 vs. draft 1-D 에서 `MAX_REVIEW_ROUNDS`(=2) 로 교체

- **target 위치**: draft 편집 1-D — `shouldSkipReview` skip 사유 목록에서 `state.reviewRoundCount >= MAX_REVIEW_ROUNDS`(=2) 로 표기 교체 제안
- **충돌 대상**: `spec/3-workflow-editor/4-ai-assistant.md` L957 `- state.reviewRoundCount >= 2`, L1085 `reviewRoundCount >= 2` — 두 곳 모두 리터럴 `2` 로 표기되어 있음
- **상세**: draft 1-D 는 skip 사유 목록을 `MAX_REVIEW_ROUNDS`(=2) 기호 상수로 교체한다. 그런데 L957 과 L1085 는 draft 가 편집하지 않는 서술 위치이므로 편집 1-D 적용 후에도 같은 파일 내에 리터럴 `2` 가 그대로 잔류한다. 상수명과 리터럴 값이 하나의 파일 안에서 혼용되면 향후 상수 값 변경 시 일부만 갱신되는 drift 원인이 된다. spec 외부(다른 영역 충돌)는 아니나, 같은 파일 내 동일 의미 혼용이어서 WARNING 수준.
- **제안**: 1-D 편집 범위를 L957 만으로 한정하지 말고 L1085 (`reviewCompleted / reviewRoundCount >= 2 — 같은 턴 review 1회 상한`) 도 동일 PR 에서 `MAX_REVIEW_ROUNDS` 로 통일. 또는 변경 불요로 판단하되 이유를 명시.

---

### [WARNING] draft 1-H Rationale 삽입 — `AssistantFinishGuard` / `AssistantTurnPersistenceService` / `AssistantToolRouter` 가 다른 spec 에 아직 미등재

- **target 위치**: draft 편집 1-H — `spec/3-workflow-editor/4-ai-assistant.md` Rationale 에 M-3 collaborator 3종 (`AssistantToolRouter`, `AssistantFinishGuard`, `AssistantTurnPersistenceService`) 추가
- **충돌 대상**: `spec/data-flow/7-llm-usage.md` L108 — `persistAssistantTurn` 을 `WorkflowAssistantStreamService` 직속 메서드로 표기. draft 3-A 에서 이 표기를 교체하나, 7-llm-usage.md 는 단일 행만 수정 대상.
- **상세**: draft 는 ai-assistant spec 의 frontmatter `code:` 는 글로브가 이미 커버한다고 판단해 변경 불요로 두었다 (1-A). 그러나 `spec/conventions/conversation-thread.md` L7, `spec/conventions/node-cancellation.md` L131, `spec/4-nodes/3-ai/0-common.md` L8, `spec/data-flow/13-agent-memory.md` L39/L103 등 여러 conventions·data-flow 파일이 `ai-agent.handler.ts` 를 직접 인용하는 패턴과 동형으로, M-1 분할 이후 `AiTurnExecutor`·`AiMemoryManager`·`AiConditionEvaluator` 를 단일 파일 핸들러로 암묵 지칭하는 서술이 남아 있다. 이는 draft 2-B·2-C 가 수정하는 `spec/4-nodes/3-ai/1-ai-agent.md` 외부 파일들로, draft 편집 범위 밖이다. M-1 이후 `ai-agent.handler.ts` 가 여전히 존재(위임만 하는 외관 핸들러)하므로 즉각 오작동은 없지만, 내부 구현 참조(예: `buildMultiTurnFinalOutput` 의 single source — `ai-agent.handler.ts`) 가 사실과 달라진 부분이 있을 수 있어 중기 drift 위험.
- **제안**: draft 범위(3 파일)는 현재 계획대로 먼저 적용하고, 후속 작업으로 `spec/conventions/data-hydration-surfaces.md` L32 의 `(single source — ai-agent.handler.ts)` 표기 및 `spec/data-flow/13-agent-memory.md` L39/L103 의 핸들러 인용을 M-1 collaborator 를 포함하도록 sync 하는 별도 편집을 예약.

---

### [INFO] `spec/3-workflow-editor/4-ai-assistant.md` L957 의 `state.reviewRoundCount >= 2` 와 L679 의 `최대 2회(reviewRoundCount)` 서술 — draft 가 수정하는 1-D 범위와 일부 중복

- **target 위치**: draft 편집 1-D — L958 부분 교체
- **충돌 대상**: 동일 파일 L679 (`상한: 같은 턴에 review 는 최대 2회(reviewRoundCount)`) 와 L948 (`Review(Phase 1) 는 한 턴에 최대 2회(reviewRoundCount) 발동 후 자동 통과`)
- **상세**: L679 와 L948 에도 `2` 가 리터럴로 존재하고, `MAX_REVIEW_ROUNDS` 상수를 언급하지 않는다. 단일 파일 내 일관성 문제이며, 다른 spec 영역과의 모순은 아니다. INFO 수준.
- **제안**: 1-D 적용 시 L679·L948 도 함께 `MAX_REVIEW_ROUNDS`(=2) 로 통일하면 파일 내 명명 일관성이 달성된다.

---

### [INFO] `spec/4-nodes/3-ai/0-common.md` frontmatter L8 의 `ai-agent.handler.ts` — M-1 분할 이후 collaborator 3종 미등재

- **target 위치**: draft 외 — draft 는 `1-ai-agent.md` frontmatter 만 편집(2-A)
- **충돌 대상**: `spec/4-nodes/3-ai/0-common.md` L4-8 의 `code:` frontmatter — `ai-agent.handler.ts` 1건만 등재
- **상세**: `0-common.md` 는 AI 노드 공통 규약 파일이고 frontmatter 에 `ai-agent.handler.ts` 를 포함한다. M-1 collaborator(`ai-condition-evaluator.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts`)는 `0-common.md` 의 규약(memoryStrategy, contextScope, system prompt 빌드 ordering 등)을 직접 구현하지만 미등재 상태. draft 가 `1-ai-agent.md` frontmatter 를 수정하면 coverage 불일치가 발생한다(`1-ai-agent.md` 에는 collaborator 등재, `0-common.md` 에는 미등재). 행위 계약 모순은 아니나 spec 추적성 측면에서 동기화 권장.
- **제안**: `0-common.md` frontmatter 에도 collaborator 3종을 추가하거나, `ai-agent/*.ts` 글로브로 통합. 이 편집은 draft 범위 확장 또는 후속 별도 draft 로 처리.

---

## 요약

draft `spec-draft-m3-m1-ai-assistant-sync.md` 가 제안하는 7 + 3 + 1 편집은 모두 behavior 무변경 doc-sync 이며, 기존 spec 다른 영역과의 **직접 행위 모순(CRITICAL)은 발견되지 않았다**. 주요 Cross-Spec 쟁점은 두 가지다. 첫째, draft 1-D 가 `shouldSkipReview` 목록에서 `MAX_REVIEW_ROUNDS`(=2) 기호를 도입하지만 같은 파일 내 L957·L1085 의 리터럴 `2`, L679·L948 의 `최대 2회` 표기와 혼용되어 동일 개념이 두 표기로 공존하는 파일 내 WARNING 이 발생한다. 둘째, M-1 collaborator 등재가 `1-ai-agent.md` frontmatter 에만 이루어지면 `0-common.md` frontmatter, `spec/conventions/data-hydration-surfaces.md`, `spec/data-flow/13-agent-memory.md` 등 `ai-agent.handler.ts` 를 직접 인용하는 인접 파일들이 M-1 이후 현실을 반영하지 못하는 중기 drift 원인이 된다. 이 두 가지는 단기 작동에는 영향이 없으나 후속 편집 예약을 권장한다.

## 위험도

LOW

---

STATUS: OK
