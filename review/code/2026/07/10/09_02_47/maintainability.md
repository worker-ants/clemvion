# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 범위

`llm_usage_log` attribution 하드닝 diff (5 파일): `ai-memory-manager.ts`(+8) / `ai-turn-executor.ts`(타입 주석 1개 + import 1개) / `agent-memory-injection.ts`(옵셔널 필드 1개 + 3번째 인자 전달) / `agent-memory-injection.spec.ts`(테스트 1개 추가) / `plan/in-progress/ai-usage-attribution-hardening.md`(신규 plan 문서). 실질 코드 변경분은 총 20줄 내외로 매우 작고 국소적(surgical)이다.

## 발견사항

- **[INFO]** `llmContext` 3필드(workflowId/executionId/nodeExecutionId) 조합 객체 리터럴이 두 곳(`ai-memory-manager.ts` `injectMemoryContext` / `ai-turn-executor.ts` resume 경로)에서 유사 패턴으로 각각 구성됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:294-298` (`args.config.workflowId` / `args.executionId` / `args.config.nodeExecutionId`), `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2601-2604` (`state.workflowId` / `executionId` / `state.nodeExecutionId`)
  - 상세: 소스(`args.config` vs `state`)가 다르고 필드 수도 3개로 적어 지금 당장 추출이 시급하진 않으나, `LlmCallContext` 조합 지점이 이미 4곳(single-turn `context.*`, resume `state.*`, tool-loop 재사용, 이번 memory-manager `args.config.*`)으로 늘었다. 향후 attribution 소스가 하나 더 늘면(예: extraction 경로) 동일 패턴이 세 번째로 복붙될 가능성이 있다.
  - 제안: 지금 리팩터링을 강제할 필요는 없으나, 다음에 유사 조합이 한 곳 더 생기면 `buildLlmCallContext(source: { workflowId?, nodeExecutionId? }, executionId: string | undefined): LlmCallContext` 같은 단일 헬퍼로 추출을 고려.

- **[INFO]** `ai-memory-manager.ts` 의 `llmContext: { executionId: args.executionId || undefined, ... }` 에서 `||` 사용
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:296`
  - 상세: `injectMemoryContext` 시그니처상 `args.executionId: string` 은 필수(옵셔널 아님)인데, 대상 타입 `LlmCallContext.executionId?: string | null` 은 옵셔널이라 `||`로 falsy(빈 문자열 포함)를 명시적으로 `undefined` 변환하는 자체는 타당하다. 다만 근접 주석("첫 턴 등 미주입 시 undefined→NULL")이 `workflowId`/`nodeExecutionId` 의 미주입 케이스만 설명하고, `executionId` 자체가 falsy 일 수 있는 이유(왜 필수 타입인데 방어 코드가 필요한지)는 별도로 언급하지 않아 다음 읽는 사람이 "필수 필드인데 왜 fallback?" 하고 잠깐 멈출 수 있다.
  - 제안: 한 줄만 보강해도 충분 — 예) "executionId 는 타입상 필수지만 방어적으로 falsy→undefined 정규화".

- **[INFO]** `injectMemoryContext` (ai-memory-manager.ts) 는 이번 diff 이전에도 이미 책임이 많은 장문 메서드([5a] 회수 → [5b] 요약 → 안정 프리픽스 append → 휘발성 꼬리 → keepUserExchanges 도출 → 3가지 tailMode 분기)인데, 이번 변경으로 8줄이 더 추가되어 길이가 소폭 늘었다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:149-408` (`injectMemoryContext` 전체), 특히 `llmContext` 삽입부 291-298
  - 상세: 이 diff 자체가 새로 만든 문제는 아니며(pre-existing 장문 메서드에 대한 순수 추가), 각 단계가 `// ── [5a] ── / [5b] ── / [6] ──` 주석으로 잘 구획되어 있어 가독성은 유지된다. 다만 향후 attribution 소스가 더 늘거나 유사한 옵션이 계속 추가되면 단일 메서드가 더 비대해질 위험이 있다.
  - 제안: 지금 액션은 불필요. 다음 확장 시점에 `[5b]` 블록(요약 config 해석 + llmContext 조립 + buildSummaryBufferUpdate 호출)을 별도 private 헬퍼로 분리하는 걸 고려.

- **[INFO, 긍정적 패턴]** `ai-turn-executor.ts` 에서 `const llmContext = {...}` → `const llmContext: LlmCallContext = {...}` 로 명시 타입 주석을 추가한 것은 TS excess-property check 를 되살려 필드 오탈자를 컴파일 타임에 잡는 좋은 관례
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2601`
  - 상세: single-turn 경로(`llmService.chat(..., { workflowId: context.workflowId, ... })`, 1520행 부근)는 인라인 리터럴을 바로 3번째 인자로 넘겨 excess-property check 가 이미 적용되지만, resume 경로는 독립 `const` 로 먼저 만든 뒤 넘기는 구조라 그 체크가 무력화되어 있었다(직전 PR #879 review INFO#1 지적 사항). 이번 diff 로 갭이 메워졌고, 커밋 메시지/주석에 근거(ai-review INFO#1)가 명시되어 추적성도 좋다.
  - 특별한 조치 불필요 — 오히려 향후 유사하게 "먼저 변수로 뽑아서 넘기는" 패턴을 쓸 때 이 관례(명시 타입 주석)를 재사용하도록 권장.

- **[INFO]** 신규 plan 문서(`plan/in-progress/ai-usage-attribution-hardening.md`)의 프로젝트 컨벤션 준수도
  - 위치: `plan/in-progress/ai-usage-attribution-hardening.md`
  - 상세: frontmatter(`worktree`/`branch`/`started`/`owner`/`spec`/`precedent`), 변경 세트·테스트·TEST WORKFLOW·SPEC-DRIFT·워크플로 체크리스트 구성이 기존 plan 컨벤션과 일관되고, frontend 미검증 사유(스킵이 아니라 근거 명시)도 투명하게 기록되어 있어 유지보수 관점에서 문제 없음.

## 요약

diff 규모가 5파일 20줄 내외로 매우 작고 국소적이며, 기존 codebase 의 확립된 패턴(single-turn `context.*` attribution 전달, `LlmCallContext` 타입, Korean spec-reference 주석 스타일)을 그대로 따르고 있어 가독성·네이밍·일관성 모두 양호하다. 새로 도입된 조건 분기·중첩·매직 넘버는 없으며, 함수 길이/복잡도 증가도 8줄 추가 수준으로 미미하다. 유일하게 눈에 띄는 점은 `llmContext` 3필드 조합 객체가 이제 두 개의 서로 다른 소스(`config`/`state`)에서 유사한 형태로 각각 구성된다는 것인데, 규모가 작아 즉시 리팩터링을 요구할 수준은 아니고 향후 세 번째 조합 지점이 생길 때 공유 헬퍼 추출을 검토하면 충분하다. 오히려 `LlmCallContext` 명시 타입 주석 추가는 직전 리뷰(INFO#1) 피드백을 정확히 반영한 견고화로, 유지보수성 측면에서 긍정적 변화다.

## 위험도

LOW
