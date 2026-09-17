import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';

import { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import { ChatChannelConfig } from '../chat-channel/types';
import { Schedule } from '../schedules/entities/schedule.entity';
import { ScheduleRunnerService } from '../schedules/schedule-runner.service';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { ChatChannelBinderService } from './chat-channel-binder.service';
import { Trigger } from './entities/trigger.entity';
import {
  deleteTriggerSecretsAfterCommit,
  TriggerParent,
  TriggerResourceReleasePort,
  undoAbsentTriggerWrite,
} from './trigger-resource-release';

/**
 * 트리거 행을 없애는 **네 경로**(트리거 · 스케줄 · 워크플로 · 워크스페이스 삭제)와, 삭제와 겹친
 * 쓰기 경로가 쓰는 자원 정리 협력자.
 *
 * 순서·실패 정책은 `trigger-resource-release.ts` 가 SoT 다 — 여기는 그 정책에 **의존성을 배선**한다.
 * 스케줄 삭제만 이 서비스를 쓰지 않는다: `TriggersModule` 이 `SchedulesModule` 을 import 하므로
 * 반대 방향은 순환이다. 그쪽은 순수 함수를 직접 부른다(스케줄 트리거는 chat channel 을 못 가져
 * 외부 해제가 schedule job 하나뿐이다).
 */
@Injectable()
export class TriggerResourceReleaserService implements TriggerResourceReleasePort {
  private readonly logger = new Logger(TriggerResourceReleaserService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    private readonly scheduleRunner: ScheduleRunnerService,
    private readonly chatChannelBinder: ChatChannelBinderService,
    private readonly channelListenerRegistry: ChannelListenerRegistry,
    private readonly secrets: SecretResolverService,
  ) {}

  /**
   * 트리거 하나의 외부 자원을 해제한다 — 행 삭제 **전**, 트랜잭션 **밖**.
   *
   * schedule job 해제가 실패하면 **던진다** — 삭제를 멈춘다(종전 `TriggersService.remove()` 와
   * 같다). provider teardown 은 best-effort 라 binder 가 삼킨다.
   */
  async releaseExternal(trigger: Trigger): Promise<void> {
    await this.releaseExternalMany([trigger]);
  }

  /**
   * 부모 밑 트리거들의 외부 자원을 해제한다 — 트랜잭션 **전**의 스냅샷 기준이다.
   *
   * **남는 창**: 이 스냅샷 뒤·부모 잠금 전에 생긴 트리거는 외부 해제를 받지 못한다(비밀은
   * {@link lockParentAndListTriggerIds} 가 잠금 뒤 열거로 덮는다). spec 트리거 목록 §4.3 이 적어 둔
   * 잔여다 — 닫으려면 외부 해제를 커밋 뒤로 옮겨야 하는데 그러면 schedule 행이 CASCADE 로 사라져
   * job id 를 못 찾는다.
   */
  async releaseExternalForParent(parent: TriggerParent): Promise<void> {
    const triggers = await this.triggerRepository.find({ where: parent });
    await this.releaseExternalMany(triggers);
  }

  async lockParentAndListTriggerIds(
    manager: EntityManager,
    parent: TriggerParent,
  ): Promise<string[]> {
    if ('workflowId' in parent) {
      await manager.findOne(Workflow, {
        select: { id: true },
        where: { id: parent.workflowId },
        lock: { mode: 'pessimistic_write' },
      });
    } else {
      await manager.findOne(Workspace, {
        select: { id: true },
        where: { id: parent.workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
    }
    const rows = await manager.find(Trigger, {
      select: { id: true },
      where: parent,
    });
    return rows.map((row) => row.id);
  }

  async releaseSecretsAfterCommit(
    triggerIds: readonly string[],
    caller: string,
  ): Promise<void> {
    await deleteTriggerSecretsAfterCommit(
      this.secrets,
      this.logger,
      triggerIds,
      caller,
    );
  }

  /**
   * 락 안 재기록이 행 부재로 쓰지 못한 쓰기를 되돌린다 — `undoAbsentTriggerWrite` 참조.
   *
   * @param chatChannel 이 요청이 provider 에 등록한 설정. 등록이 없었으면 `undefined`.
   */
  async undoAbsentWrite(
    triggerId: string,
    chatChannel: ChatChannelConfig | undefined,
    caller: string,
  ): Promise<void> {
    await undoAbsentTriggerWrite(
      {
        teardown: chatChannel
          ? () =>
              this.chatChannelBinder.teardownChannelConfig(
                triggerId,
                chatChannel,
              )
          : undefined,
        secrets: this.secrets,
        logger: this.logger,
      },
      triggerId,
      caller,
    );
  }

  /**
   * schedule job 은 스케줄 행을 **한 번에** 조회한다 — 워크스페이스 삭제가 트리거 수만큼 조회하지
   * 않게. provider teardown 은 순서대로 부른다: 삭제는 드문 관리 동작이고, 동시에 부르면 같은
   * provider 에 한꺼번에 요청이 몰린다.
   */
  private async releaseExternalMany(triggers: Trigger[]): Promise<void> {
    const scheduleTriggerIds = triggers
      .filter((trigger) => trigger.type === 'schedule')
      .map((trigger) => trigger.id);
    if (scheduleTriggerIds.length > 0) {
      const schedules = await this.scheduleRepository.find({
        where: { triggerId: In(scheduleTriggerIds) },
      });
      await this.removeScheduleJobsOrRestore(schedules);
    }
    for (const trigger of triggers) {
      await this.chatChannelBinder.teardownChatChannel(trigger);
      // [chat-channel R8] 해제 뒤 도착한 race event 가 dispatcher 에 닿아도 안전하게.
      // 미등록이면 noop.
      this.channelListenerRegistry.unregister(trigger.id);
    }
  }

  /**
   * schedule job 을 **전부 시도**하고, 하나라도 실패하면 이미 해제한 활성 job 을 **다시 등록한 뒤**
   * 던진다 — 삭제는 멈춘다.
   *
   * 앞에서부터 해제하다 k 번째에서 그냥 던지면 1..k-1 은 Redis 에서 사라졌는데 행은 남는다: 스케줄은
   * 활성인데 발화하지 않는 상태가 재시작(`onModuleInit` 재등록) 전까지 조용히 굳는다. 이 PR 이 없애려는
   * 결함 클래스라 되돌린다. 복구도 실패하면 소리내어 남긴다 — 재시작이 마지막 그물이다.
   */
  private async removeScheduleJobsOrRestore(
    schedules: Schedule[],
  ): Promise<void> {
    const removed: Schedule[] = [];
    const failures: Array<{ scheduleId: string; reason: string }> = [];
    for (const schedule of schedules) {
      try {
        await this.scheduleRunner.removeJob(schedule.id);
        removed.push(schedule);
      } catch (err) {
        failures.push({
          scheduleId: schedule.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (failures.length === 0) return;

    for (const schedule of removed.filter((s) => s.isActive)) {
      try {
        await this.scheduleRunner.registerJob(schedule);
      } catch (err) {
        this.logger.error(
          `schedule=${schedule.id} 의 job 을 삭제 중단 뒤 다시 등록하지 못했다 — 재시작 전까지 발화하지 ` +
            `않는다(부팅 시 활성 스케줄을 재등록한다): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    throw new Error(
      `schedule job 해제 실패 — 삭제를 멈췄다(${failures
        .map((f) => `schedule=${f.scheduleId}: ${f.reason}`)
        .join('; ')})`,
    );
  }
}
