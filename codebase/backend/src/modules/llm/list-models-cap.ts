import type { Logger } from '@nestjs/common';
import type { ModelInfo } from './interfaces/llm-client.interface';

/**
 * provider `listModels` 응답 모델 수 **방어적 상한**.
 *
 * 정상 provider 응답은 수십 개 수준(OpenAI ~50, Anthropic ~10)이라 실사용에는
 * 닿지 않는다. 목적은 병적(misconfigured/악의적) 응답 — 특히 사용자가 baseUrl 을
 * 지정하는 preview-models 경로(SSRF 가드는 사설망만 차단) — 의 대량 목록으로부터
 * 메모리·페이로드를 보호하는 것이다. 30s timeout·5분 캐시와 동일 층의 방어 동작.
 */
export const MAX_MODEL_LIST_SIZE = 500;

/**
 * provider 모델 목록을 방어적 상한으로 절단한다. 초과 시 **앞 N개만** 남기고
 * (provider 순서 보존 — 재정렬하지 않아 정상 케이스 표시 순서가 바뀌지 않는다)
 * 경고 로그를 남긴다. 응답 계약(`ModelInfo[]`)은 변하지 않는다.
 */
export function capModelList(
  models: ModelInfo[],
  logger?: Logger,
): ModelInfo[] {
  if (models.length <= MAX_MODEL_LIST_SIZE) return models;
  logger?.warn(
    `listModels returned ${models.length} models; capping to ${MAX_MODEL_LIST_SIZE}`,
  );
  return models.slice(0, MAX_MODEL_LIST_SIZE);
}
