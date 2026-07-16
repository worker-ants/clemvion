# 요구사항(Requirement) 리뷰 — review/consistency 산출물 + spec/4-nodes/3-ai/1-ai-agent.md §12.16 등

## 검토 범위 요약

이번 diff(14개 파일)는 **애플리케이션 코드를 포함하지 않는다** — 전량 (a) `review/consistency/2026/07/16/{07_31_34,09_13_49}/**` 소비형 consistency-check 산출물(md/json), (b) `spec/4-nodes/3-ai/1-ai-agent.md` §10/§12.16, `spec/conventions/cross-node-warning-rules.md`, `spec/conventions/node-cancellation.md` 3개 spec 문서 갱신이다. 실제 backend 구현(`tool-payload-save-warning.ts`, `llm-call-timeout.ts`, `workflows.service.ts`, `ai-turn-executor.ts`)은 같은 브랜치의 선행 커밋(`60a80fda2`, `13a0e8848`, `4edcedfa3` 등)에 이미 존재하며 이전 review round(`08_36_49`/`09_30_44`)에서 코드 자체를 리뷰했을 가능성이 높다. 따라서 본 라운드의 "기능 완전성" 판단은 **spec 본문이 실제 코드와 line-level 로 일치하는지(criterion 9)** 에 집중해 워크트리 실제 소스를 직접 열람·대조했다.

## 검증 방법

`spec/4-nodes/3-ai/1-ai-agent.md` §10/§12.16 및 `spec/conventions/node-cancellation.md`의 신규 서술을 다음 실제 코드와 1:1 대조했다:

- `codebase/backend/src/nodes/ai/ai-agent/llm-call-timeout.ts` (+ `.spec.ts`)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`executeSingleTurn` L1525~, `processMultiTurnMessage` L2631~, `buildSingleTurnToolsOrError` L1472-1523)
- `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts` (`getGraphWarnings`/`evaluateToolPayloadWarnings`/`evaluateToolPayloadWarningsAndThrow`)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (`classifyLlmError`/`extractAiTurnErrorPayload`)
- `codebase/backend/src/modules/llm/llm.service.ts` (`chat` 의 `opts.timeoutMs`→`withTimeout` 분기)
- `codebase/backend/.env.example`, `CHANGELOG.md`

## 발견사항

- **[INFO]** item B(§12.16, LLM chat 타임아웃)의 Critical 발견·수정 이력을 담은 consistency-check 라운드가 이번 diff 에 미포함
  - 위치: `review/consistency/2026/07/16/10_41_10/**` (워크트리에 존재하나 `git status` 상 미추적(untracked) — 이번 diff(14개 파일)에는 포함되지 않음)
  - 상세: 워크트리를 직접 확인한 결과 `10_41_10` 라운드가 `--impl-prep, item B` 로 실행되어 §12.16 초안의 "timeout throw → 무조건 `LLM_CALL_FAILED`" 오기재를 CRITICAL 로 잡아내고, 이번 diff 의 §12.16 최종 문구(turn 종류별 비대칭 명시 + `LLM_CALL_FAILED` vs `LLM_TIMEOUT` disambiguation + ai_agent 전용 스코프 근거)가 정확히 그 fix 를 반영하고 있음을 확인했다. 즉 **내용적으로는 이미 올바르게 반영**됐으나, 그 근거가 된 검토 산출물 자체(`10_41_10`)는 이번 커밋에 포함되지 않아 `review/consistency/2026/07/16/` 안에 07_31_34→09_13_49(item A) 만 남고 item B 를 검증한 라운드는 감사 추적에서 빠지게 된다. 프로젝트 컨벤션(CLAUDE.md "일관성 검토 산출물 저장 위치: `review/consistency/**`")과의 완전성 관점에서 사소한 gap이며 기능 결함은 아니다.
  - 제안: 후속 커밋에서 `review/consistency/2026/07/16/10_41_10/**` 도 함께 커밋해 §12.16 정정의 근거를 감사 추적에 남길 것을 권장 (조치 필수는 아님).

- **[INFO]** review artifact 문서(files 1, 4, 6~11) 상호 참조·claim 은 실제 diff/코드와 정확히 대조 확인됨
  - 상세: `review/consistency/2026/07/16/09_13_49/SUMMARY.md`(파일 4)가 주장하는 "WARNING(`ai-agent.md` frontmatter `code:` 완전성 누락) → 조치 완료"는 실제로 이번 spec diff(`spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:`)에 `tool-payload-save-warning.ts`가 추가돼 있어 사실과 일치한다. `naming_collision.md`(파일 9)의 "충돌 없음" 판정, `plan_coherence.md`(파일 10)의 "node-output-redesign 미해결 CRITICAL 이 이 diff 로 해소된 것처럼 오인될 소지 없음" 판정도 §12.16 실제 문구(try/catch 스코프를 `buildTools` pre-flight 로 명확히 한정)와 코드(`buildSingleTurnToolsOrError` L1492-1522, `executeSingleTurn` 본문에 chat 호출을 감싸는 try/catch 부재)를 직접 대조해 정확함을 재확인했다. 허위·과장 claim 없음.

