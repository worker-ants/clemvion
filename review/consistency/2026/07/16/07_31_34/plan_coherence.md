# Plan 정합성 검토 — spec/4-nodes/3-ai/

> 모드: `--impl-prep` (구현 착수 전 검토), scope = `spec/4-nodes/3-ai/`
> 대상: `0-common.md` / `1-ai-agent.md` / (`2-text-classifier.md` / `3-information-extractor.md` 상호참조 확인)
> 비교 대상 plan: `plan/in-progress/**` 전수 (특히 `ai-agent-tool-connection-rewrite.md`, `ai-agent-tool-payload-budget-followups.md`, `ai-agent-tool-payload-budget-guardrail.md`, `plan/in-progress/node-output-redesign/{ai-agent,text-classifier,information-extractor}.md`)

## 발견사항

### [WARNING] single-turn 일반 오류 라우팅 — target 이 "구현됨"으로 서술하나 활성 plan 은 미해소 CRITICAL/P0 로 추적 중

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 "Single Turn 모드 — 오류 (`error` 포트)" (L622-654), §10 에러 코드 표의 `LLM_CALL_FAILED`/`LLM_RESPONSE_INVALID` 행 (L1116-1126)
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` (최신 "6차 갱신 2026-06-25" 블록) + 동 폴더 `README.md` §"우선순위 항목 net 변화" P0 항목
- **상세**:
  - target §7.3 은 "타임아웃, rate limit, LLM API 오류, JSON 파싱 실패 등 **모든** 오류 상황"에서 `port: "error"` + `output.error.{code,message,details}` 로 종결된다고 무조건적으로 서술한다. §10 도 `LLM_CALL_FAILED`(5xx/network/auth) 와 `LLM_RESPONSE_INVALID`(JSON 파싱 실패)를 "runtime" 시점 발화 코드로 표에 등재했고, 어디에도 "single-turn 은 예외"라는 Planned/⚠ 마커가 없다 (§4.2·§10 "저장 시점 경고"·§8·§11 은 모두 명시적으로 ⚠ 구현 현황(Planned) 을 붙이는 것과 대조적).
  - 실제 코드(`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`)를 직접 확인: `executeSingleTurn` 의 `llmService.chat(...)` 첫 호출(L1669)과 tool-loop 재호출(L1805/2904)은 **try/catch 로 감싸여 있지 않다** — `AiAgentHandler.execute`(`ai-agent.handler.ts` L119-140)도 `finally`(provider cleanup)만 있고 catch 가 없어, single-turn 도중 LLM 호출이 throw 하면 `port:'error'` 출력이 아니라 그대로 엔진 `FAILED` 로 전파된다. JSON 파싱 실패(L1828-1836)도 `catch { response = result.content }` 로 raw-string fallback 만 하고 `LLM_RESPONSE_INVALID` 를 throw 하지 않는다. (참고로 §4.2 도구 정의 payload 예산의 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 는 `buildSingleTurnToolsOrError` 가 별도로 try/catch 해 error 포트로 정상 라우팅한다 — 이 **한 가지 에러 코드만** 예외적으로 구현돼 있다.)
  - `plan/in-progress/node-output-redesign/ai-agent.md` 는 이 정확한 gap 을 "P0" / "CRITICAL" 로 최신(2026-06-25) 갱신까지 유지 추적 중이다: "**single-turn (`executeSingleTurn`) 의 `llmService.chat`... try/catch 미적용** → single throw 는 여전히 engine FAILED", "`LLM_RESPONSE_INVALID` 가 spec §10 '예약'→'runtime' 격상됐으나 single-turn 은 raw-string fallback 유지 → drift". 동 폴더 `README.md` 도 이를 "P0" 최우선 잔여 항목으로 명시한다.
  - 그런데 `1-ai-agent.md` frontmatter 의 `pending_plans:` 에는 이 plan(`plan/in-progress/node-output-redesign/ai-agent.md`)이 **등록돼 있지 않다** — `ai-agent-tool-connection-rewrite.md` 와 `ai-agent-tool-payload-budget-followups.md` 만 있다. 결과적으로 target 문서 본문(§7.3/§10)은 이 gap 을 전혀 disclose 하지 않고, frontmatter 추적에서도 빠져 있어 "target 이 가정하는 사전 조건(single-turn 오류가 spec 대로 라우팅됨)이 plan 에서 아직 해결되지 않았음"이 이중으로 은폐된 상태다.
- **제안**: (a) `1-ai-agent.md` §7.3/§10 에 §4.2/§8/§11 과 동일한 패턴으로 "⚠ 구현 현황(Planned) — single-turn 의 `LLM_CALL_FAILED`/`LLM_RESPONSE_INVALID` 는 현재 미구현(엔진 FAILED 로 귀결), multi-turn 만 §7.9 대로 동작. 추적: `plan/in-progress/node-output-redesign/ai-agent.md`" 류의 디스클레이머 추가, (b) frontmatter `pending_plans:` 에 해당 plan 경로 추가. spec 문서 갱신이므로 project-planner 트랙.

### [INFO] tool_* dispatcher 분류 순서 참고 노트가 현재 §6.1 알고리즘과 어긋남

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 3.a (L387 부근, provider-priority 분류 서술: "먼저 등록된 `toolProviders` 중 `matches(tc.name)` 가 참인 첫 provider 를 찾고 (kb → mcp → render 순으로 등록), provider 매칭이 없으면 condition 이름 집합과 대조하며, 그래도 매칭이 없으면 일반 도구로 분류")
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` 상단 메모 (2026-05-22 추가): "`tool_*` 모델 확정 시 본 plan §3 Spec 작성 단계에서 ... §6.1 step 3a 의 dispatcher 분류 순서 표 (현재 `cond_* → kb_* → mcp_* → render_* → tool_*` 5단계) 를 갱신해야 한다"
- **상세**: plan 메모는 현재 분류 순서를 "cond → kb → mcp → render → tool" 5단계로 인용하지만, 실제 target §6.1.3.a 는 provider-우선 매칭(kb → mcp → render 순 등록된 provider 를 먼저 검사) 후에야 condition 이름 집합과 대조하고, 마지막에 일반 도구로 폴백하는 알고리즘이다 — 즉 cond 매칭이 순서상 처음이 아니라 provider 매칭 다음이다. `render_*` Presentation Tool Family(§4.1, 2026-05 이후 추가)와 M-1 god-handler 분할(`AiConditionEvaluator.classifyToolCalls` 추출)을 거치며 서술이 갱신됐지만, 5개월 전에 작성된 plan 메모는 그 변화를 반영하지 못한 상태로 남아 있다.
- **제안**: 당장 착수하는 작업(followups 항목 A)과는 무관하지만, `ai-agent-tool-connection-rewrite.md` §3 재개 시점에 이 메모를 §6.1.3.a 실제 문구로 갱신해야 한다는 추적 메모로 남겨둔다. 지금 당장 spec/plan 변경은 불필요.

