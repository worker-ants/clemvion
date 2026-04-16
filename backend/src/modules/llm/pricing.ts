/**
 * LLM 모델별 토큰 단가(USD per 1K token).
 * 알려진 모델만 등록하고, 미등록 모델은 비용 계산을 생략한다 (cost_usd = NULL).
 * 가격은 프로바이더 공시 기준이며 시간이 지나면 변동될 수 있다.
 */
export interface ModelPricing {
  /** 1,000 input(prompt) 토큰당 USD */
  promptPer1k: number;
  /** 1,000 output(completion) 토큰당 USD */
  completionPer1k: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI (참고: 2025-04 기준 공시 가격, 실제 구독 단가는 다를 수 있음)
  'openai:gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
  'openai:gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'openai:gpt-4-turbo': { promptPer1k: 0.01, completionPer1k: 0.03 },
  'openai:gpt-3.5-turbo': { promptPer1k: 0.0005, completionPer1k: 0.0015 },

  // Anthropic
  'anthropic:claude-opus-4-6': { promptPer1k: 0.015, completionPer1k: 0.075 },
  'anthropic:claude-sonnet-4-6': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'anthropic:claude-haiku-4-5-20251001': {
    promptPer1k: 0.0008,
    completionPer1k: 0.004,
  },

  // Google (Gemini 1.5 / 2.0 계열 예시)
  'google:gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
  'google:gemini-1.5-flash': {
    promptPer1k: 0.000075,
    completionPer1k: 0.0003,
  },
};

/**
 * `provider:model` 키로 단가를 조회한다.
 * 미등록 시 null.
 */
export function getModelPricing(
  provider: string,
  model: string,
): ModelPricing | null {
  const key = `${provider.toLowerCase()}:${model.toLowerCase()}`;
  return PRICING_TABLE[key] ?? null;
}

/**
 * 토큰 수를 USD 비용으로 환산한다. 단가 미등록 시 null.
 */
export function calculateCostUsd(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const pricing = getModelPricing(provider, model);
  if (!pricing) return null;
  const cost =
    (promptTokens / 1000) * pricing.promptPer1k +
    (completionTokens / 1000) * pricing.completionPer1k;
  // 6자리까지 보존
  return Math.round(cost * 1_000_000) / 1_000_000;
}
