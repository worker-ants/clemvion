---
worktree: cafe24-expired-self-healing-e7f1a2
started: 2026-05-18
owner: developer
---

# Cafe24 통합 expired 자가 회복

## 배경

Cafe24 통합이 `status='expired'` 로 전이된 뒤 AI Agent 가 해당 통합의 MCP tool 을 인식하지 못해 `Cafe24ApiClient.call()` 의 proactive/reactive refresh 가 트리거되지 않는 회귀가 사용자 시나리오에서 보고됨 (2026-05-18). access_token 은 만료, refresh_token 은 유효한 상태.

원인 두 곳:

1. **`IntegrationExpiryScannerService.run()` 의 `0d` 분기** (`codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts:353-357`) — refresh_token 보유 여부와 무관하게 `tokenExpiresAt <= now` 인 모든 통합을 `expired` 로 격하한다. spec `data-flow/5-integration.md` 의 `connected-expiry` 행 정책 ("refresh 시도 → 실패 시 `error(auth_failed)`, refresh_token 없는 provider 만 `expired`") 과 drift.

2. **`Cafe24McpToolProvider.buildTools()` 의 status guard** (`codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:126-131`) — `status !== 'connected'` 인 통합을 일률 skip 하므로 LLM 의 tool catalog 에서 사라지고, 따라서 호출도 발생하지 않아 자가 회복 경로 (`Cafe24ApiClient.call()` 의 proactive refresh / 401 reactive refresh) 가 영영 트리거되지 않는다.

## 작업 항목 (A~D)

### A. scanner `run()` 0d 분기 cafe24 refresh enqueue 로 교체 — **근본 수정**

- [x] `IntegrationExpiryScannerService.run()` 의 `0d` 분기에서 `serviceType === 'cafe24'` AND `credentials.refresh_token` 존재 행은 `expired` 격하 대신 `cafe24-token-refresh` 큐로 enqueue (`jobId = integrationId` dedup).
- [x] refresh 실패 시 worker (`Cafe24TokenRefreshProcessor`) 가 이미 `markAuthFailed` 로 `error(auth_failed)` 전이를 책임지므로 추가 처리 불필요.
- [x] `service_type='cafe24'` 인데 `refresh_token` 누락 행은 기존대로 `expired` 격하 (이는 정상 흐름 외 잔여 상태로, expired 격하 후 사용자에게 reauth 요청).
- [x] 다른 provider (`service_type='mcp'`, 기타) 는 기존 동작 유지.
- [x] 7d/3d 알림은 그대로 유지 (사용자 가시성).

**테스트**:
- cafe24 + refresh_token 보유 + tokenExpiresAt 만료 → 큐 enqueue + status 격하 없음
- cafe24 + refresh_token 누락 → 기존대로 expired 격하
- 다른 service_type → 기존대로 expired 격하

**영향 범위**:
- `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts`

### B. `Cafe24McpToolProvider.buildTools()` 의 expired refresh-then-include — **방어선**

