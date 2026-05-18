/**
 * MCP build-time diagnostics — spec/5-system/11-mcp-client.md §6.2
 * `mcpDiagnostics.serverSummaries[]` 의 backend 타입.
 *
 * AI Agent 노드 실행의 buildTools 단계에서 각 `mcpServers[]` 항목의 결과를
 * 사용자에게 노출하기 위한 정적 스냅샷. provider 가 한 entry 씩 push 하고
 * 핸들러가 `meta.mcpDiagnostics.serverSummaries` 로 emit 한다.
 *
 * 의미: 사용자가 "왜 내가 등록한 통합이 AI Agent 에 안 보이지?" 의문을
 * 즉시 식별할 수 있도록 한다. (예: cafe24 가 expired(install_timeout)
 * 이면 catalog 가 비어있고, skipReason 으로 사유가 표면화됨.)
 *
 * 본 PR (cafe24-expired-self-healing) 은 `mcpDiagnostics` 의 전체 surface
 * 중 `serverSummaries[]` slice 만 시동 — 나머지 필드 (attempted /
 * serverCount / toolCalls / resourceReads / promptGets / errors) 는 spec
 * 에 정의되어 있으나 외부 MCP 호출 경로와 함께 follow-up 으로 확장.
 */

/**
 * `skipReason` vocabulary — spec/5-system/11-mcp-client.md §6.2 와 일치.
 *
 * 명명 규칙: 모두 `lower_snake_case`. `Integration.status_reason` (예:
 * `auth_failed`, `install_timeout`) 와 의도적으로 표기 일치 — 일부 값
 * (`expired_install_timeout`, `expired_refresh_failed`) 이 status_reason
 * 의 의미를 그대로 캐리하기 때문. MCP 에러 코드 vocabulary (`MCP_AUTH_FAILED`
 * 등 UPPER_SNAKE_CASE) 와는 다른 enum.
 */
export type McpSkipReason =
  | 'expired_install_timeout'
  | 'expired_refresh_failed'
  | 'expired_no_refresh_token'
  | 'error'
  | 'pending_install'
  | 'lookup_failed'
  | 'not_capable';

export interface McpServerSummary {
  integrationId: string;
  serviceType: string;
  status: 'connected' | 'skipped';
  /** `status === 'skipped'` 일 때만 채워짐. */
  skipReason?: McpSkipReason;
  /** catalog 에 등록된 도구 수. skipped 행은 항상 0. */
  toolCount: number;
}

/**
 * Provider 가 buildTools 단계에서 entry 1건을 push 할 때 사용. 핸들러가
 * 생성·소유하는 배열을 ProviderBuildCtx 에 전달하면 provider 는 본 helper 로
 * 안전하게 entry 를 추가한다 (직접 push 도 무방).
 */
export function pushMcpServerSummary(
  acc: McpServerSummary[] | undefined,
  entry: McpServerSummary,
): void {
  if (!acc) return;
  acc.push(entry);
}
