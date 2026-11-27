import { ExecutionEngineService } from './execution-engine.service';
import {
  InvalidExecutionStateError,
  MessageTooLongError,
  FormValidationError,
} from './workflow-errors';
import { resolveWaitingSurface } from './waiting-surface-guard';
import { MB_IN_BYTES } from '../chat-channel/shared/form-mode';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
} from './__test-utils__/engine-service-harness';
import {
  installTxByAffected,
  installTxUpdateBuilders,
  type TxAffected,
} from './__test-utils__/update-query-builder.mock';

/**
 * ExecutionEngineService 단위 테스트: 재개 진입점 · durable WAITING 취소 · 재개 claim · 롤백 · 경로 기록.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockWaitingQb: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      mockWebsocketService,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockWaitingQb,
    } = h);
  });

  // Phase 2 (workflow-resumable-execution) — 5개 continuation 진입점이
  // ContinuationBusService.publish (BullMQ enqueue) 로 fan-out 되는지 +
  // applyContinuation / applyCancellation dispatch (BullMQ Worker 가 호출하는
  // entry) 가 로컬 `pendingContinuations` Map 의 resolver 를 호출하는지 검증.
  // 옛 Redis pub/sub `on(type, handler)` 등록 경로는 폐기 (spec §7.4).
  describe('continuation entry points → bus.publish + apply* dispatch', () => {
    let mockBus: {
      on: jest.Mock;
      publish: jest.Mock;
      acquireLock: jest.Mock;
    };

    beforeEach(() => {
      mockBus = (service as unknown as { continuationBus: typeof mockBus })
        .continuationBus;
      mockBus.publish.mockClear();
    });

    it('continueExecution → bus.publish({type:"continue", payload:{type:"form_submitted",formData}}) (spec §10.9 wrap)', async () => {
      // spec/4-nodes/6-presentation/0-common.md §10.9 — wrap 책임은
      // continueExecution. raw formData 가 아닌 sentinel 형태로 publish.
      // 기본 mock find 가 WAITING_FOR_INPUT row 1건 (id=ne-waiting) 을 반환하므로
      // resolveWaitingNodeExecutionId 가 그 id 를 publish payload 에 채운다.
      await service.continueExecution('exec-1', { name: 'Alice' });
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-1',
        nodeExecutionId: 'ne-waiting',
        payload: { type: 'form_submitted', formData: { name: 'Alice' } },
      });
    });

    // F-1 (plan eia-command-waiting-surface-guard) — expectedNodeId 전달 시 실제 대기
    // 노드(mock nodeId='n-wait')와 대조. 일치하면 정상 publish, 불일치면 거부.
    it('F-1 — expectedNodeId 가 대기 노드와 일치하면 정상 publish', async () => {
      await service.continueExecution('exec-1', { name: 'Alice' }, 'n-wait');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-1',
        nodeExecutionId: 'ne-waiting',
        payload: { type: 'form_submitted', formData: { name: 'Alice' } },
      });
    });

    it('F-1 — expectedNodeId 가 대기 노드와 불일치하면 InvalidExecutionStateError + publish 안 함', async () => {
      await expect(
        service.continueExecution('exec-1', { name: 'Alice' }, 'wrong-node'),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    // F-6 — WS 도 forward 하는 나머지 3개 continue* 도 expectedNodeId 불일치 시 동일하게 거부
    // (인자 순서/이름 오연결 회귀 가드). mock 대기 nodeId='n-wait'.
    it('F-6 — continueButtonClick expectedNodeId 불일치 → InvalidExecutionStateError', async () => {
      await expect(
        service.continueButtonClick('exec-1', 'btn-1', 'wrong-node'),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('F-6 — continueAiConversation expectedNodeId 불일치 → InvalidExecutionStateError', async () => {
      await expect(
        service.continueAiConversation('exec-1', 'hi', 'wrong-node'),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('F-6 — endAiConversation expectedNodeId 불일치 → InvalidExecutionStateError', async () => {
      await expect(
        service.endAiConversation('exec-1', 'wrong-node'),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('F-6 — continueAiConversation expectedNodeId 일치(n-wait) → 정상 publish', async () => {
      await service.continueAiConversation('exec-1', 'hi', 'n-wait');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_message',
        executionId: 'exec-1',
        nodeExecutionId: 'ne-waiting',
        payload: { message: 'hi' },
      });
    });

    it('cancelWaitingExecution → bus.publish({type:"cancel"}) 후 ContinuationPublishResult 반환 (C-1)', async () => {
      const result = await service.cancelWaitingExecution('exec-2');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'cancel',
        executionId: 'exec-2',
      });
      // C-1 — 4종 continuation 메서드와 동일하게 publish 결과를 표면 (queued/jobId).
      expect(result).toEqual({ queued: true, jobId: 'jobId-stub' });
    });

    it('cancelWaitingExecution — publish null(Redis 장애) 시 queued:false 반환 (C-1 fail-fast)', async () => {
      // M-7 fail-fast → publish 가 null 반환하는 경로. cancel 도 4종과 동일하게
      // queued:false 로 표면 (caller REST stop() 이 503 으로 surface).
      mockBus.publish.mockResolvedValueOnce(null);
      const result = await service.cancelWaitingExecution('exec-cancel-fail');
      expect(result).toEqual({ queued: false, jobId: null });
    });

    it('continueButtonClick → bus.publish({type:"button_click", payload:{buttonId}})', async () => {
      await service.continueButtonClick('exec-3', 'btn-confirm');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'button_click',
        executionId: 'exec-3',
        nodeExecutionId: 'ne-waiting',
        payload: { buttonId: 'btn-confirm' },
      });
    });

    it('continueAiConversation → bus.publish({type:"ai_message", payload:{message}})', async () => {
      await service.continueAiConversation('exec-4', 'hi');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_message',
        executionId: 'exec-4',
        nodeExecutionId: 'ne-waiting',
        payload: { message: 'hi' },
      });
    });

    it('continueAiConversation 은 10000자 초과 시 typed MessageTooLongError throw 하고 publish 하지 않는다', async () => {
      const tooLong = 'x'.repeat(10_001);
      await expect(
        service.continueAiConversation('exec-5', tooLong),
      ).rejects.toBeInstanceOf(MessageTooLongError);
      // client-safe 고정 message — 실제 길이 수치는 message 에 노출되지 않는다 (§7.5.2)
      await expect(
        service.continueAiConversation('exec-5', tooLong),
      ).rejects.toThrow('Message exceeds the maximum allowed length.');
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('endAiConversation → bus.publish({type:"ai_end_conversation"})', async () => {
      await service.endAiConversation('exec-6');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_end_conversation',
        executionId: 'exec-6',
        nodeExecutionId: 'ne-waiting',
      });
    });

    // Phase 2.3 (변경 2.3) — spec §7.5.1 publisher 측 사전 검증. WAITING row 가
    // 0건이면 BullMQ enqueue 를 시도하지 않고 INVALID_EXECUTION_STATE 로 즉시 거부.
    it('continueExecution — WAITING NodeExecution 0건이면 INVALID_EXECUTION_STATE throw + publish 안 함', async () => {
      h.waitingRawRows = [];
      await expect(
        service.continueExecution('exec-none', { name: 'Bob' }),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('continueExecution — throw 된 InvalidExecutionStateError.code === INVALID_EXECUTION_STATE', async () => {
      h.waitingRawRows = [];
      await expect(
        service.continueExecution('exec-none', {}),
      ).rejects.toMatchObject({ code: 'INVALID_EXECUTION_STATE' });
    });

    it('continueButtonClick — WAITING row 0건이면 INVALID_EXECUTION_STATE throw + publish 안 함', async () => {
      h.waitingRawRows = [];
      await expect(
        service.continueButtonClick('exec-none', 'btn-x'),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('continueExecution — WAITING row 다중(invariant 위반)이면 warn + INVALID_EXECUTION_STATE throw', async () => {
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      h.waitingRawRows = [
        {
          id: 'ne-a',
          nodeId: 'n1',
          nodeType: 'form',
          metaInteractionType: 'form',
          flatInteractionType: null,
        },
        {
          id: 'ne-b',
          nodeId: 'n2',
          nodeType: 'form',
          metaInteractionType: 'form',
          flatInteractionType: null,
        },
      ];
      await expect(
        service.continueExecution('exec-dup', {}),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invariant 위반'),
      );
      expect(mockBus.publish).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('continueExecution — DB lookup infra 실패는 INVALID_EXECUTION_STATE 가 아닌 원본 에러로 전파', async () => {
      h.waitingQueryError = new Error('connection terminated');
      const rejection = service.continueExecution('exec-dberr', {});
      await expect(rejection).rejects.toThrow('connection terminated');
      await expect(rejection).rejects.not.toBeInstanceOf(
        InvalidExecutionStateError,
      );
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    // 표면 판정에 필요한 문자열 하나만 투영한다 — `output_data` JSONB 컬럼 전체를
    // 싣지 않는다 (AI 멀티턴의 `_resumeCheckpoint.messages` 는 turn 마다 누적).
    it('publisher lookup 은 output_data 컬럼 전체를 select 하지 않는다 (JSONB path 투영)', async () => {
      await service.continueAiConversation('exec-1', 'hi');
      const selected = [
        ...mockWaitingQb.select.mock.calls,
        ...mockWaitingQb.addSelect.mock.calls,
      ].map((c) => String(c[0]));
      // meta·flat 두 경로를 각각 투영한다 (precedence 결합은 TS 가 소유).
      expect(
        selected.some((s) => /'meta'\s*->>\s*'interactionType'/.test(s)),
      ).toBe(true);
      expect(
        selected.some(
          (s) => /->>\s*'interactionType'/.test(s) && !/'meta'/.test(s),
        ),
      ).toBe(true);
      // 컬럼 전체(`ne.output_data` 단독)를 select 한 호출이 없어야 한다.
      expect(selected).not.toContain('ne.output_data');
      expect(selected).not.toContain('ne.outputData');
      expect(mockWaitingQb.innerJoin).toHaveBeenCalledWith('ne.node', 'n');
    });

    // ────────────────────────────────────────────────────────────────────────
    // spec §7.5.1 — 대기 표면 ↔ 명령 매트릭스 (publisher 사전 검증).
    //
    // 회귀 가드: 종전엔 표면 검사가 없어 이종 명령이 publish 됐고, resume 처리기는
    // 도착 payload 의 type 이 아니라 노드 표면으로 선택되므로 **조용히 오처리**됐다.
    //   - form 대기 + end_conversation → 빈 폼이 제출된 것처럼 노드 COMPLETED
    //   - buttons 대기 + 비-button_click → resolveButtonInteraction (d) fallback 이
    //     엉뚱한 'continue' 포트로 그래프를 분기
    // 이제 publish 전에 동기 거부되고 execution 은 waiting_for_input 으로 보존된다.
    // ────────────────────────────────────────────────────────────────────────
    describe('표면 매트릭스 가드 (§7.5.1)', () => {
      /**
       * 지정한 표면으로 대기 중인 단일 WAITING row 를 무장한다. 기본은 structured
       * envelope 경로(`metaInteractionType`); `via: 'flat'` 이면 legacy flat root
       * 경로로 넣어 `coalesceInteractionType` 의 fallback 분기를 exercise 한다.
       */
      const armWaitingSurface = (
        interactionType: string | undefined,
        nodeType = 'carousel',
        via: 'meta' | 'flat' = 'meta',
      ): void => {
        h.waitingRawRows = [
          {
            id: 'ne-waiting',
            nodeId: 'n-wait',
            nodeType,
            metaInteractionType:
              via === 'meta' ? (interactionType ?? null) : null,
            flatInteractionType:
              via === 'flat' ? (interactionType ?? null) : null,
          },
        ];
      };

      /** form 노드는 정적 blocking metadata 로 표면이 결정된다 (persisted meta 무관). */
      const armStaticFormSurface = (): void => {
        jest
          .spyOn(handlerRegistry, 'getMetadata')
          .mockReturnValue({ kind: 'blocking', interaction: 'form' });
        armWaitingSurface(undefined, 'form');
      };

      it('form 대기 + end_conversation → INVALID_EXECUTION_STATE, publish 안 함 (재현된 결함)', async () => {
        armStaticFormSurface();
        await expect(
          service.endAiConversation('exec-form'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('form 대기 + submit_message → INVALID_EXECUTION_STATE, publish 안 함', async () => {
        armStaticFormSurface();
        await expect(
          service.continueAiConversation('exec-form', 'hi'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('form 대기 + click_button → INVALID_EXECUTION_STATE, publish 안 함', async () => {
        armStaticFormSurface();
        await expect(
          service.continueButtonClick('exec-form', 'btn-1'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('form 대기 + submit_form → 통과 (publish)', async () => {
        armStaticFormSurface();
        await service.continueExecution('exec-form', { answer: 'yes' });
        expect(mockBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'continue' }),
        );
      });

      it('buttons 대기 + end_conversation → INVALID_EXECUTION_STATE, publish 안 함', async () => {
        armWaitingSurface('buttons');
        await expect(
          service.endAiConversation('exec-btn'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('buttons 대기 + submit_form → INVALID_EXECUTION_STATE (엉뚱한 continue 포트 분기 차단)', async () => {
        armWaitingSurface('buttons');
        await expect(
          service.continueExecution('exec-btn', { a: 1 }),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('buttons 대기 + click_button → 통과 (publish)', async () => {
        armWaitingSurface('buttons');
        await service.continueButtonClick('exec-btn', 'btn-1');
        expect(mockBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'button_click' }),
        );
      });

      // legacy flat root 경로(`output_data.interactionType`, meta 부재)도 표면 판정에
      // 쓰인다 — `coalesceInteractionType` 의 fallback 분기. structured meta 만 있는
      // 기본 케이스와 동일 결과여야 한다.
      it('buttons 대기 (legacy flat root interactionType) + end_conversation → 거부', async () => {
        armWaitingSurface('buttons', 'carousel', 'flat');
        await expect(
          service.endAiConversation('exec-btn-flat'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('buttons 대기 (legacy flat root interactionType) + click_button → 통과', async () => {
        armWaitingSurface('buttons', 'carousel', 'flat');
        await service.continueButtonClick('exec-btn-flat', 'btn-1');
        expect(mockBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'button_click' }),
        );
      });

      // AI 표면은 의도적으로 관대하다 — Presentation §10.9 의 stale button_click
      // graceful re-park invariant + AI Agent §6.2 step 2.c 의 render_form 응답
      // (form_submitted) 을 보존해야 한다. 여기서 좁히면 두 계약이 깨진다.
      it.each([['ai_conversation'], ['ai_form_render']])(
        '%s 대기 — 4종 명령 모두 통과',
        async (interactionType) => {
          for (const publish of [
            () => service.endAiConversation('exec-ai'),
            () => service.continueAiConversation('exec-ai', 'hi'),
            () => service.continueButtonClick('exec-ai', 'btn-1'),
            () => service.continueExecution('exec-ai', { a: 1 }),
          ]) {
            mockBus.publish.mockClear();
            armWaitingSurface(interactionType, 'ai_agent');
            await expect(publish()).resolves.toBeDefined();
            expect(mockBus.publish).toHaveBeenCalledTimes(1);
          }
        },
      );

      // fail-closed — 표면 판정 불가 row 는 `dispatchResumeTurn` 도 매칭 처리기를
      // 못 찾아 RESUME_CHECKPOINT_MISSING 으로 실패한다 (form 은 정적 metadata 로
      // 항상 판정되므로 여기 도달 불가). publish 전 동기 거부가 execution 을
      // waiting 으로 보존한다.
      it('표면 판정 불가(interactionType 부재, 비-form 노드) → INVALID_EXECUTION_STATE', async () => {
        armWaitingSurface(undefined, 'carousel');
        await expect(
          service.continueButtonClick('exec-legacy', 'btn-1'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      // 노드 정의가 사라진 행은 `innerJoin('ne.node')` 이 실 DB 에서 걸러 0건이 된다
      // (`node_id` 는 NOT NULL + ON DELETE CASCADE FK 라 orphan 자체가 DB 레벨에서
      // 사실상 발생 불가). 그 결과는 "WAITING row 0건" 과 동형이다 — 여기서는 mock 이
      // JOIN SQL 을 대체하므로 **동형 결과(빈 rawRows)만** 검증하고, 실제 JOIN 탈락
      // semantics 는 e2e(실 Postgres)가 커버한다.
      it('JOIN 탈락(빈 rawRows) → INVALID_EXECUTION_STATE', async () => {
        h.waitingRawRows = [];
        await expect(
          service.endAiConversation('exec-nonode'),
        ).rejects.toBeInstanceOf(InvalidExecutionStateError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      // 불변식 — publisher 의 표면 판정(`resolveWaitingSurface`)이 **worker 가 실제로 고르는**
      // `resumeTurnRegistry` 의 selects 와 어긋나면, 가드가 통과시킨 명령이 여전히 엉뚱한
      // 처리기로 흘러간다 (이 PR 이 고치는 버그 클래스의 재도입). park-entry 쪽 대칭은
      // waiting-surface-guard.spec.ts 가, worker 쪽 대칭은 여기서 가드한다.
      it('resumeTurnRegistry 의 selects 와 resolveWaitingSurface 판정이 일치한다', () => {
        const registry = (
          service as unknown as {
            resumeTurnRegistry: ReadonlyArray<{
              kind: string;
              selects: (sel: unknown) => boolean;
            }>;
          }
        ).resumeTurnRegistry;

        const cases = [
          { nodeType: 'form', interactionType: undefined, blocking: 'form' },
          { nodeType: 'carousel', interactionType: 'buttons' },
          { nodeType: 'ai_agent', interactionType: 'ai_conversation' },
          { nodeType: 'ai_agent', interactionType: 'ai_form_render' },
          {
            nodeType: 'information_extractor',
            interactionType: 'ai_conversation',
          },
          { nodeType: 'carousel', interactionType: undefined },
        ] as const;

        for (const c of cases) {
          const registryKind = registry.find((h) =>
            h.selects({
              node: { id: 'n', type: c.nodeType },
              blockingInteraction:
                'blocking' in c
                  ? (c as { blocking: string }).blocking
                  : undefined,
              persistedInteractionType: c.interactionType,
              isAiConversation:
                c.interactionType === 'ai_conversation' ||
                c.interactionType === 'ai_form_render',
              // ai 분기는 checkpoint 존재를 추가로 요구한다 — publisher 가 알 수 없는
              // worker-시점 상태라, 그 조건을 만족시킨 상태에서 표면 판정만 비교한다.
              hasResumeCheckpoint: true,
            }),
          )?.kind;
          const surface = resolveWaitingSurface({
            blockingInteraction:
              'blocking' in c
                ? (c as { blocking: string }).blocking
                : undefined,
            interactionType: c.interactionType,
          });
          expect(surface).toBe(registryKind);
        }
      });

      // client 응답에는 고정 메시지만 — 대기 노드 표면/nodeId 는 serverDetail 전용 (§7.5.2).
      it('거부 메시지는 client-safe 고정 문자열, 상세는 serverDetail 에만', async () => {
        armStaticFormSurface();
        const err = await service
          .endAiConversation('exec-form')
          .catch((err_: InvalidExecutionStateError) => err_);
        expect(err).toBeInstanceOf(InvalidExecutionStateError);
        expect(err.message).toBe('Execution is not waiting for input.');
        expect(err.message).not.toContain('n-wait');
        expect(err.serverDetail).toContain('ai_end_conversation');
        expect(err.serverDetail).toContain('form');
      });
    });

    it('applyContinuation continue — payload 를 그대로 rehydrateAndResume 로 forward (spec §10.9 raw forward)', async () => {
      // exec-park D6 full B3 — park 가 항상 코루틴을 release 하므로 깨울 in-memory
      // resolver 가 없다. applyContinuation 은 fast-path 없이 항상 §7.5 rehydration
      // (rehydrateAndResume) 으로 진입하며 payload sentinel 을 unwrap 없이 그대로 전달한다.
      const rehydrateSpy = jest
        .spyOn(
          service as unknown as {
            rehydrateAndResume: (
              id: string,
              ne: string,
              payload: unknown,
            ) => Promise<void>;
          },
          'rehydrateAndResume',
        )
        .mockResolvedValue(undefined);

      await service.applyContinuation('exec-1', 'ne-1', {
        type: 'form_submitted',
        formData: { ok: 1 },
      });
      expect(rehydrateSpy).toHaveBeenCalledWith('exec-1', 'ne-1', {
        type: 'form_submitted',
        formData: { ok: 1 },
      });
      rehydrateSpy.mockRestore();
    });

    it('continueExecution — form 필드명이 "type" 인 페이로드도 sentinel wrap 으로 정확히 라우팅 (silent drop 회귀 방지, spec §10.9)', async () => {
      // spec §10.9 — root cause regression guard. continueExecution 이 sentinel
      // wrap 을 담당하므로 form 필드명이 `type` 이어도 dispatch 가 `form_submitted`
      // 로 명시 매칭된다.
      await service.continueExecution('exec-coll', {
        type: '주문 문의',
        contact: '010-1234-5678',
      });
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-coll',
        nodeExecutionId: 'ne-waiting',
        payload: {
          type: 'form_submitted',
          formData: { type: '주문 문의', contact: '010-1234-5678' },
        },
      });

      // applyContinuation dispatch 도 sentinel 을 unwrap 없이 그대로 rehydrateAndResume
      // 로 forward 하는지 검증.
      const rehydrateSpy = jest
        .spyOn(
          service as unknown as {
            rehydrateAndResume: (
              id: string,
              ne: string,
              payload: unknown,
            ) => Promise<void>;
          },
          'rehydrateAndResume',
        )
        .mockResolvedValue(undefined);
      await service.applyContinuation('exec-coll', 'ne-coll', {
        type: 'form_submitted',
        formData: { type: '주문 문의', contact: '010-1234-5678' },
      });
      expect(rehydrateSpy).toHaveBeenCalledWith('exec-coll', 'ne-coll', {
        type: 'form_submitted',
        formData: { type: '주문 문의', contact: '010-1234-5678' },
      });
      rehydrateSpy.mockRestore();
    });

    it('continueExecution — undefined formData 도 sentinel wrap (빈 폼 제출, TypeError 회피)', async () => {
      // 빈 form 제출 또는 formData 인자 없음 — continueExecution 이 wrap.
      await service.continueExecution('exec-empty');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-empty',
        nodeExecutionId: 'ne-waiting',
        payload: { type: 'form_submitted', formData: undefined },
      });
    });
    // W-1 — assertFormSubmissionValid / coerceFormValue 핵심 검증 로직 단위 테스트
    // (기본 mockNodeRepo.findOneBy → null 이므로 기존 테스트는 폼 검증을 우회함.
    // 아래 테스트는 findOneBy + findOne 을 override 해 실제 검증 경로를 커버한다.)
    describe('assertFormSubmissionValid / coerceFormValue (W-1)', () => {
      /** form 노드 config 픽스처 — required email + optional number 필드. */
      const formConfig = {
        fields: [
          { name: 'email', label: '이메일', type: 'email', required: true },
          { name: 'age', label: '나이', type: 'number' },
        ],
      };

      function setupFormNodeMocks(config: unknown = formConfig): void {
        // assertFormSubmissionValid: nodeExecutionRepository.findOne → nodeExec row
        mockNodeExecutionRepo.findOne = jest
          .fn()
          .mockResolvedValueOnce({ id: 'ne-waiting', nodeId: 'n-form' });
        // assertFormSubmissionValid: nodeRepository.findOneBy → node with form config
        mockNodeRepo.findOneBy = jest
          .fn()
          .mockResolvedValueOnce({ id: 'n-form', config });
      }

      it('required 필드 누락 → FormValidationError throw + bus.publish 미호출', async () => {
        setupFormNodeMocks();
        await expect(
          service.continueExecution('exec-fv', {}),
        ).rejects.toBeInstanceOf(FormValidationError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('required 필드 누락 — FormValidationError.field 와 메시지 검증', async () => {
        setupFormNodeMocks();
        await expect(
          service.continueExecution('exec-fv2', {}),
        ).rejects.toMatchObject({
          field: 'email',
          message: '필수 입력 항목입니다.',
          code: 'VALIDATION_ERROR',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('email 형식 오류 → FormValidationError throw + publish 미호출', async () => {
        setupFormNodeMocks();
        await expect(
          service.continueExecution('exec-fv3', { email: 'not-an-email' }),
        ).rejects.toBeInstanceOf(FormValidationError);
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('email 형식 오류 — field 와 메시지 검증', async () => {
        setupFormNodeMocks();
        await expect(
          service.continueExecution('exec-fv4', { email: 'not-an-email' }),
        ).rejects.toMatchObject({
          field: 'email',
          message: '올바른 이메일 형식이 아닙니다.',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('유효한 이메일 + number 필드 → FormValidationError 없이 publish 호출', async () => {
        setupFormNodeMocks();
        await service.continueExecution('exec-fv-ok', {
          email: 'user@example.com',
          age: 30,
        });
        expect(mockBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'continue',
            executionId: 'exec-fv-ok',
          }),
        );
      });

      it('nodeExec null(findOne → null) → 검증 skip, publish 호출', async () => {
        // nodeExecutionRepository.findOne 을 null 반환으로 override
        mockNodeExecutionRepo.findOne = jest.fn().mockResolvedValueOnce(null);
        // mockNodeRepo.findOneBy 기본값은 null (검증 불가 pass-through)
        await service.continueExecution('exec-no-ne', {});
        expect(mockBus.publish).toHaveBeenCalled();
      });

      it('node null(findOneBy → null) → 검증 skip, publish 호출', async () => {
        mockNodeExecutionRepo.findOne = jest
          .fn()
          .mockResolvedValueOnce({ id: 'ne-x', nodeId: 'n-missing' });
        mockNodeRepo.findOneBy = jest.fn().mockResolvedValueOnce(null);
        await service.continueExecution('exec-no-node', {});
        expect(mockBus.publish).toHaveBeenCalled();
      });

      it('fields 빈 배열 → 검증 skip, publish 호출', async () => {
        setupFormNodeMocks({ fields: [] });
        await service.continueExecution('exec-empty-fields', { email: 'x' });
        expect(mockBus.publish).toHaveBeenCalled();
      });

      // D 후속 (spec-sync-form-gaps INFO) — min/max·pattern 이 publisher chokepoint
      // (assertFormSubmissionValid) 에서도 FormValidationError 로 표면하는지 통합 검증.
      it('§6.2 number min/max 위반 → FormValidationError throw + publish 미호출', async () => {
        setupFormNodeMocks({
          fields: [
            {
              name: 'qty',
              label: '수량',
              type: 'number',
              validation: { min: 1, max: 10 },
            },
          ],
        });
        await expect(
          service.continueExecution('exec-fv-range', { qty: 100 }),
        ).rejects.toMatchObject({
          field: 'qty',
          message: '최댓값은 10 이하여야 합니다.',
          code: 'VALIDATION_ERROR',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('§6.2 pattern(정규식) 위반 → FormValidationError throw + publish 미호출', async () => {
        setupFormNodeMocks({
          fields: [
            {
              name: 'code',
              label: '코드',
              type: 'text',
              validation: { pattern: '^[A-Z]+$' },
            },
          ],
        });
        await expect(
          service.continueExecution('exec-fv-pattern', { code: 'abc' }),
        ).rejects.toMatchObject({
          field: 'code',
          message: '형식이 올바르지 않습니다.',
          code: 'VALIDATION_ERROR',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      // A-2 — type:'file' MIME/크기/개수 서버측 검증 (기본값 주입 후 raw metadata 배열).
      const fileMeta = (over: Record<string, unknown> = {}) => ({
        name: 'f.png',
        size: 1024,
        type: 'image/png',
        lastModified: 0,
        ...over,
      });

      it('§6.2 file MIME 미허용 → FormValidationError throw + publish 미호출', async () => {
        setupFormNodeMocks({
          fields: [{ name: 'doc', label: '문서', type: 'file' }],
        });
        await expect(
          service.continueExecution('exec-file-mime', {
            doc: [fileMeta({ type: 'application/x-msdownload' })],
          }),
        ).rejects.toMatchObject({
          field: 'doc',
          message: '허용되지 않은 파일 형식입니다.',
          code: 'VALIDATION_ERROR',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('§6.2 file per-file 크기 초과(기본 10MB) → FormValidationError throw', async () => {
        setupFormNodeMocks({
          fields: [{ name: 'doc', label: '문서', type: 'file' }],
        });
        await expect(
          service.continueExecution('exec-file-size', {
            doc: [fileMeta({ size: 11 * MB_IN_BYTES })],
          }),
        ).rejects.toMatchObject({
          field: 'doc',
          message: '파일 크기는 10MB 이하여야 합니다.',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('§6.2 file 개수 초과(maxFiles 2) → FormValidationError throw', async () => {
        setupFormNodeMocks({
          fields: [{ name: 'doc', label: '문서', type: 'file', maxFiles: 2 }],
        });
        await expect(
          service.continueExecution('exec-file-count', {
            doc: [fileMeta(), fileMeta(), fileMeta()],
          }),
        ).rejects.toMatchObject({
          field: 'doc',
          message: '최대 2개까지 업로드할 수 있습니다.',
        });
        expect(mockBus.publish).not.toHaveBeenCalled();
      });

      it('§6.2 file 허용 MIME · 크기 이내 → 검증 통과 + publish 호출', async () => {
        setupFormNodeMocks({
          fields: [{ name: 'doc', label: '문서', type: 'file' }],
        });
        await service.continueExecution('exec-file-ok', {
          doc: [fileMeta({ type: 'application/pdf', size: 2 * MB_IN_BYTES })],
        });
        expect(mockBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'continue',
            executionId: 'exec-file-ok',
          }),
        );
      });

      // coerceFormValue 각 타입 분기 (private 접근 패턴)
      describe('coerceFormValue 타입 분기', () => {
        // ExecutionEngineService 의 private static 메서드를 cast 로 접근
        // (NestJS unit test 표준 패턴 — private API 안정성은 기존 테스트가 보장)
        type SvcClass = { coerceFormValue: (v: unknown) => string };
        const cfv = (v: unknown) =>
          (ExecutionEngineService as unknown as SvcClass).coerceFormValue(v);

        it('null → ""', () => {
          expect(cfv(null)).toBe('');
        });

        it('undefined → ""', () => {
          expect(cfv(undefined)).toBe('');
        });

        it('string 그대로 반환', () => {
          expect(cfv('hello')).toBe('hello');
        });

        it('number → String()', () => {
          expect(cfv(42)).toBe('42');
        });

        it('boolean → String()', () => {
          expect(cfv(true)).toBe('true');
        });

        it('빈 배열 → ""', () => {
          expect(cfv([])).toBe('');
        });

        it('string 배열 → 콤마 join', () => {
          expect(cfv(['a', 'b', 'c'])).toBe('a,b,c');
        });

        it('mixed 배열 → 비문자열 요소는 JSON.stringify 후 join', () => {
          expect(cfv([{ x: 1 }, 'y'])).toBe('{"x":1},y');
        });

        it('객체 → JSON.stringify', () => {
          expect(cfv({ a: 1 })).toBe('{"a":1}');
        });
      });
    });

    // W11 — applyCancellation 는 exec-park D6 full B3 에서 항상 cancelParkedExecution
    // (durable WAITING DB 마감) 으로 위임한다 (in-memory rejectPending 경로 제거).
    // ai-review WARNING #1 (2026-07-27) — cancelParkedExecution 이 Execution+
    // NodeExecution 이중 UPDATE 를 단일 트랜잭션으로 원자화해, 이제 개별 repo 의
    // createQueryBuilder 가 아니라 `dataSource.transaction` 안의
    // `manager.createQueryBuilder()` 를 순서대로 호출한다 — 아래 `installIdleTx`
    // (같은 형태를 쓰는 markWebChatIdleTimeout 테스트와 공유)로 그 경로를 무장한다.
    it('applyCancellation — cancelParkedExecution(dataSource.transaction) 경로 실행', async () => {
      const { execQb } = installIdleTx({ execution: 0, nodeExecution: 0 });

      // affected:0 → 멱등 no-op. Execution UPDATE 가 실제로 시도됐는지(= DB 경로
      // 도달)만 확인한다.
      await service.applyCancellation('exec-no-pending');
      expect(execQb.execute).toHaveBeenCalled();
    });

    // EIA-RL-07 markWebChatIdleTimeout — 공개 위젯 idle-wait 회수 (§R19).
    // Execution+NodeExecution UPDATE 는 dataSource.transaction 안에서 manager.createQueryBuilder
    // 로 순차 수행(review W1 원자화). tx 콜백을 in-memory 즉시 실행하고 qb 를 순서대로 반환한다.
    // `RETURNING duration_ms` 를 실제로 돌려줘야 threading 이 테스트를 탄다 —
    // `raw` 를 비워 두면 emit 이 `null` 이라 단언이 vacuous 해진다.
    const idleRaw = [{ id: 'exec-idle', duration_ms: 3600000 }];
    const installIdleTx = (affected: TxAffected) =>
      installTxByAffected(service, affected, idleRaw);
    const idleEmitter = () =>
      (
        service as unknown as {
          eventEmitter: {
            emitExecution: jest.Mock;
            releaseExecutionRouting: jest.Mock;
          };
        }
      ).eventEmitter;
    const stubFinalize = () =>
      jest
        .spyOn(
          service as unknown as {
            finalizeRehydrationCleanup: (id: string) => void;
          },
          'finalizeRehydrationCleanup',
        )
        .mockImplementation(() => undefined);

    it('markWebChatIdleTimeout — affected:0(재개로 이미 RUNNING/terminal) → false, emit 없음', async () => {
      installIdleTx({ execution: 0, nodeExecution: 0 });
      const emitSpy = jest.spyOn(idleEmitter(), 'emitExecution');

      const result = await service.markWebChatIdleTimeout('exec-running');

      expect(result).toBe(false);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('markWebChatIdleTimeout — affected:1 → true, WAITING 가드 UPDATE(error.code) + NodeExecution cancel + cancelledBy:timeout emit + routing release', async () => {
      const { execQb, nodeQb } = installIdleTx({
        execution: 1,
        nodeExecution: 1,
      });
      stubFinalize();
      const emitSpy = jest
        .spyOn(idleEmitter(), 'emitExecution')
        .mockResolvedValue(undefined as never);
      const releaseSpy = jest.spyOn(idleEmitter(), 'releaseExecutionRouting');

      const result = await service.markWebChatIdleTimeout('exec-idle');

      expect(result).toBe(true);
      // Execution UPDATE 의 set 에 WEBCHAT_IDLE_TIMEOUT error.code + WAITING 가드.
      expect(execQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'WEBCHAT_IDLE_TIMEOUT' }),
        }),
      );
      expect(execQb.andWhere).toHaveBeenCalledWith(
        'status = :waiting',
        expect.objectContaining({ waiting: 'waiting_for_input' }),
      );
      // 동반 NodeExecution 도 cancel(동일 트랜잭션).
      expect(nodeQb.update).toHaveBeenCalled();
      // cancelledBy:'timeout' + error.code emit + routing release.
      expect(emitSpy).toHaveBeenCalledWith(
        'exec-idle',
        expect.anything(),
        expect.objectContaining({
          result: { cancelledBy: 'timeout' },
          error: expect.objectContaining({ code: 'WEBCHAT_IDLE_TIMEOUT' }),
          // RETURNING 값이 emit 까지 **그대로** 흐르는지 — 2라운드째 요청받고 미이행이던
          // 단언이다. mock 이 주는 값과 정확히 같아야 한다(threading 검증).
          durationMs: 3600000,
        }),
      );
      expect(releaseSpy).toHaveBeenCalledWith('exec-idle');
    });

    // review W6/testing — 에러 경로.
    it('markWebChatIdleTimeout — 트랜잭션 throw → false + emit 미발생 (DB 롤백, 다음 tick 재시도)', async () => {
      (
        service as unknown as { dataSource: { transaction: jest.Mock } }
      ).dataSource.transaction = jest
        .fn()
        .mockRejectedValue(new Error('db down'));
      const emitSpy = jest.spyOn(idleEmitter(), 'emitExecution');

      const result = await service.markWebChatIdleTimeout('exec-err');

      expect(result).toBe(false);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('markWebChatIdleTimeout — emit reject 해도 cancel 은 durable → true 유지(로그만)', async () => {
      installIdleTx({ execution: 1, nodeExecution: 1 });
      stubFinalize();
      jest
        .spyOn(idleEmitter(), 'emitExecution')
        .mockRejectedValue(new Error('ws disconnect') as never);
      const releaseSpy = jest.spyOn(idleEmitter(), 'releaseExecutionRouting');

      const result = await service.markWebChatIdleTimeout('exec-emit-fail');

      // 커밋 이후 emit 실패는 흡수 — cancel 은 이미 DB 반영이라 true, routing 은 여전히 release.
      expect(result).toBe(true);
      expect(releaseSpy).toHaveBeenCalledWith('exec-emit-fail');
    });

    it('applyContinuation button_click — payload 누락 시 buttonId: undefined 로 rehydrateAndResume forward (review I9)', async () => {
      const rehydrateSpy = jest
        .spyOn(
          service as unknown as {
            rehydrateAndResume: (
              id: string,
              ne: string,
              payload: unknown,
            ) => Promise<void>;
          },
          'rehydrateAndResume',
        )
        .mockResolvedValue(undefined);

      await service.applyContinuation('exec-btn', 'ne-btn', {
        type: 'button_click',
        buttonId: undefined,
      });
      expect(rehydrateSpy).toHaveBeenCalledWith('exec-btn', 'ne-btn', {
        type: 'button_click',
        buttonId: undefined,
      });
      rehydrateSpy.mockRestore();
    });

    it('applyContinuation ai_message — 길이 초과 메시지는 silent drop (인-프로세스 직접 publish 우회 방어)', async () => {
      // 길이 가드는 rehydrateAndResume 진입 전에 동작 — drive 가 시작되지 않아야 한다.
      const rehydrateSpy = jest
        .spyOn(
          service as unknown as {
            rehydrateAndResume: (
              id: string,
              ne: string,
              payload: unknown,
            ) => Promise<void>;
          },
          'rehydrateAndResume',
        )
        .mockResolvedValue(undefined);

      const oversized = 'x'.repeat(10_001);
      await service.applyContinuation('exec-ai', 'ne-ai', {
        type: 'ai_message',
        message: oversized,
      });
      expect(rehydrateSpy).not.toHaveBeenCalled();
      rehydrateSpy.mockRestore();
    });
  });

  // W10 — cancelParkedExecution durable WAITING cancel 3-way 분기 검증.
  describe('cancelParkedExecution — durable WAITING cancel (W10)', () => {
    // ai-review WARNING #1 (2026-07-27) — cancelParkedExecution 이 이제
    // Execution+NodeExecution 이중 UPDATE 를 단일 트랜잭션(markWebChatIdleTimeout
    // 과 동형)으로 원자화한다. 개별 repo 의 createQueryBuilder 대신
    // `dataSource.transaction` 안의 `manager.createQueryBuilder()` 를 순서대로
    // (Execution → NodeExecution) 호출한다. 무장은 형제 describe 들과 같은
    // `installTxUpdateBuilders` 로 하고, 영향 행 수는 테이블 이름으로 넘긴다
    // (예전 헬퍼 쌍은 인자 순서가 서로 반대였다, CLE-T-WKESFB).
    // `raw` 를 비워 두면 emit 이 `null` 이 되고, 초기값과 우연히 일치해 **추출 로직을
    // 깨도 GREEN** 이다 — 자매 4경로에서 같은 형태를 두 번 겪었다 (`11_59_09` W3).
    const cancelRaw = [{ id: 'exec-park-1', duration_ms: 7200000 }];
    const installCancelTx = (affected: TxAffected) =>
      installTxByAffected(service, affected, cancelRaw);

    it('affected:1 — Execution CANCELLED, NodeExecution CANCELLED, EXECUTION_CANCELLED emit (cancelledBy:user, error 키 부재)', async () => {
      const { execQb, nodeQb } = installCancelTx({
        execution: 1,
        nodeExecution: 1,
      });
      // emitCancellationEvent 가 engine emitter 로 넘기는 원본 payload 를 직접 포착한다.
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const emitSpy = jest.spyOn(eventEmitter, 'emitExecution');

      await service.applyCancellation('exec-park-1');

      // Execution UPDATE 호출 확인.
      expect(execQb.execute).toHaveBeenCalled();
      // NodeExecution UPDATE 도 호출됐는지 확인 (W1/W6 핵심).
      expect(nodeQb.execute).toHaveBeenCalled();
      // EXECUTION_CANCELLED emit 확인 (WS 하류).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        'exec-park-1',
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      // emitCancellationEvent 계약을 고정한다: cancelledBy='user' 리터럴 + **error 키 부재**
      // (cancelParked 는 4경로 중 유일하게 error 없이 방출 — 헬퍼의 `...(error?{error}:{})`
      // 생략 분기를 회귀로부터 보호). 정확 payload 매칭이라 error 키가 섞이면 실패한다.
      expect(emitSpy).toHaveBeenCalledWith('exec-park-1', expect.anything(), {
        status: 'cancelled',
        result: { cancelledBy: 'user' },
        // RETURNING 이 돌려준 영속값이 emit 까지 그대로 흘러야 한다(DB=wire).
        durationMs: 7200000,
      });
      const emittedPayload = emitSpy.mock.calls.find(
        (c) => c[0] === 'exec-park-1',
      )?.[2];
      expect(emittedPayload).not.toHaveProperty('error');
      emitSpy.mockRestore();
    });

    it('affected:0 — 이미 terminal / resume RUNNING → 멱등 no-op (emit 미호출)', async () => {
      const { nodeQb } = installCancelTx({ execution: 0, nodeExecution: 0 });

      const emitMock = mockWebsocketService.emitExecutionEvent;
      const emitCallsBefore = emitMock.mock.calls.length;

      await service.applyCancellation('exec-park-2');

      // affected:0 → 트랜잭션 콜백이 조기 return. NodeExecution UPDATE 미호출.
      expect(nodeQb.execute).not.toHaveBeenCalled();
      // emit 도 추가 호출 없음.
      expect(emitMock.mock.calls.length).toBe(emitCallsBefore);
    });

    it('emit throw → warn 으로 흡수 (cancel 은 DB 반영됨, 호출자에 예외 전파 없음)', async () => {
      installCancelTx({ execution: 1, nodeExecution: 1 });

      const logger = (
        service as unknown as { logger: { warn: jest.Mock; error: jest.Mock } }
      ).logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      // emitExecution 이 throw 하도록 강제.
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const origEmit = eventEmitter.emitExecution;
      eventEmitter.emitExecution = jest
        .fn()
        .mockRejectedValue(new Error('ws disconnect'));

      try {
        // 예외가 호출자에 전파되지 않아야 한다.
        await expect(
          service.applyCancellation('exec-park-3'),
        ).resolves.toBeUndefined();
        // warn 이 emit 실패를 흡수했는지 확인.
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('emit 실패'),
        );
      } finally {
        eventEmitter.emitExecution = origEmit;
        warnSpy.mockRestore();
      }
    });

    // ai-review WARNING (2026-07-27, 6차 라운드, testing) — cancelParkedExecution
    // 이 단일 트랜잭션으로 원자화된 이후(WARNING #1), 자매 markWebChatIdleTimeout
    // 에는 이미 있는 "트랜잭션 자체 throw" 테스트(위 `markWebChatIdleTimeout —
    // 트랜잭션 throw → false + emit 미발생`)가 이 describe 에는 대응 짝이 없었다.
    // `@remarks DB 오류는 내부 흡수 — 호출자에 예외 전파 없음` 계약을 미러링해 고정한다.
    it('트랜잭션 자체 throw(DB 인프라 오류) → catch 로 흡수, 호출자에 예외 전파 없음 + emit 미발생', async () => {
      (
        service as unknown as { dataSource: { transaction: jest.Mock } }
      ).dataSource.transaction = jest
        .fn()
        .mockRejectedValue(new Error('db down'));
      const logger = (
        service as unknown as { logger: { warn: jest.Mock; error: jest.Mock } }
      ).logger;
      const errorSpy = jest.spyOn(logger, 'error');
      const eventEmitter = (
        service as unknown as { eventEmitter: { emitExecution: jest.Mock } }
      ).eventEmitter;
      const emitSpy = jest.spyOn(eventEmitter, 'emitExecution');

      // 예외가 호출자(applyCancellation)에 전파되지 않아야 한다 — resolve.
      await expect(
        service.applyCancellation('exec-park-tx-throw'),
      ).resolves.toBeUndefined();

      // 트랜잭션 실패가 error 로그로 흡수됐는지 확인.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cancelParkedExecution 실패'),
      );
      // 커밋되지 않았으므로 cancel 이벤트도 발사되지 않는다.
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // 재개 진입 DB 원자 claim (CLE-EXEC-RECOVERY-REHYDRATE). 비원자 SELECT 재검증을 조건부
  // UPDATE(waiting_for_input → running, affected=0 → ack-and-discard)로 대체.
  describe('claimResumeEntry — 재개 진입 원자 claim', () => {
    // qb 가 어느 엔티티를 UPDATE 하는지는 `update()` 인자로 판별한다(`byEntity`). 그래야
    // 잠금 순서(Execution → NodeExecution, CLE-T-9JBVQK)를 `order` 로 단언할 수 있다.
    // tx 콜백이 던지면 tx mock 도 reject 한다(실제 트랜잭션의 롤백 자리).
    const ds = () =>
      service as unknown as { dataSource: { transaction: jest.Mock } };
    const installTx = (affected: TxAffected) =>
      installTxByAffected(service, affected);
    const segmentStarted = () =>
      (
        service as unknown as { segmentStartMs: Map<string, number> }
      ).segmentStartMs.has('exec-1');
    const clearSegment = () =>
      (
        service as unknown as { segmentStartMs: Map<string, number> }
      ).segmentStartMs.delete('exec-1');

    it('둘 다 affected=1 → true. Execution 을 먼저 잠그고 NodeExecution 을 claim 한다 (형제 경로와 같은 순서)', async () => {
      const { order, byEntity } = installTx({ execution: 1, nodeExecution: 1 });

      await expect(service.claimResumeEntry('exec-1', 'ne-1')).resolves.toBe(
        true,
      );

      // 잠금 순서 — 형제 cancelParkedExecution · markWebChatIdleTimeout ·
      // finalizeStalledExhausted 와 같은 Execution → NodeExecution (CLE-T-9JBVQK).
      expect(order).toEqual(['Execution', 'NodeExecution']);
      // Execution: 재개 가능 상태(WFI ∪ RUNNING)만 RUNNING 으로.
      expect(byEntity.Execution.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.RUNNING }),
      );
      expect(byEntity.Execution.andWhere).toHaveBeenCalledWith(
        'status IN (:...resumable)',
        expect.objectContaining({
          resumable: [
            ExecutionStatus.WAITING_FOR_INPUT,
            ExecutionStatus.RUNNING,
          ],
        }),
      );
      // NodeExecution: 경합 판정 — waiting_for_input 조건 → running.
      expect(byEntity.NodeExecution.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: NodeExecutionStatus.RUNNING }),
      );
      expect(byEntity.NodeExecution.andWhere).toHaveBeenCalledWith(
        'status = :waiting',
        expect.objectContaining({
          waiting: NodeExecutionStatus.WAITING_FOR_INPUT,
        }),
      );
      // 부수효과: claim 성공 시 active-running 세그먼트 시작 기록(PR2a/§8 보정).
      expect(segmentStarted()).toBe(true);
    });

    it('node affected=0 → false + 트랜잭션 롤백(Execution 변경 취소) + segmentStartMs 미기록', async () => {
      const { order, tx } = installTx({ execution: 1, nodeExecution: 0 });
      clearSegment();

      await expect(service.claimResumeEntry('exec-1', 'ne-1')).resolves.toBe(
        false,
      );
      // Execution 은 이미 RUNNING 으로 바꿨다. 경합에서 졌으므로 롤백해야 늦게 온
      // 메시지가 WFI 실행을 RUNNING 으로 뒤집지 않는다 — tx 콜백이 던진다.
      expect(order).toEqual(['Execution', 'NodeExecution']);
      await expect(tx.mock.results[0].value).rejects.toMatchObject({
        name: 'ResumeClaimNodeLostError',
      });
      expect(segmentStarted()).toBe(false);
    });

    it('Execution terminal(affected=0) → false + NodeExecution claim 미실행 (동시 cancel 방어)', async () => {
      // 일반 방어 시나리오: 어떤 경로로든 exec=CANCELLED(또는 다른 terminal)·
      // node=WAITING 이면 Execution UPDATE 가 affected=0 이다. 바뀐 행이 없으므로
      // 롤백 없이 false 이고 node 는 건드리지 않는다.
      const { order, tx } = installTx({ execution: 0, nodeExecution: 1 });
      clearSegment();

      await expect(service.claimResumeEntry('exec-1', 'ne-1')).resolves.toBe(
        false,
      );
      expect(order).toEqual(['Execution']);
      await expect(tx.mock.results[0].value).resolves.toBe(false);
      expect(segmentStarted()).toBe(false);
    });

    it('동시 재개 — 두 claim 중 하나만 승리 (경합 판정=node claim)', async () => {
      // 둘 다 Execution UPDATE 는 통과한다(WFI ∪ RUNNING). 먼저 도착한 node claim 만
      // affected=1 이다(DB 의 `status = waiting` 조건이 둘째를 0행으로 만든다).
      installTxUpdateBuilders(service, {
        execution: { affected: 1 },
        nodeExecution: {
          execute: jest
            .fn()
            .mockResolvedValueOnce({ affected: 1 })
            .mockResolvedValue({ affected: 0 }),
        },
      });

      const [a, b] = await Promise.all([
        service.claimResumeEntry('exec-1', 'ne-1'),
        service.claimResumeEntry('exec-1', 'ne-1'),
      ]);

      expect([a, b].filter(Boolean)).toHaveLength(1); // 정확히 하나만 승리
    });

    it('센티널이 아닌 DB 오류는 전파한다', async () => {
      ds().dataSource.transaction = jest.fn(async () => {
        throw new Error('db down');
      });
      await expect(service.claimResumeEntry('exec-1', 'ne-1')).rejects.toThrow(
        'db down',
      );
    });

    it('__no_node_exec__ / 빈 id → true (legacy 우회, 트랜잭션 미실행)', async () => {
      ds().dataSource.transaction = jest.fn();
      await expect(
        service.claimResumeEntry('exec-1', '__no_node_exec__'),
      ).resolves.toBe(true);
      await expect(service.claimResumeEntry('exec-1', '')).resolves.toBe(true);
      expect(ds().dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // CLE-EXEC-RECOVERY-REHYDRATE 「rehydration 실패」 — claim 후 rehydration 실패 롤백. markNodeExecutionFailed 가 claim 된
  // RUNNING row 도 FAILED 로 마감해야 stuck RUNNING 을 남기지 않는다.
  describe('markNodeExecutionFailed — claim 후 RUNNING 롤백', () => {
    it('UPDATE 가 WAITING_FOR_INPUT 와 RUNNING 둘 다 대상으로 한다', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockNodeExecutionRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await (
        service as unknown as {
          markNodeExecutionFailed: (id: string, code: string) => Promise<void>;
        }
      ).markNodeExecutionFailed('ne-1', 'RESUME_CHECKPOINT_MISSING');

      expect(qb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: NodeExecutionStatus.FAILED }),
      );
      // 핵심 회귀 가드: RUNNING 이 status IN 목록에 포함돼야 claim 후 롤백이 동작.
      expect(qb.andWhere).toHaveBeenCalledWith(
        'status IN (:...statuses)',
        expect.objectContaining({
          statuses: expect.arrayContaining([
            NodeExecutionStatus.WAITING_FOR_INPUT,
            NodeExecutionStatus.RUNNING,
          ]),
        }),
      );
    });
  });

  // review W11(old) — appendExecutionPath 의 best-effort catch 경로 검증.
  describe('appendExecutionPath best-effort 동작 (review W11)', () => {
    it('insert 실패 시 logger.warn 호출 후 흐름 중단 없이 계속 진행', async () => {
      const repo = (
        service as unknown as {
          executionNodeLogRepository: { insert: jest.Mock };
        }
      ).executionNodeLogRepository;
      const logger = (service as unknown as { logger: { warn: jest.Mock } })
        .logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      repo.insert.mockRejectedValueOnce(new Error('connection refused'));
      await expect(
        (
          service as unknown as {
            appendExecutionPath: (e: string, n: string) => Promise<void>;
          }
        ).appendExecutionPath('exec-flaky', 'node-x'),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      const msg = String(warnSpy.mock.calls[0][0]);
      expect(msg).toContain('exec-flaky');
      expect(msg).toContain('node-x');
      warnSpy.mockRestore();
    });
  });
});
