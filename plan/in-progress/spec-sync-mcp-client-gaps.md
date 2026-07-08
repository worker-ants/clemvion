---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# mcp-client — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec(`spec/5-system/11-mcp-client.md`)을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/11-mcp-client.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-mcp-client-gaps PR)**: §6.2 외부 MCP serverSummaries push(항목 2) 구현.
> 나머지(`errors[]`/`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets` 필드 + MCP_TIMEOUT/
> CONNECT_FAILED/LIST_FAILED 코드 granularity)는 **McpDiagnostics 타입 확장(serverSummaries[] → 구조화 객체)
> cluster** 로 묶여 별도 PR 권장 — ProviderBuildCtx.mcpDiagnostics 인터페이스 + buildMcpDiagnosticsMeta +
> 전 push 사이트 동시 변경. §3.3 capability 캐시는 Integration 엔티티 credentials 구조 변경(infra)으로 별도.

- [x] §6.2 `mcpDiagnostics` 의 `attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]` 필드 emit — **완료 (2026-07-06 타입확장 cluster PR)**: `McpDiagnosticsAccumulator` 구조화 승격 + `buildMcpDiagnosticsMeta` 파생. 코드/테스트/spec-sync 전량 반영 확인(아래 §완료 요약).
- [x] §6.2 외부 `service_type='mcp'` 통합의 진단 표면 노출 — **완료**: `McpToolProvider.materializeServer` 가 connect+list 성공 시 connected serverSummary(toolCount) push, `openServer` 가 serviceType=mcp 확정 이후 status/connect/list 실패 시 skipped(skipReason=error) push(Cafe24 Internal Bridge 와 대칭). serviceType 판정 전 lookup 실패는 미push(double-push 회피). 테스트 2건.
- [x] §8.2 `MCP_TIMEOUT` 코드 emit — **완료 (2026-07-06 타입확장 cluster PR)**: `with-timeout.ts` `TimeoutError` 기반 build-phase 분류로 `mcp-tool-provider.ts` `errors[]` push. 확인.
- [x] §8.2 `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` buildTools surface — **완료 (2026-07-06 타입확장 cluster PR)**: connect/status precheck→`MCP_CONNECT_FAILED`, tools/list→`MCP_LIST_FAILED` phase 분류 emit. 확인.
- [ ] §3.3 `credentials.cached_capabilities` capability 캐시 — **보류 (infra)**: Integration 엔티티 credentials JSONB 구조 변경 + preview test 저장 경로. spec L142-148 Planned(캐시는 hint, 실행 시 재조회).

## 타입 확장 cluster — 착수 설계 (2026-07-06)

> 착수: developer 워크플로. B그룹 2순위 (알림 파이프라인 PR1~3 완료 후). worktree `priceless-yonath-791675`.

**목표**: `mcpDiagnostics` 를 `McpServerSummary[]` 단일 배열 → 구조화 객체로 승격.

### 데이터 타입 (`mcp-diagnostics.ts`)
- `McpDiagnosticError { integrationId, phase, code, message }` 신규.
  - `phase`: `'connect' | 'initialize' | 'tools/list' | 'tools/call' | 'resources/read' | 'prompts/get'` (§8.1 단계 vocabulary).
  - `code`: `string` — MCP_* (외부) 와 CAFE24_*/MAKESHOP_* (Internal Bridge) 두 vocabulary 를 모두 담으므로 union 이 아닌 string (spec §2.3).
- `McpDiagnosticsAccumulator { serverSummaries: McpServerSummary[]; errors: McpDiagnosticError[]; toolCalls; resourceReads; promptGets }` — 핸들러가 소유, provider/executor 가 push/increment.
- `pushMcpServerSummary(acc, entry)` 시그니처를 accumulator 대상으로 변경 (내부에서 `acc.serverSummaries.push`) → **기존 5개 provider 호출부 무변경**.
- `pushMcpDiagnosticError(acc, entry)` 신규.
- `createMcpDiagnosticsAccumulator()` 팩토리.

### 생산 사이트
- `McpToolProvider.openServer` (build): connect/list 실패를 phase 분류해 `errors[]` push — `MCP_TIMEOUT` (withTimeout `TimeoutError`), `MCP_CONNECT_FAILED` (connect·status precheck), `MCP_LIST_FAILED` (tools/list). 기존 skipped serverSummary push 는 유지 (병존).
  - `with-timeout.ts` 에 `TimeoutError` class 도입 → 타임아웃 robust 판정 (message regex 회피). `with-timeout` 은 McpClientService 도 쓰는 공용 유틸이나 granular 분류 **소비는 현재 McpToolProvider 만** (McpClientService 소비는 follow-up). 하위호환 유지 (여전히 Error, message 포맷 불변).
- executor `executeProviderToolBatch` (choke point): `mcp_`-prefixed 호출을 name 으로 분류해 counter 증가 — `read_resource`→resourceReads, `get_prompt`→promptGets, `list_*`→미집계(discovery), 그 외→toolCalls. `classifyMcpCall(name)` helper.

### 소비 사이트 (executor `ai-turn-executor.ts`)
- `mcpDiagnosticsAcc: McpServerSummary[]` → `McpDiagnosticsAccumulator` (single-turn·multi-turn 2곳 생성).
- `TurnOutputAccumulators.mcpDiagnosticsAcc` 타입 변경.
- 3개 output builder metadata (`mcpServerSummaries?`) → accumulator 전달.
- `buildMcpDiagnosticsMeta(acc)`: `attempted`(summaries|errors|counters 중 하나라도>0), `serverCount`(status='connected' 행 수) 파생 + 전체 구조 emit. attempted 아니면 omit (기존 lean 정책 보존).

