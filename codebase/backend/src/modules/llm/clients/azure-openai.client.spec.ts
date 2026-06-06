import { AzureOpenAIClient } from './azure-openai.client';

// 임의 더미 Azure 엔드포인트 — 테스트는 내부 SDK client 를 stub 으로 교체하므로
// 실제 네트워크 연결은 일어나지 않는다.
const AZURE_ENDPOINT = 'https://example.openai.azure.com/';

// AzureOpenAIClient 는 OpenAIClient 를 상속하며 생성자에서 SDK client 만
// Azure 헤더/쿼리로 재구성한다 — embed 의 e5 prefix 로직은 그대로 물려받는다.
// Azure OpenAI 호환 배포로 e5 계열 모델을 서빙하는 경우 동일 비대칭 경로가
// 적용되어야 하므로, LocalClient 와 동일하게 상속 경로를 회귀 가드로 고정한다.
describe('AzureOpenAIClient.embed (inherited e5 prefix)', () => {
  function makeEmbedClient(defaultModel: string): {
    client: AzureOpenAIClient;
    createMock: jest.Mock;
  } {
    const createMock = jest
      .fn()
      .mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    const client = new AzureOpenAIClient(
      'azure-key',
      defaultModel,
      AZURE_ENDPOINT,
    );
    // @ts-expect-error — 내부 SDK client 를 embeddings stub 으로 교체.
    client.client = { embeddings: { create: createMock } };
    return { client, createMock };
  }

  it('e5 계열 + query → "query: " prefix 적용', async () => {
    const { client, createMock } = makeEmbedClient('multilingual-e5-large');
    await client.embed(['고객 환불'], 'multilingual-e5-large', 'query');
    expect(createMock).toHaveBeenCalledWith({
      model: 'multilingual-e5-large',
      input: ['query: 고객 환불'],
    });
  });

  it('e5 계열 + document → "passage: " prefix 적용', async () => {
    const { client, createMock } = makeEmbedClient('intfloat/e5-base-v2');
    await client.embed(['환불은 7일 이내'], 'intfloat/e5-base-v2', 'document');
    expect(createMock).toHaveBeenCalledWith({
      model: 'intfloat/e5-base-v2',
      input: ['passage: 환불은 7일 이내'],
    });
  });

  it('OpenAI native(text-embedding-3) 는 대칭이라 prefix 없이 원문 그대로 전달', async () => {
    const { client, createMock } = makeEmbedClient('text-embedding-3-large');
    await client.embed(['질문'], 'text-embedding-3-large', 'query');
    expect(createMock).toHaveBeenCalledWith({
      model: 'text-embedding-3-large',
      input: ['질문'],
    });
  });
});
