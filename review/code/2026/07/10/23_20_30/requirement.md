# 요구사항(Requirement) Review

## 검토 대상

- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — resume 턴 `llmContext` object literal 에 `LlmCallContext` 명시 타입 주석 부여 (import 도 `type LlmCallContext` 추가)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — `collection retry loop` 스위트에 collection-retry 2번째 chat 호출의 attribution 단언 테스트 1건 신규 추가
- 목적: `#501` attribution 불변식(`spec/5-system/4-execution-engine.md` §Rationale "resume/retry 턴 usage-log attribution")의 회귀 방지 강화. 커밋 메시지·plan 문서 모두 "런타임 동작 변경 0" 을 명시.

## 검증 방법

정적 diff 리뷰에 그치지 않고 실제 코드베이스(worktree `llm-usage-attr-hardening-4648ca`, commit `5e6f70b76`)에서 다음을 직접 실행/확인했다.

1. `npx jest information-extractor.handler.spec.ts` (36 tests) 및 `ai-turn-executor.spec.ts` 포함 전체 — 67/67 PASS.
2. **Mutation 검증 (e)**: `ai-turn-executor.ts:2609` 의 `nodeExecutionId` 를 `nodeExecutionID` 로 오타 주입 → `tsc --noEmit` 이 `TS2561: ... Did you mean to write 'nodeExecutionId'?` 로 즉시 차단됨을 재현. 파일 복구 후 diff 0 확인.
3. **Mutation 검증 (g)**: `information-extractor.handler.ts` 의 `runTurnWithCollectionRetries` 루프에서 "collectionRetryCount === startingRetryCount 일 때만 llmContext 전달, 재시도부터는 undefined" 로 변조 → 신규 테스트(`passes the same llmContext attribution to the retried (2nd) chat call`) **단 1건만 실패**, 기존 `feeds tool_result back and loops...` 등 나머지 35건은 그대로 통과. 신규 테스트가 vacuous 하지 않고 실제 retry-specific 회귀를 검출함을 실증. 파일 복구 후 diff 0 확인.
4. `spec/data-flow/7-llm-usage.md` §1.3 표·Rationale, `spec/5-system/4-execution-engine.md` 의 `#501` 불변식 문단(:171, :1378-1384)을 원문 대조.
5. 동봉된 `review/consistency/2026/07/10/22_52_18/*` (impl-prep 5종 checker) 결과(BLOCK: NO, Critical 0)도 함께 확인 — 위 mutation 재현 결과가 SUMMARY.md 의 자체 실증과 일치.

## 발견사항

- **[INFO]** 순수 컴파일타임/테스트 전용 변경 — 런타임 동작 무변화 확인
  - 위치: `ai-turn-executor.ts:36-40`(import), `:2606`(타입 주석)
  - 상세: `const llmContext: LlmCallContext = {...}` 는 타입 주석만 추가된 것으로, 이미 `LlmCallContext` 형태와 정확히 일치하는 필드(`workflowId`/`executionId`/`nodeExecutionId`)만 담고 있어 컴파일 결과(런타임 JS)에 어떤 차이도 없다. mutation 검증으로 "주석 없으면 오탈자가 조용히 통과, 주석 있으면 `TS2561`" 을 재현해 주석이 실제로 load-bearing 함을 확인했다 — 커밋 메시지의 주장과 정확히 일치.
  - 제안: 없음 (의도대로 동작).

