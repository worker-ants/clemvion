import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { LlmModelConfigController } from './llm-model-config.controller';
import { LlmService } from './llm.service';
import { LlmPreviewService } from './llm-preview.service';
import { ROLES_KEY } from '../../common/guards/roles.guard';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { LLMClientFactory } from './llm-client.factory';
import { LlmUsageLogService } from './llm-usage-log.service';
import { ModelConfigService } from '../model-config/model-config.service';
import {
  assertMatchesContract,
  contractForDto,
} from '../../shared/testing/response-contract';
import { ModelTestConnectionResultDto } from '../model-config/dto/responses/model-config-response.dto';

// LLM-구동 부속 엔드포인트(preview / test / list models)는 model-config ↔ llm
// forwardRef 순환을 끊기 위해 ModelConfigController 에서 이 컨트롤러로 이전됐다
// (C-2 cluster 4). 라우트(`model-configs/*`)·동작은 불변 — 위임만 검증한다.
type LlmServiceMethods = Pick<LlmService, 'testConnection' | 'listModels'>;
type PreviewMethods = Pick<LlmPreviewService, 'previewModels'>;

describe('LlmModelConfigController', () => {
  let controller: LlmModelConfigController;
  let mockLlmService: jest.Mocked<LlmServiceMethods>;
  let mockLlmPreviewService: jest.Mocked<PreviewMethods>;

  beforeEach(() => {
    mockLlmService = {
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      listModels: jest.fn().mockResolvedValue([]),
    };
    mockLlmPreviewService = {
      previewModels: jest.fn().mockResolvedValue([]),
    };
    controller = new LlmModelConfigController(
      mockLlmService as unknown as LlmService,
      mockLlmPreviewService as unknown as LlmPreviewService,
    );
  });

  describe('previewModels', () => {
    it('delegates to LlmPreviewService.previewModels and returns result', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmPreviewService.previewModels.mockResolvedValue(models);

      const dto = { provider: 'openai' as const, apiKey: 'sk-xxx' };
      const result = await controller.previewModels(dto as any);

      expect(mockLlmPreviewService.previewModels).toHaveBeenCalledWith(dto);
      expect(result).toBe(models);
    });
  });

  describe('testConnection', () => {
    it('delegates to LlmService.testConnection with id + workspaceId', async () => {
      const outcome = { success: true };
      mockLlmService.testConnection.mockResolvedValue(outcome);

      const result = await controller.testConnection('cfg-1', 'ws-1');

      expect(mockLlmService.testConnection).toHaveBeenCalledWith(
        'cfg-1',
        'ws-1',
      );
      expect(result).toBe(outcome);
    });
  });

  describe('listModels', () => {
    it('delegates to LlmService.listModels passing the optional type filter', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmService.listModels.mockResolvedValue(models);

      const result = await controller.listModels('cfg-1', 'ws-1', 'chat');

      expect(mockLlmService.listModels).toHaveBeenCalledWith('cfg-1', 'ws-1', {
        type: 'chat',
      });
      expect(result).toBe(models);
    });

    it('passes type=undefined when the query param is omitted', async () => {
      await controller.listModels('cfg-1', 'ws-1');
      expect(mockLlmService.listModels).toHaveBeenCalledWith('cfg-1', 'ws-1', {
        type: undefined,
      });
    });
  });

  // ── route prefix preserved (public API unchanged) ──────────────────────────
  it("keeps the 'model-configs' controller route prefix (no API break)", () => {
    const path = Reflect.getMetadata('path', LlmModelConfigController);
    expect(path).toBe('model-configs');
  });

  // ── @Roles guard — preview-models·testConnection editor-gated; listModels Viewer+ ──
  // 인가 계약 SoT: spec/2-navigation/6-config.md §3 + R-7.
  // ROLES_KEY 상수를 import 해 메타데이터 키 매직 스트링('roles') 하드코딩을 피한다.
  describe('@Roles decorator presence (metadata check)', () => {
    it("previewModels method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        LlmModelConfigController.prototype.previewModels,
      );
      expect(roles).toContain('editor');
    });

    it("testConnection method has 'editor' role metadata (billed action-POST -> Editor+)", () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        LlmModelConfigController.prototype.testConnection,
      );
      expect(roles).toContain('editor');
    });

    it('listModels (GET read) has NO role metadata — Viewer+ retained', () => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        LlmModelConfigController.prototype.listModels,
      );
      expect(roles).toBeUndefined();
    });
  });
});

/**
 * `POST /model-configs/:id/test` — **와이어에 실제로 실리는 것**을 본다.
 *
 * ## 왜 서비스 단위 프로브로 부족한가
 *
 * 자매 프로브(`llm.service.spec.ts` — *"실패 응답이 선언 DTO 와 일치한다"*)는 서비스
 * **반환 객체**를 `ModelTestConnectionResultDto` 와 대조한다. 그것이 원래 결함(서비스는
 * `error`, DTO·프런트엔드는 `message`)을 정확히 고정하지만, 서비스 반환과 응답 본문 사이에는
 * 층이 하나 더 있다 — 전역 `TransformInterceptor` 다. 단위 프로브는 그 인터셉터를 **한 번도
 * 태우지 않는다**.
 *
 * 실측으로 지금은 그 층이 키를 건드리지 않는다(`{data}` 로 감싸기만 한다. 컨트롤러도
 * `return this.llmService.testConnection(...)` 순수 위임이고, `ClassSerializerInterceptor` 는
 * 전역 등록돼 있지 않다). 그러니 오늘의 두 층은 같은 것을 말한다 — **그 "오늘" 을 고정하는 게
 * 이 describe 다.** 응답을 다시 만지는 인터셉터·직렬화 옵션이 생기면 프런트엔드가 읽는
 * 이름이 조용히 달라질 수 있고, 단위 프로브는 그것을 원리적으로 못 본다.
 *
 * ## 왜 mock 서비스가 아니라 진짜 서비스인가
 *
 * `LlmService` 를 mock 하면 내가 적은 리터럴을 내가 단언하게 된다 — **필드 이름 축에서
 * vacuous** 다(원래 결함이 바로 그 축이었다). 그래서 진짜 `LlmService` 를 DI 에 넣고 그
 * **의존만** mock 한다(자매 단위 spec 과 같은 4개). 본문의 `message` 는 실제로
 * `sanitizeLlmErrorMessage` 가 만든 문장이다.
 */
describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)', () => {
  let app: INestApplication;
  let clientTestConnection: jest.Mock;

  const CONFIG_UUID = '33333333-4444-4555-8666-777777777777';
  const WORKSPACE_UUID = '88888888-9999-4aaa-8bbb-cccccccccccc';

  // `@WorkspaceId()` 는 헤더·JWT 클레임이 없으면 400 `WORKSPACE_ID_REQUIRED` 를 먼저
  // 던진다 — 헤더로 그 축을 고정해 응답 shape 축만 남긴다.
  const post = () =>
    request(app.getHttpServer())
      .post(`/model-configs/${CONFIG_UUID}/test`)
      .set('X-Workspace-Id', WORKSPACE_UUID);

  beforeAll(async () => {
    clientTestConnection = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [LlmModelConfigController],
      providers: [
        LlmService,
        { provide: LlmPreviewService, useValue: { previewModels: jest.fn() } },
        {
          provide: ModelConfigService,
          useValue: {
            findEntity: jest.fn().mockResolvedValue({
              id: CONFIG_UUID,
              kind: 'chat',
              provider: 'openai',
              defaultModel: 'gpt-4o',
              apiKey: 'encrypted',
            }),
            getDecryptedApiKey: jest.fn().mockReturnValue('sk-decrypted'),
            onConfigInvalidated: jest.fn(),
          },
        },
        {
          provide: LLMClientFactory,
          useValue: {
            create: jest
              .fn()
              .mockReturnValue({ testConnection: clientTestConnection }),
          },
        },
        { provide: LlmUsageLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // 봉투(`{ data }`)는 이 인터셉터가 만든다 — 붙이지 않으면 프런트엔드가 실제로 읽는
    // 자리를 보지 못한다.
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clientTestConnection.mockReset();
  });

  it('실패 시 정규화된 사유가 봉투를 통과해 와이어에 실린다', async () => {
    clientTestConnection.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const res = await post();

    expect(res.status).toBe(200);
    // **이 단언이 원래 버그의 사용자-가시 증상이다.** 종전엔 서비스가 `error` 를 실어
    // 프런트엔드의 `result.message ?? ""` 가 빈 문자열을 집었고, 토스트가 `"연결 실패: "`
    // 로 콜론 뒤가 비어 나갔다.
    expect(res.body?.data?.message).toBe(
      'Connection refused. Please check your endpoint URL.',
    );
    assertMatchesContract(
      res.body.data,
      await contractForDto(ModelTestConnectionResultDto),
    );
    // 와이어 키를 전수로 적는다 — `assertMatchesContract` 는 `message` 가 **optional**
    // 이라 필드가 통째로 사라져도 통과한다(실측: 그 뮤턴트에서 단독 GREEN).
    //
    // **처음 이 자리에 "선언됐는데 안 실리는 키의 거울상까지 닫는다" 고 적었다가
    // 뮤턴트에 반증됐다.** DTO 에 `latencyMs` 를 되살려도 66/66 GREEN 이다 — 당연하다,
    // 이 단언은 **와이어**를 보고 그 뮤턴트는 **선언**을 바꾼다. 그 방향을 볼 수 있는
    // 런타임 검사는 없다(`model-config-response.dto.ts` 의 주석이 적은 대로 grep 뿐).
    //
    // 세 단언이 실제로 가르는 것 (전부 실측):
    // | 뮤턴트 | assertMatchesContract | `.message` 문장 | 키 전수 |
    // |---|---|---|---|
    // | 서비스가 `error` 를 싣는다 (원래 결함) | RED | RED | RED |
    // | 정규화를 벗겨 provider 원문을 흘린다 | GREEN | **RED** | GREEN |
    // | 사유 필드를 아예 안 싣는다 | GREEN | RED | **RED** |
    // | DTO 에 생산자 0건인 키를 선언한다 | GREEN | GREEN | GREEN ← grep 만 |
    expect(Object.keys(res.body.data).sort()).toEqual(['message', 'success']);
  });

  it('[대조군] 성공 시에는 사유 필드 자체가 실리지 않는다', async () => {
    clientTestConnection.mockResolvedValue(true);

    const res = await post();

    expect(res.status).toBe(200);
    // 위 케이스가 "어떤 문자열이든 있으면 통과" 로 무뎌지지 않게 성공 축을 함께 고정한다.
    expect(res.body.data).toEqual({ success: true });
    assertMatchesContract(
      res.body.data,
      await contractForDto(ModelTestConnectionResultDto),
    );
  });
});
