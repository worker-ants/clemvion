import { buildDryRunMock } from '../../../core/dry-run.util';
import type { AgentToolResult } from './agent-tool-provider.interface';

/** dry-run 으로 건너뛴 도구 결과에 싣는 안내. LLM 이 읽는 문장이라 영어로 둔다. */
export const DRY_RUN_SKIPPED_TOOL_MESSAGE =
  'Not executed: this is a dry-run re-run, so the tool was not called and no external system was read or changed. Do not call it again in this run.';

/**
 * dry-run 재실행에서 MCP 계열 도구 호출을 외부로 보내지 않고 돌려줄 결과.
 * 근거: [재실행](CLE-EXEC-RERUN) 의 dry-run 절.
 *
 * 임시 가드(CLE-T-8BX1HK)다. 부수효과 분류와 모의 응답은 후속 CLE-T-G62XJS 가
 * 맡는다. 그때까지는 읽기 · 쓰기를 가리지 않고 막는다. 본문은 통합 노드의 dry-run
 * mock(`buildDryRunMock`)과 같은 모양에 `executed: false` 와 안내를 더한다.
 * 실패가 아니므로 status 는 `success` 로 두고 `mcpErrorDelta` 도 싣지 않는다.
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
