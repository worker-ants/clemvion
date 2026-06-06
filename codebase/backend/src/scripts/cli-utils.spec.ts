/**
 * cli-utils.ts 단위 테스트 — W3 (SUMMARY#3 코드 리뷰 지적 사항)
 *
 * parseCliFlag: --flag value / --flag=value / 없음 / 인접 플래그 경계 케이스.
 */
import { parseCliFlag } from './cli-utils';

const origArgv = process.argv;

afterEach(() => {
  process.argv = origArgv.slice();
});

describe('parseCliFlag', () => {
  it('--flag value 형식에서 값을 추출한다', () => {
    process.argv = ['node', 'script.ts', '--golden', 'eval/golden.json'];
    expect(parseCliFlag('--golden')).toBe('eval/golden.json');
  });

  it('--flag=value 형식(이퀄 형식)에서 값을 추출한다', () => {
    process.argv = ['node', 'script.ts', '--threshold=0.5'];
    expect(parseCliFlag('--threshold')).toBe('0.5');
  });

  it('존재하지 않는 플래그는 undefined 를 반환한다', () => {
    process.argv = ['node', 'script.ts'];
    expect(parseCliFlag('--missing')).toBeUndefined();
  });

  it('마지막 위치 인수(값이 없는 단독 플래그)는 undefined 를 반환한다', () => {
    process.argv = ['node', 'script.ts', '--dry-run'];
    expect(parseCliFlag('--dry-run')).toBeUndefined();
  });

  it('이퀄 형식이 space 형식보다 우선된다', () => {
    process.argv = [
      'node',
      'script.ts',
      '--flag=eq-val',
      '--flag',
      'space-val',
    ];
    // eqIdx 가 먼저 탐색되므로 eq-val 반환
    expect(parseCliFlag('--flag')).toBe('eq-val');
  });

  it('이름 접두어가 같은 다른 플래그와 혼동되지 않는다', () => {
    process.argv = ['node', 'script.ts', '--ks', '1,3,5', '--fail-k', '5'];
    expect(parseCliFlag('--ks')).toBe('1,3,5');
    expect(parseCliFlag('--fail-k')).toBe('5');
  });
});
