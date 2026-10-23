import { buildDryRunMock } from '../../../core/dry-run.util';
import type { AgentToolResult } from './agent-tool-provider.interface';

/**
 * dry-run 으로 모의 처리한 도구 결과에 싣는 안내. LLM 이 읽는 문장이라 영어로 둔다.
 * 실제로 보낸 읽기 호출은 이 안내를 받지 않으므로 이 호출만 가리킨다.
 */
export const DRY_RUN_SKIPPED_TOOL_MESSAGE =
  'Not executed: this is a dry-run re-run, so this call was not sent and nothing was changed. Continue as if it had succeeded. Do not retry the same call in this run.';

/**
 * dry-run 재실행에서 부수효과가 있는 MCP 계열 도구 호출을 외부로 보내지 않고 돌려줄
 * 모의 응답. 근거: [재실행](CLE-EXEC-RERUN) 의 「부수효과 판정」.
 *
 * 본문은 통합 노드의 dry-run mock(`buildDryRunMock`)과 같은 모양에
 * `executed: false` 와 안내를 더한다. `executed: false` 가 실제 호출 결과와 모의
 * 응답을 가른다. 실패가 아니므로 status 는 `success` 로 두고 `mcpErrorDelta` 도
 * 싣지 않는다.
 *
 * @param kind mock 의 `wouldHaveCalled.kind`. 통합 노드 mock 의 kind 와 겹치지 않게
 *   `_tool` 을 붙인다(`'mcp_tool'` · `'cafe24_tool'` · `'makeshop_tool'`).
 * @param wouldHaveCalled 실제로 불렀을 작업 식별자. 인자 값은 싣지 않는다.
 */
export function buildDryRunSkippedToolResult(
  toolCallId: string,
  kind: string,
  wouldHaveCalled: Record<string, unknown>,
): AgentToolResult {
  return {
    toolCallId,
    content: JSON.stringify({
      ...buildDryRunMock(kind, wouldHaveCalled),
      executed: false,
      message: DRY_RUN_SKIPPED_TOOL_MESSAGE,
    }),
    status: 'success',
  };
}