## 확인됨 — 정합 (참고용, 조치 불요)

- `ai-agent-tool-payload-budget-followups.md` (항목 A, 본 impl-prep 이 실제로 검토 대상으로 삼는 작업) 와 target 문서의 정합은 양호하다:
  - `1-ai-agent.md` §4.2 "저장 시점 경고"·§10 "도구 정의 payload 예산 경고" 는 "⚠ 구현 현황(Planned)" 을 명시하고 followups plan 을 직접 링크하며, frontmatter `pending_plans` 에도 등록돼 있다.
  - `spec/conventions/cross-node-warning-rules.md` §5(backend-only 예외 W2)·§8(`ai_agent:tool-payload-budget` 행)도 "⚠ 구현 예정(Planned)" 을 명시하고 동일 plan 을 참조하며 frontmatter `pending_plans`/`status: partial` 과 일치한다.
  - `spec/5-system/11-mcp-client.md` §5.8 은 SoT 를 `1-ai-agent.md` §4.2/§10 에 전적으로 위임하는 cross-ref 이며 자체적으로 구현 여부를 재주장하지 않아 drift 위험이 없다.
  - followups plan 이 전제하는 "`WorkflowsService` 에 Integration 미주입" / "`getGraphWarnings` 엔드포인트 이미 존재" 등 선행 조건은 현재 코드베이스와 일치함을 직접 확인했다(WorkflowsService 에 Integration 참조 없음, `GET /workflows/:id/graph-warnings` 는 이미 구현됨).
- `ai-agent-tool-connection-rewrite.md` 의 "도구 등록 모델(a/b/c)" 등 5개 미해결 결정(TBD)에 대해 target §4/§4 박스("⚠ 재작성 예정(현재 제거됨)")는 어느 쪽도 선점하지 않고 중립적으로 비활성 상태만 서술한다 — 미해결 결정 우회 없음.
- `marketplace-and-plugin-sdk.md` 는 이미 자신의 Phase D 가 `ai-agent-tool-connection-rewrite.md` 결정에 영향받을 수 있음을 스스로 인지하고 있어 별도 조치 불요.
- `rag-dynamic-cut.md`(D1/D2, RAG 동적 컷) 는 구현·spec 갱신이 이미 완료된 상태이며 target `0-common.md` §2 의 `ragTopK`/`ragThreshold` 서술(미지정 시 동적 점수 컷 지배)과 정확히 일치한다. 잔여 항목(`eval-retrieval` 지표 비교)은 데이터 의존 블록으로 별도 추적 중이며 target 서술에 영향 없음.

## 요약

이번 검토가 실제로 트리거하는 작업(`ai-agent-tool-payload-budget-followups.md` 항목 A — config-time 저장 경고)에 대해서는 target 문서(§4.2/§10/§11, cross-node-warning-rules §5/§8)와 plan 사이의 정합이 정확하다 — Planned 마킹, frontmatter pending_plans, 선행 조건(Integration 미주입 등) 모두 코드베이스 현황과 일치해 착수를 막을 사유가 없다. 다만 검토 범위(`spec/4-nodes/3-ai/`) 전체를 보면 `1-ai-agent.md` §7.3/§10 이 single-turn 의 일반 LLM 오류(`LLM_CALL_FAILED`)·JSON 파싱 실패(`LLM_RESPONSE_INVALID`) 라우팅을 무조건 구현된 것처럼 서술하는데, 실제 코드는 여전히 미구현이고 `plan/in-progress/node-output-redesign/ai-agent.md` 가 이를 P0/CRITICAL 로 추적 중이면서도 target frontmatter `pending_plans` 에는 반영되지 않았다 — 다음 spec 갱신 사이클에서 바로잡을 필요가 있는 WARNING 이다. 그 외 도구 연결 재설계 관련 미해결 결정은 target 이 중립적으로 잘 보류하고 있어 우회 사례는 없다.

## 위험도

MEDIUM
