import { ExecutionEngineService } from './execution-engine.service';
import { CALL_STACK_SCHEMA_VERSION } from '../../shared/execution-resume/resume-call-stack.types';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import { ButtonInteractionService } from './button-interaction.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { Node } from '../nodes/entities/node.entity';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  mockWorkflow,
  workflowId,
} from './__test-utils__/engine-service-harness';

/**
 * ExecutionEngineService 단위 테스트: rehydrateContext · 재개 체크포인트 · 재시작 뒤 재개(§7.5).
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  // C-1 step2 — AI 멀티턴 lifecycle 은 AiTurnOrchestrator 로 추출됨. 엔진의
  // dispatch/registry/retry 가 위임하므로, 추출된 메서드를 spy 하는 테스트는 본
  // 인스턴스를 대상으로 한다 (엔진 인스턴스가 아님).
  let aiTurnOrchestrator: AiTurnOrchestrator;
  let buttonInteraction: ButtonInteractionService;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  let mockExecutionNodeLogRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      aiTurnOrchestrator,
      buttonInteraction,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockWorkflowRepo,
      mockExecutionNodeLogRepo,
    } = h);
  });

  // W1 (SUMMARY) — `CheckpointSubject` 타입을 describe 바깥 상위 스코프로 승격해
  // checkpoint 관련 테스트 블록에서 재사용 가능하게 한다.
  type CheckpointSubject = {
    buildResumeCheckpoint: (
      s: Record<string, unknown> | undefined,
    ) => Record<string, unknown> | undefined;
    buildRetryReentryState: (
      execution: unknown,
      node: unknown,
      context: unknown,
      retryState: Record<string, unknown>,
      opts?: { resumeMode?: boolean; nodeExecutionId?: string },
    ) => { resumeState: Record<string, unknown>; initialAction: unknown };
    contextService: {
      createContext: (
        id: string,
        wf: string,
        opts?: { initialVariables?: Record<string, unknown> },
      ) => unknown;
    };
  };

  describe('rehydrateAndResume — chat-channel routing context 재등록 (재개 경로)', () => {
    // Spec [chat-channel.md §3.1 CCH-AD-05] + [4-execution-engine.md §7.5 line 858]:
    // routing context(`{triggerId, workflowId, chatChannel.conversationKey}`)는
    // `WebsocketService.executionRouting` in-memory per-process Map 으로, 최초
    // execute() 진입 시 1회만 등록된다. 재개(rehydration slow path)는 다른
    // 인스턴스/재시작 후 worker 가 pick up 할 수 있어 그 Map 이 비어 있다. 특히
    // `RESUME_INCOMPATIBLE_STATE` 는 "인스턴스 재시작으로 multi-turn in-memory
    // 상태 소실"(§7.5 line 858)일 때 발생 — 즉 routing context 도 항상 함께
    // 사라져 있다. 영속된 execution row 로 재등록하지 않으면 markExecutionCancelled
    // 의 graceful "세션 만료" 안내가 conversationKey 없이 emit 돼 ChatChannelDispatcher
    // 가 outbound skip → 사용자 무음. 본 describe 는 재개 시 재등록 회귀 가드.

    // exec-park D6 full B3 — applyContinuation 은 fast-path 없이 항상 rehydration
    // (rehydrateAndResume) 으로 진입한다. execution row 만 WAITING_FOR_INPUT 로
    // 주고 nodeExec 를 null 로 만들어 RESUME_CHECKPOINT_MISSING 으로 조기 종료시킨다
    // (재등록은 그 실패 이전에 일어나므로 어떤 RESUME_* 케이스든 동일하게 보장됨).
    const driveResumeSlowPath = async (
      executionRow: Partial<Execution>,
    ): Promise<void> => {
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(executionRow);
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValueOnce(null);
      mockWebsocketService.registerExecutionRouting.mockClear();
      await service.applyContinuation(executionId, 'ne-some-node', {
        type: 'ai_message',
        message: 'hi',
      });
      await flushPromises();
      await flushPromises();
    };

    it('chatChannel 발화 execution → execute() 와 동일한 {triggerId, workflowId, chatChannel} 로 재등록', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        triggerId: 'trg-tele',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: {
          __triggerSource: 'webhook',
          chatChannel: {
            provider: 'telegram',
            conversationKey: '12345',
            channelUserKey: 'user-1',
          },
        },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-tele',
        workflowId,
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          channelUserKey: 'user-1',
        },
      });
    });

    it('triggerId 만 있고 chatChannel 미설정인 재개 → triggerId + workflowId 만 재등록', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        triggerId: 'trg-wh',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: { parameters: {} },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-wh',
        workflowId,
      });
    });

    it('triggerId 없는 (수동 실행) 재개 → 재등록 호출 안 함', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        // triggerId 미설정 (수동 실행)
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: { data: 'x' },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).not.toHaveBeenCalled();
    });

    it('inputData.chatChannel.conversationKey 가 빈 문자열이면 chatChannel 제외하고 재등록', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        triggerId: 'trg-bad',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: {
          chatChannel: { provider: 'telegram', conversationKey: '' },
        },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-bad',
        workflowId,
      });
    });
  });

  // PR-A1 — conversationThread durable 복원 (spec §6.2/§7.5, conversation-thread
  // §4·§8.4). rehydrateContext 를 직접 호출해 thread 복원만 격리 검증한다 (resume
  // 머신리와 무관). park 시 `Execution.conversation_thread` 에 commit 된 스냅샷이
  // 무손실 복원되는지 + NULL(배포 이전 row)이면 빈 thread 로 회귀 없는지.
  describe('rehydrateContext — conversationThread durable 복원', () => {
    // 단일 타입 별칭으로 private API 접근 일원화 — 메서드 시그니처 변경 시
    // 이 한 곳만 수정하면 블록 전체에 전파된다 (WARNING 4 refactor).
    type RehydrateCtxSubject = {
      rehydrateContext: (
        execution: unknown,
        waitingNodeExec: unknown,
      ) => Promise<{
        conversationThread: unknown;
        variables: Record<string, unknown>;
      }>;
      stageDurableResumeSnapshot: (
        execution: unknown,
        context: unknown,
      ) => void;
      rehydrateUserVariables: (raw: unknown) => Record<string, unknown>;
      contextService: { deleteContext: (key: string) => void };
    };
    const ctxSubject = () => service as unknown as RehydrateCtxSubject;

    const waitingNodeExec = {
      id: 'ne-rehydrate',
      nodeId: 'node-1',
      outputData: {
        interactionType: 'form',
        meta: { interactionType: 'form' },
        status: 'waiting_for_input',
      },
    };

    beforeEach(() => {
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);
    });

    it('restores the persisted thread losslessly (turns + runningSummary + summarizedUpToSeq)', async () => {
      const persisted = {
        id: 'default',
        nextSeq: 2,
        turns: [
          {
            seq: 0,
            nodeId: 'node-1',
            nodeLabel: 'Form',
            nodeType: 'form',
            timestamp: '2026-06-05T10:00:00.000Z',
            source: 'presentation_user',
            text: '환불해주세요',
          },
          {
            seq: 1,
            nodeId: 'node-1',
            nodeLabel: 'Agent',
            nodeType: 'ai_agent',
            timestamp: '2026-06-05T10:00:01.000Z',
            source: 'ai_assistant',
            text: '처리하겠습니다',
          },
        ],
        totalChars: 13, // '환불해주세요'(6) + '처리하겠습니다'(7)
        runningSummary: '사용자 환불 요청',
        summarizedUpToSeq: 0,
      };
      const execution = {
        id: 'exec-rehydrate-thread',
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        recursionDepth: 0,
        dryRun: false,
        conversationThread: persisted,
      };
      // 기존 in-memory context 가 있으면 rehydrateContext 가 early-return 하므로 제거.
      ctxSubject().contextService.deleteContext('exec-rehydrate-thread');

      const ctx = await ctxSubject().rehydrateContext(
        execution,
        waitingNodeExec,
      );

      expect(ctx.conversationThread).toEqual(persisted);
    });

    it('falls back to an empty thread when the column is NULL (배포 이전 row / park 이력 없음 — 회귀 가드)', async () => {
      const execution = {
        id: 'exec-rehydrate-null',
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        recursionDepth: 0,
        dryRun: false,
        conversationThread: null,
      };
      ctxSubject().contextService.deleteContext('exec-rehydrate-null');

      const ctx = await ctxSubject().rehydrateContext(
        execution,
        waitingNodeExec,
      );

      expect(ctx.conversationThread).toEqual({
        id: 'default',
        nextSeq: 0,
        turns: [],
        totalChars: 0,
      });
    });

    // $trigger durable 복원 (spec 5-expression-language §4.5) — resume 경로도
    // Execution.inputData(webhook transport)에서 triggerData 를 재추출해 주입한다.
    it('restores triggerData from webhook Execution.inputData (resume 후에도 $trigger 비지 않음)', async () => {
      const execution = {
        id: 'exec-rehydrate-trigger',
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        recursionDepth: 0,
        dryRun: false,
        conversationThread: null,
        inputData: {
          __triggerSource: 'webhook',
          parameters: { orderId: '1' },
          body: { event: 'push' },
          headers: { 'content-type': 'application/json' },
          query: { ref: 'main' },
          method: 'POST',
        },
      };
      ctxSubject().contextService.deleteContext('exec-rehydrate-trigger');

      const ctx = await ctxSubject().rehydrateContext(
        execution,
        waitingNodeExec,
      );

      expect((ctx as { triggerData?: unknown }).triggerData).toEqual({
        body: { event: 'push' },
        headers: { 'content-type': 'application/json' },
        query: { ref: 'main' },
        method: 'POST',
      });
    });

    it('leaves triggerData undefined for manual inputData (resume → $trigger = {})', async () => {
      const execution = {
        id: 'exec-rehydrate-manual',
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        recursionDepth: 0,
        dryRun: false,
        conversationThread: null,
        inputData: { __triggerSource: 'manual', parameters: {} },
      };
      ctxSubject().contextService.deleteContext('exec-rehydrate-manual');

      const ctx = await ctxSubject().rehydrateContext(
        execution,
        waitingNodeExec,
      );

      expect((ctx as { triggerData?: unknown }).triggerData).toBeUndefined();
    });

    // PR-A3 — user-defined variables 무손실 복원 (spec §6.1/§6.2/§7.5).
    it('restores user-defined variables from Execution.user_variables (park 이전 변수를 park 이후 참조)', async () => {
      const execution = {
        id: 'exec-rehydrate-vars',
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        recursionDepth: 0,
        dryRun: false,
        conversationThread: null,
        userVariables: { counter: 7, payload: { ok: true } },
      };
      ctxSubject().contextService.deleteContext('exec-rehydrate-vars');

      const ctx = await ctxSubject().rehydrateContext(
        execution,
        waitingNodeExec,
      );

      // 사용자 변수 복원 + 시스템 __* 동시 존재 (충돌 없음).
      expect(ctx.variables.counter).toBe(7);
      expect(ctx.variables.payload).toEqual({ ok: true });
      expect(ctx.variables.__workspaceId).toBe('ws-1');
    });

    it('NULL user_variables → 사용자 변수 없이 시스템 __* 만 (회귀 가드)', async () => {
      const execution = {
        id: 'exec-rehydrate-vars-null',
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        recursionDepth: 0,
        dryRun: false,
        conversationThread: null,
        userVariables: null,
      };
      ctxSubject().contextService.deleteContext('exec-rehydrate-vars-null');

      const ctx = await ctxSubject().rehydrateContext(
        execution,
        waitingNodeExec,
      );

      expect(ctx.variables.__workspaceId).toBe('ws-1');
      // 사용자 변수 키 없음.
      const userKeys = Object.keys(ctx.variables).filter(
        (k) => !k.startsWith('__'),
      );
      expect(userKeys).toEqual([]);
    });

    it('stageDurableResumeSnapshot stages thread (deep-cloned) + user variables (system __* 제외)', () => {
      const thread = {
        id: 'default',
        nextSeq: 1,
        turns: [
          {
            seq: 0,
            nodeId: 'n1',
            nodeLabel: 'Form',
            nodeType: 'form',
            timestamp: '2026-06-05T10:00:00.000Z',
            source: 'presentation_user',
            text: 'hi',
          },
        ],
        totalChars: 2,
      };
      const execution = {
        id: 'e1',
        conversationThread: null,
        userVariables: null,
      } as unknown;
      const context = {
        conversationThread: thread,
        variables: {
          __workspaceId: 'ws-1', // 시스템 — 제외돼야 함
          __dryRun: false,
          counter: 3, // 사용자 — 영속돼야 함
          payload: { a: 1 },
        },
      } as unknown;

      ctxSubject().stageDurableResumeSnapshot(execution, context);

      const ex = execution as {
        conversationThread: unknown;
        userVariables: Record<string, unknown>;
      };
      // thread: 값 동일 + cloneThread 깊은 복사(영속본 분리).
      expect(ex.conversationThread).toEqual(thread);
      expect(ex.conversationThread).not.toBe(thread);
      // variables: 시스템 __* 제외, 사용자분만.
      expect(ex.userVariables).toEqual({ counter: 3, payload: { a: 1 } });
      expect(ex.userVariables).not.toHaveProperty('__workspaceId');
      expect(ex.userVariables).not.toHaveProperty('__dryRun');
    });

    // PR-A3 WARNING #3 — 배열/null 값 케이스 + shallow copy mutability 명시.
    it('stageDurableResumeSnapshot: 배열 값·null 값 포함 variables — shallow copy 로 레퍼런스 공유 (의도적)', () => {
      // shallow copy 이므로 배열은 원본과 레퍼런스를 공유한다.
      // stage→save 는 동기 연속이므로 중간 mutation 이 개입할 수 없다 (설계 의도).
      const tags = ['a', 'b'];
      const execution = {
        id: 'e-arr',
        conversationThread: null,
        userVariables: null,
      } as unknown;
      const context = {
        conversationThread: {
          id: 'default',
          nextSeq: 0,
          turns: [],
          totalChars: 0,
        },
        variables: {
          __workspaceId: 'ws-1',
          tags,
          score: null as unknown,
        },
      } as unknown;

      ctxSubject().stageDurableResumeSnapshot(execution, context);

      const ex = execution as { userVariables: Record<string, unknown> };
      // 시스템 변수 제외.
      expect(ex.userVariables).not.toHaveProperty('__workspaceId');
      // 배열 값 포함.
      expect(ex.userVariables['tags']).toEqual(['a', 'b']);
      // shallow copy — 원본 배열과 레퍼런스가 동일 (의도적 shallow).
      expect(ex.userVariables['tags']).toBe(tags);
      // null 값 포함.
      expect(
        Object.prototype.hasOwnProperty.call(ex.userVariables, 'score'),
      ).toBe(true);
      expect(ex.userVariables['score']).toBeNull();
    });

    // PR-A3 WARNING #3 / INFO #8 — 시스템 변수만 있는 케이스 → userVariables === {}.
    it('stageDurableResumeSnapshot: 시스템 변수(__*)만 있으면 userVariables 가 빈 객체', () => {
      const execution = {
        id: 'e-sys',
        conversationThread: null,
        userVariables: null,
      } as unknown;
      const context = {
        conversationThread: {
          id: 'default',
          nextSeq: 0,
          turns: [],
          totalChars: 0,
        },
        variables: {
          __workspaceId: 'ws-1',
          __dryRun: false,
          __workspaceName: 'Test',
        },
      } as unknown;

      ctxSubject().stageDurableResumeSnapshot(execution, context);

      const ex = execution as { userVariables: Record<string, unknown> };
      expect(ex.userVariables).toEqual({});
    });

    it('rehydrateUserVariables normalizes snapshot (비객체→{}, 배열→{}, 방어적 __* 제외)', () => {
      const cs = ctxSubject();
      expect(cs.rehydrateUserVariables(null)).toEqual({});
      expect(cs.rehydrateUserVariables('garbage')).toEqual({});
      // PR-A3 INFO #5 — 배열 입력 시 인덱스 키 유출 방지 (Array.isArray guard).
      expect(cs.rehydrateUserVariables([])).toEqual({});
      expect(cs.rehydrateUserVariables(['a', 'b'])).toEqual({});
      expect(cs.rehydrateUserVariables({ counter: 5, __dryRun: true })).toEqual(
        {
          counter: 5,
        },
      );
    });

    // exec-park D6 (PR-B2b) — 중첩 sub-workflow park 시 호출 체인(call stack)이
    // `Execution.resume_call_stack` 에 durable 영속되는지 검증. stage 헬퍼가
    // context._callStack 을 version envelope 로 직렬화한다.
    it('stageDurableResumeSnapshot stages resume_call_stack from context._callStack (중첩 frame)', () => {
      const execution = {
        id: 'e-nested',
        conversationThread: null,
        userVariables: null,
        resumeCallStack: null,
      } as unknown;
      const context = {
        conversationThread: {
          id: 'default',
          nextSeq: 0,
          turns: [],
          totalChars: 0,
        },
        variables: { __workspaceId: 'ws-1' },
        _callStack: [
          {
            workflowId: 'wf-sub-1',
            invokerNodeId: 'node-wf-A',
            recursionDepth: 1,
          },
          {
            workflowId: 'wf-sub-2',
            invokerNodeId: 'node-wf-B',
            recursionDepth: 2,
          },
        ],
      } as unknown;

      ctxSubject().stageDurableResumeSnapshot(execution, context);

      const ex = execution as {
        resumeCallStack: { version: number; frames: unknown[] } | null;
      };
      expect(ex.resumeCallStack).not.toBeNull();
      // WARNING #10 — 상수 참조로 교체: 하드코딩 1 → CALL_STACK_SCHEMA_VERSION.
      // 상수가 변경될 경우 이 테스트도 자동으로 최신 값으로 검증된다.
      expect(ex.resumeCallStack?.version).toBe(CALL_STACK_SCHEMA_VERSION);
      expect(ex.resumeCallStack?.frames).toEqual([
        {
          workflowId: 'wf-sub-1',
          invokerNodeId: 'node-wf-A',
          recursionDepth: 1,
        },
        {
          workflowId: 'wf-sub-2',
          invokerNodeId: 'node-wf-B',
          recursionDepth: 2,
        },
      ]);
      // frame 은 얕은 복사(이후 pop mutation 격리) — 원본 배열과 레퍼런스 분리.
      expect(ex.resumeCallStack?.frames).not.toBe(
        (context as { _callStack: unknown[] })._callStack,
      );
    });

    // exec-park D6 — top-level park(중첩 없음)은 resume_call_stack 을 NULL 로
    // 명시 재설정한다 (중첩→재개→top-level park 시 stale stack 누수 방지).
    it('stageDurableResumeSnapshot sets resume_call_stack=null for top-level park (빈/미설정 _callStack)', () => {
      const base = {
        conversationThread: {
          id: 'default',
          nextSeq: 0,
          turns: [],
          totalChars: 0,
        },
        variables: { __workspaceId: 'ws-1' },
      };
      // (a) _callStack 미설정.
      const exNoStack = {
        id: 'e-top-a',
        conversationThread: null,
        userVariables: null,
        resumeCallStack: { version: 1, frames: [{ x: 1 }] }, // 이전 stale 값
      } as unknown;
      ctxSubject().stageDurableResumeSnapshot(exNoStack, base as unknown);
      expect(
        (exNoStack as { resumeCallStack: unknown }).resumeCallStack,
      ).toBeNull();
      // (b) _callStack === [].
      const exEmpty = {
        id: 'e-top-b',
        conversationThread: null,
        userVariables: null,
        resumeCallStack: { version: 1, frames: [{ x: 1 }] },
      } as unknown;
      ctxSubject().stageDurableResumeSnapshot(exEmpty, {
        ...base,
        _callStack: [],
      } as unknown);
      expect(
        (exEmpty as { resumeCallStack: unknown }).resumeCallStack,
      ).toBeNull();
    });
  });

  // 재개 뒤 캐시 복원(CLE-T-JDYHCF 4번). DB 의 완료 행은 다섯 필드 정본 `{ config, output,
  // port… }` 이다. 정상 실행이 만든 두 캐시와 같은 값으로 되살려야 다음 노드의 `$input` ·
  // 포트 라우팅 · `$node[X].output` 이 재개 전과 같다.
  describe('rehydrateContext — 완료 노드 출력 캐시 복원 (CLE-T-JDYHCF)', () => {
    type RehydrateCacheSubject = {
      rehydrateContext: (
        execution: unknown,
        waitingNodeExec: unknown,
      ) => Promise<{
        nodeOutputCache: Record<string, unknown>;
        structuredOutputCache: Record<string, { output?: unknown }>;
        _executedNodes?: Set<string>;
      }>;
      gatherNodeInput: (
        nodeId: string,
        edges: unknown[],
        executedNodes: Set<string>,
        caches: {
          nodeOutputCache: Record<string, unknown>;
          structuredOutputCache: Record<string, { output?: unknown }>;
        },
        workflowInput: unknown,
        incomingEdgeMap?: Map<string, unknown[]>,
      ) => unknown;
      contextService: { deleteContext: (key: string) => void };
    };
    const subject = () => service as unknown as RehydrateCacheSubject;
    const WORKFLOW_INPUT = { from: 'workflow-input' };

    const restore = async (executionId: string, outputData: unknown) => {
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([{ nodeId: 'src' }]);
      mockNodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne-src',
          nodeId: 'src',
          status: NodeExecutionStatus.COMPLETED,
          outputData,
        },
      ]);
      subject().contextService.deleteContext(executionId);
      const ctx = await subject().rehydrateContext(
        {
          id: executionId,
          workflowId,
          status: ExecutionStatus.RUNNING,
          recursionDepth: 0,
          dryRun: false,
          conversationThread: null,
        },
        null,
      );
      // 다음 노드 `next` 가 `src` 의 `sourcePort` 연결선 하나로 이어진 그래프의 `$input`.
      const inputVia = (sourcePort: string) => {
        const edge = {
          sourceNodeId: 'src',
          sourcePort,
          targetNodeId: 'next',
          targetPort: 'in',
        };
        return subject().gatherNodeInput(
          'next',
          [edge],
          ctx._executedNodes ?? new Set(),
          ctx,
          WORKFLOW_INPUT,
          new Map([['next', [edge]]]),
        );
      };
      subject().contextService.deleteContext(executionId);
      return { ctx, inputVia };
    };

    it.each([
      ['배열', [1, 2, 3]],
      ['객체', { a: 1 }],
      ['숫자', 42],
      ['null', null],
    ])(
      '포트가 있는 %s 출력을 되살리면 다음 노드 $input 은 그 값이고 다른 포트 연결선은 막힌다',
      async (_label, value) => {
        const { ctx, inputVia } = await restore('exec-rehydrate-cache', {
          config: { code: 'return x;' },
          output: value,
          port: 'success',
        });

        expect(inputVia('success')).toEqual(value);
        expect(inputVia('error')).toBeUndefined();
        expect(ctx.structuredOutputCache.src).toEqual({
          config: { code: 'return x;' },
          output: value,
          port: 'success',
        });
      },
    );

    it('포트 없는 정본 행은 output 을 다음 노드 $input 으로 준다', async () => {
      const { ctx, inputVia } = await restore('exec-rehydrate-noport', {
        config: {},
        output: { rows: [1] },
      });

      expect(inputVia('out')).toEqual({ rows: [1] });
      expect(ctx.structuredOutputCache.src.output).toEqual({ rows: [1] });
    });

    it('정본이 아닌 옛 행은 값 그대로 되살린다', async () => {
      const { ctx, inputVia } = await restore('exec-rehydrate-legacy', {
        foo: 1,
      });

      expect(inputVia('out')).toEqual({ foo: 1 });
      expect(ctx.structuredOutputCache.src.output).toEqual({ foo: 1 });
    });
  });

  // PR-A2a — `_resumeCheckpoint` 견고화 (spec §1.3 / §7.5). checkpoint 에 스키마
  // 버전을 stamp 하고, 재구성 시 버전 메타를 strip + 핵심 필드 누락을 기본값으로
  // 보강한다. buildResumeCheckpoint / buildRetryReentryState 를 직접 호출해 격리 검증.
  describe('_resumeCheckpoint schemaVersion + 견고화 (PR-A2a)', () => {
    // W1 (SUMMARY) — CheckpointSubject 는 최상위 describe 스코프에서 선언됨.
    const cpSubject = () => service as unknown as CheckpointSubject;

    it('buildResumeCheckpoint stamps the current schemaVersion', () => {
      const checkpoint = cpSubject().buildResumeCheckpoint({
        messages: [{ role: 'user', content: 'hi' }],
        turnCount: 2,
        model: 'm',
      });
      expect(checkpoint?.schemaVersion).toBe(1);
      // 안전 필드는 보존.
      expect(checkpoint?.turnCount).toBe(2);
      expect(checkpoint?.model).toBe('m');
    });

    it('buildResumeCheckpoint returns undefined for non-object input', () => {
      expect(cpSubject().buildResumeCheckpoint(undefined)).toBeUndefined();
    });

    it('buildRetryReentryState strips schemaVersion meta from the reconstructed resumeState', () => {
      const cp = cpSubject();
      const ctx = cp.contextService.createContext('exec-a2a-1', 'wf-1', {
        initialVariables: { __workspaceId: 'ws-1' },
      });
      const { resumeState } = cp.buildRetryReentryState(
        { id: 'exec-a2a-1', startedAt: new Date() },
        { id: 'node-1', type: 'ai_agent', config: { mode: 'multi_turn' } },
        ctx,
        {
          schemaVersion: 1,
          messages: [{ role: 'user', content: 'prev' }],
          turnCount: 3,
          model: 'm',
        },
        { resumeMode: true },
      );
      expect(resumeState).not.toHaveProperty('schemaVersion');
      expect(resumeState.turnCount).toBe(3);
    });

    // 회귀(#501) — 멀티턴 resume 턴 통합 사용 로그 attribution. 재구성된 resumeState 가
    // `workflowId`(execution 에서)·`nodeExecutionId`(opts 에서)를 재주입해야, resume 턴
    // provider-tool 실행(ai-turn-executor.ts:2684)이 cafe24/makeshop/mcp provider 의
    // logUsage 게이트 `if (ctx.nodeExecutionId && ctx.workflowId)` 를 통과한다. 두 필드는
    // checkpoint allow-list 로 persist 에서 제거되고 재개 시 재유도 대상이다(§1.3).
    it('buildRetryReentryState re-injects workflowId (execution) + nodeExecutionId (opts) into the reconstructed resumeState (#501 regression)', () => {
      const cp = cpSubject();
      const ctx = cp.contextService.createContext('exec-attr-1', 'wf-attr', {
        initialVariables: { __workspaceId: 'ws-1' },
      });
      const { resumeState } = cp.buildRetryReentryState(
        { id: 'exec-attr-1', workflowId: 'wf-attr', startedAt: new Date() },
        { id: 'node-1', type: 'ai_agent', config: { mode: 'multi_turn' } },
        ctx,
        { messages: [], turnCount: 1 },
        { resumeMode: true, nodeExecutionId: 'ne-attr-1' },
      );
      expect(resumeState.workflowId).toBe('wf-attr');
      expect(resumeState.nodeExecutionId).toBe('ne-attr-1');
      // 개인 통합 사용 판정은 노드 → 워크플로우 작성자를 이 값으로 찾는다(CLE-NODE-INT-COMMON).
      expect(resumeState.nodeId).toBe('node-1');
    });

    // 개인 통합 사용 판정 — MCP 서버의 표현식 여부는 서버 항목 밖 평행 배열 `mcpServerFromExpression` 으로
    // 첫 턴에 정한 값을 이어 받는다(CLE-EXEC-STATE 「보존 예외 `_resumeCheckpoint`」, CLE-T-68XG50).
    // 배열이 없는 옛 체크포인트는 복원할 때 항목 값을 옮기고, 서버 목록이 없으면 노드 설정에서 첫 턴처럼 다시 정한다.
    describe('MCP 서버의 표현식 여부 배열', () => {
      const A = '11111111-1111-4111-8111-111111111111';
      const B = '22222222-2222-4222-8222-222222222222';
      const reenter = (
        execId: string,
        checkpoint: Record<string, unknown>,
        nodeMcpServers: unknown,
        vars: Record<string, unknown> = {},
      ) => {
        const cp = cpSubject();
        const ctx = cp.contextService.createContext(execId, 'wf-1', {
          initialVariables: { __workspaceId: 'ws-1', ...vars },
        });
        return cp.buildRetryReentryState(
          { id: execId, workflowId: 'wf-1', startedAt: new Date() },
          {
            id: 'node-1',
            type: 'ai_agent',
            config: { mode: 'multi_turn', mcpServers: nodeMcpServers },
          },
          ctx,
          { messages: [], turnCount: 1, ...checkpoint },
          { resumeMode: true },
        ).resumeState;
      };

      it('buildResumeCheckpoint 는 서버 목록과 배열을 함께 싣는다', () => {
        const checkpoint = cpSubject().buildResumeCheckpoint({
          messages: [],
          mcpServers: [{ integrationId: A }, { integrationId: B }],
          mcpServerFromExpression: [false, true],
        });
        expect(checkpoint?.mcpServers).toEqual([
          { integrationId: A },
          { integrationId: B },
        ]);
        expect(checkpoint?.mcpServerFromExpression).toEqual([false, true]);
      });

      it('buildResumeCheckpoint 는 상태에 배열이 없으면 빈 배열을 싣는다(모든 서버가 표현식)', () => {
        const checkpoint = cpSubject().buildResumeCheckpoint({
          messages: [],
          mcpServers: [{ integrationId: A }],
        });
        expect(checkpoint?.mcpServerFromExpression).toEqual([]);
      });

      it('buildRetryReentryState 는 체크포인트의 목록과 배열을 그대로 쓴다(노드 설정과 다시 맞추지 않는다)', () => {
        const resumeState = reenter(
          'exec-mcp-1',
          {
            mcpServers: [{ integrationId: A }],
            mcpServerFromExpression: [false],
          },
          [{ integrationId: '{{ $var.x }}' }],
        );
        expect(resumeState.mcpServers).toEqual([{ integrationId: A }]);
        expect(resumeState.mcpServerFromExpression).toEqual([false]);
      });

      it('buildResumeCheckpoint → buildRetryReentryState 왕복에서 배열이 이어진다', () => {
        const checkpoint = cpSubject().buildResumeCheckpoint({
          messages: [],
          turnCount: 1,
          mcpServers: [{ integrationId: A }, { integrationId: B }],
          mcpServerFromExpression: [true, false],
        }) as Record<string, unknown>;
        const resumeState = reenter('exec-mcp-rt', checkpoint, []);
        expect(resumeState.mcpServers).toEqual([
          { integrationId: A },
          { integrationId: B },
        ]);
        expect(resumeState.mcpServerFromExpression).toEqual([true, false]);
      });

      it('배열이 없는 옛 체크포인트는 항목 값을 배열로 옮기고 항목에서 키를 지운다', () => {
        const resumeState = reenter(
          'exec-mcp-legacy',
          {
            mcpServers: [
              { integrationId: A, fromExpression: false },
              { integrationId: B, fromExpression: true },
              { integrationId: B },
            ],
          },
          [],
        );
        expect(resumeState.mcpServers).toEqual([
          { integrationId: A },
          { integrationId: B },
          { integrationId: B },
        ]);
        expect(resumeState.mcpServerFromExpression).toEqual([
          false,
          true,
          true,
        ]);
      });

      it('서버 목록이 없으면 노드 설정에서 첫 턴처럼 다시 정하고 사용자가 넣은 fromExpression 은 쓰지 않는다', () => {
        const resumeState = reenter(
          'exec-mcp-2',
          // 목록과 짝이 아닌 배열은 버린다.
          { mcpServerFromExpression: [false, false] },
          [
            { integrationId: A, fromExpression: true },
            { integrationId: '{{ $var.mcpId }}', fromExpression: false },
          ],
          { mcpId: B },
        );
        expect(resumeState.mcpServers).toEqual([
          { integrationId: A },
          { integrationId: B },
        ]);
        expect(resumeState.mcpServerFromExpression).toEqual([false, true]);
      });
    });

    // 재실행 dry-run 부수효과 판정(CLE-EXEC-RERUN) — resume 턴 provider-tool 실행도 dry-run 을 알아야 MCP
    // 도구를 실제로 부르지 않는다. dryRun 은 checkpoint 에 영속하지 않는 context-binding
    // 값이라 context.variables.__dryRun 에서 재유도한다(checkpoint 에 값이 남아도 무시).
    it.each([
      [true, { __workspaceId: 'ws-1', __dryRun: true }],
      [false, { __workspaceId: 'ws-1' }],
    ])(
      'buildRetryReentryState re-derives dryRun=%s from context.variables.__dryRun',
      (expected, initialVariables) => {
        const cp = cpSubject();
        const ctx = cp.contextService.createContext('exec-dry-1', 'wf-1', {
          initialVariables,
        });
        const { resumeState } = cp.buildRetryReentryState(
          { id: 'exec-dry-1', workflowId: 'wf-1', startedAt: new Date() },
          { id: 'node-1', type: 'ai_agent', config: { mode: 'multi_turn' } },
          ctx,
          { messages: [], turnCount: 1, dryRun: !expected },
          { resumeMode: true },
        );
        expect(resumeState.dryRun).toBe(expected);
      },
    );

    it('buildRetryReentryState applies defensive defaults for a legacy checkpoint missing core fields', () => {
      const cp = cpSubject();
      const ctx = cp.contextService.createContext('exec-a2a-2', 'wf-1', {
        initialVariables: { __workspaceId: 'ws-1' },
      });
      // 구(舊) checkpoint — schemaVersion·messages·turnCount·tokens 부재.
      const { resumeState } = cp.buildRetryReentryState(
        { id: 'exec-a2a-2', startedAt: new Date() },
        { id: 'node-1', type: 'ai_agent', config: { mode: 'multi_turn' } },
        ctx,
        { model: 'm' },
        { resumeMode: true },
      );
      expect(resumeState.messages).toEqual([]);
      expect(resumeState.turnCount).toBe(0);
      expect(resumeState.totalInputTokens).toBe(0);
      expect(resumeState.totalOutputTokens).toBe(0);
      expect(resumeState.totalThinkingTokens).toBe(0);
      expect(resumeState.toolCalls).toBe(0);
    });

    // INFO #11 (SUMMARY) — buildResumeCheckpoint(null) 도 toBeUndefined 단언.
    it('buildResumeCheckpoint returns undefined for null input', () => {
      expect(
        cpSubject().buildResumeCheckpoint(null as unknown as undefined),
      ).toBeUndefined();
    });

    // INFO #10 (SUMMARY) — 경계값: schemaVersion === 1 (현재 버전과 동일) 은
    // RESUME_INCOMPATIBLE_STATE 를 발생시키지 않아야 한다.
    it('buildRetryReentryState with schemaVersion:1 (current version) succeeds without throwing', () => {
      const cp = cpSubject();
      const ctx = cp.contextService.createContext('exec-a2a-v1', 'wf-1', {
        initialVariables: { __workspaceId: 'ws-1' },
      });
      // schemaVersion: 1 은 현재 지원 버전 — 재구성 가능.
      expect(() =>
        cp.buildRetryReentryState(
          { id: 'exec-a2a-v1', startedAt: new Date() },
          { id: 'node-1', type: 'ai_agent', config: { mode: 'multi_turn' } },
          ctx,
          {
            schemaVersion: 1,
            messages: [{ role: 'user', content: 'hello' }],
            turnCount: 1,
            model: 'm',
          },
          { resumeMode: true },
        ),
      ).not.toThrow();
    });

    // PR-A2b — information_extractor 멀티턴 checkpoint 확장 (spec §1.3 allow-list
    // 합집합). IE 고유 runtime state(partialResult/collectionRetryCount) 영속 +
    // config 필드(outputSchema/examples/instructions/maxCollectionRetries) 재유도.
    describe('information_extractor checkpoint 확장 (PR-A2b)', () => {
      it('buildResumeCheckpoint persists IE runtime state (partialResult / collectionRetryCount)', () => {
        const checkpoint = cpSubject().buildResumeCheckpoint({
          messages: [],
          turnCount: 2,
          partialResult: { name: 'Alice' },
          collectionRetryCount: 1,
        });
        expect(checkpoint?.partialResult).toEqual({ name: 'Alice' });
        expect(checkpoint?.collectionRetryCount).toBe(1);
      });

      it('buildResumeCheckpoint defaults IE fields when absent (ai_agent inert)', () => {
        const checkpoint = cpSubject().buildResumeCheckpoint({
          messages: [],
          turnCount: 0,
        });
        expect(checkpoint?.partialResult).toEqual({});
        expect(checkpoint?.collectionRetryCount).toBe(0);
      });

      it('buildRetryReentryState re-derives IE config from node.config + restores IE runtime state', () => {
        // W4 (ai-review) — cpSubject() 를 단일화해 동일 it 내 두 번 호출로 인한
        // 인스턴스 불일치 가능성을 제거한다.
        const cp = cpSubject();
        const ctx = cp.contextService.createContext('exec-a2b-ie', 'wf-1', {
          initialVariables: { __workspaceId: 'ws-1' },
        });
        const { resumeState } = cp.buildRetryReentryState(
          { id: 'exec-a2b-ie', startedAt: new Date() },
          {
            id: 'node-ie',
            type: 'information_extractor',
            config: {
              mode: 'multi_turn',
              outputSchema: [{ name: 'email', type: 'string' }],
              examples: [{ in: 'a', out: 'b' }],
              instructions: 'extract email',
              maxCollectionRetries: 5,
            },
          },
          ctx,
          {
            messages: [{ role: 'user', content: 'hi' }],
            turnCount: 1,
            partialResult: { email: 'x@y.z' },
            collectionRetryCount: 2,
          },
          { resumeMode: true },
        );
        // config re-derived from node.config
        expect(resumeState.outputSchema).toEqual([
          { name: 'email', type: 'string' },
        ]);
        expect(resumeState.instructions).toBe('extract email');
        expect(resumeState.maxCollectionRetries).toBe(5);
        expect(resumeState.examples).toEqual([{ in: 'a', out: 'b' }]);
        // IE runtime state restored from checkpoint
        expect(resumeState.partialResult).toEqual({ email: 'x@y.z' });
        expect(resumeState.collectionRetryCount).toBe(2);
      });

      it('buildRetryReentryState defaults IE config/state when absent', () => {
        const cp = cpSubject();
        const ctx = cp.contextService.createContext('exec-a2b-ie2', 'wf-1', {
          initialVariables: { __workspaceId: 'ws-1' },
        });
        const { resumeState } = cp.buildRetryReentryState(
          { id: 'exec-a2b-ie2', startedAt: new Date() },
          {
            id: 'node-ie',
            type: 'information_extractor',
            config: { mode: 'multi_turn' },
          },
          ctx,
          { model: 'm' },
          { resumeMode: true },
        );
        expect(resumeState.outputSchema).toEqual([]);
        expect(resumeState.maxCollectionRetries).toBe(3);
        expect(resumeState.instructions).toBe('');
        expect(resumeState.partialResult).toEqual({});
        expect(resumeState.collectionRetryCount).toBe(0);
      });

      // INFO #8 (ai-review) — collectionRetryCount 의 typeof === 'number' 방어 가드
      // 엣지 케이스: 문자열 "2" / null 입력 시 0 수렴 검증.
      it('buildRetryReentryState coerces non-number collectionRetryCount to 0 ("2" / null)', () => {
        const cp = cpSubject();
        const ctx = cp.contextService.createContext('exec-a2b-ie3', 'wf-1', {
          initialVariables: { __workspaceId: 'ws-1' },
        });
        const { resumeState: rs1 } = cp.buildRetryReentryState(
          { id: 'exec-a2b-ie3', startedAt: new Date() },
          {
            id: 'node-ie',
            type: 'information_extractor',
            config: { mode: 'multi_turn' },
          },
          ctx,
          { collectionRetryCount: '2' as unknown as number },
          { resumeMode: true },
        );
        expect(rs1.collectionRetryCount).toBe(0);

        const { resumeState: rs2 } = cp.buildRetryReentryState(
          { id: 'exec-a2b-ie3', startedAt: new Date() },
          {
            id: 'node-ie',
            type: 'information_extractor',
            config: { mode: 'multi_turn' },
          },
          ctx,
          { collectionRetryCount: null as unknown as number },
          { resumeMode: true },
        );
        expect(rs2.collectionRetryCount).toBe(0);
      });
    });
  });

  // Phase 2.3a — §7.5 rehydration 본 구현 단위 검증. happy-path (form 제출 →
  // 워크플로 완료) 는 e2e 에서 별도 검증; 본 블록은 invariant fail-fast 분기를
  // 검증해 RESUME_* 코드 분류가 정확한지 보장한다.
  describe('Rehydration — §7.5 Resume after Restart', () => {
    type RehydrationSubject = {
      rehydrateAndResume: (
        executionId: string,
        nodeExecutionId: string,
        payload: unknown,
      ) => Promise<void>;
    };
    const subject = () => service as unknown as RehydrationSubject;

    beforeEach(() => {
      // exec-park D6 full B3 — rehydrateAndResume 은 fast-path 없이 항상 §7.5
      // rehydration 으로 진입하므로 별도 비활성화가 필요 없다.
      mockExecutionRepo.findOneBy.mockReset();
      mockExecutionRepo.save.mockClear();
      // createQueryBuilder 의 chain mock — markExecutionCancelled /
      // markNodeExecutionFailed 가 사용. 본 테스트는 호출 여부만 검증하므로
      // execute() 가 resolves 하도록 가벼운 stub.
      const buildUpdateChain = (): {
        update: jest.Mock;
        set: jest.Mock;
        where: jest.Mock;
        andWhere: jest.Mock;
        execute: jest.Mock;
      } => {
        const chain = {
          update: jest.fn(),
          set: jest.fn(),
          setParameter: jest.fn(),
          where: jest.fn(),
          andWhere: jest.fn(),
          returning: jest.fn(),
          execute: jest
            .fn()
            .mockResolvedValue({ affected: 1, raw: [{ duration_ms: 1234 }] }),
        };
        chain.update.mockReturnValue(chain);
        chain.set.mockReturnValue(chain);
        chain.setParameter.mockReturnValue(chain);
        chain.where.mockReturnValue(chain);
        chain.andWhere.mockReturnValue(chain);
        chain.returning.mockReturnValue(chain);
        return chain;
      };
      mockExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildUpdateChain);
      mockNodeExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildUpdateChain);
    });

    // W3 (ai-review) — 비동기 예외/강제 중단 시 spyOn 복원 누락 방지 안전망.
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // CLE-EXEC-RECOVERY-REHYDRATE — Execution 이 terminal(재개 불가) 이면 RESUME_CHECKPOINT_MISSING.
    // 주의: RUNNING 은 §7.5 원자 claim 진입 후 상태라 **허용값**이므로 reject 테스트에
    // 쓰면 안 된다(가드 통과 → false-green). terminal(CANCELLED)로 검증한다.
    it('Execution terminal(CANCELLED) → RESUME_CHECKPOINT_MISSING (early reject, rehydrate 미진입)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.CANCELLED,
      });
      const rehydrateSpy = jest
        .spyOn(service, 'rehydrateContext')
        .mockRejectedValue(new Error('should-not-reach'));

      await subject().rehydrateAndResume(executionId, 'ne-1', { foo: 1 });

      // execution.update(...) chain 호출 → execute() 1회 (markExecutionCancelled)
      const execChain = mockExecutionRepo.createQueryBuilder.mock.results[0]
        .value as { execute: jest.Mock };
      expect(execChain.execute).toHaveBeenCalled();
      // Execution status 가드에서 early throw → node 로드·rehydrate 미진입.
      expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(rehydrateSpy).not.toHaveBeenCalled();
    });

    // CLE-EXEC-RECOVERY-REHYDRATE — claim 진입 후 Execution·NodeExecution 이 RUNNING 이면 **재개 가능**으로
    // 허용돼 status 가드를 통과하고 rehydrate 로 진입한다 (RUNNING 이 거부되던 옛 동작의
    // 회귀 방지 positive 테스트).
    it('Execution/NodeExecution RUNNING(claim 후) → status 가드 통과, rehydrate 진입', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.RUNNING,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.RUNNING,
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-1', type: 'form' });
      // rehydrate 로 진입했음을 sentinel 로 확인 (진입 후는 본 테스트 범위 밖).
      const rehydrateSpy = jest
        .spyOn(service, 'rehydrateContext')
        .mockRejectedValue(new Error('reached-rehydrate'));

      await subject().rehydrateAndResume(executionId, 'ne-1', { foo: 1 });

      // 두 status 가드(Execution·NodeExecution) 모두 RUNNING 을 통과 → rehydrate 도달.
      expect(rehydrateSpy).toHaveBeenCalled();
    });

    it('__no_node_exec__ sentinel → RESUME_CHECKPOINT_MISSING', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });

      await subject().rehydrateAndResume(executionId, '__no_node_exec__', {});

      const execChain = mockExecutionRepo.createQueryBuilder.mock.results[0]
        .value as { execute: jest.Mock };
      expect(execChain.execute).toHaveBeenCalled();
      expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('NodeExecution not WAITING_FOR_INPUT → RESUME_CHECKPOINT_MISSING (둘 다 마킹)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.COMPLETED, // already moved on
      });

      await subject().rehydrateAndResume(executionId, 'ne-1', {});

      // resolvedNodeExecutionId 는 invariant 통과 못해서 null — NodeExecution 마킹 미호출
      // (코드 흐름: resolvedNodeExecutionId = nodeExec.id 는 status 검증 통과한 뒤에 set)
      expect(
        mockExecutionRepo.createQueryBuilder.mock.results[0].value.execute,
      ).toHaveBeenCalled();
      expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('Node 정의 부재 → RESUME_CHECKPOINT_MISSING (Execution + NodeExecution 모두 마킹)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-missing',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(null);

      await subject().rehydrateAndResume(executionId, 'ne-1', {});

      expect(
        mockExecutionRepo.createQueryBuilder.mock.results[0].value.execute,
      ).toHaveBeenCalled();
      // NodeExecution 마킹도 호출 (resolvedNodeExecutionId 가 set 된 상태)
      expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('Multi-turn AI 노드 + _resumeCheckpoint 부재 → RESUME_INCOMPATIBLE_STATE (graceful reset)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        triggerId: 'trg-ai',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: {
          __triggerSource: 'webhook',
          chatChannel: {
            provider: 'telegram',
            conversationKey: 'ck-ai',
            channelUserKey: 'u-ai',
          },
        },
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          // _resumeCheckpoint 부재 (배포 이전 진입한 waiting row) → 재구성 불가.
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
      });
      // rehydrateContext 는 contextService 가 in-memory 새 context 를 생성하므로
      // workflow / log 조회가 필요. 가벼운 stub.
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);
      mockWebsocketService.registerExecutionRouting.mockClear();

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // WARNING #1 회귀 가드 — RESUME_INCOMPATIBLE_STATE 경로에서도 routing context
      // 재등록이 markExecutionCancelled 보다 먼저 일어나야 graceful 안내가 도달한다.
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(
        executionId,
        expect.objectContaining({ triggerId: expect.any(String) }),
      );

      // RESUME_INCOMPATIBLE_STATE 마킹 — execution 과 nodeExecution 양쪽 chain.
      expect(
        mockExecutionRepo.createQueryBuilder.mock.results[0].value.execute,
      ).toHaveBeenCalled();
      expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();
      // set() 호출에 'RESUME_INCOMPATIBLE_STATE' 가 들어갔는지 확인
      const setCall = mockExecutionRepo.createQueryBuilder.mock.results[0].value
        .set.mock.calls[0][0] as {
        error: { code: string };
      };
      expect(setCall.error.code).toBe('RESUME_INCOMPATIBLE_STATE');

      // 방안 D — affected>0 이면 EXECUTION_CANCELLED 가 error.code 와 함께
      // emit 돼 채널 어댑터가 graceful 안내를 보낼 수 있다 (과거엔 무음).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({
          result: { cancelledBy: 'system' },
          error: expect.objectContaining({
            code: 'RESUME_INCOMPATIBLE_STATE',
          }),
          // 이 경로는 엔티티를 로드하지 않는다 — UPDATE 의 `RETURNING duration_ms` 가
          // 돌려준 값이 emit 까지 그대로 흘러야 한다(DB=wire). mock 이 1234 를 준다.
          durationMs: 1234,
        }),
      );
    });

    it('markExecutionCancelled: affected=0 (이미 처리됨) 이면 EXECUTION_CANCELLED emit 억제', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
        },
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-1', type: 'ai_agent' });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);
      // execution update chain 이 affected:0 (다른 worker 가 먼저 처리) 반환.
      mockExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(() => {
          // `setParameter`/`returning` 이 빠지면 체인이 TypeError 를 던지고 함수를
          // 감싼 try/catch 가 그걸 삼킨다 — 그러면 검증하려는 `affected > 0` 가드
          // 분기 자체가 실행되지 않아 **가드를 통째로 지워도 GREEN** 이다.
          // 실제로 그 상태였고, 이 PR 이 두 메서드를 추가하면서 만든 회귀다.
          const chain = {
            update: jest.fn(),
            set: jest.fn(),
            setParameter: jest.fn(),
            where: jest.fn(),
            andWhere: jest.fn(),
            returning: jest.fn(),
            execute: jest.fn().mockResolvedValue({ affected: 0 }),
          };
          chain.update.mockReturnValue(chain);
          chain.set.mockReturnValue(chain);
          chain.setParameter.mockReturnValue(chain);
          chain.where.mockReturnValue(chain);
          chain.andWhere.mockReturnValue(chain);
          chain.returning.mockReturnValue(chain);
          return chain;
        });
      mockWebsocketService.emitExecutionEvent.mockClear();

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // affected=0 → EXECUTION_CANCELLED emit 미발생 (중복 emit 방지).
      const cancelledEmits =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.cancelled',
        );
      expect(cancelledEmits).toHaveLength(0);
    });

    it('Multi-turn AI 노드 + _resumeCheckpoint 존재 → 재구성 후 processAiResumeTurn 재진입 (RESUME_INCOMPATIBLE_STATE 미발생)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          // §7.5 — credential-strip 부분집합이 영속돼 있으면 재구성 가능.
          _resumeCheckpoint: {
            messages: [{ role: 'user', content: 'prev' }],
            turnCount: 1,
            model: 'test-model',
            totalInputTokens: 3,
            totalOutputTokens: 1,
          },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      // W3 (ai-review) — jest.spyOn 으로 교체해 비동기 예외/강제 중단 시
      // 전역 서비스 인스턴스 오염을 방지한다. afterEach(() => jest.restoreAllMocks())
      // 가 describe 블록에 등록돼 있어 개별 복원 코드 불필요.
      const svcAny = service as unknown as {
        loadAndBuildGraph: (...args: unknown[]) => Promise<unknown>;
      };
      // 그래프는 waiting node 단일 — post-branch traversal 이 즉시 종료.
      const loadSpy = jest
        .spyOn(svcAny, 'loadAndBuildGraph')
        .mockResolvedValue({
          graphNodes: [],
          graphEdges: [],
          forwardEdges: [],
          backEdges: [],
          sortedNodeIds: ['node-1'],
          sortedIndexMap: new Map([['node-1', 0]]),
          backEdgeMap: new Map(),
          outgoingEdgeMap: new Map(),
          incomingEdgeMap: new Map(),
          nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
        });
      // Phase B (exec-park D4) — top-level AI resume 은 옛 장수 루프
      // waitForAiConversation 대신 단발 turn 처리기 processAiResumeTurn 으로
      // 재진입한다. 도착한 payload 1건만 처리하고 (계속이면 re-park) 반환.
      // C-1 step2 — processAiResumeTurn 은 orchestrator 로 이동 (registry 위임).
      const turnSpy = jest
        .spyOn(aiTurnOrchestrator, 'processAiResumeTurn')
        .mockResolvedValue(undefined);

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // 재구성 분기 도달 — processAiResumeTurn 호출 (early throw 미발생).
      expect(turnSpy).toHaveBeenCalledTimes(1);
      // 도착한 turn(payload) 이 그대로 전달됐는지 — driveResumeAwaited 가
      // opts.payload 를 processAiResumeTurn 으로 직접 forward.
      expect(turnSpy).toHaveBeenCalledWith(
        expect.anything(), // savedExecution
        executionId,
        expect.objectContaining({ id: 'node-1' }),
        expect.anything(), // context
        expect.anything(), // nodeExec
        expect.any(Object), // resumeState
        { type: 'ai_message', message: 'hi' },
      );

      // RESUME_INCOMPATIBLE_STATE 로 cancel 되지 않았는지 — execution
      // createQueryBuilder.set 에 해당 코드가 들어가지 않았다.
      const cancelSetCalls =
        mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
          (r) =>
            (
              r.value as {
                set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
              }
            ).set?.mock?.calls ?? [],
        );
      const codes = cancelSetCalls
        .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
        .filter(Boolean);
      expect(codes).not.toContain('RESUME_INCOMPATIBLE_STATE');

      loadSpy.mockRestore();
      turnSpy.mockRestore();
    });

    // PR-A2b — information_extractor 노드도 _resumeCheckpoint 재구성으로 재개된다
    // (guard 확장: node.type === 'information_extractor' 도 재진입 분기 진입).
    it('information_extractor 노드 + _resumeCheckpoint 존재 → 재구성 후 재진입 (RESUME_INCOMPATIBLE_STATE 미발생)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-ie',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          // IE checkpoint — 고유 runtime state(partialResult/collectionRetryCount) 포함.
          _resumeCheckpoint: {
            schemaVersion: 1,
            messages: [{ role: 'user', content: 'prev' }],
            turnCount: 1,
            partialResult: { email: 'a@b.c' },
            collectionRetryCount: 1,
          },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-ie',
        type: 'information_extractor',
        config: {
          mode: 'multi_turn',
          outputSchema: [{ name: 'email', type: 'string' }],
          maxCollectionRetries: 3,
        },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      // W3 (ai-review) — jest.spyOn 으로 교체해 비동기 예외/강제 중단 시
      // 전역 서비스 인스턴스 오염을 방지한다.
      const svcAny = service as unknown as {
        loadAndBuildGraph: (...args: unknown[]) => Promise<unknown>;
        contextService: {
          seedNodeOutput: jest.Mock;
          getContext: (
            key: string,
          ) => { nodeOutputCache: Record<string, unknown> } | undefined;
        };
      };
      const loadSpy = jest
        .spyOn(svcAny, 'loadAndBuildGraph')
        .mockResolvedValue({
          graphNodes: [],
          graphEdges: [],
          forwardEdges: [],
          backEdges: [],
          sortedNodeIds: ['node-ie'],
          sortedIndexMap: new Map([['node-ie', 0]]),
          backEdgeMap: new Map(),
          outgoingEdgeMap: new Map(),
          incomingEdgeMap: new Map(),
          nodeMap: new Map([
            ['node-ie', { id: 'node-ie', type: 'information_extractor' }],
          ]),
        });
      // Phase B (exec-park D4) — IE multi-turn resume 도 동일 공용 경로:
      // 단발 turn 처리기 processAiResumeTurn 으로 재진입.
      // C-1 step2 — processAiResumeTurn 은 orchestrator 로 이동 (registry 위임).
      const turnSpy = jest
        .spyOn(aiTurnOrchestrator, 'processAiResumeTurn')
        .mockResolvedValue(undefined);

      // W6 (ai-review) — seedNodeOutput 호출 인자를 캡처해 buildRetryReentryState 가
      // checkpoint 로부터 partialResult/collectionRetryCount 를 실제 복원했는지
      // toMatchObject 로 검증한다. processAiResumeTurn 시그니처상 resumeState 가
      // 인자로 오지만, 재구성 결과가 nodeOutputCache 에도 seed 되므로 양쪽 검증
      // 가능 — 여기서는 기존대로 context.seedNodeOutput 에 seed 된 값을 조회한다.
      const seedNodeOutputSpy = jest.spyOn(
        svcAny.contextService,
        'seedNodeOutput',
      );

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // guard 확장으로 IE 도 재구성 분기 도달 — processAiResumeTurn 호출.
      expect(turnSpy).toHaveBeenCalledTimes(1);

      // W6 — seeded nodeOutputCache 에 partialResult/collectionRetryCount 가 복원됐는지.
      const seededCalls = seedNodeOutputSpy.mock.calls;
      expect(seededCalls.length).toBeGreaterThan(0);
      const seededOutput = seededCalls[seededCalls.length - 1][2] as Record<
        string,
        unknown
      >;
      const seededResumeState = seededOutput._resumeState as
        Record<string, unknown> | undefined;
      expect(seededResumeState).toMatchObject({
        partialResult: { email: 'a@b.c' },
        collectionRetryCount: 1,
      });

      const cancelSetCalls =
        mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
          (r) =>
            (
              r.value as {
                set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
              }
            ).set?.mock?.calls ?? [],
        );
      const codes = cancelSetCalls
        .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
        .filter(Boolean);
      expect(codes).not.toContain('RESUME_INCOMPATIBLE_STATE');

      seedNodeOutputSpy.mockRestore();
      loadSpy.mockRestore();
      turnSpy.mockRestore();
    });

    // PR-A2a — checkpoint schemaVersion 미래 버전(롤링 배포 중 구 인스턴스가 신
    // 포맷 pickup) → 안전 재구성 불가 → graceful RESUME_INCOMPATIBLE_STATE (§1.3/§7.5).
    it('Multi-turn AI 노드 + _resumeCheckpoint schemaVersion 미래 버전 → RESUME_INCOMPATIBLE_STATE (graceful reset)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        triggerId: 'trg-1',
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeCheckpoint: {
            schemaVersion: 999, // 미래 버전 — 현재 코드 미지원
            messages: [{ role: 'user', content: 'prev' }],
            turnCount: 1,
            model: 'm',
          },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn' },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      // W2 (SUMMARY) — jest.spyOn 으로 교체해 복원 누락 side-effect 방지.
      // C-1 step2 — waitForAiConversation 은 orchestrator 로 이동.
      const orchAny = aiTurnOrchestrator as unknown as {
        waitForAiConversation: (...args: unknown[]) => Promise<void>;
      };
      const waitSpy = jest
        .spyOn(orchAny, 'waitForAiConversation')
        .mockResolvedValue(undefined);

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // 버전 가드가 graph rebuild 이전에 throw → 재진입(waitForAiConversation) 미발생.
      expect(waitSpy).not.toHaveBeenCalled();

      // RESUME_INCOMPATIBLE_STATE 로 cancel 마킹.
      const cancelSetCalls =
        mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
          (r) =>
            (
              r.value as {
                set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
              }
            ).set?.mock?.calls ?? [],
        );
      const codes = cancelSetCalls
        .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
        .filter(Boolean);
      // INFO #4 (SUMMARY) — false-pass 방지: codes 가 비어있으면 toContain 이
      // 통과할 수 없으므로 사전 가드로 어설션 무결성을 보장한다.
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain('RESUME_INCOMPATIBLE_STATE');

      // INFO #3 (SUMMARY) — spec §7.5 "동반 NodeExecution failed 마킹" 검증.
      expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();

      waitSpy.mockRestore();
    });

    // INFO #9 (ai-review) — IE 노드 + schemaVersion:999 → RESUME_INCOMPATIBLE_STATE
    // graceful reset (기존 ai_agent 미래 버전 테스트 패턴의 IE 버전).
    it('IE 노드 + _resumeCheckpoint schemaVersion 미래 버전 → RESUME_INCOMPATIBLE_STATE (graceful reset)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        triggerId: 'trg-ie-fv',
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-ie-fv',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeCheckpoint: {
            schemaVersion: 999, // 미래 버전 — 현재 코드 미지원
            messages: [{ role: 'user', content: 'prev' }],
            partialResult: { name: 'Alice' },
            collectionRetryCount: 1,
          },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-ie-fv',
        type: 'information_extractor',
        config: { mode: 'multi_turn', outputSchema: [] },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      // C-1 step2 — waitForAiConversation 은 orchestrator 로 이동.
      const orchAny2 = aiTurnOrchestrator as unknown as {
        waitForAiConversation: (...args: unknown[]) => Promise<void>;
      };
      const waitSpyIe = jest
        .spyOn(orchAny2, 'waitForAiConversation')
        .mockResolvedValue(undefined);

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // 버전 가드 → 재진입(waitForAiConversation) 미발생.
      expect(waitSpyIe).not.toHaveBeenCalled();

      // RESUME_INCOMPATIBLE_STATE 마킹.
      const cancelSetCalls =
        mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
          (r) =>
            (
              r.value as {
                set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
              }
            ).set?.mock?.calls ?? [],
        );
      const codes = cancelSetCalls
        .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
        .filter(Boolean);
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain('RESUME_INCOMPATIBLE_STATE');

      waitSpyIe.mockRestore();
    });

    // exec-park D6 full B3 — slow-path 재개는 BullMQ worker 의 process() 안에서
    // 수행되며, 이제 `driveResumeAwaited` 를 **await** 한다 (옛 detach 모델 폐기).
    // 단발 turn 처리기(processButtonResumeTurn / processAiResumeTurn)는 한 세그먼트
    // (또는 멀티턴 AI 의 한 turn → re-park)만 처리하고 반환하므로 worker 슬롯
    // deadlock 위험이 없다. 본 블록은 resume 드라이브가 도착 payload 를 직접 처리기로
    // 전달하고 남은 그래프(runNodeDispatchLoop)를 구동해 완결됨을 가드한다. 1s
    // completionGuard 로 hang 회귀를 잡는다.

    const twoNodeGraph = {
      graphNodes: [],
      graphEdges: [],
      forwardEdges: [],
      backEdges: [],
      sortedNodeIds: ['node-1', 'node-2'],
      sortedIndexMap: new Map([
        ['node-1', 0],
        ['node-2', 1],
      ]),
      backEdgeMap: new Map(),
      outgoingEdgeMap: new Map(),
      incomingEdgeMap: new Map(),
      nodeMap: new Map([
        ['node-1', { id: 'node-1', type: 'carousel' }],
        ['node-2', { id: 'node-2', type: 'carousel' }],
      ]),
    };

    function makeCompletionGuard(): {
      guard: Promise<never>;
      timer: NodeJS.Timeout;
    } {
      let timer!: NodeJS.Timeout;
      const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'HANG: rehydrateAndResume 가 반환하지 않음 — 처리기/그래프 구동이 완결되지 않음',
              ),
            ),
          1000,
        );
      });
      return { guard, timer };
    }

    it('slow-path resume 은 도착 payload 를 processButtonResumeTurn 으로 직접 전달하고 다운스트림 그래프를 await 구동해 완결한다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'buttons' },
          status: 'waiting_for_input',
          buttonConfig: { buttons: [{ id: 'b1', type: 'port', label: 'B1' }] },
        },
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-1', type: 'carousel', config: {} });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      // C-1 step3 — processButtonResumeTurn 은 ButtonInteractionService 로 이동.
      // loadAndBuildGraph / runNodeDispatchLoop / updateExecutionStatus 는 엔진
      // 인스턴스에 둔다 (registry 가 this.buttonInteraction.processButtonResumeTurn
      // 으로 위임하므로 button 처리기는 그 인스턴스에서 스텁).
      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        runNodeDispatchLoop: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const btnAny = buttonInteraction as unknown as {
        processButtonResumeTurn: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        btn: btnAny.processButtonResumeTurn,
        loop: svcAny.runNodeDispatchLoop,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue(twoNodeGraph);
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      // processButtonResumeTurn: 도착 click 을 직접 처리(단일 상호작용).
      btnAny.processButtonResumeTurn = jest.fn().mockResolvedValue(undefined);
      // 남은 그래프 구동 — 다음 노드에서 park (runNodeDispatchLoop 는 { parked } 반환).
      svcAny.runNodeDispatchLoop = jest
        .fn()
        .mockResolvedValue({ parked: false });

      const { guard, timer } = makeCompletionGuard();
      try {
        // resume 은 이제 await 된다 — 처리기 + 그래프 구동이 완결될 때까지 반환하지
        // 않으며, 완결되면 정상 resolve 한다 (hang 없음).
        await Promise.race([
          subject().rehydrateAndResume(executionId, 'ne-1', {
            type: 'button_click',
            buttonId: 'b1',
          }),
          guard,
        ]);
        expect(btnAny.processButtonResumeTurn).toHaveBeenCalledTimes(1);
        // 도착 payload 가 직접 처리기로 forward 됐는지.
        expect(btnAny.processButtonResumeTurn).toHaveBeenCalledWith(
          expect.anything(), // savedExecution
          executionId,
          expect.objectContaining({ id: 'node-1' }),
          expect.anything(), // context
          { type: 'button_click', buttonId: 'b1' },
        );
        expect(svcAny.runNodeDispatchLoop).toHaveBeenCalledTimes(1);
      } finally {
        clearTimeout(timer);
        await flushPromises();
        svcAny.loadAndBuildGraph = orig.load;
        btnAny.processButtonResumeTurn = orig.btn;
        svcAny.runNodeDispatchLoop = orig.loop;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });

    it('slow-path ai_agent 재개: 도착 turn 을 processAiResumeTurn 으로 직접 전달하고 await 한다 — re-park(PARK_RELEASED) 시 그래프 구동 없이 완결', async () => {
      // exec-park D6 full B3 — top-level AI resume 은 도착한 turn 1건을
      // processAiResumeTurn 으로 처리하고 (계속이면 re-park) 끝낸다. resume 드라이브는
      // 이제 await 되므로, 처리기가 반환할 때까지 기다린 뒤 정상 완결한다 (옛 detach
      // 모델 폐기 — 단발 turn 이라 worker 슬롯 deadlock 위험 없음). re-park 면
      // PARK_RELEASED 를 반환해 세그먼트를 종료(그래프 미진행)한다.
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      // C-1 step2 — processAiResumeTurn 은 orchestrator 로 이동. buildRetryReentryState /
      // updateExecutionStatus 는 EngineDriver(=엔진) 경유 호출이므로 엔진 인스턴스에 둔다.
      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        buildRetryReentryState: jest.Mock;
        runNodeDispatchLoop: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const orchAny = aiTurnOrchestrator as unknown as {
        processAiResumeTurn: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        build: svcAny.buildRetryReentryState,
        turn: orchAny.processAiResumeTurn,
        loop: svcAny.runNodeDispatchLoop,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue({
        ...twoNodeGraph,
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
      });
      svcAny.buildRetryReentryState = jest
        .fn()
        .mockReturnValue({ resumeState: {}, initialAction: undefined });
      svcAny.runNodeDispatchLoop = jest
        .fn()
        .mockResolvedValue({ parked: false });
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      // turn 처리기를 terminal(void resolve)로 스텁 — drive 가 이를 await 한다.
      orchAny.processAiResumeTurn = jest.fn().mockResolvedValue(undefined);

      const { guard, timer } = makeCompletionGuard();
      try {
        // resume 은 processAiResumeTurn(+남은 그래프)을 await 한 뒤 정상 완결한다.
        await Promise.race([
          subject().rehydrateAndResume(executionId, 'ne-1', {
            type: 'ai_message',
            message: 'hi',
          }),
          guard,
        ]);
        expect(orchAny.processAiResumeTurn).toHaveBeenCalledTimes(1);
        // 도착한 turn(payload)이 그대로 forward 됐는지.
        expect(orchAny.processAiResumeTurn).toHaveBeenCalledWith(
          expect.anything(), // savedExecution
          executionId,
          expect.objectContaining({ id: 'node-1' }),
          expect.anything(), // context
          expect.anything(), // nodeExec
          expect.any(Object), // resumeState
          { type: 'ai_message', message: 'hi' },
        );
      } finally {
        clearTimeout(timer);
        await flushPromises();
        svcAny.loadAndBuildGraph = orig.load;
        svcAny.buildRetryReentryState = orig.build;
        orchAny.processAiResumeTurn = orig.turn;
        svcAny.runNodeDispatchLoop = orig.loop;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });

    // driveResumeAwaited 의 RUNNING skip-guard. 재개 진입 원자 claim(CLE-EXEC-RECOVERY-REHYDRATE) 이
    // Execution 을 이미 WFI→RUNNING 페어링 전이시켰으면(processor 경로 → savedExecution
    // 은 RUNNING 으로 로드) 재개 sentinel 전이(updateExecutionStatus(RUNNING))를 건너뛴다
    // (RUNNING→RUNNING assertTransition throw 회피). legacy/직접 경로(WAITING)는 위
    // 테스트가 정상 전이를 구동해 커버.
    it('claim 후 Execution=RUNNING → 재개 sentinel 전이(updateExecutionStatus(RUNNING)) skip', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.RUNNING, // claim 이 이미 전이시킨 상태
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.RUNNING, // claim 후
        outputData: {
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        buildRetryReentryState: jest.Mock;
        runNodeDispatchLoop: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const orchAny = aiTurnOrchestrator as unknown as {
        processAiResumeTurn: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        build: svcAny.buildRetryReentryState,
        turn: orchAny.processAiResumeTurn,
        loop: svcAny.runNodeDispatchLoop,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue({
        ...twoNodeGraph,
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
      });
      svcAny.buildRetryReentryState = jest
        .fn()
        .mockReturnValue({ resumeState: {}, initialAction: undefined });
      svcAny.runNodeDispatchLoop = jest
        .fn()
        .mockResolvedValue({ parked: false });
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      orchAny.processAiResumeTurn = jest.fn().mockResolvedValue(undefined);

      const { guard, timer } = makeCompletionGuard();
      try {
        await Promise.race([
          subject().rehydrateAndResume(executionId, 'ne-1', {
            type: 'ai_message',
            message: 'hi',
          }),
          guard,
        ]);
        // 핵심: 재개 sentinel 전이(→RUNNING)는 claim 이 이미 했으므로 호출되지 않는다.
        const calledWithRunning = svcAny.updateExecutionStatus.mock.calls.some(
          (c) => c[1] === ExecutionStatus.RUNNING,
        );
        expect(calledWithRunning).toBe(false);
      } finally {
        clearTimeout(timer);
        await flushPromises();
        svcAny.loadAndBuildGraph = orig.load;
        svcAny.buildRetryReentryState = orig.build;
        orchAny.processAiResumeTurn = orig.turn;
        svcAny.runNodeDispatchLoop = orig.loop;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });

    // detached drive 내부에서 발생한 RehydrationError(ai_agent _resumeCheckpoint
    // 재구성 실패 = schema drift/손상)는 worker 로 rethrow 할 수 없으므로 in-band
    // graceful 단말 처리해야 한다: Execution cancelled(RESUME_INCOMPATIBLE_STATE) +
    // node failed. markExecutionCancelled 의 EXECUTION_CANCELLED emit 으로 채널
    // (텔레그램)에 "세션 만료" 안내가 도달한다 (#398 routing). full-detach 로 이
    // 분기가 outer catch → detached catch 로 이동했으므로 가드한다.
    it('detached ai_agent 재개: buildRetryReentryState 실패 → graceful cancelled(RESUME_INCOMPATIBLE_STATE) + node failed', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        buildRetryReentryState: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        build: svcAny.buildRetryReentryState,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue({
        ...twoNodeGraph,
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
      });
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      // 재구성 실패 (schema drift) 모사 — driveResumeAwaited 내부에서
      // RehydrationError(RESUME_INCOMPATIBLE_STATE)로 래핑된다.
      svcAny.buildRetryReentryState = jest.fn().mockImplementation(() => {
        throw new Error('schema drift');
      });

      try {
        // worker 가 await 하는 부분(setup)은 throw 없이 통과 → 즉시 resolve.
        await subject().rehydrateAndResume(executionId, 'ne-1', {
          type: 'ai_message',
          message: 'hi',
        });
        // detached drive 가 단말 처리하도록 drain.
        await flushPromises();
        await flushPromises();
        await flushPromises();

        // Execution cancel UPDATE 에 RESUME_INCOMPATIBLE_STATE 코드가 들어갔는지.
        const cancelCodes =
          mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
            (r) =>
              (
                r.value as {
                  set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
                }
              ).set?.mock?.calls ?? [],
          );
        const codes = cancelCodes
          .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
          .filter(Boolean);
        expect(codes).toContain('RESUME_INCOMPATIBLE_STATE');
        // 동반 NodeExecution failed 마킹도 수행 (createQueryBuilder 사용).
        expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();

        // RUNNING-stuck 가드 — 본 경로는 driveResumeAwaited 가
        // updateExecutionStatus(RUNNING) 이후 도달하므로, Execution cancel UPDATE 의
        // status 조건이 **RUNNING 도 포함**해야 한다 (WAITING_FOR_INPUT 만이면
        // 운영에서 affected=0 → cancel 미반영 + EXECUTION_CANCELLED emit 억제 →
        // 텔레그램 graceful 안내 무음). `status IN (:...statuses)` 의 statuses 검증.
        const andWhereStatusGuards =
          mockExecutionRepo.createQueryBuilder.mock.results
            .flatMap(
              (r) =>
                (
                  r.value as {
                    andWhere?: { mock?: { calls: unknown[][] } };
                  }
                ).andWhere?.mock?.calls ?? [],
            )
            .map(
              (c) => (c[1] as { statuses?: unknown[] } | undefined)?.statuses,
            )
            .filter((s): s is unknown[] => Array.isArray(s));
        expect(andWhereStatusGuards.length).toBeGreaterThan(0);
        const cancelStatusGuard = andWhereStatusGuards.find((s) =>
          s.includes(ExecutionStatus.WAITING_FOR_INPUT),
        );
        expect(cancelStatusGuard).toBeDefined();
        expect(cancelStatusGuard).toContain(ExecutionStatus.RUNNING);
      } finally {
        svcAny.loadAndBuildGraph = orig.load;
        svcAny.buildRetryReentryState = orig.build;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });
  });

  // §7.5 — buildResumeCheckpoint credential-strip allow-list 단위 테스트.
  // allow-list 변경 시 credential 누수를 자동 감지하는 보안 경계 가드.
  describe('buildResumeCheckpoint (credential-strip allow-list)', () => {
    function build(state: unknown): Record<string, unknown> | undefined {
      return (
        service as unknown as {
          buildResumeCheckpoint(
            s: Record<string, unknown> | undefined,
          ): Record<string, unknown> | undefined;
        }
      ).buildResumeCheckpoint(state as Record<string, unknown> | undefined);
    }

    it('safe 필드는 보존, credential / context-binding 필드는 배제', () => {
      const cp = build({
        // safe (보존)
        messages: [{ role: 'user', content: 'hi' }],
        turnCount: 2,
        totalInputTokens: 7,
        totalOutputTokens: 3,
        totalThinkingTokens: 1,
        toolCalls: 1,
        model: 'gpt-x',
        temperature: 0.5,
        maxTokens: 1000,
        knowledgeBases: ['kb1'],
        ragTopK: 4,
        ragThreshold: 0.7,
        ragSources: [{ chunkId: 'c1' }],
        mcpServers: [{ url: 'secret://x' }],
        // credential / context-binding (배제)
        llmConfigId: 'cred-canary',
        workspaceId: 'ws-canary',
        executionId: 'exec',
        nodeId: 'node',
        workflowId: 'wf',
        presentationTools: [{ a: 1 }],
        conditions: [{ id: 'c' }],
        maxTurns: 20,
        maxToolCalls: 10,
        conversationThreadRef: { turns: [] },
        rawConfig: { systemPrompt: 'INTERNAL' },
        systemPrompt: 'INTERNAL_PROMPT',
        turnDebugHistory: [{ turnIndex: 1 }],
      })!;
      // 보존
      expect(cp.turnCount).toBe(2);
      expect(cp.model).toBe('gpt-x');
      expect(cp.totalInputTokens).toBe(7);
      expect((cp.messages as unknown[]).length).toBe(1);
      expect(cp.knowledgeBases).toEqual(['kb1']);
      expect(cp.mcpServers).toEqual([{ url: 'secret://x' }]);
      // 배제 (credential / context-binding / debug)
      for (const k of [
        'llmConfigId',
        'workspaceId',
        'executionId',
        'nodeId',
        'workflowId',
        'presentationTools',
        'conditions',
        'maxTurns',
        'maxToolCalls',
        'conversationThreadRef',
        'rawConfig',
        'systemPrompt',
        'turnDebugHistory',
      ]) {
        expect(cp).not.toHaveProperty(k);
      }
      // canary 가 직렬화에 새지 않는다.
      const s = JSON.stringify(cp);
      expect(s).not.toContain('cred-canary');
      expect(s).not.toContain('ws-canary');
      expect(s).not.toContain('INTERNAL');
    });

    it('pendingFormToolCall 존재 시 포함, 부재 시 미포함', () => {
      const withForm = build({
        messages: [],
        pendingFormToolCall: { toolCallId: 't1', formConfig: { x: 1 } },
      })!;
      expect(withForm.pendingFormToolCall).toEqual({
        toolCallId: 't1',
        formConfig: { x: 1 },
      });
      const without = build({ messages: [] })!;
      expect(without).not.toHaveProperty('pendingFormToolCall');
    });

    it('빈/누락 필드는 안전 기본값으로 정규화', () => {
      const cp = build({})!;
      expect(cp.messages).toEqual([]);
      expect(cp.turnCount).toBe(0);
      expect(cp.totalInputTokens).toBe(0);
      expect(cp.ragSources).toEqual([]);
      expect(cp.mcpServers).toEqual([]);
    });

    it('undefined / 비-객체 입력 → undefined 반환', () => {
      expect(build(undefined)).toBeUndefined();
      expect(build(null)).toBeUndefined();
      expect(build('x' as unknown)).toBeUndefined();
    });
  });
});
