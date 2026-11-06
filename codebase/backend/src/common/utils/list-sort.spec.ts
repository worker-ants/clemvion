import { pickSortColumn } from './list-sort';

describe('pickSortColumn', () => {
  const allowed = {
    created_at: 's.created_at',
    name: 't.name',
  } as const;

  it('허용 목록의 키는 대응하는 값을 돌려준다', () => {
    expect(pickSortColumn(allowed, 'name', 's.created_at')).toBe('t.name');
    expect(pickSortColumn(allowed, 'created_at', 't.name')).toBe(
      's.created_at',
    );
  });

  it('sort 가 없으면 fallback 이다', () => {
    expect(pickSortColumn(allowed, undefined, 's.created_at')).toBe(
      's.created_at',
    );
  });

  it.each(['', 'unknown', 'createdAt', 'CREATED_AT', 'workspace_id'])(
    '허용 밖 sort=%j 는 fallback 이다',
    (sort) => {
      expect(pickSortColumn(allowed, sort, 's.created_at')).toBe(
        's.created_at',
      );
    },
  );

  /**
   * 입력은 손으로 고르지 않고 Object.prototype 의 속성 이름 전부로 만든다. `constructor` · `toString` 처럼
   * DTO 정규식을 통과하는 이름과 `__proto__` 처럼 DTO 가 먼저 거르는 이름이 모두 들어 있다. 서비스를
   * DTO 없이 부르는 내부 호출자도 같은 판정을 받는다.
   */
  it.each(Object.getOwnPropertyNames(Object.prototype))(
    'Object.prototype 의 속성 이름 sort=%s 는 fallback 이다',
    (sort) => {
      expect(pickSortColumn(allowed, sort, 's.created_at')).toBe(
        's.created_at',
      );
    },
  );

  it('허용 목록의 프로토타입에서 물려받은 키도 받지 않는다', () => {
    const withInherited: Record<string, string> = Object.create({
      hidden: 'x.hidden',
    }) as Record<string, string>;
    withInherited.name = 't.name';

    expect(pickSortColumn(withInherited, 'hidden', 's.created_at')).toBe(
      's.created_at',
    );
    expect(pickSortColumn(withInherited, 'name', 's.created_at')).toBe(
      't.name',
    );
  });
});
