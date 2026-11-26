import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TriggersService } from './triggers.service';
import { ChatChannelBinderService } from './chat-channel-binder.service';
import { TriggerResourceReleaserService } from './trigger-resource-releaser.service';
import { NotificationSigningSecretService } from './notification-signing-secret.service';
import { Trigger } from './entities/trigger.entity';
import { withTransactionMock } from './__test-utils__/trigger-transaction-mock';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { AuthConfig } from '../auth-configs/entities/auth-config.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { ScheduleRunnerService } from '../schedules/schedule-runner.service';

/**
 * `rotateBotToken` 의 감사 기록 위치를 고정하는 회귀 테스트 (NERV Task `CLE-T-D6NK0C`).
 *
 * 형제 `triggers.service.spec.ts` 는 4단계(`setupChannel`) 실패와 6단계(컬럼 갱신) 실패에서
 * 감사가 남지 않음을 이미 단언한다. 감사를 6단계 앞 어디로 옮겨도 6단계 실패 테스트가 잡는다.
 *
 * 남은 자리는 6단계 **뒤**, 쓰기가 건너뛰어졌는지(`wrote === false`) 보기 **전**이다. 회전 도중
 * 트리거가 삭제되면 락 안 재읽기가 행을 찾지 못해 쓰기를 건너뛰고 404 로 끝난다. 감사를 그 판정
 * 앞으로 옮기면 삭제된 트리거에 "회전됐다" 는 거짓 기록이 남는다. 그 뮤턴트를 넣어도
 * `src/modules/triggers` 의 기존 테스트가 모두 통과했다(2026-11-20, 729 통과 · 1 skip).
 * 형제 spec 은 다른 묶음이 고치고 있어 이 파일에 따로 둔다.
 */
describe('TriggersService.rotateBotToken — 감사 기록 위치', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let auditLogs: { record: jest.Mock };

  const WORKSPACE_ID = 'ws-1';
  const TRIGGER_ID = 'trig-1';
  const NEW_TOKEN = '222222222:NewToken';

  const storedRow = (): Trigger =>
    ({
      id: TRIGGER_ID,
      workspaceId: WORKSPACE_ID,
      type: 'chat_channel',
      endpointPath: 'hook-abc',
      config: {
        chatChannel: {
          provider: 'telegram',
          botTokenRef: 'secret://triggers/trig-1/bot-token',
          inboundSigningRef: 'secret://triggers/trig-1/inbound-signing',
        },
      },
    }) as unknown as Trigger;

  beforeEach(async () => {
    const mockAdapter = {
      setupChannel: jest.fn().mockResolvedValue({
        registeredAt: new Date().toISOString(),
        configUpdates: {},
        issuedInboundSigning: 'newWebhookSecret',
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        TriggersService,
        ChatChannelBinderService,
        TriggerResourceReleaserService,
        NotificationSigningSecretService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: withTransactionMock({
            findOne: jest.fn().mockResolvedValue(storedRow()),
            update: jest.fn().mockResolvedValue(undefined),
            save: jest.fn((t: Trigger) => Promise.resolve(t)),
          }),
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Workflow),
          useValue: { exists: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: {
            has: jest.fn().mockReturnValue(true),
            get: jest.fn().mockReturnValue(mockAdapter),
          },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn().mockResolvedValue(undefined),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'app.url' ? 'http://localhost:3000' : undefined,
            ),
          },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn().mockResolvedValue('111111111:OldToken'),
            store: jest.fn(),
            rotate: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn(),
            deleteByPrefix: jest.fn(),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    auditLogs = moduleRef.get(AuditLogsService) as unknown as {
      record: jest.Mock;
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('[대조군] 같은 준비로 행이 남아 있으면 감사를 남긴다', async () => {
    // 아래 테스트의 "기록 없음" 이 준비 실수로 생긴 것이 아님을 보인다.
    await service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'u-bot');

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'trigger.chat_channel_bot_token_rotated',
        resourceId: TRIGGER_ID,
      }),
    );
  });

  it('회전 도중 트리거가 삭제돼 6단계 쓰기를 건너뛰면 404 로 끝나고 감사를 남기지 않는다', async () => {
    // 첫 읽기(`findById`)는 행을 찾고 락 안 재읽기는 찾지 못한다. 그러면 쓰기가 건너뛰어진다.
    triggerRepo.findOne
      .mockResolvedValueOnce(storedRow())
      .mockResolvedValueOnce(null);
    const releaser = (
      service as unknown as {
        resourceReleaser: { undoAbsentWrite: jest.Mock };
      }
    ).resourceReleaser;
    const undoSpy = jest
      .spyOn(releaser, 'undoAbsentWrite')
      .mockResolvedValue(undefined);

    await expect(
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'u-bot'),
    ).rejects.toBeInstanceOf(NotFoundException);

    // 쓰기 건너뜀 분기에 실제로 들어갔는지 먼저 확인한다. 다른 이유로 던졌다면 아래 단언은 vacuous 하다.
    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(auditLogs.record).not.toHaveBeenCalled();
  });
});
