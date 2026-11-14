import type { Dispatcher } from 'undici';
import {
  createGuardedLookupDispatcher,
  createLazyGuardedDispatcher,
} from '../../common/utils/guarded-lookup-dispatcher';
import { resolvedAddressBlockReason } from '../../common/utils/ssrf-safe-url.util';

/**
 * 알림 웹훅 연결 시점 판정이 연결을 막았다. `reason` 은 `checkResolvedHostIp` 의 거부 사유와 같은 문구다.
 * `fetch` 는 `TypeError('fetch failed')` 로 끝나고 이 오류는 그 `cause` 에 있다.
 */
export class ResolvedHostBlockedError extends Error {
  constructor(readonly reason: string) {
    super(`blocked at connect: ${reason}`);
    this.name = 'ResolvedHostBlockedError';
  }
}

const lazyDispatcher = createLazyGuardedDispatcher(() =>
  createGuardedLookupDispatcher(({ address }) => {
    const reason = resolvedAddressBlockReason(address);
    return reason ? new ResolvedHostBlockedError(reason) : null;
  }),
);

/**
 * 알림 웹훅 발송 `fetch` 의 `dispatcher`(CLE-T-GAQCF9). 연결할 때 푼 주소를 `resolvedAddressBlockReason` 으로
 * 판정하고, 통과한 주소로만 연결한다. 막히면 {@link ResolvedHostBlockedError} 로 연결을 끝낸다.
 *
 * - 발송 직전 DNS 검사를 켤 때만 쓴다(`isNotificationDnsGuardEnabled`). 끄면 전역 dispatcher 로 보낸다.
 * - 프로세스에 하나만 만들어 나눠 쓴다. 발송마다 연결 풀을 새로 열지 않기 위해서다.
 * - 해석 실패는 판정하지 않고 전송 오류로 둔다. `checkResolvedHostIp` 의 fail-open 과 같다.
 * - TLS 의 SNI 와 인증서 검증은 URL 의 호스트 이름으로 한다.
 */
export function notificationWebhookDispatcher(): Dispatcher {
  return lazyDispatcher.get();
}

/** 테스트용. 만들어 둔 dispatcher 를 닫고 다음 호출이 새로 만들게 한다. */
export function resetNotificationWebhookDispatcherForTesting(): Promise<void> {
  return lazyDispatcher.reset();
}
