import type {
  ChatParams,
  ChatResult,
  LLMClient,
  ModelInfo,
} from '../interfaces/llm-client.interface';

/**
 * **테스트 전용** 결정적 LLM 클라이언트 — `LLM_STUB_MODE=true` (dockerized e2e
 * `docker-compose.e2e.yml` backend-e2e env) 일 때만 `LlmService.createClient` 가
 * 실제 provider 대신 본 stub 을 반환한다. `OAUTH_STUB_MODE` 와 동일한 env-gated
 * 테스트 stub 패턴.
 *
 * 목적: 멀티턴 AI park→재개 e2e(spec/5-system/4-execution-engine.md §4.x turn-park,
 * §7.5 rehydration)가 실제 LLM 호출/키 없이 결정적으로 동작하도록 한다. 마지막 user
 * 메시지를 echo 한 plain-text 응답을 반환하며 **tool call 을 만들지 않으므로**, AI Agent
 * multi-turn 핸들러는 "응답 emit 후 다음 turn 입력 대기(waiting_for_input)" 경로로 가서
 * turn-park 를 그대로 exercise 한다. 대화 종료는 e2e 가 `ai_end_conversation` continuation
 * 으로 구동한다.
 *
 * 프로덕션 경로에는 절대 활성화되지 않는다(env 미설정 시 `createClient` 가 본 stub 을
 * 거치지 않음).
 *
 * ai-review WARNING #6 (2026-07-26) — `execution-park-resume.e2e-spec.ts` 의 "턴
 * 진행 중 Stop" e2e(park 짝 전이 lost-update 회귀 실증)가 **관측 가능한 RUNNING
 * 윈도우**를 필요로 한다. 고정 sleep 으로 타이밍을 맞추지 않는다는 기존 컨벤션
 * (`node-cancellation-propagation.e2e-spec.ts` 의 busy-wait 노드 선례)과 동일하게,
 * user 메시지에 {@link DELAY_MARKER} 접두사(`__e2e_delay_ms:<n> `)가 있으면 그
 * ms 만큼 응답을 지연한다 — e2e 가 실제로 `running` 이 될 때까지 poll 한 뒤 그
 * 지연 구간에 실 HTTP `POST /stop` 을 발사할 수 있게 한다. 마커는 echo 대상에서
 * 제거된다(응답 assertion 을 오염시키지 않도록).
 */
// 매직 넘버 추출 (review I6) — echo 슬라이스 길이 · embedding 차원.
export const STUB_ECHO_MAX_CHARS = 200;
export const STUB_EMBEDDING_DIMS = 3;

/**
 * WARNING #6 (2026-07-26) — e2e 전용 인위적 지연 마커. `<n>` 은 ms, 상한은
 * {@link STUB_MAX_DELAY_MS}(무한 e2e hang 방지 안전장치).
 */
const DELAY_MARKER = /^__e2e_delay_ms:(\d+)\s*/;
export const STUB_MAX_DELAY_MS = 5_000;

export class StubLlmClient implements LLMClient {
  chat(params: ChatParams): Promise<ChatResult> {
    const lastUser = [...params.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const rawContent = lastUser?.content ?? '';
    const delayMatch = rawContent.match(DELAY_MARKER);
    // 마커가 있으면 echo 대상에서 제거 — 응답 assertion 은 실제 메시지 본문만 본다.
    const echoSource = delayMatch
      ? rawContent.slice(delayMatch[0].length)
      : rawContent;
    const echo = echoSource.slice(0, STUB_ECHO_MAX_CHARS);
    const result: ChatResult = {
      content: `[stub] received: ${echo}`,
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      model: params.model || 'stub-model',
      finishReason: 'stop',
    };
    if (!delayMatch) {
      // 메서드는 결정적·동기 본문이라 `async` 없이 `Promise.resolve` 로 인터페이스의
      // Promise 반환 계약만 충족한다 (eslint `require-await` 회피).
      return Promise.resolve(result);
    }
    const delayMs = Math.min(Number(delayMatch[1]), STUB_MAX_DELAY_MS);
    return new Promise((resolve) => setTimeout(() => resolve(result), delayMs));
  }

  embed(texts: string[]): Promise<number[][]> {
    // 결정적 zero 벡터 — embedding 경로 e2e 가 없으므로 형태만 충족.
    return Promise.resolve(
      texts.map(() => Array.from({ length: STUB_EMBEDDING_DIMS }, () => 0)),
    );
  }

  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve([
      { id: 'stub-model', name: 'Stub Model', type: 'chat' },
    ]);
  }

  testConnection(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
