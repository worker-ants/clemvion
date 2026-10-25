import { markMcpServerRefOrigins, mcpServerRefUse } from './mcp-server-ref-use';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('markMcpServerRefOrigins — 첫 턴 표현식 여부', () => {
  it('같은 순서의 항목끼리 원본과 평가값을 비교한다', () => {
    const out = markMcpServerRefOrigins(
      [{ integrationId: A }, { integrationId: '{{ $vars.b }}' }],
      [{ integrationId: A }, { integrationId: B }],
    );
    expect(out).toEqual([
      { integrationId: A, fromExpression: false },
      { integrationId: B, fromExpression: true },
    ]);
  });

  it.each<[string, unknown]>([
    ['원본 목록이 표현식(문자열)', '{{ $vars.servers }}'],
    ['원본 없음', undefined],
    ['원본과 길이가 다름', [{ integrationId: A }]],
  ])('%s → 모든 항목이 표현식', (_label, raw) => {
    const out = markMcpServerRefOrigins(raw, [
      { integrationId: A },
      { integrationId: B },
    ]);
    expect(out).toEqual([
      { integrationId: A, fromExpression: true },
      { integrationId: B, fromExpression: true },
    ]);
  });

  it('원본 항목이 객체가 아니면 그 항목만 표현식', () => {
    const out = markMcpServerRefOrigins(
      ['{{ $vars.server }}', { integrationId: B }],
      [{ integrationId: A }, { integrationId: B }],
    );
    expect(out).toEqual([
      { integrationId: A, fromExpression: true },
      { integrationId: B, fromExpression: false },
    ]);
  });

  it('이스케이프한 \\{\\{ 가 든 원본은 표현식', () => {
    const out = markMcpServerRefOrigins(
      [{ integrationId: '\\{\\{x}}' }],
      [{ integrationId: '{{x}}' }],
    );
    expect(out).toEqual([{ integrationId: '{{x}}', fromExpression: true }]);
  });

  it('사용자 설정의 fromExpression 은 늘 덮어쓴다', () => {
    const out = markMcpServerRefOrigins(
      [{ integrationId: '{{ $vars.a }}', fromExpression: false }],
      [{ integrationId: A, fromExpression: false }],
    );
    expect(out).toEqual([{ integrationId: A, fromExpression: true }]);
  });

  it('평가값 항목이 객체가 아니면 그대로 둔다', () => {
    expect(markMcpServerRefOrigins([null], [null])).toEqual([null]);
  });

  it('입력 항목을 바꾸지 않는다', () => {
    const evaluated = [{ integrationId: A }];
    markMcpServerRefOrigins([{ integrationId: A }], evaluated);
    expect(evaluated).toEqual([{ integrationId: A }]);
  });
});

describe('mcpServerRefUse — false 일 때만 리터럴', () => {
  it.each<[string, unknown, boolean]>([
    ['false', { integrationId: A, fromExpression: false }, false],
    ['true', { integrationId: A, fromExpression: true }, true],
    ['값 없음(옛 항목)', { integrationId: A }, true],
    ['null', { integrationId: A, fromExpression: null }, true],
    ["문자열 'false'", { integrationId: A, fromExpression: 'false' }, true],
    ['0', { integrationId: A, fromExpression: 0 }, true],
    ['항목이 객체가 아님', 'x', true],
  ])('%s → fromExpression=%s', (_label, ref, fromExpression) => {
    expect(mcpServerRefUse('node-1', ref)).toEqual({
      nodeId: 'node-1',
      fromExpression,
    });
  });

  it('nodeId 가 없으면 null', () => {
    expect(mcpServerRefUse(undefined, { fromExpression: false })).toEqual({
      nodeId: null,
      fromExpression: false,
    });
  });
});
