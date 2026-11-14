import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent, type Dispatcher } from 'undici';

/**
 * 연결할 때 푼 주소 하나를 판정한다. 막으면 사유를 담은 오류를, 통과면 `null` 을 돌려준다.
 *
 * @param resolved 해석기가 돌려준 주소 하나.
 * @param hostname 연결하려는 호스트 이름(URL 의 호스트).
 */
export type ResolvedAddressGuard = (
  resolved: LookupAddress,
  hostname: string,
) => Error | null;

/** Happy Eyeballs(RFC 8305) 시도 간격(ms). 전역 dispatcher 와 연결 시점 판정 dispatcher 가 같은 값을 쓴다. */
const AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS = 300;

/**
 * undici `Agent` 의 주소 계열 선택 옵션. IPv6 경로가 깨진 환경에서 IPv4 로 넘어가게 한다.
 * `DISABLE_UNDICI_AUTO_SELECT_FAMILY=1` 이면 빈 객체(undici 기본값)다.
 *
 * 전역 dispatcher(`bootstrap/undici-dispatcher.ts`)와 {@link createGuardedLookupDispatcher} 가 함께 쓴다.
 * 나가는 요청이 어느 dispatcher 를 타든 같은 연결 동작을 보이게 하려는 것이다.
 */
export function autoSelectFamilyAgentOptions(
  env: NodeJS.ProcessEnv = process.env,
): { autoSelectFamily?: boolean; autoSelectFamilyAttemptTimeout?: number } {
  if (env.DISABLE_UNDICI_AUTO_SELECT_FAMILY === '1') return {};
  return {
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS,
  };
}

/**
 * 연결할 때 쓰는 주소 조회(`net.connect` 의 `lookup`)에 대역 판정을 넣는다.
 *
 * OS 해석기(`dns.lookup`, getaddrinfo)로 호스트 이름을 풀고, 나온 주소를 모두 `guard` 에 넣는다. 하나라도 막히면
 * 그 오류로 연결을 끝낸다. 모두 통과하면 그 주소를 그대로 연결에 쓴다. 판정한 주소와 연결하는 주소가 같은 조회
 * 결과라서, 앞선 검사와 연결 사이에 DNS 응답이 바뀌어도(DNS rebinding) 판정을 거치지 않은 주소로는 연결하지 않는다.
 *
 * - `net.connect` 는 `autoSelectFamily` 가 켜져 있으면 `{ all: true }` 로 주소 목록을, 꺼져 있으면 주소 하나를 받는다.
 *   두 모양을 모두 지원한다. 주소 하나를 원할 때는 해석기가 돌려준 첫 주소를 준다(`dns.lookup` 기본 동작과 같다).
 * - 해석 실패는 해석기의 오류를 그대로 넘긴다. 연결은 `ENOTFOUND` 같은 전송 오류로 끝난다.
 * - IP 리터럴 호스트에는 `net.connect` 가 조회를 부르지 않는다. 리터럴 판정은 호출자의 사전 검사가 맡는다.
 * - TLS 의 SNI 와 인증서 검증은 undici 가 URL 의 호스트 이름으로 한다. 이 함수는 연결할 IP 만 정한다.
 */
export function createGuardedLookup(
  guard: ResolvedAddressGuard,
): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) {
        callback(err, '', 0);
        return;
      }
      if (addresses.length === 0) {
        // 주소가 하나도 없으면 연결할 곳이 없다. 해석 실패와 같은 오류로 끝낸다.
        const notFound: NodeJS.ErrnoException & { hostname?: string } =
          new Error(`getaddrinfo ENOTFOUND ${hostname}`);
        notFound.code = 'ENOTFOUND';
        notFound.syscall = 'getaddrinfo';
        notFound.hostname = hostname;
        callback(notFound, '', 0);
        return;
      }
      for (const resolved of addresses) {
        let blocked: Error | null;
        try {
          blocked = guard(resolved, hostname);
        } catch (guardErr) {
          // 판정이 던져도 통과시키지 않는다. 연결 오류로 끝낸다.
          callback(
            guardErr instanceof Error ? guardErr : new Error(String(guardErr)),
            '',
            0,
          );
          return;
        }
        if (blocked) {
          callback(blocked, '', 0);
          return;
        }
      }
      if (options.all) {
        callback(null, addresses);
        return;
      }
      const [first] = addresses;
      callback(null, first.address, first.family);
    });
  };
}

/**
 * {@link createGuardedLookup} 을 연결 조회로 쓰는 undici `Agent`. `fetch(url, { dispatcher })` 로 넘긴다.
 *
 * 연결을 맺을 때만 조회하므로 keep-alive 로 다시 쓰는 연결은 다시 판정하지 않는다. 그 연결의 주소는 맺을 때
 * 판정을 거쳤다. 판정 기준이 같은 호출 경로끼리 하나를 만들어 나눠 쓴다.
 */
export function createGuardedLookupDispatcher(
  guard: ResolvedAddressGuard,
): Agent {
  return new Agent({
    ...autoSelectFamilyAgentOptions(),
    connect: { lookup: createGuardedLookup(guard) },
  });
}

/** {@link createLazyGuardedDispatcher} 가 돌려주는 지연 싱글턴 핸들. */
export interface LazyGuardedDispatcher {
  /** 처음 부를 때 만들고 이후에는 같은 dispatcher 를 돌려준다. */
  get(): Dispatcher;
  /** 테스트용. 만들어 둔 dispatcher 를 닫고 캐시를 비운다. 다음 `get()` 이 새로 만든다. */
  reset(): Promise<void>;
}

/**
 * 연결 시점 판정 dispatcher 를 처음 부를 때 한 번 만들어 나눠 쓰는 지연 싱글턴.
 *
 * 알림 웹훅 · MCP · HTTP Request 세 호출처가 같은 방식으로 쓴다. 판정 기준이 같은 경로끼리 하나를 나눠 써야
 * undici 연결 풀(keep-alive)이 요청마다 새로 열리지 않는다. 끄는 조건(환경 변수)은 호출처가 `get()` 을 부르기
 * 전에 정한다.
 *
 * @param factory dispatcher 를 만드는 함수. 보통 {@link createGuardedLookupDispatcher} 를 부른다.
 */
export function createLazyGuardedDispatcher(
  factory: () => Dispatcher,
): LazyGuardedDispatcher {
  let instance: Dispatcher | undefined;
  return {
    get: () => (instance ??= factory()),
    reset: async () => {
      const current = instance;
      instance = undefined;
      await current?.close();
    },
  };
}

/** {@link findCause} 가 거슬러 올라가는 `cause` 의 최대 깊이. 순환 참조로 멈추지 않게 둔다. */
const MAX_CAUSE_DEPTH = 8;

/**
 * `err` 와 그 `cause` 를 따라가며 `type` 의 인스턴스를 찾는다. undici `fetch` 는 연결 오류를
 * `TypeError('fetch failed', { cause })` 로 감싸므로 {@link createGuardedLookup} 의 판정 오류는 `cause` 에 있다.
 */
export function findCause<T extends Error>(
  err: unknown,
  type: abstract new (...args: never[]) => T,
): T | undefined {
  let current: unknown = err;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH && current; depth++) {
    if (current instanceof type) return current;
    current =
      typeof current === 'object'
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return undefined;
}
