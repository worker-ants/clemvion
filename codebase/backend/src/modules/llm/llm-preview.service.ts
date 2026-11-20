import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { isPrivateHost, resolvesToPrivate } from '../../common/utils/ssrf.util';
import { type PreviewModelProvider } from '../model-config/dto/preview-model-list.dto';
import { LLMClientFactory } from './llm-client.factory';
import {
  type LLMClient,
  type ModelInfo,
} from './interfaces/llm-client.interface';
import { sanitizeLlmErrorMessage } from './utils/sanitize-error.util';
import { withTimeout } from './utils/with-timeout.util';
import { capModelList } from './list-models-cap';

const PREVIEW_TIMEOUT_MS = 30_000;

/**
 * 저장되지 않은 폼 자격증명으로 provider 모델 목록을 미리 조회하는 서비스.
 * `LlmService` 의 저장 설정 기반 경로와 관심사·추상화 레벨이 달라 분리.
 * apiKey 는 이 스코프 밖으로 기록·저장되지 않는다 (spec §5.4).
 */
@Injectable()
export class LlmPreviewService {
  private readonly logger = new Logger(LlmPreviewService.name);

  constructor(private readonly clientFactory: LLMClientFactory) {}

  async previewModels(params: {
    provider: PreviewModelProvider;
    apiKey: string;
    baseUrl?: string;
  }): Promise<ModelInfo[]> {
    if (params.provider !== 'local' && !params.apiKey) {
      throw new BadRequestException({
        code: 'LLM_CREDENTIALS_REQUIRED',
        message: 'API key is required for this provider.',
      });
    }
    if (params.baseUrl && params.provider !== 'local') {
      if (isPrivateHost(params.baseUrl)) {
        throw new BadRequestException({
          code: 'MODEL_CONFIG_INVALID',
          message:
            'Private/loopback addresses are only allowed for the local provider.',
        });
      }
      // 도메인이 사설 IP 로 풀리면 막는다. 이 검사 뒤에 DNS 응답이 바뀌는 경우는 클라이언트의 연결 시점
      // 판정(`llm-endpoint-fetch.ts`)이 막는다.
      if (await resolvesToPrivate(params.baseUrl)) {
        throw new BadRequestException({
          code: 'MODEL_CONFIG_INVALID',
          message:
            'Hostname resolves to a private/loopback address; only the local provider may target such hosts.',
        });
      }
    }
    let client: LLMClient;
    try {
      client = this.clientFactory.create({
        provider: params.provider,
        apiKey: params.apiKey,
        defaultModel: '',
        baseUrl: params.baseUrl,
      });
    } catch (err) {
      // Factory errors are defined in llm-client.factory.ts and contain no
      // user-supplied apiKey, so they can surface as-is to help the user
      // (e.g. "Azure OpenAI requires a base URL").
      const raw = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM preview client init failed: ${raw}`);
      throw new BadRequestException({
        code: 'MODEL_CONFIG_INVALID',
        message: raw,
      });
    }
    try {
      const models = await withTimeout(
        (signal) => client.listModels(signal),
        PREVIEW_TIMEOUT_MS,
      );
      return capModelList(models, this.logger);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const sanitized = sanitizeLlmErrorMessage(raw);
      this.logger.warn(`LLM preview models failed: ${sanitized}`);
      throw new BadRequestException({
        code: 'LLM_MODEL_LIST_FAILED',
        message: sanitized,
      });
    }
  }
}
