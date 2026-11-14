import { applyModelDefaultParams } from './model-default-params';
import type { ModelConfig } from '../model-config/entities/model-config.entity';
import type { ChatParams } from './interfaces/llm-client.interface';

/**
 * CLE-T-GG3WPZ — 모델 설정 기본 파라미터(`defaultParams`)를 호출 값이 빈 자리에 채운다.
 * 우선순위: 호출 쪽 값 > `defaultParams` > 보내지 않음.
 */
function config(
  defaultParams: unknown,
  kind: ModelConfig['kind'] = 'chat',
): ModelConfig {
  return { kind, defaultParams } as unknown as ModelConfig;
}

/** 샘플링 값 말고 다른 호출 값도 그대로 지나가는지 보려고 `model` 을 싣는다. */
function callParams(params: Partial<ChatParams>): Partial<ChatParams> {
  return params;
}

describe('applyModelDefaultParams', () => {
  it('fills temperature and max_tokens when the caller leaves them empty', () => {
    expect(
      applyModelDefaultParams(
        config({ temperature: 0.2, max_tokens: 1024 }),
        callParams({ model: 'm' }),
      ),
    ).toEqual({ model: 'm', temperature: 0.2, maxTokens: 1024 });
  });

  it('keeps the caller values over the defaults', () => {
    expect(
      applyModelDefaultParams(config({ temperature: 0.2, max_tokens: 1024 }), {
        temperature: 1.1,
        maxTokens: 50,
      }),
    ).toEqual({ temperature: 1.1, maxTokens: 50 });
  });

  it('keeps a caller temperature of 0 (0 is a value, not empty)', () => {
    expect(
      applyModelDefaultParams(config({ temperature: 0.7 }), { temperature: 0 }),
    ).toEqual({ temperature: 0 });
  });

  it('applies a stored temperature of 0', () => {
    expect(applyModelDefaultParams(config({ temperature: 0 }), {})).toEqual({
      temperature: 0,
    });
  });

  it('treats null caller values as empty', () => {
    expect(
      applyModelDefaultParams(config({ temperature: 0.3, max_tokens: 99 }), {
        temperature: null,
        maxTokens: null,
      } as never),
    ).toEqual({ temperature: 0.3, maxTokens: 99 });
  });

  it('fills each field on its own', () => {
    expect(
      applyModelDefaultParams(config({ temperature: 0.3, max_tokens: 99 }), {
        temperature: 1,
      }),
    ).toEqual({ temperature: 1, maxTokens: 99 });
  });

  it('reads the camelCase maxTokens key when max_tokens is absent', () => {
    expect(applyModelDefaultParams(config({ maxTokens: 2000 }), {})).toEqual({
      maxTokens: 2000,
    });
  });

  it('prefers max_tokens over maxTokens', () => {
    expect(
      applyModelDefaultParams(
        config({ max_tokens: 4096, maxTokens: 2000 }),
        {},
      ),
    ).toEqual({ maxTokens: 4096 });
  });

  it.each([
    ['a string temperature', { temperature: '0.5' }],
    ['a negative temperature', { temperature: -0.1 }],
    ['a temperature above 2', { temperature: 2.5 }],
    ['a NaN temperature', { temperature: Number.NaN }],
    ['an infinite temperature', { temperature: Number.POSITIVE_INFINITY }],
    ['a zero max_tokens', { max_tokens: 0 }],
    ['a negative max_tokens', { max_tokens: -5 }],
    ['a fractional max_tokens', { max_tokens: 10.5 }],
    ['a string max_tokens', { max_tokens: '4096' }],
  ])('ignores %s', (_title, defaults) => {
    expect(applyModelDefaultParams(config(defaults), {})).toEqual({});
  });

  it.each([
    ['null', null],
    ['an array', [0.5]],
    ['a string', 'temperature=0.5'],
    ['undefined', undefined],
  ])('sends nothing when defaultParams is %s', (_title, defaults) => {
    expect(applyModelDefaultParams(config(defaults), {})).toEqual({});
  });

  it('does not read defaultParams of a non-chat config', () => {
    expect(
      applyModelDefaultParams(config({ temperature: 0.5 }, 'embedding'), {}),
    ).toEqual({});
  });

  it('does not mutate the caller params', () => {
    const params = callParams({ model: 'm' });
    applyModelDefaultParams(config({ temperature: 0.5 }), params);
    expect(params).toEqual({ model: 'm' });
  });

  it('does not add keys whose value stays empty', () => {
    const result = applyModelDefaultParams(
      config({}),
      callParams({ model: 'm' }),
    );
    expect(result).toEqual({ model: 'm' });
    expect(result).not.toHaveProperty('temperature');
    expect(result).not.toHaveProperty('maxTokens');
  });
});
