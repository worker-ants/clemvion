import type { Redis } from 'ioredis';
import type { RedisConnectionProvider } from '../../../common/redis/redis-connection.provider';
import { SSE_ACQUIRE_SLOT_SCRIPT } from '../sse-fanout.service';

/**
 * `SseFanoutService` 단위 테스트용 Redis 대역. 서버 하나를 여러 클라이언트가 나눠 써서 서버 인스턴스 둘을 흉내 낸다.
 *
 * 그 서비스가 쓰는 명령만 흉내 낸다: pipeline(`xadd` · `pexpire` · `publish` · `zadd`), `xrange`, `get`, `publish`, `eval`
 * (연결 상한 스크립트 하나), `zrem`, `subscribe` · `unsubscribe`, `duplicate`, `on`, `quit`. 만료는 읽을 때 `Date.now()`
 * 로 판정하므로 jest 가짜 타이머의 시각을 따른다. pub/sub 메시지는 microtask 로 전달한다. Lua 스크립트 자체는 e2e
 * (`test/external-interaction-sse-fanout.e2e-spec.ts`)가 실제 Redis 로 확인한다.
 */
export class FakeRedisServer {
  /** `true` 면 모든 명령이 거부된다. */
  failing = false;
  /** 설정하면 XRANGE 가 응답하기 전에 기다린다. 구독 순서의 경쟁을 만드는 데 쓴다. */
  beforeXrange: (() => Promise<void>) | null = null;
  /** 설정하면 SUBSCRIBE 가 채널을 등록하기 전에 기다린다. 구독이 늦게 확인되는 경우를 만든다. */
  beforeSubscribe: ((channels: string[]) => Promise<void>) | null = null;
  /** 문자열 키. 테스트가 `exec:seq:<id>` 같은 값을 직접 넣는다. */
  readonly strings = new Map<string, string>();
  readonly streams = new Map<string, Array<[string, string[]]>>();
  readonly zsets = new Map<string, Map<string, number>>();
  readonly expiresAt = new Map<string, number>();
  readonly published: Array<{ channel: string; message: string }> = [];
  readonly channelSubscribers = new Map<string, Set<FakeRedisClient>>();
  private lastIdMs = 0;
  private lastIdSeq = 0;

  client(): FakeRedisClient {
    return new FakeRedisClient(this);
  }

  /** `RedisConnectionProvider` 대역. 공유 command 연결로 새 클라이언트 하나를 돌려준다. */
  provider(): RedisConnectionProvider {
    const client = this.client();
    return {
      getClientOrNull: () => client as unknown as Redis,
    } as unknown as RedisConnectionProvider;
  }

  /** 채널을 구독 중인 클라이언트 수. */
  subscriberCount(channel: string): number {
    return this.channelSubscribers.get(channel)?.size ?? 0;
  }

  pttl(key: string): number | null {
    this.expireIfDue(key);
    const at = this.expiresAt.get(key);
    return at === undefined ? null : at - Date.now();
  }

  /** @internal */
  expireIfDue(key: string): void {
    const at = this.expiresAt.get(key);
    if (at !== undefined && at <= Date.now()) {
      this.expiresAt.delete(key);
      this.streams.delete(key);
      this.zsets.delete(key);
    }
  }

  /** @internal */
  nextStreamId(): string {
    const now = Date.now();
    if (now > this.lastIdMs) {
      this.lastIdMs = now;
      this.lastIdSeq = 0;
    } else {
      this.lastIdSeq += 1;
    }
    return `${this.lastIdMs}-${this.lastIdSeq}`;
  }

  /** @internal */
  publish(channel: string, message: string): number {
    this.published.push({ channel, message });
    const subs = Array.from(this.channelSubscribers.get(channel) ?? []);
    for (const sub of subs) {
      queueMicrotask(() => sub.emit('message', channel, message));
    }
    return subs.length;
  }
}

type Listener = (...args: unknown[]) => void;

export class FakeRedisClient {
  private readonly listeners = new Map<string, Listener[]>();
  readonly subscribed = new Set<string>();
  readonly subscribeCalls: string[][] = [];
  quitCalled = false;

  constructor(readonly server: FakeRedisServer) {}

  duplicate(): FakeRedisClient {
    return new FakeRedisClient(this.server);
  }

