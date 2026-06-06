import {
  applyEmbeddingInputPrefix,
  resolveEmbeddingInputStrategy,
  resolveGeminiTaskType,
} from './embedding-input-type';

describe('resolveEmbeddingInputStrategy', () => {
  it.each([
    ['multilingual-e5-large', 'e5-prefix'],
    ['intfloat/multilingual-e5-large', 'e5-prefix'],
    ['intfloat/e5-base-v2', 'e5-prefix'],
    ['e5-small', 'e5-prefix'],
    ['E5-LARGE', 'e5-prefix'], // 대소문자 무관
  ])('%s → e5-prefix', (model, expected) => {
    expect(resolveEmbeddingInputStrategy(model)).toBe(expected);
  });

  it.each([
    ['text-embedding-3-small', 'none'], // OpenAI 대칭
    ['text-embedding-3-large', 'none'],
    ['text-embedding-ada-002', 'none'],
    ['text-embedding-004', 'none'], // Gemini 는 taskType 별도 경로
    ['bge-m3', 'none'], // 대칭 — 한국어 추천이지만 prefix 불요
    ['e5-mistral-7b-instruct', 'none'], // instruct 변형은 의도적 제외
    ['multilingual-e5-large-instruct', 'none'], // instruct 변형 제외
    ['some-random-model', 'none'], // 미매칭 안전 기본값
  ])('%s → none', (model, expected) => {
    expect(resolveEmbeddingInputStrategy(model)).toBe(expected);
  });

  it('undefined / null / 빈 문자열 → none', () => {
    expect(resolveEmbeddingInputStrategy(undefined)).toBe('none');
    expect(resolveEmbeddingInputStrategy(null)).toBe('none');
    expect(resolveEmbeddingInputStrategy('')).toBe('none');
  });

  it('"core5-base" 같은 우연 부분일치는 매칭 안 됨(경계 검사)', () => {
    // e5- 앞에 경계(^ 또는 /_-)가 없으면 매칭 안 함.
    expect(resolveEmbeddingInputStrategy('core5-base')).toBe('none');
  });
});

describe('applyEmbeddingInputPrefix', () => {
  it('e5 모델 + query → "query: " 접두사', () => {
    expect(
      applyEmbeddingInputPrefix(['고객 환불 정책'], 'multilingual-e5-large', 'query'),
    ).toEqual(['query: 고객 환불 정책']);
  });

  it('e5 모델 + document → "passage: " 접두사', () => {
    expect(
      applyEmbeddingInputPrefix(['환불은 7일 이내'], 'multilingual-e5-large', 'document'),
    ).toEqual(['passage: 환불은 7일 이내']);
  });

  it('배치 전체에 접두사 적용', () => {
    expect(
      applyEmbeddingInputPrefix(['a', 'b'], 'e5-base', 'query'),
    ).toEqual(['query: a', 'query: b']);
  });

  it('대칭 모델(none)은 입력 그대로 반환', () => {
    const texts = ['hello', 'world'];
    expect(
      applyEmbeddingInputPrefix(texts, 'text-embedding-3-small', 'query'),
    ).toEqual(texts);
  });

  it('model undefined → 입력 그대로', () => {
    expect(applyEmbeddingInputPrefix(['x'], undefined, 'document')).toEqual(['x']);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(applyEmbeddingInputPrefix([], 'e5-large', 'query')).toEqual([]);
  });
});

describe('resolveGeminiTaskType', () => {
  it('query → RETRIEVAL_QUERY', () => {
    expect(resolveGeminiTaskType('query')).toBe('RETRIEVAL_QUERY');
  });

  it('document → RETRIEVAL_DOCUMENT', () => {
    expect(resolveGeminiTaskType('document')).toBe('RETRIEVAL_DOCUMENT');
  });
});