- **[INFO]** 신규 테스트가 커버리지 갭을 정확히 메움 — vacuous 아님
  - 위치: `information-extractor.handler.spec.ts:1027-1067`
  - 상세: 기존 `collection retry loop > feeds tool_result back and loops...` (:994)는 2번째 `chat` 호출이 일어난다는 것만 검증하고 그 호출의 3번째 인자(`llmContext`)는 단언하지 않았다. 신규 테스트는 `mock.calls[0][2]`/`mock.calls[1][2]` 둘 다 동일 attribution 을 갖는지, 그리고 `nodeExecutionId` 자리에 node 정의 id(`node-def-2`)가 잘못 유입되지 않는지(`#501` 의 실제 실패 모드)를 직접 단언한다. `retryState()` 헬퍼 기본값에 `executionId` 가 없어(핸들러 `:891` 의 `state.executionId ? {...} : undefined` 조건 분기 때문에) override 로 세 필드를 명시 주입해야 한다는 테스트 내 주석도 실제 코드(`handler.ts:891-897`)와 정확히 일치함을 확인.
  - 제안: 없음.

- **[INFO]** spec fidelity — line-level 일치
  - 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 + Rationale "`llm_usage_log` 의 nullable context 컬럼들", `spec/5-system/4-execution-engine.md` §Rationale "resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)" (:1378-1384)
  - 상세: spec 은 "노드 핸들러 3종(AI Agent/Text Classifier/Information Extractor)이 `workflow_id/execution_id/node_execution_id` 를 채운다", "이 불변식은 회귀 테스트로만 강제되므로 리팩터 시 반드시 보존한다" 고 명시한다. 본 diff 는 정확히 그 "회귀 테스트로만 강제" 되는 지점을 (a) 컴파일타임 가드(타입 주석)와 (b) 테스트 커버리지 확장(2번째 chat 단언) 두 층으로 보강하는 것으로, spec 문구와 실제 변경의 의도·범위가 완전히 일치한다. 불일치·CRITICAL 없음.
  - 제안: 없음.

- **[INFO]** (기능적 결함 아님, 진행상황 추적 참고) plan 체크박스 미갱신은 의도적 결정이며 문서화됨
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md` "최종 /ai-review(02_09_15) INFO" 섹션의 INFO#1/INFO#4 항목(여전히 `[ ]`)
  - 상세: 본 코드 변경은 그 plan 의 INFO#1(타입 주석)·INFO#4(2nd-chat 테스트)를 1:1 로 소진하는 작업이지만, 동일 plan 파일의 인접 리스트 항목을 병렬 진행 중인 docs PR #898 이 편집 중이라 merge conflict 위험이 있어 이번 커밋은 plan 파일을 건드리지 않기로 결정했다(동봉 `plan-coherence.md` W1, 커밋 메시지에도 명시). "코드는 반영됐는데 체크박스는 미체크" 상태가 일시적으로 남지만, 그 사유와 후속 계획("#898 머지 후 별도 pass 에서 종결")이 커밋 메시지·consistency 산출물에 명확히 기록되어 있어 유실 위험은 낮다.
  - 제안: 없음(이미 사람이 내린 결정이자 문서화된 trade-off). 후속 세션에서 #898 머지 확인 후 체크박스 반영 잊지 않도록 참고.

## 요약

`ai-turn-executor.ts` 의 명시 타입 주석과 `information-extractor.handler.spec.ts` 의 신규 회귀 테스트는 둘 다 런타임 동작을 바꾸지 않는 순수 하드닝 변경이며, 실제 jest 실행(67/67 PASS)과 두 건의 독립 mutation 재현(타입 주석 제거 시 오탈자 미검출 재현, retry 경로 attribution 누락 변조 시 신규 테스트 단독 실패)으로 "주장된 가드 효과가 실제로 작동한다"를 직접 검증했다. `spec/data-flow/7-llm-usage.md` §1.3 과 `spec/5-system/4-execution-engine.md` 의 `#501` 불변식 서술은 코드·주석·테스트와 line-level 로 정확히 일치하며 CRITICAL 급 괴리는 없다. 유일하게 남는 것은 plan 체크박스의 일시적 stale 상태인데, 이는 이미 impl-prep consistency-check 에서 발견돼 사유와 함께 명시적으로 defer 된 결정이라 별도 조치가 필요한 결함이 아니다.

## 위험도

NONE

STATUS: DONE
