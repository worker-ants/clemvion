# 정식 규약 준수 검토 결과

검토 모드: impl-done (scope=spec/4-nodes/3-ai/, diff-base=origin/main)

---

## 발견사항

### 발견사항 1
- **[WARNING]** `2-text-classifier.md` 의 `pending_plans` 에 선언된 `spec-sync-text-classifier-gaps.md` 파일이 worktree 에 존재하지만, 해당 plan 이 완료되기 전까지 `text_classifier` 의 `output.error.details.retryable` 미충전은 `node-output.md` Principle 3.2.1 의 **LLM 계열 노드 한정 필수** 요건과 실제 구현이 어긋난 상태다. spec 문서 자체는 `🚧 미구현(Planned)` 표기로 이 갭을 정직하게 노출하고 있으나, `status: partial` + `pending_plans` 로만 추적되며 plan 파일이 완료되면 반드시 `status: implemented` 로 승격하는 lifecycle 가드(`spec-status-lifecycle.test.ts`)가 커버할 것이다. 현재 규약 내에서 허용되는 상태이나, plan 완료 후 미승격 시 CRITICAL 로 격상됨을 기록.
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` 프런트매터 및 §5 에러 표
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2.1 (LLM 계열 `retryable` 필수), `spec/conventions/spec-impl-evidence.md` §3 `partial` 라이프사이클
  - 상세: `text_classifier` 핸들러 catch 블록이 `details.retryable` 을 채우지 않아 구현이 규약을 위반하고 있다. spec 은 이를 `🚧` 표기로 인식하고 `pending_plans` 로 추적하므로 frontmatter lifecycle 자체는 정합. 단, plan 이 in-progress 로 유지되는 한 실구현 surface 는 규약 위반 상태다.
  - 제안: 현 상태 유지 (spec 이 올바르게 갭 표시 중). `spec-sync-text-classifier-gaps.md` plan 완료 시 handler 수정 + frontmatter `implemented` 승격을 동일 PR 에서 수행.

### 발견사항 2
- **[WARNING]** `3-information-extractor.md` 의 `pending_plans` 에 선언된 `spec-sync-information-extractor-gaps.md` 가 worktree 에 존재하지만, 동일하게 `output.error.details.retryable` / `retryAfterSec` 미구현 갭이 `node-output.md` Principle 3.2.1 을 실구현 레벨에서 위반한 상태다. Spec 문서는 **미구현(Planned)** 표기로 올바르게 노출.
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §5 에러 표 (`output.error.details.retryable` / `retryAfterSec?` 행)
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2.1
  - 상세: `information-extractor.handler.ts` 의 `buildErrorOutput` 이 `retryable` 을 채우지 않음. Spec 이 갭을 정확히 기술하고 plan 으로 추적하는 점은 규약 준수.
  - 제안: 발견사항 1 과 동일 패턴. plan 완료 PR 에서 handler 수정 + frontmatter 승격 동시 수행.

### 발견사항 3
- **[INFO]** `1-ai-agent.md` 의 `pending_plans` 에 `ai-context-memory-followup-v2.md` 가 신규 추가됐고, 해당 파일이 worktree `plan/in-progress/` 에 실존한다. `spec-impl-evidence.md` §4 가드(`spec-pending-plan-existence.test.ts`)가 커버하는 invariant 를 만족한다. 문제 없음.
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 프런트매터 `pending_plans`
  - 위반 규약: 없음 (준수 확인)
  - 상세: `plan/in-progress/ai-context-memory-followup-v2.md` 실존 확인됨. spec-pending-plan-existence 가드 통과 예상.
  - 제안: 해당 없음.

### 발견사항 4
- **[INFO]** `0-common.md` 의 `status` 가 이전 `implemented` 에서 `partial` 로 다운그레이드됐으며, 새 `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 가 추가됐다. `spec-impl-evidence.md` §3.1 전이 규칙("모든 pending_plans 가 complete 로 이동하면 implemented 로 승격 의무")에 따라 향후 plan 완료 시 승격이 필요함을 명기.
  - target 위치: `spec/4-nodes/3-ai/0-common.md` 프런트매터
  - 위반 규약: 위반 없음. `spec-impl-evidence.md` §3 partial 라이프사이클 준수.
  - 상세: `memoryStrategy`/`memoryTokenBudget`/`memoryKey` 등 신규 필드가 0-common.md §10 에 추가됐으나 AI Agent 한정 (v2 에 text_classifier/information_extractor 확장 예정). Plan 이 in-progress 상태이므로 `partial` 분류는 적합.
  - 제안: 해당 없음.

