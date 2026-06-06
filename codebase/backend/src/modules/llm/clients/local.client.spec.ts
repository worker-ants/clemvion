import { LocalClient } from './local.client';

// LocalClient 는 OpenAIClient 를 상속하므로 embed 의 e5 prefix 로직을 그대로
// 물려받는다. self-host(Ollama/vLLM) 로 OpenAI 호환 엔드포인트에 띄운 e5 계열
// 모델이 가장 흔한 실사용 경로라, 상속 경로가 깨지지 않는지 LocalClient 인스턴스로
// 직접 고정한다(상위 OpenAIClient 테스트와 별개의 회귀 가드).
describe('LocalClient.embed (inherited e5 prefix)', () => {
  function makeEmbedClient(defaultModel: string): {
    client: LocalClient;
    createMock: jest.Mock;
  } {
    const createMock = jest
      .fn()
      .mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    const client = new LocalClient(defaultModel, 'http://localhost:1234/v1');
    // @ts-expect-error — 내부 SDK client 를 embeddings stub 으로 교체.
    client.client = { embeddings: { create: createMock } };
    return { client, createMock };
  }

  it('e5 계열 + query → "query: " prefix 적용(self-host 실사용 경로)', async () => {
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

  it('inputType 생략 시 document 기본값(passage)', async () => {
    const { client, createMock } = makeEmbedClient('e5-small');
    await client.embed(['doc'], 'e5-small');
    expect(createMock).toHaveBeenCalledWith({
      model: 'e5-small',
      input: ['passage: doc'],
    });
  });

  it('대칭 모델(bge-m3 등)은 prefix 없이 원문 그대로 전달', async () => {
    const { client, createMock } = makeEmbedClient('bge-m3');
    await client.embed(['질문'], 'bge-m3', 'query');
    expect(createMock).toHaveBeenCalledWith({
      model: 'bge-m3',
      input: ['질문'],
    });
  });
});
