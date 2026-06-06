// 임베딩 비대칭 입력(input_type / prefix) 배선.
//
// 일부 임베딩 모델은 query 와 document(passage) 를 서로 다르게 인코딩해야
// 검색 품질이 나온다(asymmetric retrieval). 이 구분을 누락하면 색인은 되지만
// 회수 품질이 조용히 떨어지는 silent bug 가 된다.
//   - e5 계열(multilingual-e5, e5-{small,base,large}): 입력 텍스트 앞에
//     `query: ` / `passage: ` 접두사를 붙인다(텍스트 변형, provider 무관 —
//     OpenAI 호환 엔드포인트로 self-host 되는 경우가 일반적).
//   - Google Gemini(text-embedding-004 등): embedContent 의 taskType 파라미터로
//     RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT 를 전달한다(API 파라미터, 텍스트 불변).
//   - OpenAI text-embedding-3 / ada, bge-m3 등 대칭 모델: 변형 없음('none').
//
// 안전 기본값: 매칭되지 않는 모델은 'none' — 기존 동작을 보존한다. 잘못된
// 접두사를 붙이는 것이 안 붙이는 것보다 위험하므로 잘 알려진 비대칭 모델만
// 보수적으로 화이트리스트한다. `*-instruct` 변형은 입력 포맷이 달라 제외.
//
// ⚠️ 정합성: prefix/taskType 도입 후, 그 이전에 무접두사로 색인된 기존 KB 는
// document 가 prefix 없이 임베딩된 상태다. query 에만 접두사가 붙으면 비대칭이
// 깨지므로 해당 모델을 쓰는 KB 는 재임베딩이 필요하다.
// SoT: spec/5-system/8-embedding-pipeline.md §5·§Rationale.

// 임베딩 대상 텍스트의 역할.
export type EmbedInputType = 'query' | 'document';

// 모델이 요구하는 비대칭 입력 처리 전략(텍스트 접두사 계열).
// Gemini taskType 은 텍스트 변형이 아니라 API 파라미터라 별도 헬퍼로 분리한다.
export type EmbeddingInputStrategy = 'none' | 'e5-prefix';

// e5 계열 식별 — query:/passage: 접두사를 쓰는 잘 알려진 변형만 매칭.
// 매칭: multilingual-e5-large, intfloat/e5-base-v2, e5-small ...
// 경계: 모델 ID 시작 또는 `/`·`_`·`-` 직후에 와야 한다(예: intfloat/ 네임스페이스).
const E5_PREFIX_PATTERN =
  /(?:^|[/_-])(?:multilingual-e5|e5-(?:small|base|large))/i;

export function resolveEmbeddingInputStrategy(
  model?: string | null,
): EmbeddingInputStrategy {
  if (!model) return 'none';
  // instruct 변형(e5-mistral-7b-instruct, multilingual-e5-large-instruct 등)은
  // "Instruct: ...\nQuery: ..." 포맷을 쓰므로 단순 query:/passage: 접두사와
  // 호환되지 않는다 → 보수적으로 제외.
  if (/instruct/i.test(model)) return 'none';
  if (E5_PREFIX_PATTERN.test(model)) return 'e5-prefix';
  return 'none';
}

const E5_PREFIX: Record<EmbedInputType, string> = {
  query: 'query: ',
  document: 'passage: ',
};

// OpenAI 호환 경로(OpenAIClient / 상속 Local·Azure)에서 텍스트 배열에 비대칭
// 접두사를 적용한다. 전략이 'none' 이거나 미지원 모델이면 입력을 그대로 반환.
export function applyEmbeddingInputPrefix(
  texts: string[],
  model: string | undefined,
  inputType: EmbedInputType,
): string[] {
  if (resolveEmbeddingInputStrategy(model) !== 'e5-prefix') return texts;
  const prefix = E5_PREFIX[inputType];
  return texts.map((t) => prefix + t);
}

// Google Gemini embedContent 의 taskType 매핑(검색 retrieval 용).
export function resolveGeminiTaskType(
  inputType: EmbedInputType,
): 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' {
  return inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
}
