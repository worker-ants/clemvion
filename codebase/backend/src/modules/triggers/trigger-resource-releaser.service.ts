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
        select: { id: true },
        where: { triggerId: In(scheduleTriggerIds) },
      });
      for (const schedule of schedules) {
        await this.scheduleRunner.removeJob(schedule.id);
      }
    }
    for (const trigger of triggers) {
      await this.chatChannelBinder.teardownChatChannel(trigger);
      // [chat-channel R8] 해제 뒤 도착한 race event 가 dispatcher 에 닿아도 안전하게.
      // 미등록이면 noop.
      this.channelListenerRegistry.unregister(trigger.id);
    }
  }
}
