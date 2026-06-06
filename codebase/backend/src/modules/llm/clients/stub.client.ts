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
 */
export class StubLlmClient implements LLMClient {
  async chat(params: ChatParams): Promise<ChatResult> {
    const lastUser = [...params.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const echo = (lastUser?.content ?? '').slice(0, 200);
    return {
      content: `[stub] received: ${echo}`,
      toolCalls: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      model: params.model || 'stub-model',
      finishReason: 'stop',
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    // 결정적 3차원 zero 벡터 — embedding 경로 e2e 가 없으므로 형태만 충족.
    return texts.map(() => [0, 0, 0]);
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'stub-model', name: 'Stub Model', type: 'chat' }];
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}
