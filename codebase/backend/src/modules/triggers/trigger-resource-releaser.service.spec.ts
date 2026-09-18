import { Logger } from '@nestjs/common';

import { Workflow } from '../workflows/entities/workflow.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Trigger } from './entities/trigger.entity';
import { TriggerResourceReleaserService } from './trigger-resource-releaser.service';
import type { ChatChannelConfig } from '../chat-channel/types';

/**
 * 네 삭제 경로 중 셋(트리거 · 워크플로 · 워크스페이스)이 이 협력자로 자원을 정리한다.
 * 순서·실패 정책 자체는 `trigger-resource-release.spec.ts` 가 문다 — 여기는 **배선**이다.
 */
describe('TriggerResourceReleaserService', () => {
  const trigger = (id: string, type: string) =>
    ({ id, type, config: {} }) as unknown as Trigger;

  function make(
    opts: {
      triggers?: Trigger[];
      schedules?: Array<{ id: string; isActive?: boolean }>;
      removeJobRejects?: boolean;
      /** 이 schedule id 들의 `removeJob` 만 실패한다. */
      removeJobFailsFor?: string[];
      registerJobRejects?: boolean;
    } = {},
  ) {
    const events: string[] = [];
    const triggerRepository = {
      find: jest.fn().mockResolvedValue(opts.triggers ?? []),
    };
    const scheduleRepository = {
      find: jest.fn().mockResolvedValue(opts.schedules ?? []),
    };
    const scheduleRunner = {
      removeJob: jest.fn((id: string) => {
        events.push(`removeJob:${id}`);
        return opts.removeJobRejects || opts.removeJobFailsFor?.includes(id)
          ? Promise.reject(new Error('redis down'))
          : Promise.resolve();
      }),
      registerJob: jest.fn((s: { id: string }) => {
        events.push(`registerJob:${s.id}`);
        return opts.registerJobRejects
          ? Promise.reject(new Error('redis still down'))
          : Promise.resolve();
      }),
    };
    const binder = {
      teardownChatChannel: jest.fn((t: Trigger) => {
        events.push(`teardown:${t.id}`);
        return Promise.resolve();
      }),
      teardownRegisteredChannel: jest.fn((id: string) => {
        events.push(`teardownRegistered:${id}`);
        return Promise.resolve();
      }),
    };
    const listenerRegistry = {
      unregister: jest.fn((id: string) => events.push(`unregister:${id}`)),
    };
    const secrets = {
      deleteByPrefix: jest.fn((prefix: string) => {
        events.push(`delete:${prefix}`);
        return Promise.resolve(0);
      }),
    };
    const service = new TriggerResourceReleaserService(
      triggerRepository as never,
      scheduleRepository as never,
      scheduleRunner as never,
      binder as never,
      listenerRegistry as never,
      secrets as never,
    );
    return {
      service,
      events,
      triggerRepository,
      scheduleRepository,
      scheduleRunner,
      listenerRegistry,
    };
  }

  describe('releaseExternalForParent', () => {
    it('부모 밑 트리거마다 teardown · listener unregister(chat-channel R8) 를 하고, schedule job 을 해제한다', async () => {
      const { service, events, triggerRepository } = make({
        triggers: [trigger('s1', 'schedule'), trigger('w1', 'webhook')],
        schedules: [{ id: 'sched-1' }],
      });

      await service.releaseExternalForParent({ workflowId: 'wf-1' });

      expect(triggerRepository.find).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
      });
      expect(events).toEqual([
        'removeJob:sched-1',
        'teardown:s1',
        'unregister:s1',
        'teardown:w1',
        'unregister:w1',
      ]);
    });

    it('스케줄 행은 schedule 타입 트리거만 모아 **한 번** 조회한다 (트리거 수만큼 아니다)', async () => {
      const { service, scheduleRepository } = make({
        triggers: [
          trigger('s1', 'schedule'),
          trigger('w1', 'webhook'),
          trigger('s2', 'schedule'),
        ],
        schedules: [{ id: 'sched-1' }, { id: 'sched-2' }],
      });

      await service.releaseExternalForParent({ workspaceId: 'ws-1' });

      expect(scheduleRepository.find).toHaveBeenCalledTimes(1);
      const [args] = scheduleRepository.find.mock.calls[0] as [
        { where: { triggerId: { value: string[] } } },
      ];
      expect(args.where.triggerId.value).toEqual(['s1', 's2']);
    });

    it('schedule 타입이 없으면 스케줄을 조회하지 않는다', async () => {
      const { service, scheduleRepository } = make({
        triggers: [trigger('w1', 'webhook')],
      });

      await service.releaseExternalForParent({ workflowId: 'wf-1' });

      expect(scheduleRepository.find).not.toHaveBeenCalled();
    });

    /**
     * 앞에서부터 해제하다 k 번째에서 그냥 던지면 1..k-1 은 Redis 에서 사라졌는데 행은 남는다 —
     * 스케줄은 활성인데 발화하지 않는다. 그래서 **전부 시도**하고, 실패가 있으면 이미 해제한
     * **활성** job 을 다시 등록한 뒤 던진다(`/ai-review` `review/code/2026/09/17/18_45_09` CRITICAL#1).
     */
    it('schedule job 하나가 실패하면 나머지도 시도하고, 이미 해제한 활성 job 을 다시 등록한 뒤 던진다', async () => {
      const { service, events, scheduleRunner } = make({
        triggers: [
          trigger('s1', 'schedule'),
          trigger('s2', 'schedule'),
          trigger('s3', 'schedule'),
          trigger('s4', 'schedule'),
          trigger('w1', 'webhook'),
        ],
        schedules: [
          { id: 'sched-1', isActive: true },
          { id: 'sched-2', isActive: true },
          { id: 'sched-3', isActive: false },
          { id: 'sched-4', isActive: true },
        ],
        removeJobFailsFor: ['sched-2'],
      });

      await expect(
        service.releaseExternalForParent({ workspaceId: 'ws-1' }),
      ).rejects.toThrow(/schedule=sched-2: redis down/);

      expect(events).toEqual([
        'removeJob:sched-1',
        'removeJob:sched-2',
        'removeJob:sched-3',
        'removeJob:sched-4',
        // 비활성(sched-3)은 원래 job 이 없었다 — 다시 등록하면 꺼 둔 스케줄이 켜진다.
        'registerJob:sched-1',
        'registerJob:sched-4',
      ]);
      // 삭제를 멈췄으니 provider 등록도 건드리지 않는다.
      expect(events.some((e) => e.startsWith('teardown:'))).toBe(false);
      expect(scheduleRunner.registerJob).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sched-2' }),
      );
    });

    it('실패가 여럿이면 전부를 한 메시지에 담는다', async () => {
      const { service } = make({
        triggers: [trigger('s1', 'schedule'), trigger('s2', 'schedule')],
        schedules: [
          { id: 'sched-1', isActive: true },
          { id: 'sched-2', isActive: true },
        ],
        removeJobFailsFor: ['sched-1', 'sched-2'],
      });

      await expect(
        service.releaseExternalForParent({ workflowId: 'wf-1' }),
      ).rejects.toThrow(
        'schedule=sched-1: redis down; schedule=sched-2: redis down',
      );
    });

    it('다시 등록마저 실패해도 원래 실패로 던지고, 복구 실패는 소리내어 남긴다', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        const { service } = make({
          triggers: [trigger('s1', 'schedule'), trigger('s2', 'schedule')],
          schedules: [
            { id: 'sched-1', isActive: true },
            { id: 'sched-2', isActive: true },
          ],
          removeJobFailsFor: ['sched-2'],
          registerJobRejects: true,
        });

        await expect(
          service.releaseExternalForParent({ workflowId: 'wf-1' }),
        ).rejects.toThrow(/schedule=sched-2/);

        const logged = error.mock.calls.map(([m]) => String(m)).join('\n');
        expect(logged).toContain('sched-1');
        expect(logged).toContain('redis still down');
      } finally {
        error.mockRestore();
      }
    });

    it('schedule job 해제가 실패하면 던진다 — 삭제를 멈춘다', async () => {
      const { service, listenerRegistry } = make({
        triggers: [trigger('s1', 'schedule')],
        schedules: [{ id: 'sched-1' }],
        removeJobRejects: true,
      });

      await expect(
        service.releaseExternalForParent({ workflowId: 'wf-1' }),
      ).rejects.toThrow('redis down');
      expect(listenerRegistry.unregister).not.toHaveBeenCalled();
    });
  });

  describe('lockParentAndListTriggerIds', () => {
    function managerWithEvents(rows: Array<{ id: string }>) {
      const events: string[] = [];
      const manager = {
        query: jest.fn((sql: string) => {
          events.push(`query:${sql}`);
          return Promise.resolve();
        }),
        findOne: jest.fn(
          (entity: unknown, options: { lock?: { mode: string } }) => {
            const name =
              entity === Workflow
                ? 'Workflow'
                : entity === Workspace
                  ? 'Workspace'
                  : '?';
            events.push(`lock:${name}:${options.lock?.mode}`);
            return Promise.resolve(null);
          },
        ),
        find: jest.fn((entity: unknown, _options: unknown) => {
          events.push(`find:${entity === Trigger ? 'Trigger' : '?'}`);
          return Promise.resolve(rows);
        }),
      };
      return { events, manager };
    }

    it('워크플로 — 부모 행을 pessimistic_write 로 잠근 **뒤** 트리거를 연다', async () => {
      // 순서가 보증이다 — 잠금 전에 열면 그 사이 INSERT 된 트리거가 비밀 정리 대상에서 빠진다.
      const { service } = make();
      const { events, manager } = managerWithEvents([{ id: 'a' }, { id: 'b' }]);

      const ids = await service.lockParentAndListTriggerIds(manager as never, {
        workflowId: 'wf-1',
      });

      expect(ids).toEqual(['a', 'b']);
      // 잠금 대기 상한이 **잠그기 전에** 걸린다 — 외부 해제를 되돌릴 수 없게 끝낸 뒤라 무한 대기는
      // 반쯤 삭제된 상태를 hang 으로 굳힌다(`/ai-review` `review/code/2026/09/17/19_14_29` WARNING#2).
      expect(events).toEqual([
        "query:SET LOCAL lock_timeout = '5000ms'",
        'lock:Workflow:pessimistic_write',
        'find:Trigger',
      ]);
      expect(manager.findOne.mock.calls[0][1]).toMatchObject({
        where: { id: 'wf-1' },
      });
      expect(manager.find.mock.calls[0][1]).toMatchObject({
        where: { workflowId: 'wf-1' },
      });
    });

    it('워크스페이스 — 워크스페이스 행을 잠그고 workspaceId 로 연다', async () => {
      const { service } = make();
      const { events, manager } = managerWithEvents([]);

      await service.lockParentAndListTriggerIds(manager as never, {
        workspaceId: 'ws-1',
      });

      expect(events).toEqual([
        "query:SET LOCAL lock_timeout = '5000ms'",
        'lock:Workspace:pessimistic_write',
        'find:Trigger',
      ]);
      expect(manager.find.mock.calls[0][1]).toMatchObject({
        where: { workspaceId: 'ws-1' },
      });
    });
  });

  it('undoAbsentWrite — 등록한 설정이 있으면 그 설정으로 teardown 한 뒤 비밀을 지운다', async () => {
    const { service, events } = make();
    const cfg = { provider: 'telegram' } as ChatChannelConfig;

    await service.undoAbsentWrite('t1', cfg, 'C');

    expect(events).toEqual([
      'teardownRegistered:t1',
      'delete:secret://triggers/t1/',
    ]);
  });

  it('undoAbsentWrite — 등록이 없었으면 teardown 없이 비밀만 지운다', async () => {
    const { service, events } = make();

    await service.undoAbsentWrite('t1', undefined, 'C');

    expect(events).toEqual(['delete:secret://triggers/t1/']);
  });
});