  on(event: string, listener: Listener): this {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  quit(): Promise<'OK'> {
    this.quitCalled = true;
    for (const channel of this.subscribed) {
      this.server.channelSubscribers.get(channel)?.delete(this);
    }
    this.subscribed.clear();
    return Promise.resolve('OK');
  }

  pipeline(): FakePipeline {
    return new FakePipeline(this);
  }

  xadd(key: string, ...args: Array<string | number>): Promise<string> {
    return this.run(() => this.doXadd(key, args));
  }

  xrange(
    key: string,
    start: string,
    end: string,
  ): Promise<[string, string[]][]> {
    const hook = this.server.beforeXrange;
    const read = (): Promise<[string, string[]][]> =>
      this.run(() => {
        if (start !== '-' || end !== '+') {
          throw new Error('fake xrange: - + 만 흉내 낸다');
        }
        this.server.expireIfDue(key);
        return (this.server.streams.get(key) ?? []).map(
          ([id, fields]) => [id, [...fields]] as [string, string[]],
        );
      });
    return hook ? hook().then(read) : read();
  }

  pexpire(key: string, ms: number): Promise<number> {
    return this.run(() => this.doPexpire(key, ms));
  }

  get(key: string): Promise<string | null> {
    return this.run(() => this.server.strings.get(key) ?? null);
  }

  publish(channel: string, message: string): Promise<number> {
    return this.run(() => this.server.publish(channel, message));
  }

  zadd(key: string, score: number, member: string): Promise<number> {
    return this.run(() => this.doZadd(key, score, member));
  }

  zrem(key: string, member: string): Promise<number> {
    return this.run(() => {
      this.server.expireIfDue(key);
      return this.server.zsets.get(key)?.delete(member) ? 1 : 0;
    });
  }

  eval(
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ): Promise<number> {
    return this.run(() => {
      if (script !== SSE_ACQUIRE_SLOT_SCRIPT || numKeys !== 1) {
        throw new Error('fake eval: 연결 상한 스크립트만 흉내 낸다');
      }
      const [key, now, staleBefore, limit, member, ttl] = args;
      this.server.expireIfDue(String(key));
      const set =
        this.server.zsets.get(String(key)) ?? new Map<string, number>();
      for (const [m, score] of set) {
        if (score < Number(staleBefore)) set.delete(m);
      }
      if (set.size >= Number(limit)) return 0;
      set.set(String(member), Number(now));
      this.server.zsets.set(String(key), set);
      this.doPexpire(String(key), Number(ttl));
      return 1;
    });
  }

  subscribe(...channels: string[]): Promise<number> {
    this.subscribeCalls.push(channels);
    const hook = this.server.beforeSubscribe;
    const apply = (): Promise<number> =>
      this.run(() => {
        for (const channel of channels) {
          this.subscribed.add(channel);
          const set = this.server.channelSubscribers.get(channel) ?? new Set();
          set.add(this);
          this.server.channelSubscribers.set(channel, set);
        }
        return this.subscribed.size;
      });
    return hook ? hook(channels).then(apply) : apply();
  }

  unsubscribe(...channels: string[]): Promise<number> {
    return this.run(() => {
      for (const channel of channels) {
        this.subscribed.delete(channel);
        this.server.channelSubscribers.get(channel)?.delete(this);
      }
      return this.subscribed.size;
    });
  }

  /** @internal */
  doXadd(key: string, args: Array<string | number>): string {
    // MAXLEN ~ <n> * field value ...
    let i = 0;
    let maxLen = Infinity;
    if (args[i] === 'MAXLEN') {
      i += 1;
      if (args[i] === '~' || args[i] === '=') i += 1;
      maxLen = Number(args[i]);
      i += 1;
    }
    if (args[i] !== '*') throw new Error('fake xadd: id 는 * 만 흉내 낸다');
    i += 1;
    const fields = args.slice(i).map(String);
    this.server.expireIfDue(key);
    const entries = this.server.streams.get(key) ?? [];
    const id = this.server.nextStreamId();
    entries.push([id, fields]);
    while (entries.length > maxLen) entries.shift();
    this.server.streams.set(key, entries);
    return id;
  }

  /** @internal */
  doPexpire(key: string, ms: number): number {
    this.server.expireIfDue(key);
    if (!this.server.streams.has(key) && !this.server.zsets.has(key)) return 0;
    this.server.expiresAt.set(key, Date.now() + ms);
    return 1;
  }

  /** @internal */
  doZadd(key: string, score: number, member: string): number {
    this.server.expireIfDue(key);
    const set = this.server.zsets.get(key) ?? new Map<string, number>();
    const added = set.has(member) ? 0 : 1;
    set.set(member, score);
    this.server.zsets.set(key, set);
    return added;
  }

  /** @internal */
  run<T>(fn: () => T): Promise<T> {
    if (this.server.failing) {
      return Promise.reject(new Error('fake redis unavailable'));
    }
    try {
      return Promise.resolve(fn());
    } catch (err) {
      return Promise.reject(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }
}

class FakePipeline {
  private readonly ops: Array<() => unknown> = [];

  constructor(private readonly client: FakeRedisClient) {}

  xadd(key: string, ...args: Array<string | number>): this {
    this.ops.push(() => this.client.doXadd(key, args));
    return this;
  }

  pexpire(key: string, ms: number): this {
    this.ops.push(() => this.client.doPexpire(key, ms));
    return this;
  }

  publish(channel: string, message: string): this {
    this.ops.push(() => this.client.server.publish(channel, message));
    return this;
  }

  zadd(key: string, score: number, member: string): this {
    this.ops.push(() => this.client.doZadd(key, score, member));
    return this;
  }

  exec(): Promise<Array<[Error | null, unknown]>> {
    return this.client.run(() =>
      this.ops.map((op): [Error | null, unknown] => {
        try {
          return [null, op()];
        } catch (err) {
          return [err instanceof Error ? err : new Error(String(err)), null];
        }
      }),
    );
  }
}
