/**
 * AI Agent 가 턴 응답을 만드는 LLM chat 호출의 app-level 타임아웃 (defense-in-depth).
 *
 * 런타임 도구 payload 가드(`tool-payload-budget.ts`)가 도구 정의 팽창發 hang 의
 * **근본 원인**을 막지만, 그 외 사유(네트워크 지연·모델 stall 등)의 무기한 hang 에
 * 대한 백스톱이 없다. `LlmService.chat` 의 `opts.timeoutMs > 0` 이면 `withTimeout`
 * 이 적용된다(자체 AbortController 로 동작 — 노드 abortSignal 소스와 독립).
 *
 * 대상은 턴 응답을 만드는 chat 호출뿐이다. 단일 턴과 멀티턴 재개의 첫 호출 · 도구 루프
 * 호출이 이 값을 받고, 마지막 턴 다시 시도도 재개 경로라 같은 값을 받는다. 롤링 요약
 * (`summary_buffer` · `persistent`)의 요약 호출에는 넘기지 않는다(`agent-memory-injection.ts`).
 *
 * 기준: [AI 에이전트 노드](CLE-NODE-AGENT) REQ-AGENT-054 와 「LLM 호출 타임아웃」 절.
 * 노드 취소와의 관계는 [노드 취소](CLE-EXEC-CANCEL).
 */

/** 턴 응답 chat 호출당 타임아웃(ms) env — `0` 비활성, 그 외 fallback default. */
const AI_AGENT_LLM_CALL_TIMEOUT_MS_DEFAULT = 600000;

/**
 * `AI_AGENT_LLM_CALL_TIMEOUT_MS` — 턴 응답 LLM chat 호출당 타임아웃(ms). 기본 600000(10분).
 *
 * **`0` 은 유효한 "비활성"(타임아웃 없음) 값**이다 — payload 예산 env(`readEnvNumber`
 * 가 0/음수를 fallback 처리)와 **다르다**. 여기서는 운영자가 명시적으로 백스톱을 끌 수
 * 있어야 하므로 `0` 을 그대로 존중한다. 음수·비수치·NaN 만 default 로 방어한다.
 * 매 호출 `process.env` 를 읽어 모듈 리로드 없이 override 가능(테스트 편의).
 *
 * **기본값 근거**: 단일 LLM turn(1 request/response)이 정상적으로 10분을 넘는 경우는
 * 극히 드물어(대형 output + extended thinking 도 대개 수 분), 정상 장기 생성 regression
 * 없이 무기한 hang 만 상한한다. 주요 provider SDK 의 기본 request timeout(~10분)과도
 * 정합. 환경별로 env 로 조정(예: `0` 비활성, 더 긴 값).
 */
export function aiAgentLlmCallTimeoutMs(): number {
  const raw = process.env.AI_AGENT_LLM_CALL_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') {
    return AI_AGENT_LLM_CALL_TIMEOUT_MS_DEFAULT;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0
    ? n
    : AI_AGENT_LLM_CALL_TIMEOUT_MS_DEFAULT;
}
