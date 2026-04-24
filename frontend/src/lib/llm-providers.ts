/**
 * LLM provider 식별자와 UI 동작 규칙. 백엔드 `PreviewLlmModelsDto` /
 * `CreateLlmConfigDto` 의 `LLM_PROVIDERS` 와 동일한 값을 사용한다.
 *
 * monorepo shared package 이 아직 없으므로 중복 정의. 새 provider 추가 시
 * 반드시 **양쪽을 함께** 수정해야 하며, `__tests__/llm-providers.contract.test.ts`
 * 가 목록 drift 를 컴파일/테스트 타임에 감지한다.
 */
export const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'azure',
  'local',
] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/**
 * Provider 가 미선택된 초기 상태를 `local` 과 동일하게 취급 — API Key 없이도
 * 진행 가능한 상태 (드롭다운이 열리기 전의 disabled 기본값).
 */
export const LOCAL_PROVIDER = 'local' satisfies LlmProvider;

/**
 * baseUrl 이 필수인 provider 집합.
 * - azure: 배포 엔드포인트 URL 이 모델 경로에 포함됨
 * - local: self-hosted 런타임(Ollama/vLLM) URL 이 모든 호출에 필요함
 */
export const PROVIDERS_REQUIRING_BASE_URL: ReadonlySet<string> = new Set<string>([
  'azure',
  LOCAL_PROVIDER,
]);
