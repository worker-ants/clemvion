# Plan 정합성 검토 — spec/4-nodes/3-ai/ (--impl-done)

> 검토 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md` (diff-base `origin/main`, HEAD worktree = 이 세션)
> 대조 plan: `plan/in-progress/ai-agent-tool-payload-budget-followups.md`(항목 B — 본 diff 의 근원 plan) · `ai-agent-tool-payload-budget-guardrail.md`(선행, 머지됨) · `ai-agent-tool-connection-rewrite.md`(별개 미해결 plan) · `plan/in-progress/node-output-redesign/ai-agent.md`(single-turn 에러 라우팅 P0/CRITICAL 추적) · `plan/complete/node-cancellation-infrastructure.md`(참조 대상)
> 참고: 같은 날 선행 실행분 `review/consistency/2026/07/16/{07_31_34,09_13_49,10_41_10}/` (특히 10_41_10 은 cross_spec 이 CRITICAL 2건을 발견해 `task_3ac39ebd` 로 위임한 기록)

## 조사 방법

1. `git status` / `git diff origin/main --stat` 로 실 변경 범위 확인: unstaged 로 `spec/4-nodes/3-ai/1-ai-agent.md`(§12.16 `LLM_TIMEOUT` disambiguation 문구 정정) · `plan/in-progress/ai-agent-tool-payload-budget-followups.md`(체크리스트 갱신) · `llm.service.spec.ts`(테스트 hygiene) 변경, committed 로는 item B(resume timeoutMs+signal, §12.16 신설) 전체.
2. `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 실행 체크리스트(항목 B)와 커밋 로그(`13a0e8848`·`677a81615`·`4edcedfa3`·`204b9aed6`) 1:1 대조.
3. 오늘 앞선 세 차례 consistency-check 산출물(07:31:34 impl-prep, 09:13:49 impl-done(항목 A), 10:41:10 impl-prep(항목 B))의 미해소 발견사항이 현재 HEAD 에서 어떻게 처리됐는지 코드/spec 직접 재확인.
4. `plan/in-progress/node-output-redesign/ai-agent.md` 최신(6차, 2026-06-25) 블록과 target §7.3/§10/§12.16 재대조.
5. `spec/conventions/node-cancellation.md` 의 `node-cancellation-infrastructure.md` 참조와 실제 plan 상태(`plan/complete/` 이동, "by-design 미전파" 로 종결) 대조.

## 발견사항

