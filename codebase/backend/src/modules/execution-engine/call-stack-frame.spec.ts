import { findBrokenCallStackFrame } from './call-stack-frame';

describe('findBrokenCallStackFrame', () => {
  const ok = { workflowId: 'wf-1', invokerNodeId: 'node-1', recursionDepth: 1 };

  it('모든 frame 이 온전하면 null', () => {
    expect(
      findBrokenCallStackFrame([ok, { ...ok, workflowId: 'wf-2' }]),
    ).toBeNull();
  });

  it.each([
    ['frame 이 null', [null], 0, ['workflowId', 'invokerNodeId']],
    ['frame 이 객체가 아님', ['frame'], 0, ['workflowId', 'invokerNodeId']],
    [
      'workflowId 없음',
      [{ invokerNodeId: 'n', recursionDepth: 1 }],
      0,
      ['workflowId'],
    ],
    ['workflowId 빈 문자열', [{ ...ok, workflowId: '' }], 0, ['workflowId']],
    [
      'invokerNodeId 가 문자열 아님(숫자)',
      [{ ...ok, invokerNodeId: 123 }],
      0,
      ['invokerNodeId'],
    ],
    [
      'invokerNodeId 가 객체',
      [{ ...ok, invokerNodeId: {} }],
      0,
      ['invokerNodeId'],
    ],
    ['둘 다 없음', [{ recursionDepth: 1 }], 0, ['workflowId', 'invokerNodeId']],
    ['두 번째 frame', [ok, { ...ok, invokerNodeId: '' }], 1, ['invokerNodeId']],
  ])('%s → index · 빈 필드를 돌려준다', (_label, frames, index, missing) => {
    expect(findBrokenCallStackFrame(frames as unknown[])).toEqual({
      index,
      missing,
    });
  });

  it('첫 번째로 깨진 frame 을 돌려준다', () => {
    expect(
      findBrokenCallStackFrame([ok, { workflowId: '' }, { invokerNodeId: '' }]),
    ).toEqual({ index: 1, missing: ['workflowId', 'invokerNodeId'] });
  });
});
