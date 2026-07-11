# 재검증 (requirement) — WARNING(resume 조립 테스트) + SPEC-DRIFT 해소 확인

대상: `claude/ie-resume-llm-attribution-c82918` HEAD `6303a2190` (직전 회차 `review/code/2026/07/10/22_22_19/requirement.md` 대비 신규 커밋 1개). `git diff origin/main...HEAD` 10 파일. merge-base `origin/main`=`cc3dafa8c` — 현재 `origin/main` tip 은 `52f46f95f`(1 커밋 앞섬, `docs(spec)` 전용·본 diff 와 무관 파일) 이라 stale-base 우려 없음.

## 발견사항

- **[INFO]** SPEC-DRIFT 해소 확인 — `spec/data-flow/7-llm-usage.md` §1.3 4개 위치가 실제 구현과 line-level 로 정합
  - 위치: `spec/data-flow/7-llm-usage.md:107`(§1.3 표 "AI Agent 자동 메모리 롤링 요약 압축 ... **채움**. 단발/첫 턴은 `context.*`, resume 턴은 재구성 `state.*`"), `:113`(콜아웃 — 잔여 NULL 목록에서 메모리 압축 제거 + 채움 서술 추가), `:162`(§4 Agent Memory 행 "롤링 요약 압축 chat(노드 발 — context 채움: 단발 `context.*`/resume `state.*`)"), `:206`(Rationale (b) 항 — "AI Agent 자동 메모리 롤링 요약 압축" 제거, `RerankService` listwise 만 잔존) / 대응 코드: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1149-1167`(single-turn `context.workflowId/executionId/nodeExecutionId`), `:2296-2302`(multi-turn resume `state.workflowId/executionId/nodeExecutionId`), `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:126,252-254`(`llmContext` 명시 파라미터 → forward), `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:287,312,391`(`buildSummaryBufferUpdate` 가 `llmContext` 를 `llmService.chat` 3번째 인자로 전달)
  - 상세: 4개 위치 모두 실제 배선 방식(caller 별 `context.*`/`state.*`, `AiMemoryManager.injectMemoryContext` → `buildSummaryBufferUpdate` → `llmContext`)을 정확히 서술하도록 정정됐다. 잔여 NULL 목록도 코드 사실과 일치(`GraphExtractionService`·`RerankService` listwise·AgentMemory 추출 processor — 워크플로 밖 non-node caller 뿐, 메모리 압축은 이제 제외). 직전 회차가 지적한 SPEC-DRIFT 는 완전히 해소됐다 — 방향은 "코드가 맞고 spec 만 낡음" 이었고 본 커밋은 정확히 spec 을 코드에 맞춰 정정(코드 되돌리기 아님)했으므로 처리가 적절하다.
  - 제안: 없음(완결). `plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT·§워크플로 섹션이 `/consistency-check --impl-done` 최초 BLOCK:YES(convention_compliance CRITICAL) → 본 정정 반영 → 재검증 경로를 정확히 추적하고 있다(`review/consistency/2026/07/10/22_22_19/SUMMARY.md` 대조 확인).

