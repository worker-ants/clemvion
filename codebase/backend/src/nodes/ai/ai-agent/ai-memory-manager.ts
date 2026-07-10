import { Logger } from '@nestjs/common';
import type { ChatMessage } from '../../../modules/llm/interfaces/llm-client.interface';
import type { LlmService, LlmCallContext } from '../../../modules/llm/llm.service';
import {
  DEFAULT_MEMORY_TOKEN_BUDGET,
  DEFAULT_MEMORY_TOP_K,
  DEFAULT_MEMORY_THRESHOLD,
  type MemoryStrategy,
} from './ai-agent.schema';
import {
  appendStablePrefix,
  buildRecallBlock,
  buildSummaryBlock,
  buildSummaryBufferUpdate,
  estimateWorkingMemoryTokens,
  mapTailToChatMessages,
  scheduleMemoryExtraction as sharedScheduleMemoryExtraction,
  selectVolatileTail,
} from '../shared/agent-memory-injection';
import {
  applyCap,
  renderThreadAsSystemText,
} from '../../../shared/conversation-thread/thread-renderer';
import type { ConversationTurn } from '../../../shared/conversation-thread/conversation-thread.types';
import type { ThreadHolder } from '../../../modules/execution-engine/conversation-thread/conversation-thread.service';

/**
 * AI Agent 노드의 자동 메모리 전략 (`summary_buffer` / `persistent`) 관리 —
 * 핸들러에서 분리한 무상태 collaborator (refactor 02-architecture §M-1 2단계,
 * behavior-preserving). 동작 보존 체크리스트는 spec/4-nodes/3-ai/1-ai-agent.md
 * §12.9~12.14 Rationale.
 *
 * 책임: ⓐ 설정된 메모리 전략 해석 (`resolveMemoryStrategy`, 미설정/미지 →
 * `manual` 하위호환), ⓑ LLM-호출-전 동기 메모리 주입 (`injectMemoryContext` —
 * persistent 회수 §6.1 1.3 + 롤링 요약 압축 1.5 + 안정 프리픽스/휘발성 꼬리
 * ordering §11.4 + 멀티턴 누적 messages 물리 압축 §12.14), ⓒ 턴 경계 비동기
 * 추출 enqueue (`scheduleMemoryExtraction` §6.1 2.7, producer 측).
 *
 * 외부 의존(`llmService` 요약 콜·`agentMemoryService` 회수/추출·
 * `conversationThreadService` thread 읽기)은 생성자로 주입받아 클래스 자체는
 * 실행별 가변 상태를 보유하지 않는다 (#665 `AiConditionEvaluator` 선례와 동형).
 * `manual` 전략은 본 매니저를 전혀 거치지 않는다 — 호출부(핸들러 execute)가
 * strategy 로 분기한다 (manual 경로 완전 무변경 = 하위호환 핵심 불변식 §12.9).
 *
 * **레이어 구분**: 본 클래스는 **node 레이어 전용** 오케스트레이터로, 노드 config
 * 해석·LLM-호출-전 컨텍스트 조립·turn 경계 enqueue 만 담당한다. 실제 persistent
 * 메모리 I/O (임베딩 회수·DB 저장·dedup)는 주입된 `AgentMemoryService`
 * (`modules/agent-memory`) 가 수행한다 — 이름이 근접하지만 책임·레이어가 다르다.
 */
export class AiMemoryManager {
  private static readonly logger = new Logger('AiMemoryManager');

  constructor(
    private readonly llmService: LlmService,
    /**
     * Optional. ConversationThread turns 를 읽어 요약 압축 대상·휘발성 꼬리·
     * 멀티턴 물리 압축 경계를 도출한다. 인라인 `import()` 타입으로 참조해
     * `nodes/` → `modules/execution-engine/` 레이어 간 런타임 import 그래프를
     * 만들지 않는다 (핸들러 동일 패턴). 미주입 시 thread 없는 동작으로 degrade.
     */
    private readonly conversationThreadService?: import('../../../modules/execution-engine/conversation-thread/conversation-thread.service').ConversationThreadService,
    /**
     * Optional. `persistent` 전략에서 세션 간 추출 메모리를 회수 (recall) 하고
     * 턴 경계 추출을 enqueue 한다 (spec/5-system/17-agent-memory.md §4). 미주입
     * 시 persistent 회수는 graceful 하게 빈 결과로, 추출 enqueue 는 no-op 으로
     * degrade 한다.
     */
    private readonly agentMemoryService?: import('../../../modules/agent-memory/agent-memory.service').AgentMemoryService,
  ) {}

