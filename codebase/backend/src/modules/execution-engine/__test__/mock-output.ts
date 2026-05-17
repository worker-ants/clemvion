import { NodeHandlerOutput } from '../../../nodes/core/node-handler.interface';

type MockOutputOpts = Omit<NodeHandlerOutput, 'config' | 'output'>;

export function mockOutput(
  output: unknown,
  opts: MockOutputOpts = {},
): NodeHandlerOutput {
  return { config: {}, output, ...opts };
}
