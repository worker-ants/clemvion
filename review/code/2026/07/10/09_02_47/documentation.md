# 문서화(Documentation) Review 결과

## 발견사항

- **[WARNING]** spec 문서(`7-llm-usage.md §1.3`)가 이번 diff 로 stale 해짐 — PR-2 로 명시 이관되었으나 병합 순서에 따라 main 에 잠시 잘못된 문서가 남을 수 있음
  - 위치: `spec/data-flow/7-llm-usage.md` §1.3 Caller 카탈로그 표(라인 107) · 표 아래 요약 문단(라인 113) · §4 외부 의존 표(라인 162) · `## Rationale` "`llm_usage_log` 의 nullable context 컬럼들" 절(라인 205-206)
  - 상세: 이 4곳 모두 "AI Agent 자동 메모리 롤링 요약 압축(`nodes/ai/shared/agent-memory-injection.ts`)" 을 "`context` 미전달 → 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)" 이라고 명시적으로 서술한다. 그런데 본 diff(`ai-memory-manager.ts` + `agent-memory-injection.ts`)가 정확히 그 caller 에 `llmContext`(workflowId/executionId/nodeExecutionId)를 배선해 이 서술을 사실과 다르게 만든다. `plan/in-progress/ai-usage-attribution-hardening.md` 의 "SPEC-DRIFT (PR-2 로 이관)" 절이 이 사실을 이미 인지하고 project-planner 트랙(PR-2)으로 위임했으므로 "놓친" 문제는 아니지만, PR-1(본 diff, backend 코드)이 PR-2(spec 정정) 보다 먼저 main 에 병합되면 그 사이 spec 이 실제 동작과 어긋난 상태로 노출된다.
  - 제안: PR-2 를 가능한 한 빨리(같은 배치로) 뒤따르게 하거나, 최소한 이번 PR 설명/커밋 메시지에 "spec 은 후속 PR 에서 정정됨" 을 명시해 리뷰어·머지 담당자가 일시적 drift 를 인지하게 한다. 가능하면 PR-1/PR-2 를 동일 PR 로 묶는 편이 drift window 를 아예 없앤다.

