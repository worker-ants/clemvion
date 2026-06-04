import { Injectable } from '@nestjs/common';
import { RerankClient } from './rerank-client.interface';
import { TeiRerankClient } from './clients/tei-rerank.client';
import { CohereRerankClient } from './clients/cohere-rerank.client';

export interface RerankClientCreateOptions {
  provider: string;
  apiKey?: string;
  defaultModel: string;
  baseUrl?: string;
}

/**
 * RerankConfig 에서 평탄화한 옵션으로 `RerankClient` 구현체를 생성한다
 * (Spec LLM Client §4.1). chat/embedding 의 `LLMClientFactory` 와 분리.
 */
@Injectable()
export class RerankClientFactory {
  create(options: RerankClientCreateOptions): RerankClient {
    switch (options.provider) {
      case 'tei':
        if (!options.baseUrl) {
          throw new Error('TEI rerank requires a base URL');
        }
        return new TeiRerankClient(
          options.baseUrl,
          options.defaultModel,
          options.apiKey,
        );
      case 'cohere':
        if (!options.apiKey) {
          throw new Error('Cohere rerank requires an API key');
        }
        return new CohereRerankClient(
          options.apiKey,
          options.defaultModel,
          options.baseUrl,
        );
      // jina / voyage / local / builtin 은 Planned (Spec LLM Client §4.1).
      default:
        throw new Error(`Unsupported rerank provider: ${options.provider}`);
    }
  }
}