- **[INFO]** WARNING(resume 경로 end-to-end 미검증) 해소 확인 — 신규 테스트가 `state.*` 조립 로직 자체를 실값으로 왕복 검증
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts:395-465`(신규 `multi-turn resume: summary 압축 chat 이 재주입된 state.* 를 llm_usage_log llmContext 로 채운다` 테스트), 대상 조립부 `ai-turn-executor.ts:2296-2302`
  - 상세: 신규 테스트는 (1) `handler.execute()` 로 실제 첫 턴을 실행해 `_resumeState` 를 받고, (2) 그 `state` 객체의 `workflowId`/`executionId`/`nodeExecutionId` 를 엔진 `buildRetryReentryState` 재주입을 시뮬레이션하는 리터럴로 직접 덮어쓴 뒤, (3) 같은 `state` 참조를 `handler.processMultiTurnMessage('질문', state)` 에 그대로 전달한다. `ai-agent.handler.ts:165-179` → `ai-turn-executor.ts:2486` `processMultiTurnMessage` → `applyMultiTurnTurnMemory`(2255~2302) 가 바로 이 `state.workflowId`/`state.executionId`/`state.nodeExecutionId` 를 읽어 `llmContext` 를 조립하므로, 테스트가 사전 구성한 객체가 아니라 **실제 조립 로직의 산출값**이 `mockLlmService.chat.mock.calls[0][2]` 로 관찰된다. 압축이 실제로 트리거됐는지(`meta.memory.summarized === true`)를 먼저 단언해 "단언의 전제"를 명시적으로 고정한 점도 적절하다. 이전 라운드가 지적한 "manager forwarding 만 검증하고 실제 `state.*` 조립은 미검증" 갭이 정확히 이 지점에서 닫혔다. `ai-memory-manager.spec.ts` 의 기존 테스트도 주석이 "state.* 조립 커버" → "manager 레이어 forwarding 계약"으로 정정되어, 실제 커버리지와 코멘트 간 괴리(이전 WARNING 상세에서 지적된 부분)도 해소됐다.
  - 검증: `npx jest ai-agent.memory.spec.ts ai-memory-manager.spec.ts agent-memory-injection.spec.ts ai-turn-executor.spec.ts` 4 suite 145 tests 전부 PASS(직접 재실행 확인). `npx eslint` 두 변경 spec 파일 lint clean.
  - 제안: 없음(완결).

- **[INFO]** 기능 완전성 — 잔여 CRITICAL/WARNING 없음
  - 위치: 전체 diff(`git diff origin/main...HEAD` 10 파일) — 신규 TODO/FIXME/HACK/XXX 미도입(grep 확인). CHANGELOG.md 항목("AI Agent 자동 메모리 롤링 요약 압축 chat 의 llm_usage_log attribution 배선")이 실제 구현·spec 서술과 line-level 일치.
  - 상세: 이번 변경 세트(테스트 2건 추가 + spec 4위치 정정 + plan 문서 갱신)는 순수하게 직전 라운드 발견사항 해소용이며 신규 런타임 로직 변경이 없다(프로덕션 코드 diff 0 — `ai-turn-executor.ts`/`ai-memory-manager.ts`/`agent-memory-injection.ts` 는 이번 커밋에 미포함, 이전 커밋에서 이미 구현·검증 완료). 두 발견사항 모두 명확히 코드/테스트로 뒷받침되어 실제로 닫혔다고 판단할 근거가 충분하다.
  - 제안: 없음.

## 요약

직전 회차가 지적한 두 항목 — (1) `spec/data-flow/7-llm-usage.md` §1.3 SPEC-DRIFT, (2) multi-turn resume 경로의 `state.*` → `llmContext` 조립 자체가 end-to-end 로 미검증이던 WARNING — 모두 이번 커밋(`6303a2190`)에서 완전히 해소됨을 코드·spec·테스트 실행으로 직접 확인했다. spec 4개 위치는 실제 구현(caller 별 `context.*`/`state.*`, `AiMemoryManager`→`buildSummaryBufferUpdate` forwarding)과 line-level 로 정합하고, 신규 테스트는 사전 구성 객체가 아니라 핸들러 first-turn 실행이 반환한 `_resumeState` 를 실제로 덮어써 `processMultiTurnMessage` 의 실제 조립 코드 경로(`ai-turn-executor.ts:2296-2302`)를 통과시킨 뒤 `mockLlmService.chat` 3번째 인자를 단언하므로, "manager forwarding 만 검증"하던 이전 갭을 정확히 메운다. 관련 4개 spec 파일 145 테스트 전부 PASS, lint clean, 신규 TODO/FIXME 없음. 잔여 CRITICAL/WARNING 을 발견하지 못했다.

## 위험도

NONE
