export interface IdleExpiringMapOptions {
  /** 항목 수 상한. 넘으면 가장 오래 만지지 않은 항목부터 지운다. */
  maxEntries: number;
  /** 마지막으로 만진 뒤 이 시간(ms)이 지나면 항목을 없는 것으로 본다. */
  idleTtlMs: number;
  /** 시각 공급자. 테스트가 바꿔 끼운다. 기본은 `Date.now`. */
  now?: () => number;
}

interface Entry<V> {
  value: V;
  touchedAt: number;
}

/**
 * 유휴 TTL 과 항목 수 상한이 있는 Map.
 *
 * 실행 단위 메모리 항목(`WebsocketService` 의 routing context, `ExecutionSeqAllocator` 의 seq 미러)은
 * terminal 이벤트를 보낸 인스턴스에서만 풀린다. 실행을 park 한 인스턴스와 끝낸 인스턴스가 다르면
 * park 한 쪽에 항목이 남는다(NERV Task CLE-T-4J965H). 이 Map 은 그런 항목을 유휴 TTL 과 상한으로 회수한다.
 *
 * 항목은 마지막으로 만진(`set` · `get`) 순서로 놓인다. JS `Map` 이 삽입 순서를 지키므로 만질 때마다
 * 지우고 다시 넣는다. 그래서 가장 오래된 항목이 늘 맨 앞에 있고, 만료 정리와 상한 축출은 앞에서부터
 * 필요한 만큼만 본다. 타이머를 두지 않고 `set` 때 정리한다. 새 항목이 들어오지 않으면 Map 도 자라지 않는다.
 */
export class IdleExpiringMap<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private readonly maxEntries: number;
  private readonly idleTtlMs: number;
  private readonly now: () => number;

  constructor(options: IdleExpiringMapOptions) {
    if (!(options.maxEntries > 0) || !(options.idleTtlMs > 0)) {
      throw new Error(
        `IdleExpiringMap 의 maxEntries · idleTtlMs 는 양수여야 한다 (maxEntries=${options.maxEntries}, idleTtlMs=${options.idleTtlMs})`,
      );
    }
    this.maxEntries = options.maxEntries;
    this.idleTtlMs = options.idleTtlMs;
    this.now = options.now ?? (() => Date.now());
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * 값을 넣고 유휴 시각을 지금으로 맞춘다. 만료된 항목을 정리한 뒤 상한을 넘으면 오래된 항목부터 지운다.
   *
   * @returns 상한 때문에 지운 키. TTL 로 지운 키는 넣지 않는다.
   */
  set(key: K, value: V): K[] {
    const now = this.now();
    this.entries.delete(key);
    this.entries.set(key, { value, touchedAt: now });
    this.sweepExpired(now);
    const evicted: K[] = [];
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as K;
      this.entries.delete(oldest);
      evicted.push(oldest);
    }
    return evicted;
  }

  /** 값을 돌려주고 유휴 시각을 지금으로 맞춘다. 만료됐으면 지우고 `undefined` 다. */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    const now = this.now();
    if (this.isExpired(entry, now)) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    entry.touchedAt = now;
    this.entries.set(key, entry);
    return entry.value;
  }

  /** 있는지만 본다. 유휴 시각은 바꾸지 않는다. 만료됐으면 지우고 `false` 다. */
  has(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.isExpired(entry, this.now())) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private isExpired(entry: Entry<V>, now: number): boolean {
    return now - entry.touchedAt >= this.idleTtlMs;
  }

  /** 맨 앞(가장 오래 만지지 않은 항목)부터 만료된 항목을 지운다. 처음 만난 살아 있는 항목에서 멈춘다. */
  private sweepExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (!this.isExpired(entry, now)) return;
      this.entries.delete(key);
    }
  }
}
