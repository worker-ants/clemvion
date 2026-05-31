import type { ExecutionContext } from './node-handler.interface';

/**
 * Re-run dry-run (spec/5-system/13-replay-rerun.md §7) 공통 헬퍼.
 *
 * 외부 부수효과 노드(HTTP Request / Send Email / Database write / cafe24 write)는
 * `context.variables.__dryRun === true` 일 때 실제 외부 호출을 수행하지 않고
 * {@link buildDryRunMock} 출력을 반환한다. mock 의 NodeExecution status 는
 * `completed` 로 흐름은 정상 진행하며(§7.2), Run Results UI 는 `_dryRun: true` 로
 * dry-run 노드를 시각 구분한다(§7.4).
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
