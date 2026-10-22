import type { ExecutionContext } from '@nestjs/common';
import { isHttpContext } from './http-context';

describe('isHttpContext', () => {
  const contextOf = (type: string) =>
    ({ getType: () => type }) as unknown as ExecutionContext;

  it('http 컨텍스트면 true', () => {
    expect(isHttpContext(contextOf('http'))).toBe(true);
  });

  it.each(['ws', 'rpc'])('%s 컨텍스트면 false', (type) => {
    expect(isHttpContext(contextOf(type))).toBe(false);
  });
});