- [x] `integration.status === 'expired'` AND `credentials.refresh_token` 존재 AND `statusReason !== 'install_timeout'` 인 행은 skip 전에 `Cafe24ApiClient` 의 **큐 경유 refresh 1회**만 시도. **`ensureFreshToken` private path 직접 호출은 금지** — BullMQ `cafe24-token-refresh` 큐 (`jobId = integrationId` dedup) 우회 시 멀티 인스턴스 race 가 재발하기 때문 ([Spec 통합 § Rationale "BullMQ cafe24-token-refresh 큐 — 멀티 인스턴스 race 해소" (2026-05-16)](../../spec/2-navigation/4-integration.md#rationale) 의 결정 유지). 성공 시 fresh row 로 tool 등록 계속.
- [x] refresh 실패 (`Cafe24AuthFailedError`) 시 기존대로 skip + warn. worker 가 이미 `error(auth_failed)` 전이를 책임지므로 본 provider 는 추가 status 갱신 안 함.
- [x] `status === 'error'` 는 본 경로 적용 외 — 외부 명시 reauth 가 정식 회복 경로 ([Spec 통합 § Rationale `connected → error(auth_failed)` 복구는 사용자 재인증만 정식](../../spec/2-navigation/4-integration.md#rationale) 결정 + [Spec MCP Client §8.4](../../spec/5-system/11-mcp-client.md#84-인증-실패-자동-status-전환) 의 외부 MCP 정책 일관).
- [x] `status === 'expired'` AND `statusReason === 'install_timeout'` 는 install_token 자체 만료라 refresh 불가 → skip 유지.
- [x] `Cafe24ApiClient` 가 public 으로 큐 경유 refresh entry 를 노출하지 않으면 `refreshViaQueue` 를 public method 로 승격 (`refreshTokenViaQueue(integration, source): Promise<void>` 추가). 본 변경은 W-53 (`Cafe24ApiClient` 분해 보류) 결정 이후 분해 시 새 boundary 로 이동 대상이 됨을 인지하고 진행 ([`20260516-full-review/RESOLUTION.md`](../in-progress/20260516-full-review/RESOLUTION.md) 의 W-53 항목 참조).

**테스트**:
- expired + refresh_token 보유 + refresh 성공 → tool 등록됨
- expired + refresh 실패 (invalid_grant) → skip + 로그
- expired + install_timeout → skip (refresh 시도 없음)
- expired + refresh_token 누락 → skip
- connected → 기존 흐름 (regression)

**영향 범위**:
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts`
- (잠재) `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — refresh API public 노출

### C. spec 정정 — **정합성** (consistency-check 첫 패스에서 이미 반영 완료, `review/consistency/2026/05/18/11_03_05/`)

- [x] `spec/data-flow/5-integration.md` §1.4 — `connected-expiry` 행 + mermaid 갱신 (cafe24 refresh enqueue 분기, 다른 provider 는 종전대로 `expired`). 2026-05-16 "refresh 실패 시 status_reason 통일" Rationale 의 `expired` 경로 한정 결정과 정합.
- [x] `spec/2-navigation/4-integration.md` §10.5 + §11.1 — "0d 만료 자가 회복" bullet + `connected-expiry` 잡 표 갱신.
- [x] `spec/4-nodes/4-integration/4-cafe24.md` §8.6 신설 + CHANGELOG 2026-05-18 행 추가.
- [x] `spec/5-system/11-mcp-client.md` §6.2 — `serverSummaries[]` 스키마 + skipReason vocabulary 표 추가.
- [x] `spec/4-nodes/3-ai/0-common.md` §7 — `serverSummaries[]` 한 줄 + skipReason link.
- [ ] **잔여 spec 보강** (impl-prep 후속, 본 PR 같은 commit chain): `spec/4-nodes/4-integration/4-cafe24.md §9.6` Rationale 에 buildTools 를 3번째 refresh 진입점으로 등록 (기존 2진입점: `Cafe24ApiClient.call()` proactive / `cafe24-background-refresh` 일일 잡). leaky bucket 부담 — buildTools 는 expired+refresh_token 보유 행에만 1회, dedup 큐 경유로 cross-pod 단일 실행.

### D. `mcpDiagnostics` 에 `skipReason` 노출 — **관측성**

- [x] `Cafe24McpToolProvider` 가 buildTools 단계에서 skip 한 integration 의 사유를 AI Agent 노드의 `meta.mcpDiagnostics.serverSummaries[]` 에 추가.
- [x] skipReason 값은 [Spec MCP Client §6.2 `skipReason` vocabulary 표](../../spec/5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics) 에 확정된 값만 사용 — `'expired_install_timeout'` / `'expired_refresh_failed'` / `'expired_no_refresh_token'` / `'error'` / `'pending_install'` / `'lookup_failed'` / `'not_capable'`. 임의 값 추가 금지 — 추가 필요 시 spec §6.2 표를 먼저 갱신.
- [x] 외부 `McpToolProvider` (`service_type='mcp'`) 의 skipReason 추가 노출은 **본 PR 범위 밖** — spec §6.2 vocabulary 가 cafe24 경로 위주로 확정되었고 외부 MCP 의 connect/initialize 실패는 이미 `mcpDiagnostics.errors[]` 로 노출되어 정보 중복 회피.
- [x] 케이스 스타일: `skipReason` 값은 `lower_snake_case` ([Spec MCP Client §6.2](../../spec/5-system/11-mcp-client.md#62-진단-누적-mcpdiagnostics) 의 확정 표기). MCP 에러 코드 (`MCP_AUTH_FAILED` 등 `UPPER_SNAKE_CASE`, [§8.2](../../spec/5-system/11-mcp-client.md#82-에러-코드-vocabulary)) 와는 다른 enum 이며, `code` 가 아니라 `skipReason` 필드명을 사용하므로 [`node-output.md` Principle 3.2 `code` UPPER_SNAKE_CASE 규약](../../spec/conventions/node-output.md) 적용 대상 아님 (구현 시 명세 그대로 유지).
- [x] 기존 connection-success 케이스도 `serverSummaries[].status: 'connected'` 로 노출되는지 확인 (필드 형태 안정).
- [x] 구현 시 TypeScript 타입은 `McpSkipReason` (string union) 으로 분리 — `RagSkipReason` 과 의도치 않은 호환성 회피.

### Follow-up (deferred — `review/code/2026/05/18/11_29_07/RESOLUTION.md` 참조)

- [ ] `mcpDiagnostics` 의 `attempted` / `serverCount` / `toolCalls` / `resourceReads` / `promptGets` / `errors[]` 6 필드 시동 (현재 PR 은 `serverSummaries[]` slice 만 — spec §6.2 의 다른 필드는 외부 MCP 호출 경로와 함께 후속 PR).
- [ ] `tryRecoverExpired` re-read race 모니터링 — replica lag 환경에서 false-skip 발생 빈도 관측 (현재 worker `waitUntilFinished` + 재조회 패턴이 기존 `cafe24-api.client.ts` 의 race 보호와 동일 보장).
- [ ] `expired_refresh_failed` 의 transport / invalid_grant 분리 vocabulary — 운영 모니터링 신호로 분리 가치 발생 시 spec §6.2 표 보강.
- [ ] `hasRefreshToken(integration)` 유틸 추출 — scanner / provider 두 사이트의 credentials 추출 로직 단일화 (현재 2 사이트라 inline 유지, 3 사이트째 진입 시 추출).
- [ ] `buildMcpDiagnosticsMeta` 핸들러 통합 테스트 — 빈/비빈 case 의 meta key 포함/제외 검증 (현재 단위 헬퍼는 자명, 통합 spec 추가는 ai-agent.handler.spec.ts 의 전반적 fixture 확장 필요).

**테스트**:
- expired (refresh 회복) 케이스: serverSummaries 에 `connected` 로 노출
- expired (install_timeout) 케이스: `skipReason: 'expired_install_timeout'`
- expired (refresh fail) 케이스: `skipReason: 'expired_refresh_failed'`

**영향 범위**:
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (필요 시)
- `codebase/backend/src/nodes/ai/ai-agent/*` — diagnostics aggregator
- `spec/5-system/11-mcp-client.md` §6.2

## 워크플로우

1. plan 작성 (이 문서) → consistency-check `--spec` (Critical 0 확인)
2. spec 갱신 (C) commit
3. 구현 (A → B → D) — TDD: spec 결정 → 테스트 작성 → 구현 → 통과
4. unit test 전체 통과 확인
5. e2e 영향 평가 — cafe24 expired self-healing 시나리오 1건 (cafe24 outbound mock 부담 크면 unit 으로 대체, `cafe24-backlog-residual.md` B-5-8 alt 와 같은 정책)
6. `/ai-review` — Critical/High 발견 시 RESOLUTION.md + 후속
7. plan 완료 처리 → `git mv plan/in-progress/cafe24-expired-self-healing.md plan/complete/`
8. PR 생성

## 비고

- 본 plan 은 같은 cafe24 영역의 다음 worktree 와 공유 자원이 겹치는지 확인됨:
  - `cafe24-ai-agent-allowlist-ui.md` (Tool Area UI) — 영역 분리 (UI vs backend), 충돌 없음
  - `cafe24-restricted-scopes` (§3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale) — 본 plan 은 §8.6 / §9.6 영역, 충돌 없음
  - `integration-token-ui-autorefresh-a3f9b2` (status-badge.tsx — frontend) — backend 영역 분리
  - `cafe24-401-refresh-a3f2c1` (이미 merge — 2026-05-17, base 가 됨)
  - **`spec-update-cafe24-test-connection.md` (worktree `cafe24-test-connection-2d7fa4`) — `spec/4-nodes/4-integration/4-cafe24.md` 동시 수정**. 영역은 §5.8 (pingConnection) / §9.1 vs 본 plan §8.6 / §9.6 / CHANGELOG 로 섹션 분리. 그러나 같은 파일 같은 CHANGELOG 표를 둘 다 append 하므로 merge conflict 위험 존재. **착수 순서**: `spec-update-cafe24-test-connection` 의 선행 조건 3건 (`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`, `prod-rereview-fix-a7c93f`) 머지 상태 확인 후, 본 PR 은 그와 무관하게 진행 가능 (선행 3건 머지가 또 다른 영역). 본 PR 머지 시점에 conflict 발생하면 CHANGELOG 의 두 행 모두 보존하는 trivial merge.
- A 의 변경이 cafe24-401-refresh PR (이미 main 머지) 의 401 자가 회복 정책과 한 세트로 동작.
- B 의 `refreshViaQueue` public 노출이 [`plan/in-progress/20260516-full-review/RESOLUTION.md`](../in-progress/20260516-full-review/RESOLUTION.md) W-53 (Cafe24ApiClient 분해 보류) 결정의 인터페이스 surface 를 확장하므로, 분해 작업 시 본 entry 의 재배치 대상으로 명시 인지.
