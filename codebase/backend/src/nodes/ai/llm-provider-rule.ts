/**
 * AI 노드 3종(ai_agent, text_classifier, information_extractor)이 공유하는
 * "no-llm-provider" warningRule 의 메시지·node type 상수.
 *
 * 캔버스 / handler.validate / execution-engine 사이의 SSOT.
 *
 * **Language SoT**: 본 메시지는 English 가 single source of truth 이며,
 * 프론트엔드 `WARNING_KO` (`codebase/frontend/src/lib/i18n/backend-labels.ts`) 가 ko
 * 번역을 담당한다. 영문 원본을 바꿀 때 반드시 `WARNING_KO` 의 매핑 키도 동시
 * 갱신해 캔버스 배지의 ko 표시가 깨지지 않게 한다.
 *
 * 배경
 * ----
 * 각 노드의 schema 에는 동일한 모양의 declarative rule 이 선언돼 있다:
 *
 *   { id: '<type>:no-llm-provider',
 *     when: '!model && !llmConfigId',
 *     message: AI_NO_LLM_PROVIDER_MESSAGE }
 *
 * 프론트엔드 캔버스(@workflow/node-summary 의 getConfigSummary)는 워크스페이스에
 * 기본 LLM 이 등록돼 있으면 이 경고를 억제한다. backend 는 schema 평가 시점에
 * 워크스페이스 컨텍스트를 모르기 때문에 일단 발사한 뒤, execution-engine 이
 * 노드 실행 직전에 AI 노드라면 메시지를 비교해 워크스페이스 default 가 있을 때
 * 통과시키는 후처리(post-filter)를 한다.
 *
 * 메시지 문자열을 그대로 비교하는 이유는 handler.validate 가 `string[]` 만
 * 반환하기 때문이다. rule id 까지 노출하려면 인터페이스 변경이 필요해 범위가
 * 과도해진다 — 메시지 상수를 공유해 typo / 표현 변형을 막는다.
 */
export const AI_NO_LLM_PROVIDER_MESSAGE =
  'LLM provider or model must be selected (auto-handled by the canvas when a workspace default provider is configured).';

export const AI_LLM_PROVIDER_NODE_TYPES: ReadonlySet<string> = new Set([
  'ai_agent',
  'text_classifier',
  'information_extractor',
]);
