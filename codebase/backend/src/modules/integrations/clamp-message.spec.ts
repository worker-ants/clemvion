import { MCP_ERROR_MESSAGE_MAX_LEN } from '../mcp/mcp-error-codes';
import { clampMessage } from './clamp-message';

describe('clampMessage', () => {
  it.each([undefined, ''])('%p 이면 Unknown error', (raw) => {
    expect(clampMessage(raw)).toBe('Unknown error');
  });

  it('상한 이하는 그대로, 넘으면 상한에서 자른다', () => {
    const atLimit = 'x'.repeat(MCP_ERROR_MESSAGE_MAX_LEN);
    expect(clampMessage(atLimit)).toBe(atLimit);
    expect(clampMessage(`${atLimit}overflow`)).toBe(atLimit);
  });
});
