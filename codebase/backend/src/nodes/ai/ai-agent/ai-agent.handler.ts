import { Logger } from '@nestjs/common';
import type { AiAgentEndReason } from '@workflow/ai-end-reason';
import {
  ResumableNodeHandler,
  AssertEndReasonDomain,
  NodeHandlerOutput,
  ExecutionContext,
  ValidationResult,
  ResumableMessageSource,
  ResumableMessageOptions,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { LlmService } from '../../../modules/llm/llm.service';
import { AgentToolProvider } from './tool-providers/agent-tool-provider.interface';
import { AiConditionEvaluator } from './ai-condition-evaluator';
import { AiMemoryManager } from './ai-memory-manager';
import { aiAgentNodeMetadata } from './ai-agent.schema';
import { AiTurnExecutor } from './ai-turn-executor';

// form-submit 가드 상수는 turn 실행 엔진(`ai-turn-executor.ts`)으로 이동했다
// (refactor §M-1 3단계). 기존 import 경로(`./ai-agent.handler`)를 쓰는 테스트·
// 외부 소비자가 깨지지 않도록 여기서 그대로 re-export 한다.
export {
  FORM_SUBMITTED_GUIDANCE_MESSAGE,
  FORM_SUBMITTED_MAX_BYTES,
} from './ai-turn-executor';

/**
 * AI Agent 노드 핸들러 — NodeHandler 인터페이스 표면(`execute` / `validate`)과
 * 엔진/information_extractor 공유 계약(`processMultiTurnMessage` polymorphic
 * 시그니처, spec/5-system/4-execution-engine.md §1.3)·엔진 호출 진입점
 * (`endMultiTurnConversation` / `buildMultiTurnFinalOutput`)만 보유하는 얇은
 * facade. 실제 turn 실행(single/multi 루프·tool 실행·출력 조립·thread push)은
 * 무상태 collaborator {@link AiTurnExecutor} 로 **단방향 위임**한다 (refactor
 * 02-architecture §M-1 god-handler 분할 — 1단계 {@link AiConditionEvaluator}
 * #665 · 2단계 {@link AiMemoryManager} #668 · 3단계 {@link AiTurnExecutor}).
 *
 * 핸들러는 세 collaborator 의 **composition root** 다 — 생성자 의존성으로 셋을
 * 조립해 executor 에 주입한다. executor 는 핸들러를 역참조하지 않는다.
 *
 * `ResumableNodeHandler<AiAgentEndReason>` 로 multi-turn 계약을 **자기 종결
 * 도메인**으로 좁혀 구현한다 — 제네릭이 왜 필요한지, `implements` 가 어떤 축을
 * 커버하고 못하는지는 {@link ResumableNodeHandler} 를 SoT 로 참조. 요약만:
 * `implements` 는 `endReason` 파라미터 자체는 못 잠그므로(메서드 파라미터
 * bivariance) 아래 `_endReasonDomainLock`({@link AssertEndReasonDomain})이 잠근다.
 */
export class AiAgentHandler implements ResumableNodeHandler<AiAgentEndReason> {
  metadata = aiAgentNodeMetadata;

  /**
   * 조건(condition) 평가 — 도구 정의·프롬프트 안내문 생성, tool_call 분류, 사유
   * 추출. 핸들러 상태에 의존하지 않는 무상태 collaborator (refactor §M-1 1단계).
   */
  private readonly conditionEvaluator = new AiConditionEvaluator();

  /**
   * 자동 메모리 전략 (`summary_buffer` / `persistent`) 관리 — 전략 해석,
   * LLM-호출-전 동기 주입 (회수·롤링 요약·안정 프리픽스/휘발성 꼬리·물리 압축),
   * 턴 경계 비동기 추출 enqueue. 핸들러 상태에 의존하지 않는 무상태 collaborator
   * (refactor §M-1 2단계). 외부 의존(llm/thread/agent-memory 서비스)은 생성자에서
   * 주입하며, `manual` 전략은 본 매니저를 거치지 않는다 (호출부가 strategy 로 분기).
   */
  private readonly memoryManager: AiMemoryManager;

  /**
   * turn 실행 엔진 — single-turn / multi-turn 첫 진입(park) / multi-turn 재개
   * 루프·tool 실행·turn 종결 출력 조립·ConversationThread push 를 담당하는 무상태
   * collaborator (refactor §M-1 3단계). 핸들러는 본 executor 로만 위임한다.
   */
  private readonly turnExecutor: AiTurnExecutor;

  constructor(
    private readonly llmService: LlmService,
    private readonly toolProviders: AgentToolProvider[] = [],
    /**
     * Optional. When provided, each provider tool execution emits
     * `tool_call_started` / `tool_call_completed` events via the engine's
     * `ExecutionEventEmitter` facade (single emit sink, spec EIA §R10) so the
     * debugging timeline can render pending → success / error transitions live.
     * Test fixtures may omit this — the node runs unchanged otherwise.
     *
     * 인라인 `import()` 타입을 쓰는 이유: `nodes/` 레이어가 `modules/execution-engine/`
     * 의 구체 클래스를 **top-level import 없이 타입으로만** 참조해 레이어 간 import
     * 그래프·잠재 순환을 만들지 않기 위함.
     */
    private readonly eventEmitter?: import('../../../modules/execution-engine/events/execution-event-emitter.service').ExecutionEventEmitter,
    /**
     * Optional. When provided, the node pushes user / assistant turns into the
     * workflow-scoped ConversationThread (single mutation entrypoint per
     * spec/conventions/conversation-thread.md §2.2) and auto-injects the thread
     * on chat calls when `contextScope` is enabled. Test fixtures may omit this;
     * the node then degrades to its original (no-thread) behaviour.
     */
    private readonly conversationThreadService?: import('../../../modules/execution-engine/conversation-thread/conversation-thread.service').ConversationThreadService,
    /**
     * Optional. AI Agent 의 `memoryStrategy: 'persistent'` 전략에서 세션 간 추출
     * 메모리를 회수 (recall) 한다 (spec/5-system/17-agent-memory.md §4).
     * `summary_buffer` / `manual` 전략은 이 서비스를 쓰지 않는다. Test fixtures 는
     * 생략 가능 — 미주입 시 persistent 회수는 graceful 하게 빈 결과로 degrade 한다.
     */
    private readonly agentMemoryService?: import('../../../modules/agent-memory/agent-memory.service').AgentMemoryService,
  ) {
    this.memoryManager = new AiMemoryManager(
      this.llmService,
      this.conversationThreadService,
      this.agentMemoryService,
    );
    this.turnExecutor = new AiTurnExecutor(
      this.llmService,
      this.conditionEvaluator,
      this.memoryManager,
      this.toolProviders,
      this.eventEmitter,
      this.conversationThreadService,
    );
  }

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers no-llm-provider,
    // multi-turn-needs-system-prompt, single-turn-needs-prompt,
    // too-many-conditions, maxTurns numeric guard, per-condition
    // id/label/prompt + reserved-port collision + 2000-char prompt cap.
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const mode = (config.mode as string) || 'single_turn';

    try {
      if (mode === 'multi_turn') {
        return await this.turnExecutor.executeMultiTurn(input, config, context);
      }
      return await this.turnExecutor.executeSingleTurn(input, config, context);
    } finally {
      // Cleanup hook fires on every execute() return — including the
      // multi-turn `waiting_for_input` path. Sessions held by providers
      // (e.g. MCP) are torn down here so the next turn rebuilds them
      // deterministically from config. Cleanup errors are swallowed —
      // they would mask the upstream success/failure that triggered the
      // return.
      await this.cleanupProviders(context.executionId);
    }
  }

  private async cleanupProviders(executionId: string): Promise<void> {
    await Promise.allSettled(
      this.toolProviders.map((p) =>
        p.cleanup
          ? p.cleanup({ executionId }).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              AiAgentHandler.logger.warn(
                `Provider "${p.key}" cleanup failed: ${msg}`,
              );
            })
          : Promise.resolve(),
      ),
    );
  }

  /**
   * Process user message in multi-turn conversation.
   * Called by the execution engine when a user submits a message.
   *
   * 엔진/information_extractor 공유 polymorphic 계약 (spec/5-system/
   * 4-execution-engine.md §1.3) — 시그니처는 핸들러에 잔류하고 본문은 turn 실행
   * 엔진으로 위임한다. provider cleanup(`finally`)은 핸들러가 소유한 단일 sink.
   */
  async processMultiTurnMessage(
    userMessage: string,
    state: Record<string, unknown>,
    options?: ResumableMessageOptions,
  ): Promise<unknown> {
    const stateExecutionId = state.executionId as string | undefined;
    try {
      return await this.turnExecutor.processMultiTurnMessage(
        userMessage,
        state,
        options,
      );
    } finally {
      if (stateExecutionId) {
        await this.cleanupProviders(stateExecutionId);
      }
    }
  }

  /**
   * Engine-facing entry point used when the user ends a conversation or the
   * per-turn timer fires (spec §7.7~7.9). Delegates to the turn-execution
   * engine; kept on the handler because the engine (`ai-turn-orchestrator`)
   * calls it on the handler instance.
   */
  endMultiTurnConversation(
    state: Record<string, unknown>,
    endReason: AiAgentEndReason,
    errorPayload?: { code: string; message: string; details?: unknown },
    failedUserMessage?: string,
    failedUserMessageSource?: ResumableMessageSource,
  ): unknown {
    return this.turnExecutor.endMultiTurnConversation(
      state,
      endReason,
      errorPayload,
      failedUserMessage,
      failedUserMessageSource,
    );
  }

  /**
   * Multi-turn 최종 출력 조립 (spec §7.6~7.9). Delegates to the turn-execution
   * engine; kept on the handler as a public method because the handler spec
   * exercises it directly. 시그니처는 executor 의 동명 메서드에서 그대로 유도해
   * (`Parameters` / `ReturnType`) drift 를 차단한다.
   */
  buildMultiTurnFinalOutput(
    ...args: Parameters<AiTurnExecutor['buildMultiTurnFinalOutput']>
  ): ReturnType<AiTurnExecutor['buildMultiTurnFinalOutput']> {
    return this.turnExecutor.buildMultiTurnFinalOutput(...args);
  }

  private static readonly logger = new Logger('AiAgentHandler');
}

/**
 * 위 `implements` 의 타입 인자(`AiAgentEndReason`)가 **검사되는 주장**이 되도록
 * 고정한다 — 메서드 파라미터 bivariance 때문에 `implements` 만으로는 구현이
 * 도메인을 좁혀도 통과한다 (SoT: `AssertEndReasonDomain`).
 */
const _endReasonDomainLock: AssertEndReasonDomain<
  AiAgentHandler,
  AiAgentEndReason
> = true;
void _endReasonDomainLock;
