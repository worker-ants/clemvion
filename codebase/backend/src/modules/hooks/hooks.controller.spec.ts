/**
 * HooksController unit test — SUMMARY#9 (testing review)
 *
 * 채팅 채널의 `providerResponse` 를 TransformInterceptor 를 거치지 않고 res 로 직접 보내는 분기와,
 * 그것이 없을 때의 일반 반환 경로를 함께 본다.
 */
import { HooksController } from './hooks.controller';
import { HooksService } from './hooks.service';
import { EmbedConfigService } from './embed-config.service';

describe('HooksController', () => {
  let controller: HooksController;
  let hooksService: jest.Mocked<Pick<HooksService, 'handleWebhook'>>;
  let embedConfigService: jest.Mocked<Pick<EmbedConfigService, 'resolve'>>;

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn(),
    set: jest.fn().mockReturnThis(),
  });

  const makeReq = (extra?: Record<string, unknown>) => ({
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    rawBody: undefined,
    ...extra,
  });

  beforeEach(() => {
    hooksService = {
      handleWebhook: jest.fn(),
    };
    embedConfigService = {
      resolve: jest.fn(),
    };
    controller = new HooksController(
      hooksService as unknown as HooksService,
      embedConfigService as unknown as EmbedConfigService,
    );
  });

  it('getEmbedConfig — allowlist 반환 + Cache-Control 설정', async () => {
    embedConfigService.resolve.mockResolvedValue({
      allowlist: ['https://shop.example.com'],
      enforce: true,
    });
    const res = makeRes();
    const result = await controller.getEmbedConfig(
      'abc',
      res as unknown as import('express').Response,
    );
    expect(result).toEqual({
      allowlist: ['https://shop.example.com'],
      enforce: true,
    });
    // 정확한 값으로 단언 — EMBED_CONFIG_CACHE_SEC 단일 진실이 깨지면(오타·단위 실수) 회귀를 잡는다.
    expect(res.set).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=300',
    );
    expect(embedConfigService.resolve).toHaveBeenCalledWith('abc');
  });

  // 근거: CLE-CHAT-ADAPTER 「인터랙션 기본 응답과 수신 확인」. 응답 형태는 `providerResponse` 하나로
  // 가른다(NERV Task `CLE-T-0JEQRY` · `CLE-T-NMTWSN`).
  describe('채팅 채널 providerResponse', () => {
    const callReceive = (res: ReturnType<typeof makeRes>, ip?: string) =>
      controller.receiveWebhook(
        'abc',
        {},
        {},
        makeReq(ip ? { ip } : undefined),
        res as unknown as import('express').Response,
      );

    it.each([
      ['Discord 모달 열기', { type: 9, data: { custom_id: 'clemvion_form' } }],
      ['Slack url_verification 핸드셰이크', { challenge: 'abc123' }],
      ['Discord PING 핸드셰이크', { type: 1 }],
      [
        'Slack view_submission 오류',
        { response_action: 'errors', errors: { a: 'b' } },
      ],
    ])(
      '%s 본문은 { data } 래핑 없이 200 으로 그대로 보낸다',
      async (_label, body) => {
        hooksService.handleWebhook.mockResolvedValue({
          executionId: 'exec-1',
          providerResponse: { body },
        });

        const res = makeRes();
        const result = await callReceive(res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(body);
        expect(res.end).not.toHaveBeenCalled();
        // res 로 직접 보냈으므로 TransformInterceptor 에 넘길 값이 없다.
        expect(result).toBeUndefined();
      },
    );

    // 근거: CLE-CHAT-SLACK 「인바운드 응답」 — Interactivity 는 3초 안 200 빈 본문. NERV Task `CLE-T-FCBG91`.
    it('body 가 없으면 200 빈 본문으로 답한다', async () => {
      hooksService.handleWebhook.mockResolvedValue({
        executionId: 'ignored',
        providerResponse: {},
      });

      const res = makeRes();
      const result = await callReceive(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledWith();
      expect(res.json).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('body 가 null 이면 빈 본문이 아니라 null JSON 으로 보낸다', async () => {
      hooksService.handleWebhook.mockResolvedValue({
        executionId: 'exec-4',
        providerResponse: { body: null },
      });

      const res = makeRes();
      await callReceive(res);

      expect(res.json).toHaveBeenCalledWith(null);
      expect(res.end).not.toHaveBeenCalled();
    });

    it('providerResponse 가 없으면 202 본문(TransformInterceptor 경로)을 돌려주고 그 키를 싣지 않는다', async () => {
      hooksService.handleWebhook.mockResolvedValue({
        executionId: 'exec-2',
        providerResponse: undefined,
      });

      const res = makeRes();
      const result = await callReceive(res);

      // res.json · res.end 미호출 — TransformInterceptor 에 위임.
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
      expect(result).toEqual({
        executionId: 'exec-2',
        message: 'Webhook received, workflow execution started',
      });
      expect(result).not.toHaveProperty('providerResponse');
    });

    // 근거: NERV Task `CLE-T-CC3GPN` — 서명 실패 한도 키의 IP 는 `req.ip`(trust proxy 적용 값)다.
    it('req.ip 를 handleWebhook 의 다섯 번째 인자로 넘긴다', async () => {
      hooksService.handleWebhook.mockResolvedValue({ executionId: 'exec-5' });

      await callReceive(makeRes(), '203.0.113.7');

      expect(hooksService.handleWebhook).toHaveBeenCalledWith(
        'abc',
        expect.objectContaining({ method: 'POST' }),
        undefined,
        undefined,
        '203.0.113.7',
      );
    });
  });
});