  /**
   * Resolve the configured memory strategy (spec §1). Unknown / missing →
   * `manual` (하위호환 — 기존 워크플로는 `memoryStrategy` 키가 없다).
   */
  resolveMemoryStrategy(config: Record<string, unknown>): MemoryStrategy {
    const raw = config.memoryStrategy;
    if (raw === 'manual' || raw === 'summary_buffer' || raw === 'persistent') {
      return raw;
    }
    return 'manual';
  }

  /**
   * 자동 메모리 전략 (`summary_buffer` / `persistent`) 의 LLM-호출-전 동기 주입.
   * spec §6.1 단계 1.3 (persistent 회수) + 1.5 (롤링 요약 압축), §11.4 ordering
   * ([5a] 회수 → [5b] 요약 → [6] 휘발성 꼬리).
   *
   * `manual` 전략에서는 호출되지 않는다 — 호출부가 strategy 로 분기한다 (하위호환
   * 핵심 불변식: manual 경로 완전 무변경).
   *
   * 요약/회수 블록은 **system_text 안정 프리픽스** 로 systemPrompt 에 append 하고,
   * 압축되지 않은 최근 원문 turn 만 휘발성 꼬리 (messages 모드면 messages 배열
   * prepend, system_text 모드면 systemPrompt 뒤) 로 둔다.
   *
   * 요약 갱신은 **예산 임계치 도달 시에만** (캐시 보호 불변식 — 재요약 금지) —
   * 갱신된 `runningSummary` / `summarizedUpToSeq` 는 in-memory thread 에 mutate 해
   * 다음 turn (multi-turn resume) 에서 재사용된다.
   */
  async injectMemoryContext(args: {
    strategy: 'summary_buffer' | 'persistent';
    target: ThreadHolder | undefined;
    selfNodeId: string;
    config: Record<string, unknown>;
    messages: ChatMessage[];
    finalSystemPrompt: string;
    llmConfig: import('../../../modules/model-config/entities/model-config.entity').ModelConfig;
    model: string;
    /**
     * 요약 LLM 콜 전용 chat ModelConfig id (config `summaryModelConfigId`). 설정 시
     * 그 config(provider/credential/defaultModel)로 요약 호출한다(노드 main 과 분리,
     * §12.12 재번복). 미설정이면 노드 llmConfig + model 폴백.
     */
    summaryModelConfigId?: string;
    workspaceId: string;
    executionId: string;
    /**
     * [Spec 7-llm-usage §1.3] 롤링 요약 압축 chat 의 llm_usage_log attribution.
     * caller 가 조립해 전달한다 — single-turn/첫 턴은 `context.*`, multi-turn resume
     * 은 재구성 `state.*`(엔진 buildRetryReentryState 주입분). `config` 에서 파생하지
     * 않는다(single-turn 의 `config` 는 사용자 노드 config 라 해당 키가 없음).
     * `buildSummaryBufferUpdate` 와 동일한 `LlmCallContext` 추상화를 그대로 forward.
     */
    llmContext?: LlmCallContext;
    /** 회수 쿼리 텍스트 (현재 사용자 메시지 / 최근 컨텍스트). */
    queryText: string;
    /**
     * Volatile tail 주입 방식:
     *  - `'prepend'` (single-turn): 휘발성 꼬리 turn 을 messages 배열에 prepend.
     *  - `'system-only'` (multi-turn): 꼬리는 이미 누적 `messages` 에 있으므로
     *    안정 프리픽스 (system 메시지) 만 갱신하고 꼬리는 다시 넣지 않는다.
     */
    tailMode: 'prepend' | 'system-only';
  }): Promise<{
    messages: ChatMessage[];
    finalSystemPrompt: string;
    memory: {
      /** 적용된 메모리 전략 (manual/summary_buffer/persistent). */
      strategy: MemoryStrategy;
      /** 이 turn 에 롤링 요약 압축(요약 LLM 콜)이 새로 발생했는지. */
      summarized: boolean;
      /** persistent 회수로 안정 프리픽스에 주입된 fact 수 (그 외 전략은 0). */
      recalledCount: number;
      /** 안정 프리픽스 + 휘발성 꼬리의 working-memory 토큰 추정 사용량. */
      tokenBudgetUsed: number;
    };
    /**
     * 휘발성 꼬리(요약에 커버되지 않은 `seq > summarizedUpToSeq` 구간)에 포함된
     * `ai_user` turn 수. multi-turn 누적 `messages` 물리 압축 시
     * `compactMessagesToTail(messages, keepUserExchanges)` 의 인자로 쓴다 — 끝에서
     * 이 개수만큼의 user 메시지 경계까지만 남기고 요약 커버 exchange 를 drop.
     */
    keepUserExchanges: number;
  }> {
    const tokenBudget =
      (args.config.memoryTokenBudget as number) || DEFAULT_MEMORY_TOKEN_BUDGET;

    // 단일 thread 읽기 (I/O-backed 전환 대비 — W-8): self 포함 전체 thread 를 한
    // 번만 읽어 ⓐ self 제외 turns (요약·휘발성 꼬리, spec §6.2 d.5) 와 ⓑ self 포함
    // 전체 turns (멀티턴 물리 압축 경계) 를 모두 in-memory 파생한다.
    // `getThreadExcludingNode` 는 `getThread().turns.filter(nodeId)` 와 동치이므로
    // 별도 쿼리가 불필요하다 (종전 이중 호출 제거).
    const fullThread =
      this.conversationThreadService && args.target
        ? this.conversationThreadService.getThread(args.target)
        : undefined;
    const fullTurns: readonly ConversationTurn[] = fullThread
      ? fullThread.turns
      : [];
    // self 노드를 제외한 thread turns (중복 방지 — spec §6.2 d.5).
    const turns = fullTurns.filter((t) => t.nodeId !== args.selfNodeId);

    // ── [5a] persistent 회수 (LLM 호출 전 동기) ──
    let recalled: import('../../../modules/agent-memory/agent-memory.service').RecalledMemory[] =
      [];
    if (args.strategy === 'persistent' && this.agentMemoryService) {
      const evaluatedMemoryKey = args.config.memoryKey as
        | string
        | undefined
        | null;
      const scopeKey = this.agentMemoryService.resolveScopeKey(
        evaluatedMemoryKey,
        args.executionId,
      );
      const topK = (args.config.memoryTopK as number) || DEFAULT_MEMORY_TOP_K;
      const threshold =
        args.config.memoryThreshold !== undefined
          ? (args.config.memoryThreshold as number)
          : DEFAULT_MEMORY_THRESHOLD;
      // M2: queryText 가 빈 값(systemPrompt-only run — userPrompt='') 이면
      // recall 이 `!queryText.trim()` early-return 으로 무음 no-op 가 된다.
      // 빈 경우 현재 system 프롬프트로 fallback 해 의미있는 회수 쿼리를 구성한다
      // (저장은 되는데 회수만 0건이 되는 비대칭 방지).
      const queryText = args.queryText?.trim()
        ? args.queryText
        : args.finalSystemPrompt;
      // 회수 임베딩 출처 — 노드 llmConfigId (요약/추출과 동일, scope-freeze §3).
      // recall 은 서비스 내부에서 이미 graceful (빈 배열) 이지만, 회수 실패가
      // 응답 경로를 깨면 안 되므로 여기서도 방어적으로 삼킨다 (defense-in-depth).
      try {
        recalled = await this.agentMemoryService.recall(
          args.workspaceId,
          scopeKey,
          queryText,
          {
            // 노드 config `embeddingModelConfigId`(등록 embedding config) 로 회수
            // 임베딩 (미지정이면 서비스가 워크스페이스 기본 embedding config 로 폴백).
            // 추출(저장) 경로도 같은 config 를 쓰므로 query/저장 임베딩 차원이 일치한다(§3).
            embeddingModelConfigId: args.config.embeddingModelConfigId as
              | string
              | undefined,
          },
          { topK, threshold },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        AiMemoryManager.logger.warn(
          `Agent memory recall failed (graceful): ${message}`,
        );
        recalled = [];
      }
    }

    // ── [5b] 롤링 요약 압축 (임계치 도달 시에만 — 캐시 보호 불변식) ──
    const thread = args.target?.conversationThread;
    const priorSummary = thread?.runningSummary;
    const priorUpToSeq = thread?.summarizedUpToSeq;

    // 요약 전용 config: summaryModelConfigId 설정 시 그 chat config(provider/credential/
    // defaultModel)로 요약 — 노드 main 과 분리(§12.12 재번복). 미설정이면 노드 llmConfig
    // + model 폴백(args.model 자체가 호출부에서 model || defaultModel 로 합성됨).
    let summaryLlmConfig = args.llmConfig;
    let resolvedSummaryModel = args.model;
    if (args.summaryModelConfigId) {
      summaryLlmConfig = await this.llmService.resolveConfig(
        args.summaryModelConfigId,
        args.workspaceId,
      );
      resolvedSummaryModel = summaryLlmConfig.defaultModel;
    }
    const update = await buildSummaryBufferUpdate({
      turns,
      runningSummary: priorSummary,
      summarizedUpToSeq: priorUpToSeq,
      tokenBudget,
      systemPromptText: args.finalSystemPrompt,
      llmConfig: summaryLlmConfig,
      model: resolvedSummaryModel,
      llmService: this.llmService,
      // [Spec 7-llm-usage §1.3] caller 가 조립한 llmContext 를 그대로 forward
      // (single-turn=context.*, multi-turn resume=state.*).
      llmContext: args.llmContext,
    });

    // 갱신된 요약을 in-memory thread 에 반영 (다음 turn 재사용 — Redis 직렬화로
    // 영속되며 신규 DB 컬럼 없음, conversation-thread §1.3·§4). thread 직접 mutate
    // 대신 ConversationThreadService 의 단일 변이 경로를 거친다 (I-7). 요약은
    // turns 가 있어야 발생하고 turns 는 service+target 이 있을 때만 채워지므로
    // (위 단일 getThread), summarized=true 면 service·target 가 존재한다.
    if (update.summarized && this.conversationThreadService && args.target) {
      this.conversationThreadService.updateSummaryState(args.target, {
        runningSummary: update.runningSummary,
        summarizedUpToSeq: update.summarizedUpToSeq,
      });
    }

    // ── 안정 프리픽스 [5a]+[5b] 를 systemPrompt 에 append ──
    const recallBlock = buildRecallBlock(recalled);
    const summaryBlock = buildSummaryBlock(update.runningSummary);
    const newSystemPrompt = appendStablePrefix(
      args.finalSystemPrompt,
      recallBlock,
      summaryBlock,
    );

    // ── [6] 휘발성 꼬리 — 압축되지 않은 최근 원문 turn ──
    const tail = selectVolatileTail(turns, update.summarizedUpToSeq);
    const capped = applyCap(tail);

    // ── [keepUserExchanges 도출] multi-turn 누적 messages 물리 압축 경계 ──
    //
    // 압축 대상은 **에이전트 자신의 누적 messages** (user/assistant/tool) 다.
    // summarization 에 쓰는 `turns` 는 self 노드를 제외하므로 에이전트 자신의
    // ai_user turn 을 포함하지 않는다 — 따라서 휘발성 꼬리(`capped.turns`)의
    // user 수만으로는 messages 압축 경계를 도출할 수 없다. 대신 위에서 한 번 읽은
    // **self 포함 전체 thread**(`fullTurns`)에서 요약에 커버되지 않은
    // (`seq > summarizedUpToSeq`) user-bearing turn 수를 센다 — 이것이 "물리적으로
    // 보존해야 할 최근 exchange 수" 이고, compactMessagesToTail 가 messages 끝에서
    // 그만큼의 user 경계까지만 남긴다.
    const keepUserExchanges = selectVolatileTail(
      fullTurns,
      update.summarizedUpToSeq,
    ).filter(
      (t) => t.source === 'ai_user' || t.source === 'presentation_user',
    ).length;

    const mode =
      (args.config.contextInjectionMode as 'messages' | 'system_text') ??
      'messages';

    // working-memory 토큰 추정 사용량 (안정 프리픽스 + 휘발성 꼬리).
    const tokenBudgetUsed = estimateWorkingMemoryTokens(
      capped.turns,
      newSystemPrompt,
    );

    const memoryMeta = {
      strategy: args.strategy,
      summarized: update.summarized,
      recalledCount: recalled.length,
      tokenBudgetUsed,
    };

    // ── system-only (multi-turn 누적 경로) ──
    // 휘발성 꼬리는 이미 누적 `messages` 에 있으므로 안정 프리픽스 (system
    // 메시지) 만 갱신한다. 꼬리를 다시 prepend 하면 중복된다.
    if (args.tailMode === 'system-only') {
      const newMessages = args.messages.map((m) =>
        m.role === 'system' ? { ...m, content: newSystemPrompt } : m,
      );
      return {
        messages: newMessages,
        finalSystemPrompt: newSystemPrompt,
        memory: memoryMeta,
        keepUserExchanges,
      };
    }

    if (mode === 'system_text') {
      const tailText = renderThreadAsSystemText(capped.turns);
      const withTail = tailText
        ? `${newSystemPrompt}\n\n${tailText}`
        : newSystemPrompt;
      const newMessages = args.messages.map((m) =>
        m.role === 'system' ? { ...m, content: withTail } : m,
      );
      return {
        messages: newMessages,
        finalSystemPrompt: withTail,
        memory: memoryMeta,
        keepUserExchanges,
      };
    }

    // 'messages' 모드 — 안정 프리픽스는 system 메시지에 반영하고, 휘발성 꼬리
    // 만 messages 배열에 prepend (spec §11.4: 최근 원문 turn 만 messages prepend,
    // [5a]/[5b] 는 여전히 system_text 안정 프리픽스).
    const tailMessages = mapTailToChatMessages(capped.turns);
    const systemIdx = args.messages.findIndex((m) => m.role === 'system');
    const newMessages = args.messages.map((m) =>
      m.role === 'system' ? { ...m, content: newSystemPrompt } : m,
    );
    const insertAt = systemIdx >= 0 ? systemIdx + 1 : 0;
    newMessages.splice(insertAt, 0, ...tailMessages);

    return {
      messages: newMessages,
      finalSystemPrompt: newSystemPrompt,
      memory: memoryMeta,
      keepUserExchanges,
    };
  }

  /**
   * 턴 경계 비동기 추출 enqueue (spec/5-system/17-agent-memory.md §3, §6.1 단계
   * 2.7 — producer 측). `persistent` 전략에서만, single-turn 최종 응답 후 /
   * multi-turn 매 turn 종료 후 (= ai_assistant turn push 직후) 에 호출된다.
   *
   * **hot path 비차단**: enqueue (큐 add) 까지만 await — 실제 추출 LLM 콜은
   * processor 에서 일어난다. **격리 invariant**: `getThread` 가
   * 반환하는 readonly turns 를 shallow-copy 한 스냅샷만 payload 에 담아
   * (`cloneThread` 와 동형), 이후 메인 루프의 turn mutation 에 오염되지 않는다.
   *
   * `summary_buffer` / `manual` 전략은 호출되지 않는다 (회귀 금지 불변식 —
   * 호출부가 strategy 로 분기). agentMemoryService 미주입 시 graceful no-op.
   * enqueue 실패는 scheduleExtraction 내부에서 삼켜진다 (대화 계속).
   */
  async scheduleMemoryExtraction(args: {
    strategy: MemoryStrategy;
    target: ThreadHolder | undefined;
    selfNodeId: string;
    config: Record<string, unknown>;
    workspaceId: string;
    executionId: string;
    /**
     * 증분 추출 watermark — 직전 추출이 커버한 마지막 turn 의 seq (멀티턴
     * `_resumeState.lastExtractionTurnSeq`). 이 seq 초과 turn 만 새로 snapshot
     * 한다 (AGM-08). undefined (single-turn / 미설정) 면 전체 turn snapshot.
     */
    lastExtractionTurnSeq?: number;
  }): Promise<number | undefined> {
    // 구조 로직은 공유 헬퍼로 추출 (#484 후속). `selfNodeId` 는 호출부 추적용
    // 으로만 받고 본 추출 경로는 `getThread` 전체 thread 를 snapshot 한다
    // (종전 동작과 동일 — 본 메서드는 selfNodeId 를 읽지 않았다).
    return sharedScheduleMemoryExtraction(
      {
        agentMemoryService: this.agentMemoryService,
        conversationThreadService: this.conversationThreadService,
      },
      {
        strategy: args.strategy,
        target: args.target,
        config: args.config,
        workspaceId: args.workspaceId,
        executionId: args.executionId,
        lastExtractionTurnSeq: args.lastExtractionTurnSeq,
      },
    );
  }
}
