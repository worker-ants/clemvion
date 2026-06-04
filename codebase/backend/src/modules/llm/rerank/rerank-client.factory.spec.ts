import { RerankClientFactory } from './rerank-client.factory';
import { TeiRerankClient } from './clients/tei-rerank.client';
import { CohereRerankClient } from './clients/cohere-rerank.client';

describe('RerankClientFactory', () => {
  let factory: RerankClientFactory;

  beforeEach(() => {
    factory = new RerankClientFactory();
  });

  it('creates a TeiRerankClient for provider=tei', () => {
    const client = factory.create({
      provider: 'tei',
      defaultModel: 'bge-reranker-v2-m3',
      baseUrl: 'http://tei:8080',
    });
    expect(client).toBeInstanceOf(TeiRerankClient);
  });

  it('throws when tei is missing baseUrl', () => {
    expect(() =>
      factory.create({ provider: 'tei', defaultModel: 'm' }),
    ).toThrow('TEI rerank requires a base URL');
  });

  it('creates a CohereRerankClient for provider=cohere', () => {
    const client = factory.create({
      provider: 'cohere',
      apiKey: 'co-key',
      defaultModel: 'rerank-3.5',
    });
    expect(client).toBeInstanceOf(CohereRerankClient);
  });

  it('throws when cohere is missing apiKey', () => {
    expect(() =>
      factory.create({ provider: 'cohere', defaultModel: 'rerank-3.5' }),
    ).toThrow('Cohere rerank requires an API key');
  });

  it('throws for unknown provider', () => {
    expect(() =>
      factory.create({ provider: 'jina', defaultModel: 'm' }),
    ).toThrow('Unsupported rerank provider: jina');
  });
});
