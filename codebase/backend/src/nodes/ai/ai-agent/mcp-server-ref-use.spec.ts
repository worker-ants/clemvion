import {
  liftLegacyMcpServerFromExpression,
  markMcpServerRefOrigins,
  mcpServerRefUse,
  mcpServerUseAt,
  restoreMcpServerOrigins,
} from './mcp-server-ref-use';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('markMcpServerRefOrigins — 첫 턴 표현식 여부', () => {
  it('같은 순서의 항목끼리 원본과 평가값을 비교해 평행 배열에 담는다', () => {
    const out = markMcpServerRefOrigins(
      [{ integrationId: A }, { integrationId: '{{ $vars.b }}' }],
      [{ integrationId: A }, { integrationId: B }],
    );
    expect(out).toEqual({
      mcpServers: [{ integrationId: A }, { integrationId: B }],
      mcpServerFromExpression: [false, true],
    });
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
    expect(out.mcpServerFromExpression).toEqual([true, true]);
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['표현식 문자열', '{{ $vars.servers }}'],
    ['숫자', 3],
    ['객체', { integrationId: A }],
  ])(
    '평가한 목록이 배열이 아니면(%s) 원본과 관계없이 빈 목록이다',
    (_label, evaluated) => {
      const empty = { mcpServers: [], mcpServerFromExpression: [] };
      expect(
        markMcpServerRefOrigins([{ integrationId: A }], evaluated),
      ).toEqual(empty);
      expect(markMcpServerRefOrigins(undefined, evaluated)).toEqual(empty);
    },
  );

  it('원본 항목이 객체가 아니면 그 항목만 표현식', () => {
    const out = markMcpServerRefOrigins(
      ['{{ $vars.server }}', { integrationId: B }],
      [{ integrationId: A }, { integrationId: B }],
    );
    expect(out.mcpServerFromExpression).toEqual([true, false]);
  });

  it('이스케이프한 \\{\\{ 가 든 원본은 표현식', () => {
    const out = markMcpServerRefOrigins(
      [{ integrationId: '\\{\\{x}}' }],
      [{ integrationId: '{{x}}' }],
    );
    expect(out.mcpServerFromExpression).toEqual([true]);
  });

  it('사용자 설정의 fromExpression 은 판정에 쓰지 않고 서버 항목에서 지운다', () => {
    const out = markMcpServerRefOrigins(
      [{ integrationId: '{{ $vars.a }}', fromExpression: false }],
      [{ integrationId: A, fromExpression: false, enabledTools: ['t'] }],
    );
    expect(out).toEqual({
      mcpServers: [{ integrationId: A, enabledTools: ['t'] }],
      mcpServerFromExpression: [true],
    });
    expect(out.mcpServers[0]).not.toHaveProperty('fromExpression');
  });

  it('평가값 항목이 객체가 아니면 그대로 두고 표현식으로 본다', () => {
    expect(markMcpServerRefOrigins([null], [null])).toEqual({
      mcpServers: [null],
      mcpServerFromExpression: [true],
    });
  });

  it('입력 항목을 바꾸지 않는다', () => {
    const evaluated = [{ integrationId: A, fromExpression: true }];
    markMcpServerRefOrigins([{ integrationId: A }], evaluated);
    expect(evaluated).toEqual([{ integrationId: A, fromExpression: true }]);
  });
});

describe('liftLegacyMcpServerFromExpression — 옛 체크포인트의 항목 값 옮기기', () => {
  it('항목 값이 false 인 위치만 false 이고 키를 지운다', () => {
    const out = liftLegacyMcpServerFromExpression([
      { integrationId: A, fromExpression: false },
      { integrationId: B, fromExpression: true },
    ]);
    expect(out).toEqual({
      mcpServers: [{ integrationId: A }, { integrationId: B }],
      mcpServerFromExpression: [false, true],
    });
  });

  it.each<[string, unknown]>([
    ['값 없음(표현식 판정 도입 전 항목)', { integrationId: A }],
    ['null', { integrationId: A, fromExpression: null }],
    ["문자열 'false'", { integrationId: A, fromExpression: 'false' }],
    ['0', { integrationId: A, fromExpression: 0 }],
    ['항목이 객체가 아님', 'x'],
  ])('%s → 표현식', (_label, item) => {
    expect(
      liftLegacyMcpServerFromExpression([item]).mcpServerFromExpression,
    ).toEqual([true]);
  });

  it('입력 항목을 바꾸지 않는다', () => {
    const servers = [{ integrationId: A, fromExpression: false }];
    liftLegacyMcpServerFromExpression(servers);
    expect(servers).toEqual([{ integrationId: A, fromExpression: false }]);
  });
});