### 범위 경계 (deferred, follow-up)
- **call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패의 errors[] 누적은 본 PR 범위 밖**. 근거: 트래커 gap 3종(TIMEOUT/CONNECT_FAILED/LIST_FAILED)은 전부 build-phase 이며 spec §6.2 errors[] 예시(`phase:"tools/list"`)도 build-phase. call 실패는 이미 `tool_result` + `IntegrationUsageLog`(§8.3)로 완전 표면화됨. §8.1 표의 "errors 에도 누적" 은 별도 follow-up (외부/cafe24/makeshop execute 4경로 + code 추출/vocab 얽힘). 본 PR 종료 시 잔여 항목으로 이관.
- §3.3 credentials.cached_capabilities 캐시 — 기존대로 infra 별도.

### spec 동기화 (본 작업의 정식 phase)
- §6.2 "구현 현황" 노트: `serverSummaries[] 단일 배열` / 나머지 필드 `미구현(Planned)` → 구현됨으로 갱신. call-phase errors[] deferred 경계 명시.
- §8.2: `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 의 "미구현/§9 연결 테스트 한정" 문구를 buildTools 경로 emit 반영으로 갱신.
- **`spec/4-nodes/3-ai/1-ai-agent.md` §7.1** (라인 485-491) `mcpDiagnostics` 예시 — impl-prep consistency-check WARNING#1: 이미 full shape 를 미구현 표기 없이 제시. 구현 후 정합해지나, 실제 emit shape 와 정렬(`serverSummaries` 추가/`errors:[]` 유지) 확인. 스코프에 포함.
- spec 본문 write 는 project-planner 위임 (developer spec read-only) — draft `spec-update` → `/consistency-check --spec` → 반영.

> impl-prep consistency-check: `review/consistency/2026/07/06/20_59_31/SUMMARY.md` — **BLOCK: NO**, Critical 0. WARNING#1(위 §7.1) spec-sync 스코프에 반영. rationale_continuity·naming_collision 2개 checker output 파일 write 차단(harness bgIsolation)으로 미기록 — 신규 식별자(McpDiagnostics/McpDiagnosticError/classifyMcpCall 등)는 내부 신규 타입이라 충돌 위험 없음, block=NO 로 진행.

### 착수 체크리스트
- [x] /consistency-check --impl-prep (BLOCK: NO 확인 — 2026-07-06 20_59_31)
- [x] 테스트 선작성 (mcp-diagnostics·mcp-tool-provider·executor)
- [x] 구현 (types → providers → executor)
- [x] TEST WORKFLOW lint·unit·build·e2e 통과 (2026-07-06, e2e 236 tests)
- [x] spec 동기화 (§6.2/§8.2/§8.1/1-ai-agent §7.1) 적용
- [x] /ai-review (21_30_25, 위험도 LOW·Critical 0) + fix (SPEC-DRIFT spec-sync·scope cast 복원·plan 문구) + RESOLUTION.md
- [x] /consistency-check --impl-done (21_50_54, BLOCK: NO·Critical 0). WARNING/INFO 2건은 기존 컨벤션 부채(Rationale 섹션 부재·INVALID_TOOL_ARGUMENTS prefix)→ follow-up task_947e443e 이관.

### 완료 요약 (2026-07-06)
- 코드: mcpDiagnostics 구조화 승격 + build-phase granular errors + 카운터. 8 backend 파일.
- 테스트: mcp-diagnostics/mcp-tool-provider/executor spec 신규·보강. lint·unit·build·e2e(236) 통과.
- spec-sync: 11-mcp-client §6.2/§8.1/§8.2 + 1-ai-agent §7.1 적용.
- 리뷰: /ai-review 21_30_25(LOW)→22_04_32(LOW, testing 2 WARNING fix)→**22_25_11(NONE, clean)**. impl-prep 20_59_31 · impl-done 21_50_54/22_05_27/**22_25_11 BLOCK:NO**. (커밋 후 re-review 는 author-date 가드가 review-postdates-code 를 요구하기 때문 — review_gate_loop_avoidance 교훈: 코드는 리뷰 전에 커밋했어야 함.)
- 22_25_11 impl-done WARNING(§2.3 Cafe24 errors[] 서술이 §6.2 Planned 와 모순) → spec-only 정정으로 해소(§2.3 line 81 + §6.2 "대칭" 괄호).
- **잔여(별건 follow-up, plan in-progress 유지)**: call-phase errors[] 누적 / §3.3 capability 캐시 / task_fa96e218(에러 message redaction) / task_947e443e(Rationale 섹션·코드 prefix) / McpClientService TimeoutError 소비.

## 비고
- 각 항목의 근거(claim→코드부재/불일치)는 audit findings/5-system/5-system__11-mcp-client.md 참조.
- spec 본문은 위 항목을 "미구현 (Planned)" 으로 명시 표기 완료 (§3.3 / §6.2 / §8.2).
- 반대로 audit 가 지적한 §8.2 신규 코드(`MCP_TOOL_ERROR`·`MCP_UNKNOWN_TOOL`)와 §9 응답 형식(200 OK body, rotate 경로 400)·`MCP_HTTPS_REQUIRED` 정정은 spec 본문 패치로 완료(구현 일치).
