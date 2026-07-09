import { Logger } from '@nestjs/common';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import type { AiTurnEngineDriver } from './engine-driver.interface';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { NodeHandler } from '../../nodes/core/node-handler.interface';
import { ExecutionEventType } from '../websocket/websocket.service';
import {
  buildAiMessageDebugFromResumeState,
  buildConversationConfigFromOutput,
  buildConversationMetaFromResumeState,
} from './ai-conversation-helpers';

// ---------------------------------------------------------------------------
// C-1 step2 — AiTurnOrchestrator 단위 테스트.
//
// AI 멀티턴 lifecycle 이 god-class 엔진에서 본 orchestrator 로 추출됐다. 엔진
// 잔류 메서드는 `EngineDriver`(token ENGINE_DRIVER, useExisting 엔진) 경유로
// 호출되며, 본 spec 은 driver 를 mock 으로 주입해 orchestrator 의 분기·driver
// 호출·이벤트 emit·payload shape 을 격리 검증한다.
//
// 엔진 전체 lifecycle(execute → runExecutionFromQueue → §7.5 rehydration →
// 위임)을 통과하는 통합 시나리오(ai_message emit shape, slow-path dispatch
// W10/W11/W12/button_click)는 엔진 spec 에 남는다 — 엔진의 park/resume 기계가
// orchestrator 로 위임하는 경로를 그대로 가드한다(behavior 보존).
// ---------------------------------------------------------------------------

const workflowId = 'wf-orch';
const executionId = 'exec-orch';

function makeMockDriver(): jest.Mocked<AiTurnEngineDriver> {
  return {
    updateExecutionStatus: jest.fn().mockResolvedValue(true),
    stageDurableResumeSnapshot: jest.fn(),
    buildRetryReentryState: jest
      .fn()
      .mockReturnValue({ resumeState: {}, initialAction: undefined }),
    buildResumeCheckpoint: jest.fn().mockReturnValue(undefined),
    isCheckpointEligibleNodeType: jest.fn().mockReturnValue(false),
    // 실제 엔진과 동일 의미 — context._contextKey ?? executionId.
    contextKeyOf: jest.fn(
      (ctx: { _contextKey?: string; executionId: string }) =>
        ctx._contextKey ?? ctx.executionId,
    ),
    applyPortSelection: jest.fn((o: unknown) => o),
  } as unknown as jest.Mocked<AiTurnEngineDriver>;
}

