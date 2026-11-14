import { GraphTraversalService } from './graph-traversal.service';
import { GraphEdge } from './graph-builder';

describe('GraphTraversalService.isPortFiltered', () => {
  const svc = new GraphTraversalService();

  it('포트를 고르지 않은 출력은 error 를 뺀 모든 연결선을 연다', () => {
    for (const output of [{ a: 1 }, null, undefined, 'text', [1, 2]]) {
      expect(svc.isPortFiltered(output, 'out')).toBe(false);
      expect(svc.isPortFiltered(output, 'case_1')).toBe(false);
      expect(svc.isPortFiltered(output, 'error')).toBe(true);
    }
  });

  it('_selectedPort 키가 있어도 값이 undefined 면 고르지 않은 것과 같다', () => {
    const output = { _selectedPort: undefined };
    expect(svc.isPortFiltered(output, 'out')).toBe(false);
    expect(svc.isPortFiltered(output, 'error')).toBe(true);
  });

  it('_selectedPort 가 null 이면 어떤 포트와도 같지 않아 모든 연결선을 닫는다(기존 동작)', () => {
    const output = { _selectedPort: null };
    expect(svc.isPortFiltered(output, 'out')).toBe(true);
    expect(svc.isPortFiltered(output, 'error')).toBe(true);
  });

  it('빈 배열 선택도 고르지 않은 것과 같다', () => {
    const output = { _selectedPort: [] };
    expect(svc.isPortFiltered(output, 'out')).toBe(false);
    expect(svc.isPortFiltered(output, 'error')).toBe(true);
  });

  it('error 를 고르면 error 연결선만 연다', () => {
    const output = { _selectedPort: 'error' };
    expect(svc.isPortFiltered(output, 'error')).toBe(false);
    expect(svc.isPortFiltered(output, 'out')).toBe(true);
  });

  it('배열 선택은 포함 여부로 판단한다', () => {
    const output = { _selectedPort: ['a', 'error'] };
    expect(svc.isPortFiltered(output, 'a')).toBe(false);
    expect(svc.isPortFiltered(output, 'error')).toBe(false);
    expect(svc.isPortFiltered(output, 'b')).toBe(true);
  });
});

describe('GraphTraversalService.propagateReachability', () => {
  const svc = new GraphTraversalService();
  const edge = (sourcePort: string, targetNodeId: string): GraphEdge =>
    ({ sourceNodeId: 'n', sourcePort, targetNodeId }) as GraphEdge;

  it('성공 출력(포트 없음)은 동적 에러 포트 연결선을 열지 않는다', () => {
    const reachable = new Set<string>();
    svc.propagateReachability(
      'n',
      new Map([['n', [edge('out', 'next'), edge('error', 'handler')]]]),
      { n: { ok: true } },
      reachable,
    );
    expect([...reachable]).toEqual(['next']);
  });
});
