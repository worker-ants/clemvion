import { aiAgentLlmCallTimeoutMs } from './llm-call-timeout';

/**
 * AI Agent LLM chat 호출 타임아웃 env 파서 (spec §12.16) 단위.
 * 도구 payload 예산 env(`readEnvNumber`, 0/음수=fallback)와 달리 **0 은 유효한
 * 비활성 값**이라는 차이를 고정한다.
 */
describe('llm-call-timeout — aiAgentLlmCallTimeoutMs', () => {
  const KEY = 'AI_AGENT_LLM_CALL_TIMEOUT_MS';
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env[KEY];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('defaults to 600000 (10min) when unset', () => {
    delete process.env[KEY];
    expect(aiAgentLlmCallTimeoutMs()).toBe(600000);
  });

  it('defaults when empty / whitespace', () => {
    process.env[KEY] = '';
    expect(aiAgentLlmCallTimeoutMs()).toBe(600000);
    process.env[KEY] = '   ';
    expect(aiAgentLlmCallTimeoutMs()).toBe(600000);
  });

  it('honours a positive numeric override', () => {
    process.env[KEY] = '120000';
    expect(aiAgentLlmCallTimeoutMs()).toBe(120000);
  });

  it('treats 0 as a valid "disabled" value (NOT a fallback)', () => {
    // payload 예산 env 와의 핵심 차이 — 0 은 명시적 opt-out(타임아웃 없음).
    process.env[KEY] = '0';
    expect(aiAgentLlmCallTimeoutMs()).toBe(0);
  });

  it('falls back to default for negative / non-numeric / NaN', () => {
    for (const v of ['-1', '-600000', 'abc', 'NaN', 'Infinity']) {
      process.env[KEY] = v;
      expect(aiAgentLlmCallTimeoutMs()).toBe(600000);
    }
  });

  it('reads process.env on each call (no module reload needed)', () => {
    delete process.env[KEY];
    expect(aiAgentLlmCallTimeoutMs()).toBe(600000);
    process.env[KEY] = '5000';
    expect(aiAgentLlmCallTimeoutMs()).toBe(5000);
    process.env[KEY] = '0';
    expect(aiAgentLlmCallTimeoutMs()).toBe(0);
  });
});
