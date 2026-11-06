import type { ChannelAuthorizerContext } from './channel-authorizer';

/**
 * 구독 인가 컨텍스트에는 역할 필드가 없다 (CLE-T-7ZYES5, CLE-API-EGRESS 「kb · background 채널」).
 *
 * `kb:` · `background:run:` 인가기는 워크스페이스 소유만 보므로 뷰어도 두 채널을 받는다. 그래서 발행
 * 쪽 wire 값 마스킹(`websocket.service.spec.ts` 「kb · background 채널 값 마스킹」)이 뷰어에게
 * 자격 증명 원문이 가지 않게 막는다. 각 인가기 spec 의 뷰어 구독 테스트는 이 전제에 기댄다.
 *
 * 컨텍스트에 `role` 이 생기면 인가기가 뷰어를 거를 수 있게 되고 위 전제가 바뀐다. 그때 EGRESS 의
 * 수신 인구 서술과 두 인가기 spec 을 함께 고친다. 이 검사는 jest 가 아니라 백엔드 타입체크
 * ratchet(`scripts/check-backend-typecheck-ratchet.py`)이 잡는다. jest 는 타입을 지우므로 검사는
 * 호출하지 않는 함수 안에 두고, `role` 이 생기면 `@ts-expect-error` 가 쓰이지 않는 지시어(TS2578)가 된다.
 */
describe('ChannelAuthorizerContext — 역할 필드 없음 (타입체크 ratchet 이 본다)', () => {
  it('컨텍스트에서 role 을 읽을 수 없다', () => {
    const checks = (ctx: ChannelAuthorizerContext): void => {
      // @ts-expect-error — 컨텍스트에는 role 이 없다
      void ctx.role;
    };
    expect(checks).toBeInstanceOf(Function);
  });
});
