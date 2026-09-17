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
      schedules?: Array<{ id: string }>;
      removeJobRejects?: boolean;
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
        return opts.removeJobRejects
          ? Promise.reject(new Error('redis down'))
          : Promise.resolve();
      }),
    };
    const binder = {
      teardownChatChannel: jest.fn((t: Trigger) => {
        events.push(`teardown:${t.id}`);
        return Promise.resolve();
      }),
      teardownChannelConfig: jest.fn((id: string) => {
        events.push(`teardownConfig:${id}`);
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
      expect(events).toEqual([
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
      'teardownConfig:t1',
      'delete:secret://triggers/t1/',
    ]);
  });

  it('undoAbsentWrite — 등록이 없었으면 teardown 없이 비밀만 지운다', async () => {
    const { service, events } = make();

    await service.undoAbsentWrite('t1', undefined, 'C');

    expect(events).toEqual(['delete:secret://triggers/t1/']);
  });
});
