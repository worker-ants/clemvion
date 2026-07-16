---
worktree: funny-mahavira-50d003
started: 2026-07-14
owner: developer
---

## 실행 체크리스트 — 항목 A (config-time 저장 경고, PR #1)

- [x] 3. `/consistency-check --impl-prep spec/4-nodes/3-ai/` → BLOCK: NO (5/5 checker CRITICAL=0; WARNING 은 기존 spec 문서 수준, 본 작업 무관)
- [x] 5-6. TDD: pure 도구 재현 함수 추출 (cafe24/makeshop) + config-time 평가 + 배선
  - [x] `buildCafe24ToolDefsForIntegration` 추출 (buildTools drift-0 회귀 테스트)
  - [x] `buildMakeshopToolDefsForIntegration` 추출 (동일)
  - [x] `tool-payload-save-warning.ts` (`evaluateAiAgentToolPayloadWarnings`) + unit test
  - [x] `toolBudgetStrictSave()` env 파서 + test
  - [x] WorkflowsService: Integration repo 주입 + getGraphWarnings(workspaceId) append + saveCanvas error block
  - [x] `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` + backend-labels.test P3-C-1 backend-only 목록
- [x] spec 마감: cross-node-warning-rules status partial→implemented·§8 Planned 제거, ai-agent §10 Planned 제거, 두 spec pending_plans 정리
- [x] 8. TEST WORKFLOW (lint·unit·build·e2e 모두 통과, #952 base). 신규 e2e `ai-agent-tool-payload-warning.e2e-spec.ts` 통과(256/256).
- [x] 9. `/ai-review` (11 reviewer, MEDIUM, Critical 0, Warning 7) + 수동 resolution: W1(N+1/pool/dead-path)·W3(중복)·W5(stale 주석)·W6(.env.example)·W7(CHANGELOG)·INFO#3/#6 fix, W2/W4 수용/후속. TEST WORKFLOW 재통과(lint·unit·build·e2e). RESOLUTION.md 기록.
- [x] 9.4 `/consistency-check --impl-done spec/4-nodes/3-ai/` → BLOCK: NO (5/5 CRITICAL=0). WARNING(신규 모듈 `ai-agent.md` `code:` 누락) 조치 완료.
- [x] PR (항목 A 단독) → https://github.com/worker-ants/clemvion/pull/955

## 실행 체크리스트 — 항목 B (resume 턴 timeoutMs + signal 배선, 별도 PR)

> 항목 A 와 별개 concern (defense-in-depth). 사용자 지시로 **PR #955 에 합류**(별 PR 아님).

- [x] impl-prep `/consistency-check --impl-prep` → BLOCK: YES 이나 item B 관련(§12.16 error-routing overclaim·LLM_TIMEOUT disambiguation·scope) 조치 완료. pre-existing Critical 2건(out 포트 서술 모순·count_max vs 카탈로그)은 item B 무관 → project-planner task `task_3ac39ebd` 위임(사용자 결정)
- [x] `ai-turn-executor.ts` chat 호출 4곳(single-turn 2·multi-turn resume 2)에 app-level `timeoutMs` 배선 (`llm-call-timeout.ts` env 파서)
- [x] `ResumableMessageOptions.signal` 추가 → resume chat 에 signal executor-side plumbing (abort **소스**는 node-cancellation-infrastructure follow-up — spec 명시 gap)
- [x] env `AI_AGENT_LLM_CALL_TIMEOUT_MS` (기본 600000=10분, 0 비활성) + .env.example + spec §12.16 + node-cancellation.md + CHANGELOG
- [x] TEST WORKFLOW (lint·unit·build·e2e 256/256 통과). ⚠ eslint --fix 가 제거한 필수 narrowing 캐스트(errorPayload.details) 복원 fix(4edcedfa3) — docker clean build 에서 발각(로컬 incremental 은 가림). 교훈: --fix 후 build 재실행 필수([[reference_eslint_fix_removes_needed_cast]]).
- [x] `/ai-review` (router under-select → code reviewer 직접 재실행). **concurrency CRITICAL**: `LlmService.chat` withTimeout 이 timeout signal 을 버려 타임아웃 시 요청 미취소 leak → fix(204b9aed6, signal 병합 전달 + Google chat signal + 회귀 테스트). WARNING(behavior change 문서·tool-loop/timeoutMs=0 테스트) 조치. RESOLUTION 기록.
- [x] fix 커버 재리뷰(12_23_46): concurrency CRITICAL 해소 확인 + 신규 테스트 open-handle WARNING fix(03e02389e) + embed 동형 버그 후속 task `task_07c120ce` 위임.
- [x] `/consistency-check --impl-done`(12_22_49): BLOCK NO (5/5 CRITICAL 0). WARNING(§12.16 LLM_TIMEOUT 서술) 정정. error-handling.md drift INFO 는 planner task 이월.
- [x] PR #955 갱신 (A+B) → https://github.com/worker-ants/clemvion/pull/955

> **항목 A·B 완결** (PR #955). plan 은 아래 "후속 백로그" 미해소로 in-progress 유지 — provider dedup·parity 는 미착수, spec drift(task_3ac39ebd)·embed leak(task_07c120ce)은 별도 task 위임.
- [ ] (전체 완료 시) 후속 백로그 항목 처분 후 plan/complete 이동

## 실행 체크리스트 — 후속 PR #3 (W4 provider dedup + W2 parity, 별도 PR)

> 착수 2026-07-16, base=origin/main 693e52fe1(#955 머지 후). branch `claude/ai-agent-provider-schema-dedup`.
> W4·W2 는 ai-review(#955 항목 A 08_36_49) 파생 백로그. 두 건을 한 PR 로 처리해 본 plan 을 종결한다.

- [x] 3. `/consistency-check --impl-prep spec/4-nodes/3-ai/`(13_55_11) → BLOCK: YES 이나 Critical 2건 전부 **W4/W2 무관 pre-existing spec drift**(out 포트 모순·count_max vs 카탈로그 = `task_3ac39ebd`, item B 와 동일). FS-flaky 2 checker(rationale/plan) 직접 재실행 → 신규 Critical 0. 본 리팩터는 spec 무수정이라 착수 진행. ⚠ plan_coherence WARNING: complete 이동 시 위 2 Critical 의 durable 앵커 소실 우려 → plan-complete 단계에서 처리.
- [x] 5-7. TDD + 구현 (타깃 5 spec 181 tests 통과)
  - [x] **W4** 신규 shared `tool-providers/operation-tool-schema.ts`: `buildOperationJsonSchema(op)` + `makeEnabledToolsFilter(enabledTools)` (구조적 타입 `OperationSchemaSource`/`OperationFieldSpec` — cafe24/makeshop 동형). cafe24/makeshop metadata 무import(순수, 순환 없음).
  - [x] cafe24 provider: `buildCafe24JsonSchema`·`applyCafe24Allowlist` 제거→shared 위임. cafe24 spec 의 `buildCafe24JsonSchema` import 를 shared `buildOperationJsonSchema` 로 이행(구조적 대입 통합 확인 테스트로 유지).
  - [x] makeshop provider: `buildMakeshopJsonSchema`·`applyMakeshopAllowlist` 제거→shared 위임.
  - [x] `operation-tool-schema.spec.ts` — field type/enum/array/object/description/default(0·false)/required/oneOf→allOf·anyOf(multi)·non-oneOf kind + allowlist(빈/undefined/`*`/set) 전수. 기존 drift-0 회귀(build*ToolDefsForIntegration)는 무변경 통과.
  - [x] **W2** `workflows.service.spec.ts` budget describe 에 parity 회귀: unreadable(`{__unreadable:true}`) 통합 skip(=getForExecution 동일 `isUnreadableCredentials` 술어) + not-found 통합 best-effort skip(throw 아님, 의도된 divergence).
- [ ] 8. TEST WORKFLOW (lint·unit·build·e2e)
- [ ] 9. `/ai-review` + resolution + `/consistency-check --impl-done spec/4-nodes/3-ai/`
- [ ] PR + 본 plan 의 모든 체크박스 확인 후 plan/complete 이동 (backlog 잔여 task_3ac39ebd·task_07c120ce 는 별 task 라 이관 불필요)

> 파일명 결정: config-time 평가 모듈은 `tool-payload-save-warning.ts` (런타임 `tool-payload-budget.ts` 와 명확히 구분 — naming-collision checker INFO 반영).
> ⚠ **stale base 교정**: 착수 base 가 #951 이었으나 작업 중 origin/main 이 #952(e2e 인프라)로 전진 → rebase 로 교정(silent-revert 방지 + e2e 실 인프라 정합). rebase 의 deps 재설치가 jest 캐시를 무효화해 가려졌던 3건(import 경로·제거 메서드 테스트·count breach env)을 발견·수정.

> 항목 B (resume 턴 timeoutMs+signal) 는 후속 PR — 본 체크리스트 완료 후 착수.

# AI Agent 도구 payload 예산 가드레일 — 후속

> 작성일: 2026-07-14
> 선행: [`ai-agent-tool-payload-budget-guardrail.md`](ai-agent-tool-payload-budget-guardrail.md) (런타임 fail-fast 구현·머지)
> 선행 spec: `spec/4-nodes/3-ai/1-ai-agent.md` §4.2·§10·§12.15, `spec/5-system/11-mcp-client.md` §5.8, `spec/conventions/cross-node-warning-rules.md` §5·§8

## 배경

선행 PR 이 **런타임 fail-fast**(`buildTools` 직후 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`)로 도구 정의 payload 팽창의 실질 안전망을 구현했다. spec 이 함께 정의한 아래 두 surface 는 cross-module 배선·별도 설계가 필요해 본 후속으로 분리한다.

## 항목

### A. config-time 저장 경고 (backend-only graph warning)

spec: ai-agent §4.2 "저장 시점 경고" / §10 config 경고 계약 / cross-node-warning-rules §5(backend-only 예외)·§8(`ai_agent:tool-payload-budget`).

- `WorkflowsService` 에 Integration 접근(Repository 또는 IntegrationsService) 주입 — 현재 미주입(모듈 배선 필요).
- backend-only async 평가 `evaluateAiAgentToolPayloadWarnings(nodes, workspaceId): Promise<GraphWarningRuleResult[]>`:
  - 각 ai_agent 노드의 `mcpServers`(cafe24/makeshop 정적 카탈로그)·`presentationTools` 로부터 config-time 도구셋 재현 → 선행 PR 의 `estimateAgentToolPayload` 재사용. generic MCP(`service_type='mcp'`)는 live connect 필요라 best-effort skip.
  - Cafe24/Makeshop 정적 도구 재현: `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 의 operation→ToolDef 매핑을 pure 함수로 추출(세션 state 없이) 후 config-time·runtime 공유.
  - soft/hard 초과 시 `GraphWarningRuleResult`(rule id `ai_agent:tool-payload-budget`, severity `warning`). `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 면 hard 초과 severity `error`.
- **surface**: `getGraphWarnings`(서버 권위 조회 endpoint)가 결과 배열에 append. **block**: `saveCanvas` 가 severity error 시 기존 `GRAPH_VALIDATION_FAILED` 로 400 (guard ①).
- **i18n**: `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']` KO 매핑 + `backend-labels.test.ts` backend-only ruleId 명시 목록 등록(shared-package 밖이라 P3-C-1 자동 스캔 사각지대 — 수동 등록으로 빌드 시 KO 누락 방지).
- spec frontmatter: 구현 완료 시 cross-node-warning-rules `status: partial → implemented`, 본 plan 을 pending_plans 에서 제거.

### B. resume 턴 LLM 호출 timeoutMs + signal 배선

- `processMultiTurnMessage` chat 호출(`ai-turn-executor.ts:2624`/`:2765`)에 app-level `timeoutMs`(정상 장기 생성 regression 없는 신중한 default — env 노출) + abortSignal.
- resume 경로는 `ExecutionContext`(abortSignal 보유)를 안 받고 `state` 만 받으므로, orchestrator→state(또는 options)로 abortSignal plumbing 배선 필요.
- single-turn(`:1533`)도 현재 `timeoutMs` 부재 → 함께 대칭화.
- 근거: 런타임 payload 가드가 근본 원인을 막지만, 그 외 사유(네트워크·모델 지연)의 hang 에 대한 defense-in-depth.

## 후속 백로그 (본 plan 범위 밖 — ai-review 08_36_49 파생)

- **cafe24/makeshop provider JSON schema·allowlist 중복 추출** (ai-review W4): `build{Cafe24,Makeshop}JsonSchema`·`apply{Cafe24,Makeshop}Allowlist` 가 라인 단위 100% 동일. 항목 A 에서 module-level pure 함수로 승격만 했고(신규 중복 아님), 공유 `buildJsonSchemaFromFields`/`applyAllowlist` 추출은 별도 리팩터. cafe24/makeshop metadata field shape 이 동형이라 제네릭 1개로 통합 가능.
- **WorkflowsService↔IntegrationsService 통합 조회 parity 테스트** (ai-review W2): 모듈 순환 회피로 `loadIntegrationsForBudget` 가 `getForExecution` 판정(unreadable/not-found)을 복제 → 동작 동치성 회귀 테스트 또는 순환 없는 공용 유틸 추출.

## Rationale

선행 PR 을 런타임 가드에 집중시켜 리뷰 가능한 크기로 유지하고, config-time(cross-module) 과 timeout(signal plumbing) 은 각자 독립 설계·리뷰가 필요해 분리. 런타임 fail-fast 가 실제 안전망이므로 사용자 영향(6분 hang) 은 선행 PR 로 이미 해소된다.