## Spec Fidelity 상세 대조 (모두 일치 확인)

- `AI_AGENT_LLM_CALL_TIMEOUT_MS` 기본값 600000ms(10분), `0`=비활성, 음수/NaN/비수치는 default fallback: `llm-call-timeout.ts`의 `aiAgentLlmCallTimeoutMs()` 로직 및 `llm-call-timeout.spec.ts`(6개 케이스: unset/empty-whitespace/양수/`0`/음수-NaN-Infinity/재호출)가 spec §12.16 문구와 정확히 일치.
- "single-turn `executeSingleTurn` 2곳·multi-turn `processMultiTurnMessage` resume 2곳"에 `timeoutMs: aiAgentLlmCallTimeoutMs()` 적용: `ai-turn-executor.ts` L1689/L1820(executeSingleTurn 범위)·L2779/L2923(processMultiTurnMessage 범위) 4개 호출 지점 모두 확인.
- "single-turn 은 일반 chat 호출 try/catch 없음 → 엔진 FAILED 귀결, `buildSingleTurnToolsOrError`의 try/catch 는 `buildTools` pre-flight 한정": 코드상 `executeSingleTurn` 본문에 L1689/L1820 chat 호출을 감싸는 try/catch가 없고, `buildSingleTurnToolsOrError`(L1472-1523)의 try/catch 는 `buildTools` 호출 1건만 감쌈 — 정확히 일치.
- "multi-turn resume 은 `AiTurnOrchestrator.classifyLlmError`/`extractAiTurnErrorPayload` 로 `LLM_CALL_FAILED` 분류": `ai-turn-orchestrator.service.ts` L1084(`classifyLlmError`)·L1157 호출부와 정확히 일치.
- "`withTimeout` 이 자체 `AbortController`로 signal 과 독립 동작": `llm.service.ts` L172-180의 `opts?.timeoutMs && opts.timeoutMs > 0 ? withTimeout(...) : client.chat(...)` 분기와 정확히 일치.
- "config-time 재현은 connected cafe24/makeshop 정적 카탈로그 + presentation 도구만 집계, generic MCP·비-connected 통합은 best-effort skip": `tool-payload-save-warning.ts`의 `reproduceConfigToolDefs`(`integration.status !== 'connected'` skip, `service_type==='mcp'` 미매치 시 자동 skip)와 정확히 일치.
- "`GET /workflows/:id/graph-warnings`가 결과 배열에 append, `saveCanvas`는 응답에 경고를 싣지 않고 severity=error 시에만 `GRAPH_VALIDATION_FAILED` 차단": `workflows.service.ts` `getGraphWarnings`(L565-608, toolBudgetResults append) / `evaluateToolPayloadWarningsAndThrow`(L666-685, `toolBudgetStrictSave()` 꺼져 있으면 skip)와 정확히 일치.
- `cross-node-warning-rules.md` `status: partial→implemented` 승격: 문서 전체에 잔존 "Planned/미구현" 마커 없음(grep 재확인) — 승격 근거 정당.
- `AI_AGENT_LLM_CALL_TIMEOUT_MS=600000` `.env.example` 등재, `CHANGELOG.md` 문구도 spec §12.16 수치·근거와 일치.

TODO/FIXME/HACK/XXX 주석: 대상 파일(14개) 및 대조한 실제 구현 파일 전체에서 미검출.

## 요약

이번 diff 는 순수 문서(spec 3개 + consistency-check 산출물 11개)로만 구성되며, 그 안에 서술된 신규 기능("§12.16 LLM chat 호출 app-level 타임아웃 defense-in-depth", "§10 도구 정의 payload 예산 저장 시점 경고 Planned→구현완료")은 실제 워크트리 코드(`llm-call-timeout.ts`, `ai-turn-executor.ts`, `tool-payload-save-warning.ts`, `workflows.service.ts`, `ai-turn-orchestrator.service.ts`, `llm.service.ts`)와 line-level 로 정확히 일치함을 직접 대조 확인했다. 엣지 케이스(env `0`/음수/NaN/공백)는 전용 유닛 테스트로 커버되고, 에러 시나리오(single-turn try/catch 부재로 인한 엔진 FAILED 귀결 gap)도 spec 이 과장 없이 정확히 disclose 하며 기존 `node-output-redesign` 미해결 항목과의 경계도 명확히 서술한다. TODO/FIXME 류 미완성 마커는 없다. 유일한 관찰 사항은 item B 의 근거가 된 consistency-check 라운드(`review/consistency/2026/07/16/10_41_10/`)가 이번 diff 에 커밋되지 않아 감사 추적이 다소 끊긴다는 점(INFO, 기능 결함 아님)이며, 이는 후속 커밋에서 정리 가능하다. 요구사항 충족·spec fidelity 관점에서 CRITICAL/WARNING 급 문제는 발견되지 않았다.

## 위험도

NONE
