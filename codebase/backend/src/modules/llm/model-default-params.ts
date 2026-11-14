import type { ModelConfig } from '../model-config/entities/model-config.entity';
import type { ChatParams } from './interfaces/llm-client.interface';

/** 프로바이더 공통 temperature 범위. 밖의 값은 저장돼 있어도 쓰지 않는다. */
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;

type SamplingParams = Pick<ChatParams, 'temperature' | 'maxTokens'>;

/**
 * 모델 설정의 기본 파라미터(`defaultParams.temperature` · `defaultParams.max_tokens`)를
 * 호출 값이 빈 자리에 채운다(CLE-T-GG3WPZ). 병합 규칙의 단일 출처다.
 *
 * - 우선순위: 호출 쪽 값 > `defaultParams` > 보내지 않음. 호출 쪽 `null` · `undefined` 를
 *   빈 값으로 본다. temperature 0 은 값이다.
 * - 저장 키는 `max_tokens` 다(모델 설정 폼). API 로 `maxTokens` 를 저장한 설정도 읽고,
 *   둘 다 있으면 `max_tokens` 를 쓴다.
 * - temperature 는 0~2 의 유한수, max_tokens 는 양의 정수만 쓴다. 다른 값은 없는 것으로 본다.
 * - Chat 설정만 읽는다. Anthropic 클라이언트는 temperature 를 받아도 보내지 않는다.
 *
 * 적용 여부는 호출 쪽이 `LlmService.chat` · `chatStream` 의 `applyModelDefaults`
 * 옵션으로 고른다. AI 노드 셋(AI 에이전트 · 정보 추출 · 텍스트 분류)과 워크플로우
 * 어시스턴트가 켜고, KB · 메모리 내부 호출은 켜지 않는다. 노드의 디버그 요청 기록
 * (`llmCalls[].requestPayload`)에는 채우기 전 호출 값이 남는다.
 */
export function applyModelDefaultParams<T extends SamplingParams>(
  config: Pick<ModelConfig, 'kind' | 'defaultParams'>,
  params: T,
): T {
  const defaults = readDefaults(config);
  const result: T = { ...params };
  if (params.temperature == null) {
    if (defaults.temperature !== undefined) {
      result.temperature = defaults.temperature;
    } else {
      delete result.temperature;
    }
  }
  if (params.maxTokens == null) {
    if (defaults.maxTokens !== undefined) {
      result.maxTokens = defaults.maxTokens;
    } else {
      delete result.maxTokens;
    }
  }
  return result;
}

function readDefaults(
  config: Pick<ModelConfig, 'kind' | 'defaultParams'>,
): SamplingParams {
  if (config.kind !== 'chat') return {};
  const raw: unknown = config.defaultParams;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const stored = raw as Record<string, unknown>;
  const out: SamplingParams = {};
  if (isTemperature(stored.temperature)) out.temperature = stored.temperature;
  const maxTokens = isMaxTokens(stored.max_tokens)
    ? stored.max_tokens
    : isMaxTokens(stored.maxTokens)
      ? stored.maxTokens
      : undefined;
  if (maxTokens !== undefined) out.maxTokens = maxTokens;
  return out;
}

function isTemperature(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= TEMPERATURE_MIN &&
    value <= TEMPERATURE_MAX
  );
}

function isMaxTokens(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * 기본 파라미터를 채우는 호출이 `LlmService.chat` · `chatStream` 옵션에 펼쳐 넣는 값이다.
 * AI 에이전트 · 텍스트 분류 · 워크플로우 어시스턴트가 쓴다. 정보 추출 핸들러는 같은 값을
 * `applyModelDefaults: true` 리터럴로 넘긴다. KB · 메모리 내부 호출은 쓰지 않는다.
 * 적용 지점은 `applyModelDefaults` 로 grep 하면 모두 나온다.
 */
export const APPLY_MODEL_DEFAULTS = { applyModelDefaults: true } as const;