describe('AiTurnOrchestrator', () => {
  let orchestrator: AiTurnOrchestrator;
  let handlerRegistry: NodeHandlerRegistry;
  let contextService: ExecutionContextService;
  let driver: jest.Mocked<AiTurnEngineDriver>;
  let mockEventEmitter: { emitExecution: jest.Mock; emitNode: jest.Mock };
  let mockNodeExecutionRepo: { save: jest.Mock; findOne: jest.Mock };

  beforeEach(() => {
    handlerRegistry = new NodeHandlerRegistry();
    contextService = new ExecutionContextService();
    driver = makeMockDriver();
    mockEventEmitter = {
      emitExecution: jest.fn().mockResolvedValue(undefined),
      emitNode: jest.fn().mockResolvedValue(undefined),
    };
    mockNodeExecutionRepo = {
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
      findOne: jest.fn().mockResolvedValue(null),
    };

    orchestrator = new AiTurnOrchestrator(
      handlerRegistry,
      contextService,
      mockEventEmitter as never,
      mockNodeExecutionRepo as never,
      driver,
    );
  });

  // W8 (SUMMARY) — logger / method spy 가 후속 테스트로 누출되지 않도록 방어적
  // 복원. 본 describe 의 일부 테스트는 `orchestrator.logger` / contextService 등에
  // jest.spyOn 을 건다 (W10/W11 블록 + 신규 handleAiMessageTurn/emitAiWaitingForInput
  // 테스트). 각 테스트가 개별 mockRestore 를 호출하더라도, 조기 실패 시 복원 누락을
  // 막기 위해 afterEach 에서 전체 복원한다.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(orchestrator).toBeDefined();
  });

  // 추출 seam 회귀 가드 — orchestrator 가 상태 전이를 직접 하지 않고 driver 경유.
  describe('reparkAiResumeTurn — EngineDriver seam', () => {
    type ReparkSubject = {
      reparkAiResumeTurn: (
        savedExecution: unknown,
        context: unknown,
        nodeExec: unknown,
      ) => Promise<void>;
    };

    it('stageDurableResumeSnapshot + updateExecutionStatus(WAITING_FOR_INPUT) 를 driver 로 위임', async () => {
      const savedExecution = {
        id: executionId,
        status: ExecutionStatus.RUNNING,
      };
      const context = contextService.createContext(executionId, workflowId);
      const nodeExec = { id: 'ne-1' };

      await (orchestrator as unknown as ReparkSubject).reparkAiResumeTurn(
        savedExecution,
        context,
        nodeExec,
      );

      expect(driver.stageDurableResumeSnapshot).toHaveBeenCalledTimes(1);
      expect(driver.stageDurableResumeSnapshot).toHaveBeenCalledWith(
        savedExecution,
        context,
      );
      expect(driver.updateExecutionStatus).toHaveBeenCalledWith(
        savedExecution,
        ExecutionStatus.WAITING_FOR_INPUT,
        nodeExec,
      );
    });

    // 06 C-2 — §7.5 원자 claim 이후 nodeExec 는 RUNNING 으로 로드된다. re-park 는
    // 이를 다시 WAITING_FOR_INPUT 으로 되돌려 linkedNodeExec 로 영속해야 다음 cold
    // rehydration 이 성공한다 (누락 시 RUNNING 잔류 → 재개 실패).
    it('claim 후 RUNNING nodeExec 를 WAITING_FOR_INPUT 으로 재설정해 영속', async () => {
      const savedExecution = {
        id: executionId,
        status: ExecutionStatus.RUNNING,
      };
      const context = contextService.createContext(executionId, workflowId);
      const nodeExec = { id: 'ne-1', status: NodeExecutionStatus.RUNNING };

      await (orchestrator as unknown as ReparkSubject).reparkAiResumeTurn(
        savedExecution,
        context,
        nodeExec,
      );

      // RUNNING → WAITING_FOR_INPUT 재설정 후 그 nodeExec 를 linkedNodeExec 로 전달.
      expect(nodeExec.status).toBe(NodeExecutionStatus.WAITING_FOR_INPUT);
      expect(driver.updateExecutionStatus).toHaveBeenCalledWith(
        savedExecution,
        ExecutionStatus.WAITING_FOR_INPUT,
        nodeExec,
      );
    });
  });

  // ai_end_conversation 분기 — handler.endMultiTurnConversation 호출 + driver
  // finalize 경유 (RUNNING 진입 상태에서는 NodeExecution save 만, 상태 전이 skip).
  describe('processAiResumeTurn — ai_end_conversation 종료', () => {
    const aiNode: Partial<Node> = {
      id: 'node-end',
      workflowId,
      type: 'ai_agent',
      category: NodeCategory.AI,
      label: 'Agent',
      config: { mode: 'multi_turn' },
    };

    it('handler.endMultiTurnConversation 호출 + NODE_COMPLETED + EXECUTION_RESUMED emit', async () => {
      const handler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler;
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const context = contextService.createContext(executionId, workflowId);
      // RUNNING 진입 상태 — driveResumeAwaited 가 이미 전이한 상태 모사.
      const savedExecution = {
        id: executionId,
        status: ExecutionStatus.RUNNING,
      } as unknown as Execution;
      const nodeExec = {
        id: 'ne-end',
        nodeId: 'node-end',
        startedAt: new Date(),
      };

      const result = await orchestrator.processAiResumeTurn(
        savedExecution,
        executionId,
        aiNode as Node,
        context,
        nodeExec as never,
        { messages: [], turnCount: 1 },
        { type: 'ai_end_conversation' },
      );

      // 종료 turn → void 반환 (caller 가 그래프 진행).
      expect(result).toBeUndefined();
      expect(
        (handler as unknown as { endMultiTurnConversation: jest.Mock })
          .endMultiTurnConversation,
      ).toHaveBeenCalledTimes(1);
      // RUNNING 진입이므로 상태 전이 skip + NodeExecution save (finalizeAiNode).
      expect(mockNodeExecutionRepo.save).toHaveBeenCalled();
      // NODE_COMPLETED + EXECUTION_RESUMED emit.
      const nodeEvents = mockEventEmitter.emitNode.mock.calls.map((c) => c[2]);
      expect(nodeEvents).toContain('execution.node.completed');
      const execEvents = mockEventEmitter.emitExecution.mock.calls.map(
        (c) => c[1],
      );
      expect(execEvents).toContain('execution.resumed');
    });
  });

  // -------------------------------------------------------------------------
  // W5 (SUMMARY, 엔진 spec 에서 relocate) — processAiResumeTurn 의 방어 가드.
  // exec-park D6 full B3 — 옛 `runAiConversationLoop` 가 제거됐다. unknown
  // action.type 의 `slice(0,64)` 가드와 stale button_click 의 graceful re-park 가
  // 단발 turn 처리기 `processAiResumeTurn` 으로 이관됐다. 본 블록은 그 처리기를
  // 직접 구동해 가드를 검증한다. (driver 는 mock — re-park 의 상태 전이는 no-op.)
  // -------------------------------------------------------------------------
  describe('W5 — processAiResumeTurn 방어 가드 (unknown type slice / stale button_click re-park)', () => {
    const aiDispatchNodes: Partial<Node>[] = [
      {
        id: 'node-agent-dispatch',
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'Agent',
        config: { mode: 'multi_turn' },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    // processAiResumeTurn 을 직접 구동한다. savedExecution 은 재개 드라이브가
    // 이미 RUNNING 으로 전이한 상태를 모사(status=RUNNING)하므로, re-park 의
    // RUNNING→WAITING_FOR_INPUT 전이가 유효하다. 반환값은 re-park 시 PARK_RELEASED
    // (Symbol) 이다.
    const driveResumeTurn = async (
      payload: unknown,
    ): Promise<{ warnSpy: jest.SpyInstance; result: unknown }> => {
      const handler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler;
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const logger = (orchestrator as unknown as { logger: Logger }).logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      const context = contextService.createContext(executionId, workflowId);
      const node = aiDispatchNodes[0];
      const savedExecution = {
        id: executionId,
        workflowId,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
      };

      const result = await orchestrator.processAiResumeTurn(
        savedExecution as never,
        executionId,
        node as Node,
        context,
        null,
        { messages: [], turnCount: 0 },
        payload,
      );
      return { warnSpy, result };
    };

    it('unknown action.type 64자 초과 → 64자로 슬라이싱되어 warn log 에 포함 + re-park(PARK_RELEASED)', async () => {
      const longType = 'a'.repeat(100);
      const { warnSpy, result } = await driveResumeTurn({ type: longType });

      // unknown action.type 은 slice(0,64) 로 잘려 warn 메시지에 포함된다.
      const hasSlicedWarn = warnSpy.mock.calls.some((args) => {
        const msg = String(args[0]);
        return (
          msg.includes('unknown continuation action.type') &&
          msg.includes('a'.repeat(64)) &&
          !msg.includes('a'.repeat(65))
        );
      });
      expect(hasSlicedWarn).toBe(true);
      // 대화 alive — re-park 로 PARK_RELEASED 반환.
      expect(typeof result).toBe('symbol');
      warnSpy.mockRestore();
    });

    it('stale button_click → graceful re-park(PARK_RELEASED) + warn (TypeError 없음, buttonId 형태 무관)', async () => {
      // ai_conversation 대기 중 도달한 button_click 은 상태 변경 없이 re-park.
      // buttonId 가 어떤 형태든(긴 문자열/null/숫자) 처리기는 buttonId 를 읽지
      // 않으므로 TypeError 없이 graceful re-park 한다.
      for (const buttonId of ['a'.repeat(100), null, 42]) {
        const { warnSpy, result } = await driveResumeTurn({
          type: 'button_click',
          buttonId,
        });
        const hasButtonWarn = warnSpy.mock.calls.some((args) =>
          String(args[0]).includes(
            'button_click received during ai_conversation',
          ),
        );
        expect(hasButtonWarn).toBe(true);
        expect(typeof result).toBe('symbol');
        warnSpy.mockRestore();
      }
    });

    // 추가: malformed payload(type 부재/비객체) 도 graceful re-park.
    it('malformed payload(type 부재) → warn + re-park(PARK_RELEASED)', async () => {
      const { warnSpy, result } = await driveResumeTurn({ noType: true });
      const hasWarn = warnSpy.mock.calls.some((args) =>
        String(args[0]).includes('malformed continuation payload'),
      );
      expect(hasWarn).toBe(true);
      expect(typeof result).toBe('symbol');
      warnSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // extractAiTurnErrorPayload — 단위 테스트 (testing-W req W_json). 엔진 spec 에서
  // relocate. C-1 step2 — static 메서드가 AiTurnOrchestrator 로 이동.
  // private static 이므로 `as unknown as` 캐스팅으로 직접 호출.
  // ---------------------------------------------------------------------------
  describe('extractAiTurnErrorPayload', () => {
    type ExtractFn = (err: unknown) => {
      code: string;
      message: string;
      details?: unknown;
    };
    const extract = (): ExtractFn =>
      (
        AiTurnOrchestrator as unknown as {
          extractAiTurnErrorPayload: ExtractFn;
        }
      ).extractAiTurnErrorPayload;

    // spec/conventions/node-output.md Principle 3.2.1 — LLM 계열 노드는
    // details.retryable 필수. 본 PR (2026-05-23) 의 행동 변경.
    it('Error 인스턴스 + 명시 code 를 올바르게 추출한다 (details.retryable 보장)', () => {
      const err = Object.assign(new Error('LLM rate limited'), {
        code: 'LLM_RATE_LIMIT',
      });
      const result = extract()(err);
      expect(result.code).toBe('LLM_RATE_LIMIT');
      expect(result.message).toContain('LLM rate limited');
      // Principle 3.2.1 — LLM_RATE_LIMIT 은 retryable=true
      expect(result.details).toEqual({ retryable: true });
    });

    it('string throw 를 처리한다', () => {
      const result = extract()('something went wrong');
      // 분류 불가 fallback → LLM_CALL_FAILED non-retryable (spec §10 단일 taxonomy)
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect(result.message).toBe('something went wrong');
    });

    it('null/undefined throw 를 처리한다', () => {
      expect(extract()(null).message).toBe('unknown error');
      expect(extract()(undefined).message).toBe('unknown error');
    });

    it('number/boolean/bigint throw 를 처리한다', () => {
      expect(extract()(429).message).toBe('429');
      expect(extract()(true).message).toBe('true');
    });

    it('message 에 429 포함 시 code=LLM_RATE_LIMIT fallback', () => {
      const err = new Error('API returned 429');
      const result = extract()(err);
      expect(result.code).toBe('LLM_RATE_LIMIT');
    });

    it('message 에 rate limit 포함 시 code=LLM_RATE_LIMIT fallback', () => {
      const err = new Error('Rate limit exceeded');
      const result = extract()(err);
      expect(result.code).toBe('LLM_RATE_LIMIT');
    });

    it('network/timeout 메시지 → LLM_CALL_FAILED + retryable=true (spec §10)', () => {
      const err = new Error('Connection timeout');
      const result = extract()(err);
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect((result.details as Record<string, unknown>).retryable).toBe(true);
    });

    it('분류 불가 메시지 → LLM_CALL_FAILED + retryable=false', () => {
      const err = new Error('something unexpected happened');
      const result = extract()(err);
      // spec §10 — 별도 AI_* fallback 없이 LLM_CALL_FAILED non-retryable 로 통합
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect((result.details as Record<string, unknown>).retryable).toBe(false);
    });

    it('details 필드를 포함한 오류를 처리한다 (retryable 자동 분류)', () => {
      const err = Object.assign(new Error('API error'), {
        code: 'LLM_API_ERROR',
        details: { retryAfter: 60, status: 429 },
      });
      const result = extract()(err);
      // spec/4-nodes/3-ai/1-ai-agent.md §10 (L1099) — 미등록 explicit code 는
      // status/network/429/auth 분기에 안 걸리면 classifyLlmError 가 그대로 보존
      // (passthrough, non-retryable). details.status=429 는 extractHttpStatus 가
      // 읽지 않으므로 LLM_RATE_LIMIT 으로 승격되지 않는다 (code 보존 + retryable=false).
      expect(result.code).toBe('LLM_API_ERROR');
      // 기존 details 필드 보존 + Principle 3.2.1 retryable 추가.
      // LLM_API_ERROR 는 RETRYABLE_CODES 에 없어 retryable=false (보수적 default).
      expect(result.details).toEqual({
        retryAfter: 60,
        status: 429,
        retryable: false,
      });
    });

    it('미등록 explicit code 는 정규화 시 그대로 passthrough (spec §10 L1099 — 명시 code 보존·non-retryable)', () => {
      // status / network / 429 / auth 어느 분기에도 안 걸리는 임의 explicit code 는
      // classifyLlmError 의 explicitCode 보존 분기로 떨어진다. 미등록(§10 표 밖) 이라도
      // 정규화 payload 에 code 가 그대로 실리고 retryable 은 보수적 false.
      const err = Object.assign(new Error('vendor quota exhausted'), {
        code: 'LLM_PROVIDER_QUOTA',
      });
      const result = extract()(err);
      expect(result.code).toBe('LLM_PROVIDER_QUOTA');
      expect((result.details as Record<string, unknown>).retryable).toBe(false);
    });

    it('details 에 secret 포함 시 sanitize 가 적용된다', () => {
      const err = Object.assign(new Error('OAuth error'), {
        details: { message: 'Bearer abc123token invalid' },
      });
      const result = extract()(err);
      expect(JSON.stringify(result.details)).not.toContain('abc123token');
      expect(JSON.stringify(result.details)).toContain('***');
    });

    it('details 가 순환참조 객체이면 직렬화 실패 시 fallback 문자열 반환 (req W_json)', () => {
      const circular: Record<string, unknown> = { name: 'circular' };
      circular['self'] = circular;
      const err = Object.assign(new Error('circular error'), {
        details: circular,
      });
      // JSON.stringify(circular) throws — should NOT throw out, must return safe value
      expect(() => extract()(err)).not.toThrow();
      const result = extract()(err);
      // Principle 3.2.1 갱신 후 — fallback `[serialization error]` 가
      // baseDetails 의 `details` 필드로 래핑되고 retryable 이 추가됨.
      expect(result.details).toMatchObject({
        details: '[serialization error]',
        retryable: false,
      });
    });

    it('비-Error 객체 throw 시 JSON.stringify 실패해도 throw 하지 않는다 (req W_json)', () => {
      const nonSerializable: Record<string, unknown> = {};
      nonSerializable['self'] = nonSerializable; // circular
      expect(() => extract()(nonSerializable)).not.toThrow();
      const result = extract()(nonSerializable);
      expect(result.message).toBe('[non-serializable error object]');
      expect(result.code).toBe('LLM_CALL_FAILED');
    });

    // spec/conventions/node-output.md Principle 3.2.1 — LLM 계열 retryable 분류
    describe('retryable 분류 (Principle 3.2.1)', () => {
      it('LLM_RATE_LIMIT → retryable=true', () => {
        const result = extract()(
          Object.assign(new Error('429'), { code: 'LLM_RATE_LIMIT' }),
        );
        expect((result.details as Record<string, unknown>).retryable).toBe(
          true,
        );
      });

      it('분류 불가 fallback → LLM_CALL_FAILED + retryable=false (보수적 default)', () => {
        const result = extract()(new Error('unexpected error'));
        expect(result.code).toBe('LLM_CALL_FAILED');
        expect((result.details as Record<string, unknown>).retryable).toBe(
          false,
        );
      });

      // spec/4-nodes/3-ai/1-ai-agent.md §10 — HTTP status 기반 분류 (스펙이 SoT).
      // 멀티턴 경로는 raw SDK 에러(.status)를 받으므로 status 로 분류한다.
      describe('HTTP status 기반 분류 (§10)', () => {
        const withStatus = (status: number, msg = 'provider error') =>
          Object.assign(new Error(msg), { status });

        it('status 429 → LLM_RATE_LIMIT + retryable=true', () => {
          const r = extract()(withStatus(429, 'too many requests'));
          expect(r.code).toBe('LLM_RATE_LIMIT');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 500 → LLM_CALL_FAILED + retryable=true (5xx)', () => {
          const r = extract()(withStatus(500));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 503 → LLM_CALL_FAILED + retryable=true (5xx)', () => {
          const r = extract()(withStatus(503));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 401 → LLM_CALL_FAILED + retryable=false (auth)', () => {
          const r = extract()(withStatus(401, 'unauthorized'));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(false);
        });

        it('status 403 → LLM_CALL_FAILED + retryable=false (auth)', () => {
          const r = extract()(withStatus(403, 'forbidden'));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(false);
        });

        it('err.response.status 502 fallback → LLM_CALL_FAILED + retryable=true', () => {
          const r = extract()(
            Object.assign(new Error('bad gateway'), {
              response: { status: 502 },
            }),
          );
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('errno ECONNRESET → LLM_CALL_FAILED + retryable=true (network)', () => {
          const r = extract()(
            Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
          );
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('레거시/미분류 명시 코드(LLM_CONNECTION_ERROR) 입력 시 LLM_CALL_FAILED 로 정규화 + retryable=true', () => {
          const r = extract()(
            Object.assign(new Error('network down'), {
              code: 'LLM_CONNECTION_ERROR',
            }),
          );
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 400 (bad request, 비-auth 4xx) → 비재시도 fallback', () => {
          const r = extract()(withStatus(400, 'bad request'));
          expect((r.details as Record<string, unknown>).retryable).toBe(false);
        });
      });

      it('LLM_RATE_LIMIT + Retry-After 헤더 → retryAfterSec 추출 (초 단위)', () => {
        const err = Object.assign(new Error('429'), {
          code: 'LLM_RATE_LIMIT',
          headers: { 'retry-after': '30' }, // 초 단위 RFC delta-seconds
        });
        const result = extract()(err);
        const details = result.details as Record<string, unknown>;
        expect(details.retryable).toBe(true);
        expect(details.retryAfterSec).toBe(30);
      });

      it('retryable=false 면 retryAfterSec 미동봉 (invariant)', () => {
        const err = Object.assign(new Error('parse fail'), {
          code: 'LLM_RESPONSE_INVALID',
          headers: { 'retry-after': '30' },
        });
        const result = extract()(err);
        const details = result.details as Record<string, unknown>;
        expect(details.retryable).toBe(false);
        expect(details.retryAfterSec).toBeUndefined();
      });
    });
  });
  // -------------------------------------------------------------------------
  // W1 (SUMMARY) — handleAiMessageTurn 직접 단위 테스트. private 메서드이므로
  // `as unknown as` 캐스팅으로 직접 호출하고, EngineDriver / contextService /
  // nodeExecutionRepo 를 mock 으로 격리해 4개 미커버 분기를 가드한다. 어서션은
  // 현재 구현 본문(메서드 ~L516-860)의 실제 동작을 그대로 캡처한다.
  // -------------------------------------------------------------------------
  describe('handleAiMessageTurn — 직접 단위 테스트 (W1)', () => {
    type HandleAiMessageTurn = (
      executionId: string,
      contextKey: string,
      node: Node,
      message: string,
      resumeState: Record<string, unknown>,
      nodeExec: unknown,
      source?: string,
    ) => Promise<{
      resumeState: Record<string, unknown>;
      ended: boolean;
      finalStatus?: 'FAILED';
    }>;

    const aiNode: Partial<Node> = {
      id: 'node-turn',
      workflowId,
      type: 'ai_agent',
      category: NodeCategory.AI,
      label: 'Agent',
      config: { mode: 'multi_turn' },
    };

    /** waiting_for_input 을 반환하는 resumable handler 를 등록한다. */
    const registerWaitingHandler = (): jest.Mock => {
      const processMultiTurnMessage = jest.fn().mockResolvedValue({
        config: { mode: 'multi_turn' },
        output: { result: { message: 'hi', messages: [], turnCount: 1 } },
        meta: {},
        status: 'waiting_for_input',
        _resumeState: { messages: [], turnCount: 1, model: 'gpt' },
      });
      const handler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage,
        endMultiTurnConversation: jest.fn(),
      } as unknown as NodeHandler;
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });
      return processMultiTurnMessage;
    };

    const invoke = (
      contextKey: string,
      nodeExec: unknown,
      source?: string,
    ): Promise<{
      resumeState: Record<string, unknown>;
      ended: boolean;
      finalStatus?: 'FAILED';
    }> =>
      (
        orchestrator as unknown as { handleAiMessageTurn: HandleAiMessageTurn }
      ).handleAiMessageTurn(
        executionId,
        contextKey,
        aiNode as Node,
        'user message',
        { messages: [], turnCount: 0 },
        nodeExec,
        source,
      );

    // (a) handler 가 waiting 을 반환했는데 await 도중 ExecutionContext 가 사라진
    //     경우 — throw 없이 graceful exit { ended:true, finalStatus:'FAILED' } 반환.
    it('(a) waiting 반환 + ExecutionContext 부재 → warn + { ended:true, finalStatus:"FAILED" } graceful exit', async () => {
      registerWaitingHandler();
      const logger = (orchestrator as unknown as { logger: Logger }).logger;
      const warnSpy = jest.spyOn(logger, 'warn').mockReturnValue(undefined);

      // contextKey 에 해당하는 context 를 생성하지 않음 → getContext === undefined.
      const result = await invoke('missing-key', { id: 'ne-a' });

      expect(result).toEqual({
        resumeState: { messages: [], turnCount: 0 },
        ended: true,
        finalStatus: 'FAILED',
      });
      // graceful no-op 경로 — 상태 전이 / NodeExecution save / AI_MESSAGE emit 없음.
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
      expect(driver.updateExecutionStatus).not.toHaveBeenCalled();
      const aiMessageEmitted = mockEventEmitter.emitExecution.mock.calls.some(
        (c) => c[1] === ExecutionEventType.AI_MESSAGE,
      );
      expect(aiMessageEmitted).toBe(false);
      // 진단 warn 발화.
      expect(
        warnSpy.mock.calls.some((args) =>
          String(args[0]).includes('ExecutionContext absent on LLM-resume'),
        ),
      ).toBe(true);
    });

    // (b) waiting 분기에서 nodeExec === null → DB persist 를 skip 하고 warn 후
    //     계속 진행 ({ ended:false }). context 는 존재해야 (a) 가드를 통과한다.
    it('(b) waiting 반환 + nodeExec=null → DB persist skip + warn, { ended:false } 로 계속 진행', async () => {
      registerWaitingHandler();
      contextService.createContext(executionId, workflowId);
      const logger = (orchestrator as unknown as { logger: Logger }).logger;
      const warnSpy = jest.spyOn(logger, 'warn').mockReturnValue(undefined);

      const result = await invoke(executionId, null);

      expect(result.ended).toBe(false);
      // nodeExec 가 없으므로 repository.save 는 호출되지 않는다.
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
      // 다음 turn 을 위한 AI_MESSAGE + WAITING_FOR_INPUT 는 정상 emit.
      const emittedTypes = mockEventEmitter.emitExecution.mock.calls.map(
        (c) => c[1],
      );
      expect(emittedTypes).toContain(ExecutionEventType.AI_MESSAGE);
      expect(emittedTypes).toContain(
        ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      );
      expect(
        warnSpy.mock.calls.some((args) =>
          String(args[0]).includes('nodeExec missing'),
        ),
      ).toBe(true);
    });

    // (b2) AI_MESSAGE 공개 표면(SSE·webhook·Chat Channel) egress secret 마스킹 (EIA §R17).
    it('(b2) AI_MESSAGE emit 의 message·messages secret 은 egress 마스킹 (EIA §R17)', async () => {
      const processMultiTurnMessage = jest.fn().mockResolvedValue({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            message: 'reply Authorization: Bearer sk-AIMSG-LEAK-1',
            messages: [
              { role: 'assistant', content: 'note api_key=AKIA-AIMSG-2' },
            ],
            turnCount: 1,
          },
        },
        meta: {},
        status: 'waiting_for_input',
        _resumeState: { messages: [], turnCount: 1, model: 'gpt' },
      });
      handlerRegistry.register(
        'ai_agent',
        {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(),
          processMultiTurnMessage,
          endMultiTurnConversation: jest.fn(),
        } as unknown as NodeHandler,
        { kind: 'blocking', interaction: 'ai_conversation' },
      );
      contextService.createContext(executionId, workflowId);

      await invoke(executionId, null);

      const call = mockEventEmitter.emitExecution.mock.calls.find(
        (c) => c[1] === ExecutionEventType.AI_MESSAGE,
      );
      const payload = call?.[2] as {
        message: string;
        messages: unknown;
      };
      expect(payload.message).not.toContain('sk-AIMSG-LEAK-1');
      expect(payload.message).toContain('***');
      expect(JSON.stringify(payload.messages)).not.toContain('AKIA-AIMSG-2');
      expect(JSON.stringify(payload.messages)).toContain('***');
    });

    // (b3) terminal branch(정상 turn 종료 emit)의 message/messages/presentations 마스킹.
    it('(b3) 종료 turn AI_MESSAGE emit 의 message·messages·presentations secret 마스킹 (terminal branch)', async () => {
      const processMultiTurnMessage = jest.fn().mockResolvedValue({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            response: 'final Authorization: Bearer sk-TERM-LEAK-1',
            messages: [
              {
                role: 'assistant',
                content: 'done',
                toolCalls: [
                  {
                    id: 'tc',
                    name: 'http',
                    arguments: '{"api_key":"AKIA-TERM-ARG"}',
                  },
                ],
              },
            ],
            presentations: [
              {
                type: 'table',
                payload: { rows: [['h', 'Bearer sk-TERM-PRES-3']] },
              },
            ],
            turnCount: 2,
          },
        },
        meta: { turnDebug: [] },
        status: 'ended',
        port: 'ended',
        _resumeState: { messages: [], turnCount: 2, model: 'gpt' },
      });
      handlerRegistry.register(
        'ai_agent',
        {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(),
          processMultiTurnMessage,
          endMultiTurnConversation: jest.fn(),
        } as unknown as NodeHandler,
        { kind: 'blocking', interaction: 'ai_conversation' },
      );
      contextService.createContext(executionId, workflowId);

      await invoke(executionId, { id: 'ne-term', startedAt: new Date() });

      const call = mockEventEmitter.emitExecution.mock.calls.find(
        (c) => c[1] === ExecutionEventType.AI_MESSAGE,
      );
      expect(call).toBeDefined();
      const payload = call?.[2] as { message: string };
      const blob = JSON.stringify(call?.[2]);
      expect(payload.message).not.toContain('sk-TERM-LEAK-1');
      expect(blob).not.toContain('AKIA-TERM-ARG');
      expect(blob).not.toContain('sk-TERM-PRES-3');
      expect(blob).toContain('***');
      // messages[].toolCalls[].arguments JSON 은 깨지지 않아야 한다.
      const msgs = (
        call?.[2] as {
          messages: Array<{ toolCalls?: Array<{ arguments: string }> }>;
        }
      ).messages;
      const argStr = msgs[0]?.toolCalls?.[0]?.arguments;
      if (argStr) expect(() => JSON.parse(argStr)).not.toThrow();
    });

    // (c) nodeExecutionRepository.save 가 throw → error 로깅 후 recover, turn 은
    //     계속 진행 ({ ended:false }) 하고 후속 emit 도 정상 수행.
    it('(c) waiting 반환 + nodeExecutionRepository.save throw → error 로깅 후 recover, { ended:false }', async () => {
      registerWaitingHandler();
      contextService.createContext(executionId, workflowId);
      mockNodeExecutionRepo.save.mockRejectedValueOnce(new Error('db down'));
      const logger = (orchestrator as unknown as { logger: Logger }).logger;
      const errorSpy = jest.spyOn(logger, 'error').mockReturnValue(undefined);

      const result = await invoke(executionId, { id: 'ne-c', startedAt: null });

      // save 가 throw 해도 메서드는 rethrow 하지 않고 진행한다.
      expect(result.ended).toBe(false);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledTimes(1);
      expect(
        errorSpy.mock.calls.some((args) =>
          String(args[0]).includes(
            'failed to persist NodeExecution.outputData',
          ),
        ),
      ).toBe(true);
      // recover 후 AI_MESSAGE emit 정상.
      const emittedTypes = mockEventEmitter.emitExecution.mock.calls.map(
        (c) => c[1],
      );
      expect(emittedTypes).toContain(ExecutionEventType.AI_MESSAGE);
    });

    // (d) source === 'form_submitted' → userMessageSignalApplies(false) 이므로
    //     USER_MESSAGE 라이브 신호를 emit 하지 않고, handler 에 source 를 그대로
    //     전달한다 (§6.2 step 2.c.bypass).
    it('(d) source="form_submitted" → USER_MESSAGE 신호 미발화 + handler 에 source 전달', async () => {
      const processMultiTurnMessage = registerWaitingHandler();
      contextService.createContext(executionId, workflowId);

      await invoke(executionId, { id: 'ne-d' }, 'form_submitted');

      // form_submitted 는 라이브 USER_MESSAGE 신호를 발화하지 않는다.
      const userMessageEmitted = mockEventEmitter.emitExecution.mock.calls.some(
        (c) => c[1] === ExecutionEventType.USER_MESSAGE,
      );
      expect(userMessageEmitted).toBe(false);
      // 그러나 handler 에는 source 가 결정적으로 전달된다.
      expect(processMultiTurnMessage).toHaveBeenCalledWith(
        'user message',
        expect.any(Object),
        { source: 'form_submitted' },
      );
    });

    // 대조군 — source='ai_message'(기본) 일 때는 USER_MESSAGE 신호를 발화한다.
    it('대조: source="ai_message" → USER_MESSAGE 신호 발화', async () => {
      registerWaitingHandler();
      contextService.createContext(executionId, workflowId);

      await invoke(executionId, { id: 'ne-e' }, 'ai_message');

      const userMessageEmitted = mockEventEmitter.emitExecution.mock.calls.some(
        (c) => c[1] === ExecutionEventType.USER_MESSAGE,
      );
      expect(userMessageEmitted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // W2 (SUMMARY) — emitAiWaitingForInput 직접 단위 테스트. private 메서드이므로
  // `as unknown as` 캐스팅으로 호출하고, ai_form_render 분기 / checkpoint 조건부
  // 영속 / nodeExec=null graceful pass-through 를 가드한다. 어서션은 현재 구현
  // 본문(메서드 ~L344-476)의 실제 동작을 그대로 캡처한다.
  // -------------------------------------------------------------------------
  describe('emitAiWaitingForInput — 직접 단위 테스트 (W2)', () => {
    type EmitAiWaitingForInput = (
      savedExecution: unknown,
      executionId: string,
      node: Node,
      context: unknown,
      nodeExec: unknown,
      nodeOutput: Record<string, unknown>,
      resumeState: Record<string, unknown>,
    ) => Promise<void>;

    const aiNode: Partial<Node> = {
      id: 'node-wait',
      workflowId,
      type: 'ai_agent',
      category: NodeCategory.AI,
      label: 'Agent',
      config: { mode: 'multi_turn' },
    };

    const invoke = (
      context: { structuredOutputCache: Record<string, unknown> } & Record<
        string,
        unknown
      >,
      nodeExec: unknown,
      resumeState: Record<string, unknown>,
    ): Promise<void> =>
      (
        orchestrator as unknown as {
          emitAiWaitingForInput: EmitAiWaitingForInput;
        }
      ).emitAiWaitingForInput(
        { id: executionId, status: ExecutionStatus.RUNNING },
        executionId,
        aiNode as Node,
        context,
        nodeExec,
        {},
        resumeState,
      );

    // ai_form_render 분기 — structuredOutputCache.meta.interactionType ==
    // 'ai_form_render' 이고 resumeState.pendingFormToolCall 이 있으면, emit 의
    // top-level interactionType 과 conversationConfig.pendingFormToolCall 에
    // 반영된다.
    it('ai_form_render 분기 — pendingFormToolCall 동봉 + interactionType="ai_form_render"', async () => {
      const context = contextService.createContext(executionId, workflowId);
      const pendingFormToolCall = {
        toolCallId: 'tc-1',
        formConfig: { fields: [] },
      };
      context.structuredOutputCache[aiNode.id as string] = {
        config: { mode: 'multi_turn' },
        output: { result: { message: 'fill the form', messages: [] } },
        meta: { interactionType: 'ai_form_render' },
      } as never;

      await invoke(
        context as never,
        { id: 'ne-form' },
        { pendingFormToolCall, messages: [], turnCount: 1 },
      );

      const waitingCall = mockEventEmitter.emitExecution.mock.calls.find(
        (c) => c[1] === ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      );
      expect(waitingCall).toBeDefined();
      const payload = waitingCall![2] as {
        interactionType: string;
        nodeOutput: {
          interactionType: string;
          conversationConfig: { pendingFormToolCall?: unknown };
        };
      };
      expect(payload.interactionType).toBe('ai_form_render');
      expect(payload.nodeOutput.interactionType).toBe('ai_form_render');
      expect(payload.nodeOutput.conversationConfig.pendingFormToolCall).toEqual(
        pendingFormToolCall,
      );
    });

    // checkpoint 조건부 영속 — checkpoint-ineligible 노드 타입이면
    // buildResumeCheckpoint 를 호출하지 않고 _resumeCheckpoint 도 set 하지 않는다.
    // (driver.isCheckpointEligibleNodeType mock 기본값 false).
    it('checkpoint 미대상 노드 타입 → buildResumeCheckpoint 미호출 + _resumeCheckpoint 미설정 + _resumeState strip', async () => {
      const context = contextService.createContext(executionId, workflowId);
      context.structuredOutputCache[aiNode.id as string] = {
        config: {},
        output: { result: { message: 'hi', messages: [] } },
        meta: {},
        _resumeState: { secret: 'x' },
      } as never;
      const nodeExec: { id: string; outputData?: Record<string, unknown> } = {
        id: 'ne-ckpt',
      };

      // 기본 mock 은 isCheckpointEligibleNodeType=false.
      await invoke(context as never, nodeExec, { messages: [], turnCount: 1 });

      expect(driver.isCheckpointEligibleNodeType).toHaveBeenCalledWith(
        'ai_agent',
      );
      expect(driver.buildResumeCheckpoint).not.toHaveBeenCalled();
      // 영속 outputData 에 _resumeState 는 strip, _resumeCheckpoint 도 없다.
      expect(nodeExec.outputData).toBeDefined();
      expect(nodeExec.outputData!._resumeState).toBeUndefined();
      expect(nodeExec.outputData!._resumeCheckpoint).toBeUndefined();
      // 상태 전이는 driver 경유로 1회.
      expect(driver.updateExecutionStatus).toHaveBeenCalledWith(
        { id: executionId, status: ExecutionStatus.RUNNING },
        ExecutionStatus.WAITING_FOR_INPUT,
        nodeExec,
      );
    });

    // nodeExec === null → graceful pass-through: nodeExec 영속 블록 전체 skip,
    // 단 stageDurableResumeSnapshot + updateExecutionStatus(undefined) + emit 은
    // 그대로 수행되고 nodeExecutionId 는 undefined 로 나간다.
    it('nodeExec=null → 영속 블록 skip + updateExecutionStatus(undefined) + emit 정상 (graceful pass-through)', async () => {
      const context = contextService.createContext(executionId, workflowId);
      context.structuredOutputCache[aiNode.id as string] = {
        config: {},
        output: { result: { message: 'hi', messages: [] } },
        meta: {},
      } as never;

      await invoke(context as never, null, { messages: [], turnCount: 1 });

      // checkpoint / save 경로 미진입.
      expect(driver.isCheckpointEligibleNodeType).not.toHaveBeenCalled();
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
      // 상태 전이는 nodeExec 없이(undefined) 수행.
      expect(driver.stageDurableResumeSnapshot).toHaveBeenCalledTimes(1);
      expect(driver.updateExecutionStatus).toHaveBeenCalledWith(
        { id: executionId, status: ExecutionStatus.RUNNING },
        ExecutionStatus.WAITING_FOR_INPUT,
        undefined,
      );
      // waiting emit 의 nodeExecutionId 는 undefined.
      const waitingCall = mockEventEmitter.emitExecution.mock.calls.find(
        (c) => c[1] === ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      );
      expect(waitingCall).toBeDefined();
      expect(
        (waitingCall![2] as { nodeExecutionId?: string }).nodeExecutionId,
      ).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 순수 변환 헬퍼 — execution-engine.service 에 정의돼 있으나 AI 멀티턴 emit
// 변환 도메인이므로 본 spec 에 모은다 (C-1 step2 relocate). 구현은 엔진 파일에
// 그대로 잔류하며 export 만 된다.
// ---------------------------------------------------------------------------
describe('buildConversationMetaFromResumeState', () => {
  it('exposes turnDebug + ragSources from _resumeState for frontend References / LLM Usage tabs', () => {
    const turnEntry = {
      turnIndex: 1,
      llmCalls: [],
      totalDurationMs: 100,
      ragSources: [
        { chunkId: 'c1', documentId: 'd1', documentName: 'doc.md', score: 0.9 },
      ],
      ragDiagnostics: {
        attempted: true,
        searchedKbCount: 1,
        queriesUsed: ['q'],
        resultCount: 1,
      },
    };
    const meta = buildConversationMetaFromResumeState({
      model: 'gpt-4o',
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalThinkingTokens: 5,
      toolCalls: 1,
      ragSources: [
        { chunkId: 'c1', documentId: 'd1', documentName: 'doc.md', score: 0.9 },
      ],
      ragLastDiagnostics: {
        attempted: true,
        searchedKbCount: 1,
        queriesUsed: ['q'],
        resultCount: 1,
      },
      turnDebugHistory: [turnEntry],
    });

    expect(meta).toEqual({
      interactionType: 'ai_conversation',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      thinkingTokens: 5,
      toolCalls: 1,
      ragSources: [
        { chunkId: 'c1', documentId: 'd1', documentName: 'doc.md', score: 0.9 },
      ],
      ragDiagnostics: {
        attempted: true,
        searchedKbCount: 1,
        queriesUsed: ['q'],
        resultCount: 1,
      },
      turnDebug: [turnEntry],
    });
  });

  it('returns safe defaults when state lacks accumulators (initial waiting before first user message)', () => {
    const meta = buildConversationMetaFromResumeState({ model: 'gpt-4o' });
    expect(meta).toMatchObject({
      interactionType: 'ai_conversation',
      model: 'gpt-4o',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      thinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
      turnDebug: [],
    });
    // ragLastDiagnostics 가 없으면 ragDiagnostics 도 undefined — frontend 에서
    // null 가드로 처리.
    expect(meta.ragDiagnostics).toBeUndefined();
  });
});

describe('buildAiMessageDebugFromResumeState', () => {
  // spec/5-system/6-websocket-protocol.md §4.4 — execution.ai_message
  it('extracts llmCalls and durationMs from the last turn entry', () => {
    const lastTurn = {
      turnIndex: 2,
      llmCalls: [
        {
          requestPayload: { messages: [] },
          responsePayload: { content: 'a' },
          durationMs: 100,
        },
        {
          requestPayload: { messages: [] },
          responsePayload: { content: 'b' },
          durationMs: 200,
        },
      ],
      totalDurationMs: 300,
    };
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [
        { turnIndex: 1, llmCalls: [], totalDurationMs: 50 },
        lastTurn,
      ],
    });
    expect(debug).toEqual({
      llmCalls: lastTurn.llmCalls,
      durationMs: 300,
    });
  });

  // spec/5-system/6-websocket-protocol.md §4.4 — llmCalls[].startedAt/finishedAt
  // 절대 발생 시각이 payload 로 전파돼야 어시스턴트 turn 발생 시각을 표시할 수 있다.
  it('carries per-call startedAt/finishedAt through to the payload', () => {
    const lastTurn = {
      turnIndex: 1,
      llmCalls: [
        {
          requestPayload: {},
          responsePayload: { content: 'a' },
          durationMs: 100,
          startedAt: '2026-05-10T06:42:01.500Z',
          finishedAt: '2026-05-10T06:42:01.600Z',
        },
      ],
      totalDurationMs: 100,
    };
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [lastTurn],
    });
    expect(debug.llmCalls?.[0]).toMatchObject({
      startedAt: '2026-05-10T06:42:01.500Z',
      finishedAt: '2026-05-10T06:42:01.600Z',
    });
  });

  it('preserves multi-call llm sequence for tool-loop turns', () => {
    const llmCalls = [
      {
        requestPayload: { tool: 1 },
        responsePayload: { content: '' },
        durationMs: 80,
      },
      {
        requestPayload: { tool: 2 },
        responsePayload: { content: '' },
        durationMs: 90,
      },
      {
        requestPayload: { tool: 3 },
        responsePayload: { content: 'final' },
        durationMs: 120,
      },
    ];
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [{ turnIndex: 1, llmCalls, totalDurationMs: 290 }],
    });
    expect(debug.llmCalls).toEqual(llmCalls);
    expect(debug.llmCalls).toHaveLength(3);
    expect(debug.durationMs).toBe(290);
  });

  it('returns empty object when turnDebugHistory is missing (initial waiting)', () => {
    const debug = buildAiMessageDebugFromResumeState({ model: 'gpt-4o' });
    expect(debug).toEqual({});
  });

  it('returns empty object when turnDebugHistory is an empty array', () => {
    const debug = buildAiMessageDebugFromResumeState({ turnDebugHistory: [] });
    expect(debug).toEqual({});
  });

  it('omits llmCalls field when the last turn entry has none', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [{ turnIndex: 1, totalDurationMs: 50 }],
    });
    expect(debug.llmCalls).toBeUndefined();
    expect(debug.durationMs).toBe(50);
  });

  it('emits an empty array when the last turn has llmCalls: []', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [{ turnIndex: 1, llmCalls: [], totalDurationMs: 0 }],
    });
    // []는 의도된 값(이번 턴에 LLM 호출이 0건)이므로 보존한다 — undefined와
    // 의미가 다르다.
    expect(debug.llmCalls).toEqual([]);
    expect(debug.durationMs).toBe(0);
  });

  it('drops llmCalls when the field is non-array (defensive against legacy null)', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [
        // Array.isArray rejects null / undefined / non-array values
        { turnIndex: 1, llmCalls: null, totalDurationMs: 50 },
      ],
    });
    expect(debug.llmCalls).toBeUndefined();
    expect(debug.durationMs).toBe(50);
  });
});

