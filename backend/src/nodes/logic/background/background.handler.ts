import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface';

/**
 * Background 노드 핸들러.
 *
 * 핸들러 자체는 단순한 통과 노드 — `main` 포트로 입력을 즉시 흘려보내고 끝낸다.
 * `background` 포트로 연결된 본문 서브그래프의 비동기 실행은 ExecutionEngineService가
 * 핸들러 종료 직후 컨텍스트 스냅샷과 함께 큐로 enqueue 한다 (handler는 그래프나 큐에
 * 대한 지식이 없도록 의도적으로 분리).
 */
export class BackgroundHandler implements NodeHandler {
  validate(): ValidationResult {
    return { valid: true, errors: [] };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    input: unknown,
    config: Record<string, unknown>,
  ): Promise<NodeHandlerOutput> {
    return {
      config,
      output: input,
      port: 'main',
    };
  }
}
