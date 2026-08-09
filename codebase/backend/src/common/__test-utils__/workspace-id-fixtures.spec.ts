import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isUuidShaped } from '../utils/uuid';

import * as fixtures from './workspace-id-fixtures';

const { ALL_WS, assertAllUnique } = fixtures;

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
    // 공백·개행에 관대하게 — 포맷 변경만으로 허위 RED 가 나면 이 검사가 짐이 된다.
    // 주석/문자열 안의 언급까지 세지 않도록 줄 시작 호출만 본다.
    const callSites =
      src.match(/^[ \t]*assertAllUnique\s*\(\s*ALL_WS\s*\)\s*;/gm) ?? [];
    // 실패하면: 모듈 최상위에서 `assertAllUnique(ALL_WS)` 를 부르지 않는다는 뜻이고,
    // 그러면 가드가 아무것도 막지 않는다.
    expect(callSites).toHaveLength(1);
  });

  it('ALL_WS 가 export 된 UUID 상수 전부를 담는다 — 새 상수가 가드를 조용히 비껴가지 않도록', () => {
    // **하드코딩 목록으로 대조하면 안 된다.** 초판이 그렇게 짰다가 리뷰에 잡혔고 실측으로
    // 확인했다 — 새 상수를 추가하며 `ALL_WS` 와 이 spec 둘 다 안 건드리면 양쪽이 여전히
    // 7개로 일치해 **GREEN 이 난다**. 막겠다고 선언한 실패 모드를 정확히 못 잡는 형태다
    // (심은 값이 `HEADER_WS` 와 같은 중복이어도 통과했다).
    //
    // 모듈 네임스페이스에서 **자동 추출**하면 spec 을 갱신하지 않아도 새 export 가 대상에
    // 들어온다. 판정 기준은 "UUID 형태의 string export" 다.
    // 판정은 프로덕션 `isUuidShaped` 를 그대로 쓴다 — 여기 정규식을 손으로 복제하면
    // 그 술어가 바뀔 때 이 검사만 조용히 낡는다. 이 PR 이 없애고 있는 결함 클래스를
    // 새로 만드는 셈이라 재사용이 맞다(ai-review INFO).
    //
    // `Object.values` 에는 함수(`assertAllUnique`)와 배열(`ALL_WS`)도 섞여 있어
    // `v is string` 술어는 성립하지 않는다(TS2677). `flatMap` 으로 좁힌다.
    const exportedUuids = Object.values<unknown>(fixtures).flatMap((v) =>
      typeof v === 'string' && isUuidShaped(v) ? [v] : [],
    );

    // 캐너리: 추출이 조용히 빈 배열이 되면 이 테스트가 무의미해진다.
    expect(exportedUuids.length).toBeGreaterThan(1);
    // **중복 제거하면 안 된다.** 초판이 `new Set(exportedUuids)` 로 비교했는데, 그러면
    // 누락된 새 상수가 기존 값과 **같은 값**일 때 그 중복이 지워져 통과한다 —
    // 유일성 가드가 봤어야 할 바로 그 케이스를 검사가 스스로 지운 셈이었다(실측 GREEN).
    expect([...ALL_WS].sort()).toEqual([...exportedUuids].sort());
  });
});