// WARN #22 — 단위 테스트 신설.
//
// `buildConversationConfigFromOutput` 은 핸들러 출력 (handler 의 raw output)
// 을 WS `execution.waiting_for_input` payload 의 `conversationConfig` 으로
// 변환한다. spec/5-system/4-execution-engine.md §1.3 의 multi-turn 컨트랙트
// 일부로, system 메시지 필터링 / partial 필드 선택적 전파 등 비자명한 변환을
// 포함한다.
//
// D6 (2026-05-17) — 대화 필드는 `output.result.*` 단일 경로. 옛 top-level
// `output.message` / `.messages` / `.turnCount` / `.maxTurns` 는 폐기됐고,
// `partial.*` (info-extractor 부분 수집) 만 top-level 유지.
describe('buildConversationConfigFromOutput', () => {
  it('returns defaults when output is undefined', () => {
    const conv = buildConversationConfigFromOutput(undefined);
    expect(conv).toEqual({
      message: '',
      turnCount: 0,
      messages: [],
    });
  });

  it('returns defaults when output is empty', () => {
    const conv = buildConversationConfigFromOutput({});
    expect(conv).toEqual({
      message: '',
      turnCount: 0,
      messages: [],
    });
  });

  it('echoes message and turnCount from output.result', () => {
    const conv = buildConversationConfigFromOutput({
      result: { message: 'hello', turnCount: 3 },
    });
    expect(conv.message).toBe('hello');
    expect(conv.turnCount).toBe(3);
  });

  it('filters system role messages (CONVENTIONS — system 메시지는 client 미노출)', () => {
    const conv = buildConversationConfigFromOutput({
      result: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
          { role: 'system', content: 'reset' },
        ],
      },
    });
    // Each non-system message gets `source: 'live'` backfilled per
    // spec/5-system/6-websocket-protocol.md §4.4.6 (default when handler
    // didn't tag the push site explicitly).
    expect(conv.messages).toEqual([
      { role: 'user', content: 'hi', source: 'live' },
      { role: 'assistant', content: 'hello', source: 'live' },
    ]);
  });

  it("preserves explicit source: 'injected' from ConversationThread injection (§4.4.6)", () => {
    const conv = buildConversationConfigFromOutput({
      result: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          {
            role: 'user',
            content: '[from Template] start',
            source: 'injected',
          },
          { role: 'user', content: 'live message', source: 'live' },
          { role: 'assistant', content: 'response' }, // unmarked → backfilled
        ],
      },
    });
    expect(conv.messages).toEqual([
      {
        role: 'user',
        content: '[from Template] start',
        source: 'injected',
      },
      { role: 'user', content: 'live message', source: 'live' },
      { role: 'assistant', content: 'response', source: 'live' },
    ]);
  });

  it("preserves existing source: 'live' as-is (no double-wrap)", () => {
    const original = { role: 'user', content: 'hi', source: 'live' };
    const conv = buildConversationConfigFromOutput({
      result: { messages: [original] },
    });
    // Backfill must short-circuit on already-marked items so identity is
    // preserved (no needless object allocations on hot paths).
    expect(conv.messages[0]).toBe(original);
  });

  it('returns empty messages array unchanged', () => {
    const conv = buildConversationConfigFromOutput({
      result: { messages: [] },
    });
    expect(conv.messages).toEqual([]);
  });

  it('handles a multi-turn mixed sequence (system stripped, injected preserved, live backfilled)', () => {
    const conv = buildConversationConfigFromOutput({
      result: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          {
            role: 'user',
            content: '[from Form] name=Alice',
            source: 'injected',
          },
          {
            role: 'assistant',
            content: '[from PrevAgent] Welcome',
            source: 'injected',
          },
          { role: 'user', content: '실제 메시지' },
          { role: 'assistant', content: '응답' },
        ],
      },
    });
    expect(conv.messages).toHaveLength(4);
    expect(conv.messages[0].source).toBe('injected');
    expect(conv.messages[1].source).toBe('injected');
    expect(conv.messages[2].source).toBe('live');
    expect(conv.messages[3].source).toBe('live');
  });

  it('includes maxTurns from config echo only when present (decision C-1)', () => {
    // maxTurns 는 output.result 가 아니라 config echo (2번째 인자) 에서 읽는다.
    const withMax = buildConversationConfigFromOutput({}, { maxTurns: 5 });
    expect(withMax.maxTurns).toBe(5);
    // output.result.maxTurns 는 더 이상 읽지 않는다.
    const ignoredFromResult = buildConversationConfigFromOutput({
      result: { maxTurns: 5 },
    });
    expect(ignoredFromResult).not.toHaveProperty('maxTurns');
    const without = buildConversationConfigFromOutput({});
    expect(without).not.toHaveProperty('maxTurns');
  });

  it('propagates partial.extracted / missingFields / collectionRetryCount only when present', () => {
    const conv = buildConversationConfigFromOutput({
      partial: {
        extracted: { name: 'Alice' },
        missingFields: ['email'],
        collectionRetryCount: 2,
      },
    });
    expect(conv.extracted).toEqual({ name: 'Alice' });
    expect(conv.missingFields).toEqual(['email']);
    expect(conv.collectionRetryCount).toBe(2);
  });

  it('omits partial fields when undefined (no key pollution)', () => {
    const conv = buildConversationConfigFromOutput({
      partial: { extracted: { name: 'Bob' } },
    });
    expect(conv.extracted).toEqual({ name: 'Bob' });
    expect(conv).not.toHaveProperty('missingFields');
    expect(conv).not.toHaveProperty('collectionRetryCount');
  });

  it('handles missing partial gracefully', () => {
    const conv = buildConversationConfigFromOutput({
      result: { message: 'hi' },
    });
    expect(conv.message).toBe('hi');
    expect(conv).not.toHaveProperty('extracted');
    expect(conv).not.toHaveProperty('missingFields');
  });

  // D6 회귀 차단 — 옛 top-level shape (`output.message` / `.messages` /
  // `.turnCount` / `.maxTurns`) 은 더 이상 인식되지 않는다. 핸들러가 옛
  // shape 으로 회귀했을 때 빈 conversationConfig 가 emit 되어 사용자에게
  // assistant 응답이 전달되지 않던 회귀를 차단한다 (D6 동기화).
  it('ignores legacy top-level message/messages/turnCount/maxTurns (D6 정합)', () => {
    const conv = buildConversationConfigFromOutput({
      message: 'legacy-msg',
      messages: [{ role: 'assistant', content: 'legacy' }],
      turnCount: 99,
      maxTurns: 42,
    });
    expect(conv.message).toBe('');
    expect(conv.messages).toEqual([]);
    expect(conv.turnCount).toBe(0);
    expect(conv).not.toHaveProperty('maxTurns');
  });
});

describe('buildAiMessageDebugFromResumeState — null/mutation guards', () => {
  it('returns empty object when turnDebugHistory is null', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: null,
    });
    expect(debug).toEqual({});
  });

  it('shallow-copies llmCalls so later mutation of resumeState cannot retroactively change a buffered emit', () => {
    const llmCalls: Array<{
      requestPayload: Record<string, unknown>;
      responsePayload: Record<string, unknown>;
      durationMs: number;
    }> = [{ requestPayload: { a: 1 }, responsePayload: {}, durationMs: 10 }];
    const state = {
      turnDebugHistory: [{ turnIndex: 1, llmCalls, totalDurationMs: 10 }],
    };
    const debug = buildAiMessageDebugFromResumeState(state);
    // simulate the next turn pushing a new call into the source array
    llmCalls.push({
      requestPayload: { b: 2 },
      responsePayload: {},
      durationMs: 20,
    });
    expect(debug.llmCalls).toHaveLength(1);
  });
});
