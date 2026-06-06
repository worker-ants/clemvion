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
      applyEmbeddingInputPrefix(
        ['고객 환불 정책'],
        'multilingual-e5-large',
        'query',
      ),
    ).toEqual(['query: 고객 환불 정책']);
  });

  it('e5 모델 + document → "passage: " 접두사', () => {
    expect(
      applyEmbeddingInputPrefix(
        ['환불은 7일 이내'],
        'multilingual-e5-large',
        'document',
      ),
    ).toEqual(['passage: 환불은 7일 이내']);
  });

  it('배치 전체에 접두사 적용', () => {
    expect(applyEmbeddingInputPrefix(['a', 'b'], 'e5-base', 'query')).toEqual([
      'query: a',
      'query: b',
    ]);
  });

  it('대칭 모델(none)은 입력 그대로 반환', () => {
    const texts = ['hello', 'world'];
    expect(
      applyEmbeddingInputPrefix(texts, 'text-embedding-3-small', 'query'),
    ).toEqual(texts);
  });

  it('model undefined → 입력 그대로', () => {
    expect(applyEmbeddingInputPrefix(['x'], undefined, 'document')).toEqual([
      'x',
    ]);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(applyEmbeddingInputPrefix([], 'e5-large', 'query')).toEqual([]);
  });

  // 정책 고정: applyEmbeddingInputPrefix 는 멱등(idempotent)이 아니다 —
  // 이미 prefix 가 붙은 텍스트에 다시 적용하면 prefix 가 누적된다. 의도된
  // 설계로, 함수는 "이번 호출에서 한 번만 적용" 을 전제하며 호출자(embed 경로)가
  // 단 한 번만 호출하는 책임을 진다. 이 테스트는 멱등성을 보장하지 *않는다*는
  // 계약을 문서화/고정해, 향후 dedup 로직이 무심코 추가되거나 호출자가 이중
  // 적용을 가정하지 않도록 한다.
  it('멱등성 없음 — 이미 prefix 가 붙은 입력에 재적용하면 prefix 가 누적된다(정책)', () => {
    const once = applyEmbeddingInputPrefix(
      ['고객 환불'],
      'multilingual-e5-large',
      'query',
    );
    expect(once).toEqual(['query: 고객 환불']);

    const twice = applyEmbeddingInputPrefix(
      once,
      'multilingual-e5-large',
      'query',
    );
    // 멱등이라면 ['query: 고객 환불'] 이어야 하지만, 누적되어 이중 prefix 가 된다.
    expect(twice).toEqual(['query: query: 고객 환불']);
    expect(twice).not.toEqual(once);
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