### 발견사항 5
- **[INFO]** `2-text-classifier.md` §3.3 (캔버스 요약) 에서 `summaryTemplate` 미정의 갭을 `🚧 미구현(Planned)` 표기로 노출하고 있다. `spec/conventions/node-output.md` 에는 summaryTemplate 관련 규약이 없으나 동일 spec 파일의 `0-common.md §8` 이 약속한 포맷과의 드리프트다. spec 문서가 갭을 정확히 표기했으므로 규약 위반은 없음.
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` §7 캔버스 요약
  - 위반 규약: 없음 (갭 노출이 정확함)
  - 상세: `0-common.md §8` 은 Text Classifier 의 캔버스 요약 포맷을 `{model} · {N} categories` 로 정의한다. `2-text-classifier.md` 는 현재 미구현임을 plan-tracked 방식으로 정직하게 표기.
  - 제안: 해당 없음.

### 발견사항 6
- **[INFO]** `spec/4-nodes/3-ai/3-information-extractor.md` 의 프런트매터에 `contextScope` / `memoryStrategy` 관련 필드가 spec 에 추가되지 않았다. `0-common.md §10` 이 v1 적용 범위를 `ai_agent` 만 push + 자동 주입, text_classifier / information_extractor 는 v2 로 명시하고 있어 omission 이 의도적임. `spec-impl-evidence.md` §3 partial 분류 기준상 information-extractor 의 `pending_plans` 에 추가된 plan 이 적절히 이 갭을 추적한다고 볼 수 있으나, v2 contextScope 추가가 기존 `spec-sync-information-extractor-gaps.md` 의 범위 내인지 혹은 별도 plan 이 필요한지는 plan 파일 본문 확인이 권장된다.
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §1 config 표
  - 위반 규약: 없음 직접 위반은 없으나, v2 contextScope/memoryStrategy 범위가 `spec-sync-information-extractor-gaps.md` 에 명시됐는지 확인 권장
  - 상세: `0-common.md §10` 이 v2 적용 범위를 명시하므로 현 상태는 규약 준수. 단 plan scope 모호성이 향후 drift 원인이 될 수 있음.
  - 제안: `spec-sync-information-extractor-gaps.md` 에 v2 contextScope/memoryStrategy 적용 항목이 명시됐는지 확인. 없으면 별도 항목 추가.

---

## 요약

`spec/4-nodes/3-ai/` 의 변경 사항은 정식 규약(`spec/conventions/`)을 전반적으로 올바르게 따른다. frontmatter lifecycle (`spec-impl-evidence.md`)의 `partial` 전이 규칙이 준수됐고, 신규 `pending_plans` 파일은 worktree 안에 실존한다. 핵심 규약 위반은 **실구현 레벨**에서 발생한 것(text_classifier / information_extractor 의 `output.error.details.retryable` 미충전 — `node-output.md` Principle 3.2.1)이나, spec 문서 자체는 이를 `🚧 미구현(Planned)` 표기와 `pending_plans` 추적으로 정직하게 노출하고 있어 spec-as-documentation 관점의 규약 위반은 아니다. 문서 구조(Overview/본문/Rationale)는 모두 존재하며 `0-` prefix·`_product-overview.md` 명명 관례도 준수된다. `memoryStrategy` / `memoryKey` / `memoryTokenBudget` 등 신규 config 식별자는 camelCase 규칙을 따르고, 출력 포맷(wrapper `output.result.*` / `output.error.*` / `output.interaction.*`)도 `node-output.md` Principle 11 기준을 유지한다. 금지 항목 위반(예: output 에 config 리터럴 echo, `_multiTurnState` 잔류 등)은 발견되지 않았다.

---

## 위험도

LOW