### [WARNING] single-turn 일반 오류 라우팅 미해결 gap — §12.16 에서 언급만 되고 §7.3/§10/frontmatter 원위치는 여전히 무조건 서술

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 "Single Turn 모드 — 오류" (L623-655, "타임아웃, rate limit, LLM API 오류, JSON 파싱 실패 등 **모든** 오류 상황에서 사용" — 무조건적 서술, Planned/⚠ 마커 없음), §10 에러 코드 표(L1113-1134, `LLM_CALL_FAILED`/`LLM_RESPONSE_INVALID` 를 예외 없이 "runtime" 으로 등재), frontmatter `pending_plans`(L20-21, `node-output-redesign/ai-agent.md` 미등록)
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` "6차 갱신 (2026-06-25)" 블록 — `executeSingleTurn` 의 `llmService.chat` 호출(첫 호출/tool-loop 재호출 2곳)이 여전히 try/catch 없이 엔진 `FAILED` 로 전파되는 것을 **P0/CRITICAL 잔여**로 명시 추적 중. 동일 발견이 오늘 `review/consistency/2026/07/16/07_31_34/plan_coherence.md` 에서 이미 WARNING 으로 보고됨(§7.3/§10 disclaimer 추가 + `pending_plans` 등록 제안).
- **상세**: 이번 item B 작업이 신설한 §12.16(L1358)이 "이는 single-turn 일반 LLM 에러 라우팅의 **기존 미해결 gap**(`plan/in-progress/node-output-redesign/ai-agent.md` 추적)" 이라고 명시적으로 disclose 하기 시작한 점은 07:31:34 회차가 지적한 문제를 부분적으로 완화한다 — target 이 이 gap 의 존재를 최소한 한 곳에서는 인정한다. 그러나 07:31:34 이 구체적으로 권고한 두 조치(§7.3/§10 본문에 "⚠ 구현 현황(Planned)" 마커 추가, frontmatter `pending_plans` 등록)는 여전히 미적용이다 — §7.3 은 지금도 "모든 오류 상황" 이라 단정하고, §10 표 도입부에도 single-turn 예외가 없으며, `pending_plans` 는 `ai-agent-tool-connection-rewrite.md` 하나만 남아 있다(직접 확인: `grep node-output-redesign spec/4-nodes/3-ai/1-ai-agent.md` → §12.16 1건만 매치). §12.16 은 timeout 이라는 좁은 문맥에서만 이 gap 을 인용하므로, §7.3/§10 을 단독으로 읽는 독자(대부분의 spec 소비 경로)는 여전히 이 gap 을 인지할 수 없다.
- **제안**: (a) §7.3 서두 또는 §10 표 상단에 "single-turn 의 일반 `llmService.chat` 실패는 현재 엔진 `FAILED` 로 귀결되며 본 섹션의 error 포트 라우팅은 multi-turn 에 한정 적용된다(`TOOL_DEFINITION_PAYLOAD_EXCEEDED` 등 pre-flight 코드는 예외)" 류의 명시적 disclaimer 추가, (b) frontmatter `pending_plans` 에 `plan/in-progress/node-output-redesign/ai-agent.md` 추가. project-planner 트랙(spec 갱신)이며 본 item B PR 의 필수 차단 사유는 아니지만, 두 번째 회차째 동일 권고가 반영되지 않고 있어 다음 spec 갱신 사이클에서 반드시 처리 필요.

### [WARNING] 선행 impl-prep(10:41:10) 이 발견한 CRITICAL 2건이 plan/in-progress 에 정식 기록 없이 task ID 로만 위임됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 포트 표(Multi Turn 은 `out` 없음 + 마이그레이션 "dangling, 수동 재연결") 및 §4.2/§10/§12.15(`AI_AGENT_TOOL_COUNT_MAX=128` 기본값 + Cafe24 "383" 오퍼레이션 수치), `spec/4-nodes/3-ai/_product-overview.md` ND-AG-24("조건 0개 시 `out` + `error` 제공, 하위 호환")
- **관련 plan**: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` L27 (`"pre-existing Critical 2건(out 포트 서술 모순·count_max vs 카탈로그)은 item B 무관 → project-planner task task_3ac39ebd 위임(사용자 결정)"`) — 이 한 줄이 유일한 기록.
- **상세**: 오늘 10:41:10 impl-prep 회차의 `cross_spec` checker 가 두 건의 CRITICAL 을 보고했다: ① Multi Turn `out` 포트 하위호환 여부가 `1-ai-agent.md` §3.2 본문(없음+dangling)과 `_product-overview.md`(3-ai 및 상위 `4-nodes/_product-overview.md` 양쪽) ND-AG-24("하위 호환 유지")에서 정반대로 서술됨, ② `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24(383 op, `enabledTools` 미설정=전체노출)·MakeShop(161 op) 의 **기본 연결 경로를 상시 실패**시키는데 `spec/0-overview.md` §6.1 은 두 통합을 "모두 구현 완료" 로만 서술하고, `4-cafe24.md`(~180)와 `1-ai-agent.md` §12.15(383) 간 오퍼레이션 수치도 불일치. 사용자 결정("B 진행 + planner 위임")에 따라 이 두 건은 project-planner task(`task_3ac39ebd`)로 넘겨졌으나, 현재 이 위임을 추적하는 `plan/in-progress/*.md` 파일이 **존재하지 않는다**(`grep -rl task_3ac39ebd plan/` → 체크리스트 한 줄과 review 산출물만 매치). 직접 재확인 결과 두 모순은 현재 HEAD 에도 그대로 남아 있다(`_product-overview.md:84`/`4-nodes/_product-overview.md:215` 의 "하위 호환" 문구, `4-cafe24.md:29` 의 "~180" 문구 모두 미수정). task ID 는 session-scoped 이고 review 산출물은 archive 대상이라, 이 worktree/세션이 정리되면 두 CRITICAL 의 처분 경로가 유실될 위험이 있다.
- **제안**: `plan/in-progress/` 에 이 두 건을 위한 전용 항목(신규 파일 또는 `ai-agent-tool-payload-budget-followups.md` 의 "후속 백로그" 절에 추가)을 만들어 durable 하게 기록. 최소한 `1-ai-agent.md`/`4-nodes/3-ai/_product-overview.md` frontmatter `pending_plans` 에 그 plan 경로를 등록해 다음 세션에서도 이 미해결 결정이 발견되도록 한다.

### [INFO] `node-cancellation-infrastructure.md` 참조가 stale — "추적 중" 표현이 실제로는 종결된 by-design 결정을 가리킴

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16(L1358, 신규) — "resume 경로... abort 소스는 node-cancellation-infrastructure follow-up" / `spec/conventions/node-cancellation.md` L44(§12.16 이 SoT 로 인용하는 pre-existing 문장) — "resume 경로는 turn 경계에서 abort 체크를 도입하는 별도 작업으로 **추적** (`node-cancellation-infrastructure.md`)"
- **관련 plan**: `plan/complete/node-cancellation-infrastructure.md` — 2026-06-20 재검증 블록이 "§5 AI signal... resume by-design 미전파" 를 **완료 판정**으로 명시 종결(더 이상 진행 예정 작업 아님). `plan/in-progress/parallel-p2-followups.md` L22 도 동일하게 "resume(continuation) 경로는 abort context 부재로 **by-design 미전파**" 로 재확인.
- **상세**: `node-cancellation.md` 의 사전 존재 문장은 이 gap 을 "별도 작업으로 추적 중"이라고 표현하지만, 실제로 그 추적 대상(`node-cancellation-infrastructure.md`)은 이미 `plan/complete/` 로 이동했고 해당 항목은 "의도적으로 구현하지 않음(by-design)" 으로 종결됐다 — 즉 "누군가 나중에 할 예정" 이 아니라 "하지 않기로 결정됨" 이다. 본 diff(item B)가 신설한 §12.16 이 이 기존 stale 표현을 그대로 인용해 "follow-up" 으로 재확인함으로써, 독자가 이 abort-signal 공급을 여전히 로드맵상의 활성 작업으로 오인할 소지를 이어받는다. `ResumableMessageOptions.signal` plumbing 자체(현재 no-op)는 코드 결정으로서 문제 없다 — 표현의 정확성 문제에 한정된다.
- **제안**: 시급하지 않음(item B 의 실질 안전망은 timeout 이 담당). 다음 `node-cancellation.md` 갱신 시 "추적 중" → "by-design 미전파 (재검토 시 신규 plan 필요)" 로 표현 정정 권장.

### [INFO] `ai-agent-tool-connection-rewrite.md` 의 dispatcher 분류 순서 메모 — 여전히 stale (재확인, 조치 불요)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 3.a (provider-우선: kb → mcp → render 순 등록 provider 매칭 → cond 이름 대조 → 일반 도구 폴백)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` 상단 메모(2026-05-22) — "현재 `cond_* → kb_* → mcp_* → render_* → tool_*` 5단계" 로 인용
- **상세**: 07:31:34 회차에서 이미 INFO 로 보고된 사항이 이번 diff 로도 변경되지 않아 재확인만 함 — 실제 분류 순서(§6.1.3.a)는 provider-우선(kb→mcp→render)이 cond 대조보다 먼저이나, plan 메모는 cond 를 1순위로 인용한다. prefix 가 서로 disjoint 해 기능적 영향은 없다. `tool_*` 재설계 착수(§3 Spec 작성 단계) 시점에 메모를 최신 §6.1.3.a 문구로 갱신하면 충분 — 지금 조치 불요.

## 정합 확인 (문제 없음으로 판정한 항목)

- **item B 자체 (resume timeoutMs+signal, §12.16 신설)**: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 실행 체크리스트와 커밋 로그(`13a0e8848`/`677a81615`/`4edcedfa3`/`204b9aed6`)가 1:1 대응하며, ai-review CRITICAL(withTimeout signal 누수)도 fix 커밋(`204b9aed6`)으로 해소되고 체크리스트에 반영돼 있다. `AiTurnExecutor`/`LlmService` 관련 어떤 in-progress plan 의 미해결 결정도 새로 우회하지 않는다.
- **`ai-agent-tool-connection-rewrite.md`(TBD 5개 결정)**: 이번 diff 는 이 plan 이 다루는 영역(`tool_*` 일반 도구 연결 모델)을 건드리지 않음 — 유일한 잔존 `pending_plans` 항목으로 정확히 유지됨.
- **`cross-node-warning-rules.md` §5/§8 (`ai_agent:tool-payload-budget`)**: item A 완료 반영이 이전 회차(09:13:49)에서 이미 검증됐고 이번 diff 로 재훼손되지 않음.
- **cross-node-warning-rules.md 예외 조항(backend-only rule)** 과 `estimateAgentToolPayload` 관련 상호의존(향후 `toolNodeIds` 추가 시 estimator 갱신 필요) 는 guardrail plan 백로그에 이미 INFO#2 로 정확히 추적돼 있어 별도 조치 불요.

## 요약

이번 diff(item B — resume LLM 호출 app-level timeout + signal plumbing, §12.16 신설)는 자신이 속한 `ai-agent-tool-payload-budget-followups.md` 체크리스트와 정확히 대응하며, 새로운 미해결 결정 우회는 없다. 다만 검토 범위(`spec/4-nodes/3-ai/`) 전체를 보면 두 건의 recurring 미해소 항목이 있다: (1) single-turn 일반 오류 라우팅이 `node-output-redesign/ai-agent.md` 의 P0/CRITICAL 로 계속 추적 중인데 §7.3/§10/frontmatter 원위치는 여전히 이를 disclose 하지 않고(§12.16 은 부분적으로만 언급), (2) 오늘 10:41:10 회차가 발견한 두 CRITICAL(ND-AG-24 자기모순, Cafe24/MakeShop count-cap 기본연결 실패+수치 불일치)이 `task_3ac39ebd` 위임 한 줄로만 기록돼 durable plan 파일이 없다. 두 항목 모두 이번 item B PR 을 직접 차단할 사유는 아니나(스코프 무관, target 자체가 재확인함), 다음 spec 갱신·plan 정리 사이클에서 반드시 formal 하게 추적돼야 한다.

## 위험도

MEDIUM
STATUS=success FILE_WRITTEN=/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/review/consistency/2026/07/16/12_22_49/plan_coherence.md CRITICAL=0
