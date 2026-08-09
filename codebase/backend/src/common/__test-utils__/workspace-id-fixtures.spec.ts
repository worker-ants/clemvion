import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ALL_WS,
  assertAllUnique,
  DECOY_WS,
  HEADER_WS,
  NIL_WS,
  OTHER_WS,
  SAME_WS,
  TOKEN_WS,
  VICTIM_WS,
} from './workspace-id-fixtures';

/**
 * 픽스처 모듈의 **계약 자체**를 고정한다.
 *
 * 이 모듈은 로드 시점에 `assertAllUnique(ALL_WS)` 를 부르지만, 실데이터가 유일하므로 그
 * 호출만으로는 판정 로직이 살아 있는지 알 수 없다 — `!==` 를 `===` 로 뒤집는 오타가 들어와도
 * 값이 우연히 서로 다르면 무감지다(ai-review testing INFO). 그래서 양방향을 단언한다.
 */
describe('workspace-id-fixtures', () => {
  it('현재 값들은 서로 다르다 — 로드 시점 가드가 통과하는 상태', () => {
    expect(() => assertAllUnique(ALL_WS)).not.toThrow();
    expect(new Set<string>(ALL_WS).size).toBe(ALL_WS.length);
  });

  it('중복이 있으면 throw 한다 (판정이 살아 있는가)', () => {
    expect(() => assertAllUnique(['a', 'b', 'a'])).toThrow(/값이 중복됐다/);
  });

  it('throw 메시지가 고유/전체 개수를 말한다 — 어느 쌍인지 좁히는 단서', () => {
    expect(() => assertAllUnique(['a', 'b', 'a'])).toThrow(/고유 2 \/ 전체 3/);
  });

  it('빈 배열과 단일 원소는 위반이 아니다 (경계)', () => {
    expect(() => assertAllUnique([])).not.toThrow();
    expect(() => assertAllUnique(['only'])).not.toThrow();
  });

  it('모듈이 로드 시점에 실제로 가드를 부른다 (헬퍼 존재 ≠ 호출)', () => {
    // U2: `assertAllUnique(ALL_WS)` 호출 줄을 지워도 위 테스트들은 전부 초록이다 —
    // 판정 함수가 살아 있다는 것과 **그것이 불린다**는 것은 다른 사실이기 때문이다.
    // 소스에 호출이 있는지 직접 본다. 값 검증이 아니라 배선 검증이라 이 형태가 맞다.
    const src = readFileSync(
      join(__dirname, 'workspace-id-fixtures.ts'),
      'utf8',
    );
    const callSites = src
      .split('\n')
      .filter((l) => /^\s*assertAllUnique\(ALL_WS\);/.test(l));
    // 실패하면: 모듈 최상위에서 `assertAllUnique(ALL_WS)` 를 부르지 않는다는 뜻이고,
    // 그러면 가드가 아무것도 막지 않는다.
    expect(callSites).toHaveLength(1);
  });

  it('ALL_WS 가 export 상수 전부를 담는다 — 새 상수가 가드를 조용히 비껴가지 않도록', () => {
    // 상수를 추가하고 `ALL_WS` 에 넣는 것을 잊으면 그 값은 유일성 검사를 받지 않는다.
    // 여기서 명시적으로 대조해 그 누락을 잡는다.
    expect([...ALL_WS].sort()).toEqual(
      [
        HEADER_WS,
        TOKEN_WS,
        VICTIM_WS,
        OTHER_WS,
        DECOY_WS,
        SAME_WS,
        NIL_WS,
      ].sort(),
    );
  });
});
