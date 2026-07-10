# 재검증 (convention_compliance) — §1.3 SoT drift CRITICAL 해소 확인

검토 모드: `--impl-done` 재검증. scope=`spec/data-flow/7-llm-usage.md`, diff-base=`origin/main`.
워크트리(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`.

## 배경 — 직전 회차 CRITICAL

직전 검토(같은 세션 `review/consistency/2026/07/10/22_22_19/convention_compliance.md`)에서 당신은
**CRITICAL(HIGH)** 을 보고했다: 구현 diff 가 "AI Agent 자동 메모리 롤링 요약 압축 chat" 의
`llm_usage_log` attribution 을 배선(단발 `context.*`/resume `state.*`)했는데, `spec/data-flow/7-llm-usage.md`
가 4개 위치(§1.3 표 L107·콜아웃 L113·§4 표 L162·Rationale (b) L204-208)에서 여전히 "미배선/전부
NULL/잔여 갭" 으로 서술해 SoT(단일 진실)가 붕괴했다는 지적.

## 이번 변경 — 그 4개 위치를 정정 (spec 을 diff 에 포함)

구현자가 동일 PR 에 `spec/data-flow/7-llm-usage.md` §1.3 4개 위치 정정을 포함했다. HEAD 워킹트리
기준 `git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md`:

```diff
--- a/spec/data-flow/7-llm-usage.md
+++ b/spec/data-flow/7-llm-usage.md
@@ §1.3 표 L107 @@
-| AI Agent 자동 메모리 롤링 요약 압축 (...) | chat | `context` 미전달 → ... 전부 NULL (... 미배선 — 잔여 갭) |
+| AI Agent 자동 메모리 롤링 요약 압축 (...) | chat | **채움**. 단발/첫 턴은 `context.*`, resume 턴은 재구성 `state.*` (AI Agent 메인 chat 과 동일 패턴 — `AiMemoryManager.injectMemoryContext` 가 `buildSummaryBufferUpdate` 로 `llmContext` 전달) |
@@ §1.3 콜아웃 L113 @@
-... **잔여 NULL** 은 ...(`GraphExtractionService`·`RerankService` listwise·AgentMemory 추출 processor)와 노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐이다. ...
+... AI Agent 자동 메모리 롤링 요약 압축 chat 도 노드 발 실행이므로 동일하게 채운다(단발 `context.*`/resume `state.*`, 2026-07 완결). ... **잔여 NULL** 은 워크플로우 밖·non-node caller(`GraphExtractionService`·`RerankService` listwise·AgentMemory 추출 processor)뿐이다. ...
@@ §4 Agent Memory 행 L162 @@
-| Agent Memory | cross-ref | 추출 processor chat + 롤링 요약 압축 chat (usage 적재, context NULL) / ... |
+| Agent Memory | cross-ref | 추출 processor chat(워크플로우 밖 — context NULL) + 롤링 요약 압축 chat(노드 발 — context 채움: 단발 `context.*`/resume `state.*`). usage 적재. / ... |
@@ Rationale L200-206 @@
-노드 발 사용량을 반영한다.\n\n**잔여 NULL** 은 (a) ... 와 (b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading, AI Agent 자동 메모리 롤링 요약 압축)뿐이다 ...
+노드 발 사용량을 반영한다. 추가로 AI Agent 자동 메모리 롤링 요약 압축 chat(...)도 2026-07 에 배선돼 단발/첫 턴은 `context.*`, resume 턴은 재구성 `state.*` 로 세 ID 를 채운다(...).\n\n**잔여 NULL** 은 (a) ... 와 (b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading)뿐이다 ...
```

## 당신의 임무

1. `git -C "/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929" show HEAD:spec/data-flow/7-llm-usage.md` 로 **HEAD 실제 spec 본문**을 읽어 위 4개 위치가 실제로 "AI Agent 메모리 롤링 요약 압축 = context 채움(단발 `context.*`/resume `state.*`)" 으로 정정됐는지 확인한다.
2. 코드(`git show HEAD:codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` 등)와 대조해 spec 서술이 실제 배선과 일치하는지(과다/과소 주장 없는지) 확인한다.
3. 직전 CRITICAL(SoT 붕괴)이 해소됐는지 판정. **새로** 도입된 규약 위반(문서 내부 자기모순, 잔여 NULL 목록의 새 부정확, §1.3 콜아웃과 Rationale 간 불일치 등)이 있으면 보고.
4. 정식 규약(문서 구조/명명/frontmatter) 위반 여부도 재확인.

## 출력

`output_file` 에 markdown 으로: `## 발견사항` (해소 확인 + 잔여/신규 이슈), `## 요약`, `## 위험도`
(NONE/LOW/MEDIUM/HIGH). CRITICAL 이 남아있지 않으면 명확히 "직전 CRITICAL 해소" 로 판정.
반환 라인: `STATUS=success ISSUES=<n> PATH=<output_file> RESET_HINT=`.
