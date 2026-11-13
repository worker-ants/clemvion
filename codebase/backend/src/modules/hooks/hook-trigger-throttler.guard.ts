import { ExecutionContext, Injectable } from '@nestjs/common';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';
import { isHttpContext } from '../../common/utils/http-context';
import { isSignedChatChannelTrigger } from '../chat-channel/chat-channel-secret-refs';
import type { PublicWebhookReqExtension } from './public-webhook-throttle.guard';

/**
 * `POST /hooks/:endpointPath` 의 전역 요청 한도. 서명 참조(`inboundSigningRef`)가 있는 채팅 채널 트리거는
 * 세지 않는다([채팅 채널 「인바운드 관문 순서」](CLE-CHAT-CORE#인바운드-관문-순서), REQ-CHAT-079).
 *
 * 채팅 채널 인바운드는 프로바이더 서버 몇 대의 IP 에서 몰려오므로, 전역 한도(분당 100건, IP 키)를 걸면
 * 활발한 채널 하나가 몇 초 만에 버킷을 다 쓰고 대화가 429 로 끊긴다. 그런데 채팅 채널 트리거인지는
 * 트리거 행을 조회해야 알 수 있고, 전역 `APP_GUARD` 는 그 조회를 하는 `PublicWebhookThrottleGuard`
 * (라우트 가드)보다 먼저 돈다. 그래서 라우트에 `@DeferGlobalThrottle()` 을 붙여 전역 가드를 비키게 하고,
 * 이 가드를 `PublicWebhookThrottleGuard` 뒤에 두어 그 가드가 붙인 `req.__publicWebhookTrigger` 로 판정한다.
 *
 * 한도 설정 · 저장소 · tracker · 키는 전역 가드와 같다(상속). 그래서 채팅이 아닌 웹훅은 전과 같은 버킷을
 * 같은 한도로 쓴다. 판정은 {@link isSignedChatChannelTrigger} 다. 서명 참조가 없는 채팅 채널 트리거(옛
 * 트리거 · 채널 연결 전)는 인바운드 인증기가 서명 검증을 건너뛰어 서명 검증 실패 한도도 걸리지 않는다.
 * 그런 트리거까지 빼면 IP 단위 한도가 하나도 남지 않으므로 전처럼 센다(NERV 질문
 * `01a1d322-7833-756b-a20d-2e3e247411f3` 답 A, 2026-11-13). 공개 웹훅 한도(IP 시작 한도 · 트리거 동시
 * 실행)는 채팅 채널이면 서명 참조와 무관하게 건너뛴다(`PublicWebhookThrottleGuard`).
 *
 * 트리거가 없거나(`null`, 404 로 끝날 요청) 조회에 실패해 첨부되지 않은(`undefined`) 요청은 센다.
 * 판정할 수 없는 요청을 면제하지 않는다.
 *
 * 순서를 바꾼 대가가 둘 있다. 전역 한도를 넘은 요청도 트리거 조회 한 번(`endpointPath` 인덱스)을 거친 뒤
 * 거절된다. 요청마다 늘어나는 DB 왕복은 없다(컨트롤러가 그 조회 결과를 재사용한다). 공개 웹훅은
 * 본문 크기(413) · IP 시작 한도(429)를 전역 429 보다 먼저 받는다.
 */
@Injectable()
export class HookTriggerThrottlerGuard extends UserThrottlerGuard {
  /**
   * 전역 가드와 달리 `@DeferGlobalThrottle()` 메타데이터를 보지 않는다. 이 가드가 그 라우트의 한도를
   * 맡으므로 그 메타데이터로 자신까지 건너뛰면 일반 웹훅의 전역 한도가 사라진다.
   */
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (!isHttpContext(context)) return Promise.resolve(true);
    const req = context.switchToHttp().getRequest<PublicWebhookReqExtension>();
    const trigger = req.__publicWebhookTrigger;
    return Promise.resolve(isSignedChatChannelTrigger(trigger?.config));
  }
}
