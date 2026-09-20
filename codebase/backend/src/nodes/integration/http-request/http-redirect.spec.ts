import { SsrfBlockedError, assertSafeOutboundUrl } from './http-safety.js';
import { outboundBlockReason } from './http-redirect.js';

// 가드 함수만 mock 하고 `SsrfBlockedError` 는 실물을 남긴다 — 판정을 그 클래스로 가르므로 클래스를 가리면 어떤 오류도
// «판정 아님» 이 되어 차단 테스트가 통과 이유를 잃는다.
jest.mock('./http-safety.js', () => ({
  ...jest.requireActual('./http-safety.js'),
  assertSafeOutboundUrl: jest.fn(),
}));

/**
 * `outboundBlockReason` 은 나가는 URL 을 두 가드로 검사해 «막힌 사유 또는 null» 을 돌려준다. 여기서 보는 것은 그 계약의 경계다 —
 * **차단 판정만 사유가 된다**. 가드가 판정 아닌 오류를 던지면(가드의 고장) 사유로 둔갑시키지 않고 그대로 던져, 호출자가 각자의
 * 실패 경로(노드 `HTTP_TRANSPORT_FAILED` · 연결 테스트 `HTTP_CONNECT_FAILED`)로 분류하게 한다.
 */
describe('outboundBlockReason', () => {
  const mockedUrlGuard = assertSafeOutboundUrl as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('통과하면 null', async () => {
    mockedUrlGuard.mockImplementation((u: string) => new URL(u));
    expect(await outboundBlockReason('https://api.example.com/v1')).toBeNull();
  });

  it('차단 판정은 사유 문자열 — 원문(차단된 host/IP 포함)을 그대로 돌려 서버 로그에만 쓰이게 한다', async () => {
    mockedUrlGuard.mockImplementation(() => {
      throw new SsrfBlockedError('hostname "10.0.0.9" is restricted');
    });

    const reason = await outboundBlockReason('http://10.0.0.9/admin');

    expect(reason).toBe('SSRF_BLOCKED: hostname "10.0.0.9" is restricted');
  });

  it('판정 아닌 오류는 사유로 삼키지 않고 그대로 던진다', async () => {
    mockedUrlGuard.mockImplementation(() => {
      throw new TypeError('hostname.toLowerCase is not a function');
    });

    await expect(
      outboundBlockReason('https://api.example.com/v1'),
    ).rejects.toThrow(TypeError);
  });
});
