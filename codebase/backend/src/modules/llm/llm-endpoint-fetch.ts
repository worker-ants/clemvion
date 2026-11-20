import { Logger } from '@nestjs/common';
import type { Dispatcher } from 'undici';

import {
  createGuardedLookupDispatcher,
  createLazyGuardedDispatcher,
  type ResolvedAddressGuard,
} from '../../common/utils/guarded-lookup-dispatcher';
import { isBlockedIpLiteral } from '../../common/utils/ssrf/ip-classifier';

/**
 * LLM 엔드포인트의 주소가 막는 대역이라 연결하지 않았을 때 던진다. 메시지에는 URL 의 호스트 이름만 싣는다.
 * 풀린 주소는 서버 경고 로그에만 남긴다.
 */
export class LlmEndpointBlockedError extends Error {
  constructor(readonly hostname: string) {
    super(`LLM endpoint host ${hostname} resolves to a blocked address.`);
    this.name = 'LlmEndpointBlockedError';
  }
}

const logger = new Logger('LlmEndpointFetch');

/**
 * 연결할 때 푼 주소 하나를 판정한다. 대역표는 저장 · 미리보기 사전 검사(`ssrf.util.ts`)와 같은
 * `ip-classifier` 표다(CLE-T-63RSH6).
 */
export const llmEndpointAddressGuard: ResolvedAddressGuard = (
  { address },
  hostname,
) => {
  if (!isBlockedIpLiteral(address)) return null;
  logger.warn(
    `LLM endpoint blocked at connect time: ${hostname} resolved to ${address}`,
  );
  return new LlmEndpointBlockedError(hostname);
};

const lazyDispatcher = createLazyGuardedDispatcher(() =>
  createGuardedLookupDispatcher(llmEndpointAddressGuard),
);

/** LLM 호출이 나눠 쓰는 연결 시점 판정 dispatcher. 처음 부를 때 만든다. */
export function llmEndpointDispatcher(): Dispatcher {
  return lazyDispatcher.get();
}

/** 테스트용. 만들어 둔 dispatcher 를 닫는다. */
export function resetLlmEndpointDispatcherForTest(): Promise<void> {
  return lazyDispatcher.reset();
}

function requestHostname(input: string | URL | Request): string {
  if (typeof input === 'string') return new URL(input).hostname;
  if (input instanceof URL) return input.hostname;
  return new URL(input.url).hostname;
}

/**
 * 사용자 baseUrl 로 나가는 LLM 호출(openai · azure-openai SDK, cohere rerank)이 쓰는 `fetch` (CLE-T-PT5YB5).
 *
 * - 호스트 이름은 연결할 때 OS 해석기로 풀고, 나온 주소가 막는 대역이면 소켓을 열지 않는다. 저장 · 미리보기 때의
 *   사전 검사 뒤에 DNS 응답이 바뀌어도(DNS rebinding) 판정을 거치지 않은 주소로는 연결하지 않는다.
 * - 연결 조회는 IP 리터럴 호스트에서 불리지 않는다. 그래서 리터럴은 여기서 먼저 본다. 대역표가 넓어지기 전에
 *   저장된 설정(예: CGNAT 리터럴)도 실행 중에 막힌다.
 * - `local` · `tei` 프로바이더는 사설망 엔드포인트용이라 이 함수를 쓰지 않는다. 호스트가 고정인 anthropic ·
 *   google 도 쓰지 않는다.
 *
 * 막히면 {@link LlmEndpointBlockedError} 를 던진다. undici 가 연결 단계 오류를 `TypeError('fetch failed')` 로
 * 감싸므로 호스트 이름 판정 오류는 `cause` 에 있다.
 */
export async function guardedLlmFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const hostname = requestHostname(input);
  if (isBlockedIpLiteral(hostname)) {
    logger.warn(`LLM endpoint blocked (IP literal): ${hostname}`);
    throw new LlmEndpointBlockedError(hostname);
  }
  return fetch(input, {
    ...init,
    dispatcher: llmEndpointDispatcher(),
  } as RequestInit);
}
