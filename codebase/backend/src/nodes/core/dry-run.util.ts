import type { ExecutionContext } from './node-handler.interface';

/**
 * Re-run dry-run 공통 헬퍼. 근거: [재실행](CLE-EXEC-RERUN) 의 dry-run 절.
 *
 * 외부 부수효과 노드(HTTP Request / Send Email / Database write / Cafe24 · MakeShop
 * write)는 `context.variables.__dryRun === true` 일 때 실제 외부 호출을 수행하지 않고
 * {@link buildDryRunMock} 출력을 반환한다. mock 의 NodeExecution status 는
 * `completed` 로 흐름은 정상 진행하며, Run Results UI 는 `_dryRun: true` 로
 * dry-run 노드를 시각 구분한다.
 */

/** dry-run mock 출력 객체 (§7.2). */
export interface DryRunMock {
  _dryRun: true;
  skippedReason: string;
  /** 실제로 호출됐을 외부 작업 미리보기. `kind` 는 노드 종류 식별자. */
  wouldHaveCalled: { kind: string } & Record<string, unknown>;
}

/** 현재 실행이 dry-run 모드인지 판별. 핸들러의 mock 분기 진입 조건. */
export function isDryRun(context: ExecutionContext): boolean {
  return context.variables?.['__dryRun'] === true;
}

/**
 * dry-run mock 출력을 만든다.
 *
 * @param kind 노드 종류 식별자 (예: `'http_request'`, `'send_email'`,
 *   `'database_query'`, `'cafe24'`).
 * @param wouldHaveCalled 실제 호출됐을 작업의 미리보기 필드 (method/url/to/sql 등).
 *   민감정보·대용량은 caller 가 미리 절단/마스킹한다.
 */
export function buildDryRunMock(
  kind: string,
  wouldHaveCalled: Record<string, unknown> = {},
): DryRunMock {
  return {
    _dryRun: true,
    skippedReason: 'dry-run mode',
    wouldHaveCalled: { kind, ...wouldHaveCalled },
  };
}

const NO_STATE_CHANGING_GETS: ReadonlySet<string> = new Set();

/**
 * dry-run 에서 이 Cafe24 · MakeShop operation 을 모의 응답으로 대신할지 판정한다.
 * 근거: CLE-EXEC-RERUN 「부수효과 판정」.
 *
 * GET 이 아니면 부수효과로 보고 모의 처리한다. GET 은 실제로 호출하되, 메서드는
 * GET 인데 상점 상태를 바꾸는 operation(`stateChangingGetIds`)은 모의 처리한다.
 * 메서드 철자가 `'GET'` 과 다르면 부수효과로 본다. `scopeType` 은 OAuth scope
 * 분류라 쓰지 않는다(예: Cafe24 `carts_setting_update` 는 scope 가 read 인 PUT).
 *
 * 통합 노드 핸들러와 AI 에이전트의 내부 MCP 브리지가 같은 판정을 쓴다.
 *
 * @param stateChangingGetIds 상태를 바꾸는 GET 의 operation id. 기본은 빈 집합.
 */
export function isDryRunMockedOperation(
  operation: { id: string; method: string },
  stateChangingGetIds: ReadonlySet<string> = NO_STATE_CHANGING_GETS,
): boolean {
  return operation.method !== 'GET' || stateChangingGetIds.has(operation.id);
}
