import {
  DRY_RUN_MOCKED_TOOL_MESSAGE,
  buildDryRunMockedToolResult,
} from './dry-run-tool-result';

/**
 * dry-run 재실행의 도구 모의 응답 모양을 고정한다. 근거: CLE-EXEC-RERUN-DRYRUN
 * 「부수효과 판정」. LLM 이 읽는 안내 문구와 `executed: false` 가 바뀌면 에이전트가 같은
 * 호출을 되풀이하거나 실패로 읽을 수 있어 문구 전체를 그대로 비교한다.
 */
describe('buildDryRunMockedToolResult', () => {
  it('안내 문구 전체를 고정한다', () => {
    expect(DRY_RUN_MOCKED_TOOL_MESSAGE).toBe(
      'Not executed: this is a dry-run re-run, so this call was not sent and nothing was changed. Continue as if it had succeeded. Do not retry the same call in this run.',
    );
  });

  it('통합 노드 mock 모양에 executed: false 와 안내를 더해 success 로 돌려준다', () => {
    const result = buildDryRunMockedToolResult('call-1', 'cafe24_tool', {
      operation: 'product_create',
      method: 'POST',
      resource: 'product',
    });

    expect(result).toEqual({
      toolCallId: 'call-1',
      content: expect.any(String),
      status: 'success',
    });
    expect(result).not.toHaveProperty('mcpErrorDelta');
    expect(result).not.toHaveProperty('error');
    expect(JSON.parse(result.content)).toEqual({
      _dryRun: true,
      skippedReason: 'dry-run mode',
      wouldHaveCalled: {
        kind: 'cafe24_tool',
        operation: 'product_create',
        method: 'POST',
        resource: 'product',
      },
      executed: false,
      message: DRY_RUN_MOCKED_TOOL_MESSAGE,
    });
  });
});
