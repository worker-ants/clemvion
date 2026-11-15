import { IdleExpiringMap } from './idle-expiring-map';

describe('IdleExpiringMap', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  function make<V>(maxEntries = 100, idleTtlMs = 1_000) {
    return new IdleExpiringMap<string, V>({
      maxEntries,
      idleTtlMs,
      now: clock,
    });
  }

  it('TTL 안에서는 값을 돌려준다', () => {
    const map = make<number>();
    map.set('a', 1);
    now += 999;
    expect(map.get('a')).toBe(1);
    expect(map.has('a')).toBe(true);
    expect(map.size).toBe(1);
  });

  it('마지막으로 만진 뒤 TTL 이 지나면 없는 것으로 보고 지운다', () => {
    const map = make<number>();
    map.set('a', 1);
    now += 1_000;
    expect(map.get('a')).toBeUndefined();
    expect(map.has('a')).toBe(false);
    expect(map.size).toBe(0);
  });

  it('get 은 유휴 시각을 다시 잰다', () => {
    const map = make<number>();
    map.set('a', 1);
    now += 900;
    expect(map.get('a')).toBe(1);
    now += 900;
    expect(map.get('a')).toBe(1);
  });

  it('has 는 유휴 시각을 다시 재지 않는다', () => {
    const map = make<number>();
    map.set('a', 1);
    now += 900;
    expect(map.has('a')).toBe(true);
    now += 200;
    expect(map.has('a')).toBe(false);
  });

  it('set 은 만료된 항목을 앞에서부터 쓸어 낸다', () => {
    const map = make<number>();
    map.set('old-1', 1);
    map.set('old-2', 2);
    now += 500;
    map.set('fresh', 3);
    now += 600; // old-* 는 1100ms, fresh 는 600ms 유휴
    map.set('new', 4);
    expect(map.size).toBe(2);
    expect(map.get('fresh')).toBe(3);
    expect(map.get('new')).toBe(4);
  });

  it('상한을 넘으면 가장 오래 만지지 않은 항목부터 지우고 지운 키를 돌려준다', () => {
    const map = make<number>(2);
    expect(map.set('a', 1)).toEqual([]);
    expect(map.set('b', 2)).toEqual([]);
    map.get('a'); // a 를 만져서 b 가 가장 오래된 항목이 된다
    expect(map.set('c', 3)).toEqual(['b']);
    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBeUndefined();
    expect(map.get('c')).toBe(3);
  });

  it('같은 키를 다시 set 하면 덮어쓰고 상한 계산에 한 번만 센다', () => {
    const map = make<number>(2);
    map.set('a', 1);
    map.set('a', 2);
    map.set('b', 3);
    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(2);
  });

  it('TTL 로 지운 항목은 상한 축출 목록에 넣지 않는다', () => {
    const map = make<number>(1);
    map.set('a', 1);
    now += 1_000;
    expect(map.set('b', 2)).toEqual([]);
  });

  it('delete · clear 로 지운다', () => {
    const map = make<number>();
    map.set('a', 1);
    map.set('b', 2);
    map.delete('a');
    expect(map.has('a')).toBe(false);
    expect(map.size).toBe(1);
    map.clear();
    expect(map.size).toBe(0);
  });

  it('상한과 TTL 은 양수여야 한다', () => {
    expect(
      () => new IdleExpiringMap({ maxEntries: 0, idleTtlMs: 1 }),
    ).toThrow();
    expect(
      () => new IdleExpiringMap({ maxEntries: 1, idleTtlMs: 0 }),
    ).toThrow();
  });

  it('now 를 주지 않으면 Date.now 를 쓴다', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(5_000);
    try {
      const map = new IdleExpiringMap<string, number>({
        maxEntries: 10,
        idleTtlMs: 100,
      });
      map.set('a', 1);
      spy.mockReturnValue(5_100);
      expect(map.get('a')).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});
