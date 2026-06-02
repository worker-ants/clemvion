/**
 * HooksController unit test — SUMMARY#9 (testing review)
 *
 * Covers the interactionHttpResponse relay branch that bypasses TransformInterceptor
 * and sends res.json directly. Standard return path is also covered for contrast.
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
    expect(res.set).toHaveBeenCalledWith(
      'Cache-Control',
      expect.stringContaining('max-age'),
    );
    expect(embedConfigService.resolve).toHaveBeenCalledWith('abc');
  });

  it('interactionHttpResponse 있을 때 res.status(200).json(interactionHttpResponse) 직접 전송', async () => {
    const payload = { type: 9, data: { custom_id: 'clemvion_form' } };
    hooksService.handleWebhook.mockResolvedValue({
      executionId: 'exec-1',
      interactionHttpResponse: payload,
    } as unknown as Awaited<ReturnType<HooksService['handleWebhook']>>);

    const res = makeRes();
    const result = await controller.receiveWebhook(
      'abc',
      {},
      {},
      makeReq(),
      res as unknown as import('express').Response,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(payload);
    // receiveWebhook returns undefined (early return) in this path.
    expect(result).toBeUndefined();
  });

  it('interactionHttpResponse 없으면 일반 return (TransformInterceptor 경로)', async () => {
    hooksService.handleWebhook.mockResolvedValue({
      executionId: 'exec-2',
    });

    const res = makeRes();
    const result = await controller.receiveWebhook(
      'abc',
      {},
      {},
      makeReq(),
      res as unknown as import('express').Response,
    );

    // res.json 미호출 — TransformInterceptor 에 위임.
    expect(res.json).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      executionId: 'exec-2',
      message: expect.stringContaining('Webhook'),
    });
  });
});