describe('restoreMcpServerOrigins — 체크포인트 · _retryState 복원', () => {
  const raw = [{ integrationId: A }, { integrationId: '{{ $vars.b }}' }];
  const evaluated = [{ integrationId: A }, { integrationId: B }];

  it('목록과 배열이 모두 있으면 그대로 쓴다(원본 설정과 다시 맞추지 않는다)', () => {
    const out = restoreMcpServerOrigins(
      [{ integrationId: B }],
      [false],
      raw,
      evaluated,
    );
    expect(out).toEqual({
      mcpServers: [{ integrationId: B }],
      mcpServerFromExpression: [false],
    });
  });

  it('배열 값이 false 가 아니면 표현식으로 고쳐 싣는다', () => {
    expect(
      restoreMcpServerOrigins(
        [{ integrationId: A }, { integrationId: B }],
        [false, 'false'],
        raw,
        evaluated,
      ).mcpServerFromExpression,
    ).toEqual([false, true]);
  });

  it('배열 길이가 목록과 다르면 길이를 그대로 둬 모든 서버가 표현식으로 판정된다', () => {
    const out = restoreMcpServerOrigins(
      [{ integrationId: A }, { integrationId: B }],
      [false],
      raw,
      evaluated,
    );
    expect(out.mcpServerFromExpression).toEqual([false]);
    expect(
      mcpServerRefUse('n', out.mcpServerFromExpression, 0, 2).fromExpression,
    ).toBe(true);
  });

  it('배열이 배열이 아닌 값이면 모든 서버가 표현식이다', () => {
    expect(
      restoreMcpServerOrigins(
        [{ integrationId: A }],
        { 0: false },
        raw,
        evaluated,
      ).mcpServerFromExpression,
    ).toEqual([true]);
  });

  it.each<[string, unknown]>([
    ['배열 키 없음', undefined],
    ['null', null],
  ])('목록이 있고 %s → 옛 항목 값을 옮기고 키를 지운다', (_label, flags) => {
    const out = restoreMcpServerOrigins(
      [{ integrationId: A, fromExpression: false }, { integrationId: B }],
      flags,
      raw,
      evaluated,
    );
    expect(out).toEqual({
      mcpServers: [{ integrationId: A }, { integrationId: B }],
      mcpServerFromExpression: [false, true],
    });
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
  ])(
    '목록이 %s 면 저장된 배열을 버리고 노드 설정에서 첫 턴처럼 다시 정한다',
    (_label, servers) => {
      const out = restoreMcpServerOrigins(
        servers,
        [false, false],
        [
          { integrationId: A, fromExpression: true },
          { integrationId: '{{ $vars.b }}', fromExpression: false },
        ],
        [
          { integrationId: A, fromExpression: true },
          { integrationId: B, fromExpression: false },
        ],
      );
      expect(out).toEqual({
        mcpServers: [{ integrationId: A }, { integrationId: B }],
        mcpServerFromExpression: [false, true],
      });
    },
  );

  it('빈 목록은 목록이 있는 것으로 보고 그대로 쓴다', () => {
    expect(restoreMcpServerOrigins([], undefined, raw, evaluated)).toEqual({
      mcpServers: [],
      mcpServerFromExpression: [],
    });
  });

  it('목록이 배열이 아닌 값이면 서버가 없는 것으로 본다', () => {
    expect(restoreMcpServerOrigins('broken', [false], raw, evaluated)).toEqual({
      mcpServers: [],
      mcpServerFromExpression: [],
    });
  });
});

describe('mcpServerRefUse — 평행 배열의 false 만 리터럴', () => {
  it('길이가 맞는 배열에서 그 위치의 값이 false 면 리터럴', () => {
    expect(mcpServerRefUse('node-1', [true, false], 1, 2)).toEqual({
      nodeId: 'node-1',
      fromExpression: false,
    });
    expect(mcpServerRefUse('node-1', [true, false], 0, 2)).toEqual({
      nodeId: 'node-1',
      fromExpression: true,
    });
  });

  it.each<[string, unknown, number, number]>([
    ['배열 없음', undefined, 0, 1],
    ['배열이 아님', { 0: false }, 0, 1],
    ['배열이 서버 목록보다 짧음', [false], 1, 2],
    ['배열이 서버 목록보다 김', [false, false], 0, 1],
    ['값이 null', [null], 0, 1],
    ["값이 문자열 'false'", ['false'], 0, 1],
    ['값이 0', [0], 0, 1],
    ['위치가 범위 밖', [false], 3, 1],
  ])('%s → 표현식', (_label, flags, index, serverCount) => {
    expect(mcpServerRefUse('node-1', flags, index, serverCount)).toEqual({
      nodeId: 'node-1',
      fromExpression: true,
    });
  });

  it('nodeId 가 없으면 null', () => {
    expect(mcpServerRefUse(undefined, [false], 0, 1)).toEqual({
      nodeId: null,
      fromExpression: false,
    });
  });
});

describe('mcpServerUseAt — 컨텍스트에서 mcpServerRefUse 와 같은 판정', () => {
  it('컨텍스트의 nodeId · 배열로 index 번째 서버를 판정한다', () => {
    const ctx = { nodeId: 'node-1', mcpServerFromExpression: [true, false] };
    expect(mcpServerUseAt(ctx, 1, 2)).toEqual(
      mcpServerRefUse('node-1', [true, false], 1, 2),
    );
    expect(mcpServerUseAt(ctx, 1, 2)).toEqual({
      nodeId: 'node-1',
      fromExpression: false,
    });
    expect(mcpServerUseAt(ctx, 0, 2).fromExpression).toBe(true);
  });

  it('배열이 없거나 길이가 다르면 표현식, nodeId 가 없으면 null', () => {
    expect(mcpServerUseAt({}, 0, 1)).toEqual({
      nodeId: null,
      fromExpression: true,
    });
    expect(
      mcpServerUseAt({ nodeId: 'n', mcpServerFromExpression: [false] }, 0, 2)
        .fromExpression,
    ).toBe(true);
  });
});