- **[WARNING]** CHANGELOG.md 에 이번 변경에 대한 항목이 없음 — 동일 성격의 선행 PR(#879)은 항목을 남겼음
  - 위치: `CHANGELOG.md` (루트) — 9번째 줄 "Unreleased — 멀티턴 resume 턴 llm_usage_log attribution ..." 항목이 선례
  - 상세: 이번 diff 의 C1(`agent-memory-injection.ts`/`ai-memory-manager.ts`)은 AI Agent 자동 메모리 롤링 요약 압축 chat 호출의 `llm_usage_log` attribution 컬럼(workflow_id/execution_id/node_execution_id)이 항상 NULL 이던 실제 갭을 해소한다 — Statistics/Alerts 의 workflow 단위 비용 집계에 영향을 주는 사용자·운영자 체감 변경이다. 바로 앞 선례 PR(#879, `llm_usage_log attribution` 관련 동일 유형 수정)은 CHANGELOG.md 에 상세 항목을 남겼는데, 이번 follow-up 은 5개 변경 파일 목록에 `CHANGELOG.md` 가 없다. `plan/.../ai-usage-attribution-hardening.md` 에도 CHANGELOG 갱신이 체크리스트 항목으로 없다.
  - 제안: 기존 스타일(`## Unreleased — <제목> (<spec 경로> §<절>)` + "### 변경 사항")에 맞춰 C1 배선 내용을 요약하는 CHANGELOG 항목을 추가. B1(타입 주석만, 동작 불변)은 CHANGELOG 대상이 아니어도 무방.

- **[INFO]** 신규 인라인 주석의 "config(=resume state, ...)" 표현이 첫 턴/단발 경로에는 부정확하게 읽힐 소지
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (diff 라인 36-37, `injectMemoryContext` 호출부 새 `llmContext` 주석)
  - 상세: 주석은 "workflowId/nodeExecutionId 는 config(=resume state, 엔진 buildRetryReentryState 가 주입)에서 읽는다" 라고 설명한다. 이는 `applyMultiTurnTurnMemory`(멀티턴 resume 경로, `ai-turn-executor.ts` 2271번째 줄 부근)가 `config: state` 로 재구성 resume state 를 넘기는 경우에만 정확하다. 단발/첫 턴 호출부(`processSingleTurn`, `ai-turn-executor.ts` 1149번째 줄 부근)는 `config` 에 원본 노드 config(`Record<string, unknown>`)를 그대로 넘기며, 이는 resume state 가 아니라 단지 `workflowId`/`nodeExecutionId` 키가 없어 우연히 undefined 가 되는 것이다. 주석 뒤 "첫 턴 등 미주입 시 undefined→NULL" 문구가 이를 어느 정도 보완하지만, "config(=resume state, ...)" 라는 등호 표현만 보면 향후 독자가 config 를 항상 resume state 로 오해할 수 있다.
  - 제안: "config(멀티턴 resume 경로에서는 재구성 resume state — 엔진 `buildRetryReentryState` 가 주입; 첫 턴/단발 경로는 원본 노드 config 라 해당 키 자체가 없어 undefined)" 정도로 조건을 명시하면 더 정확하다. 기능에는 영향 없는 순수 주석 정밀도 이슈.

- **[INFO]** 신규 코드의 문서화 수준 자체는 우수 — 참고용 기록
  - 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` (`BuildSummaryBufferArgs.llmContext` JSDoc, `buildSummaryBufferUpdate` 내부 호출 주석) / `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`LlmCallContext` 명시 타입 주석 + 이유 설명) / `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` (신규 유닛 테스트)
  - 상세: 새 필드마다 `[Spec 7-llm-usage §1.3]` 형태로 SoT 를 정확히 인용했고, 왜 undefined 면 NULL 이 되는지, 왜 명시 타입 주석이 필요한지(TS excess-property check, 이전 ai-review INFO#1 회귀 방지)까지 근거가 남아 있다. `agent-memory-injection.spec.ts` 의 신규 테스트("passes llmContext to the summary chat for llm_usage_log attribution")는 `llm.chat` 의 3번째 인자로 `llmContext` 가 정확히 전달됨을 검증하며 사용 예제로도 기능한다. 별도 조치 불필요.

- 해당 없음 항목: 독스트링/JSDoc(공개 API 신규 추가 없음, 기존 함수 시그니처에 필드만 추가되었고 문서화됨) · README(신규 사용자 대면 기능/설정 없음, 순수 backend 내부 attribution 배선) · API 문서(엔드포인트 변경 없음) · 인라인 주석(복잡 로직 부분마다 충분) · 설정 문서(신규 환경변수 없음).

## 요약

이번 diff 는 AI Agent 자동 메모리 롤링 요약 압축 chat 호출에 `llm_usage_log` attribution(`workflowId`/`executionId`/`nodeExecutionId`)을 배선하는 좁은 범위의 backend-only 변경으로, 코드 자체의 문서화 수준(스펙 인용 주석, JSDoc, 회귀 방지 근거, 신규 유닛 테스트)은 이 프로젝트 컨벤션에 정확히 부합해 양호하다. 다만 두 가지 문서 동기화 갭이 있다: (1) 이 변경이 정확히 무효화하는 spec 서술(`spec/data-flow/7-llm-usage.md §1.3` 등 4곳의 "미배선 — 잔여 갭" 표현)이 별도 PR(PR-2)로 의도적으로 이관되어 병합 순서에 따라 일시적 drift 창이 생길 수 있고, (2) 선행 유사 PR(#879)이 남긴 CHANGELOG.md 관행이 이번 follow-up 에는 적용되지 않았다. 두 갭 모두 기능적 위험은 없고 (1)은 이미 plan 문서에 추적되어 있어 완전히 누락된 것은 아니다.

## 위험도

LOW
