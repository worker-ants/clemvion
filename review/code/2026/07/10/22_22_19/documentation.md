# 문서화(Documentation) Review

대상: AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선
(`ai-memory-manager.ts` / `agent-memory-injection.ts` / `ai-turn-executor.ts` + 관련 spec/테스트/plan/CHANGELOG, 총 9파일)

## 발견사항

- **[INFO]** CHANGELOG 가 인용하는 SoT(`spec/data-flow/7-llm-usage.md §1.3`)가 실제로는 이 diff 의 반대 내용을 아직 서술 중 (일시적 stale window)
  - 위치: `CHANGELOG.md:19` (신규 엔트리의 "SoT: `spec/data-flow/7-llm-usage.md §1.3`" 인용) vs `spec/data-flow/7-llm-usage.md:107,113,162,204-206`
  - 상세: 이 PR 로 인해 `AiMemoryManager.injectMemoryContext` → `buildSummaryBufferUpdate` 요약 압축 chat 이 `llm_usage_log` 의 `workflow_id`/`execution_id`/`node_execution_id` 를 채우게 됐다. 그런데 spec 은 여전히 "AI Agent 자동 메모리 롤링 요약 압축 (…) → `context` 미전달 → … 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)"(§1.3 표 L107), "**잔여 NULL** 은 … 노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐이다"(L113), Agent Memory 행(L162), Rationale(L204-206)에서 이 chat 을 여전히 "미배선/NULL" 로 서술한다. 즉 이 PR 이 머지된 직후부터 후속 spec 정정 PR(plan 상 "PR-2")이 머지되기 전까지, CHANGELOG 가 가리키는 SoT 문서가 실제 구현과 반대로 읽힌다.
  - **완화 요인**: `developer` 역할은 `spec/` 이 read-only 이므로 이 PR 자체에서 spec 을 고칠 수 없는 것이 프로젝트 권한 구조상 정상이며, 두 plan 파일(`plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT, `plan/in-progress/resume-llm-usage-attribution.md` §잔여 follow-up)이 정확한 라인 앵커(L107/L113/L162/L189~206)까지 명시해 후속 PR-2 로 추적하고 있다 — "외부 위임 한 줄"이 아니라 구체적 remediation 스펙이다. 그래서 CRITICAL 이 아니라 INFO 로 낮춘다.
  - 제안: (선택) CHANGELOG 엔트리 말미에 "(spec §1.3 정정은 후속 PR 예정)" 한 줄만 덧붙이면, 이 창(window) 동안 SoT 를 따라가는 독자의 혼란을 줄일 수 있다. 필수는 아님 — PR-2 를 신속히 잇는 것으로도 충분.

- **[INFO]** `LlmCallContext` 인터페이스 자체는 JSDoc 없음 (이 diff 로 신규 도입된 문제는 아님)
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:41-45` (`export interface LlmCallContext { workflowId?...; executionId?...; nodeExecutionId?...; }`)
  - 상세: 이번 diff 에서 `ai-memory-manager.ts`/`agent-memory-injection.ts`/`ai-turn-executor.ts` 세 곳 모두 이 타입을 "attribution 추상화"로 설명하는 JSDoc 을 추가했지만, 정작 정의부에는 설명이 없다. 여러 호출부 주석이 같은 개념(§1.3, single-turn=context.*, resume=state.*)을 각자 반복 서술하고 있어, 정의부에 한 줄만 있으면 단일 진실 지점이 될 수 있다.
  - 제안: 우선순위 낮음 — 이 PR 범위 밖(pre-existing)이라 지금 고칠 필요는 없으나, 다음에 이 인터페이스를 만지는 PR 에서 짧은 JSDoc(`/** llm_usage_log attribution 컬럼 — 노드 발 chat 호출에서 caller 가 명시 전달할 때만 채워진다. spec/data-flow/7-llm-usage.md §1.3 */`)을 추가하면 좋다.

- **[INFO]** 테스트 주석이 내부 리뷰 산출물 식별자(`ai-review Critical#1`, `WARNING#2`)를 직접 인용
  - 위치: `ai-agent.memory.spec.ts:513-515`, `ai-memory-manager.spec.ts:125-126`
  - 상세: `// ... (ai-review Critical#1)`, `// WARNING#2 대칭 커버 ...` 같은 주석은 이 리포의 기존 관행(git log 의 다수 "post-rebase ai-review INFO fix" 류 커밋)과 일치하고, 회귀 배경을 압축적으로 남긴다는 점에서 유용하다. 다만 `review/code/**` 산출물을 보지 못하는 이후 독자(예: 몇 달 뒤 다른 컨트리뷰터)에게는 "Critical#1"이 무엇을 가리키는지 자명하지 않다.
  - 제안: 필수 아님. 이미 각 주석이 "무엇이 왜"(예: "single-turn 은 config 에 workflow/nodeExecution 키가 없어 과거엔 NULL 로 적재되던 회귀를 고정한다")를 리뷰 ID 없이도 이해 가능하게 병기하고 있어 실질적 위험은 낮다.

## 검증된 정확성 (문제 없음, 참고용)

- `ai-memory-manager.ts`/`agent-memory-injection.ts`/`ai-turn-executor.ts` 세 곳에 추가된 JSDoc("single-turn/첫 턴은 `context.*`, multi-turn resume 은 재구성 `state.*`")은 실제 diff 코드(단발 경로 `context.workflowId/executionId/nodeExecutionId`, resume 경로 `state.workflowId/nodeExecutionId` + `executionId ?? undefined`)와 정확히 일치한다.
- `buildSummaryBufferUpdate` 의 신규 `llmContext?: LlmCallContext` 파라미터 JSDoc("미전달 시 NULL(기존 동작)")은 `agent-memory-injection.spec.ts` 의 하위호환 회귀 테스트(`llmContext` 미전달 시 `chat` 3번째 인자가 `undefined`)와 부합한다.
- `ai-agent.memory.spec.ts:468` 의 사전 주석("First chat call = summary LLM call; second = main answer")과 신규 단언(`mockLlmService.chat.mock.calls[0][2]` 를 attribution 으로 검증)이 실제 mock 구성·호출 순서와 일치함을 확인했다(첫 `mockResolvedValueOnce` = 요약, 두 번째 = 메인 응답).
- `ai-memory-manager.ts` 의 "multi-turn resume 은 재구성 `state.*`(엔진 `buildRetryReentryState` 주입분)" 서술은 `execution-engine.service.ts`/`retry-turn.service.ts` 의 기존 `buildRetryReentryState` 재주입 구현·테스트(`#501` 회귀 고정)와 교차검증된다.
- `plan/in-progress/ai-usage-attribution-hardening.md` (신규) 는 spec 정정 필요성을 발견해 구체적 라인 앵커까지 추적하고 있어(SPEC-DRIFT 섹션), "구현 완료 후 spec 은 project-planner 위임" 원칙과 "plan 은 spec 갱신을 정식 phase 로 포함해야 한다"(외부 위임 한 줄 금지) 원칙 양쪽을 잘 지킨 사례다.
- CHANGELOG 신규 엔트리는 기존 항목들과 동일한 포맷(`## Unreleased — <제목> (<spec경로>)` + `### 변경 사항` + 번호 목록 + `SoT:` 각주)을 정확히 따른다.
- README/API 문서/신규 환경변수 해당 없음 — 이 diff 는 backend 내부 attribution 배선(노드 레이어 오케스트레이터 ↔ 공유 헬퍼 ↔ LLM 서비스)만 다루며 새 엔드포인트·설정·공개 인터페이스 표면 변경이 없다.

## 요약

이번 diff 는 새로 추가/수정한 JSDoc·인라인 주석이 실제 코드 동작(단발=`context.*`, 멀티턴 resume=`state.*`, `buildSummaryBufferUpdate` 하위호환 `undefined` fallback)과 정확히 일치하며, 테스트에 붙은 설명 주석도 실제 mock 호출 순서·인자를 정확히 반영한다. CHANGELOG 엔트리는 형식·내용 모두 리포 컨벤션에 부합한다. 유일한 실질적 관찰점은 이 코드 변경으로 인해 CHANGELOG 가 SoT 로 인용하는 `spec/data-flow/7-llm-usage.md §1.3` 이 일시적으로 stale 해진다는 것인데, `developer` 의 `spec/` read-only 권한 구조상 불가피하며 두 plan 파일에 라인 단위로 추적돼 있어 실무적 위험은 낮다. README/API 문서/신규 설정 문서화 필요성은 없다.

## 위험도

LOW
