import { NotificationWebhookProcessor } from './notification-webhook.processor';
import { Trigger } from '../triggers/entities/trigger.entity';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import type { Job } from 'bullmq';
import type { NotificationWebhookJob } from './notification-dispatcher.types';
import { Repository } from 'typeorm';
import {
  computeHmacSignature,
  verifySignatureHeader,
} from './notification-signature.util';

type Mock = jest.Mock;
type RepoMocks = {
  findOne: Mock;
  update: Mock;
};

function makeTriggerRepo(): jest.Mocked<Repository<Trigger>> {
  return {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  } as never;
}

function makeExecutionRepo(): jest.Mocked<Repository<Execution>> {
  return {
    findOne: jest.fn(),
  } as never;
}

function makeJob(
  data: Partial<NotificationWebhookJob>,
  opts: { attempts?: number; attemptsMade?: number } = {},
): Job<NotificationWebhookJob> {
  return {
    data: {
      deliveryId: data.deliveryId ?? 'd-1',
      triggerId: data.triggerId ?? 'trg-1',
      eventType: data.eventType ?? 'execution.completed',
      executionId: data.executionId ?? 'exec-1',
      workflowId: data.workflowId ?? 'wf-1',
      eventBody: data.eventBody ?? {
        type: data.eventType ?? 'execution.completed',
      },
    },
    attemptsMade: opts.attemptsMade ?? 0,
    opts: { attempts: opts.attempts ?? 5 },
  } as never;
}

const SECRET = 'wsk_test-secret';
const SECRET_V2 = 'wsk_test-secret-rotated';
const SAFE_URL = 'https://customer.example.com/webhook';

function makeTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    id: 'trg-1',
    workspaceId: 'ws-1',
    workflowId: 'wf-1',
    type: 'webhook',
    name: 'test trigger',
    isActive: true,
    config: {
      notification: {
        url: SAFE_URL,
        events: ['execution.completed', 'execution.waiting_for_input'],
        signing: { algorithm: 'hmac-sha256', secret: SECRET },
      },
    },
    notificationHealth: 'unknown',
    notificationLastError: null,
    notificationSecretV2: null,
    notificationRotatedAt: null,
    ...overrides,
  } as Trigger;
}

describe('NotificationWebhookProcessor.process', () => {
  let processor: NotificationWebhookProcessor;
  let triggerRepo: RepoMocks;
  let executionRepo: RepoMocks;
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    triggerRepo = makeTriggerRepo() as unknown as RepoMocks;
    executionRepo = makeExecutionRepo() as unknown as RepoMocks;
    processor = new NotificationWebhookProcessor(
      triggerRepo as never,
      executionRepo as never,
    );
    fetchSpy = jest.fn();
    (globalThis as unknown as { fetch: Mock }).fetch = fetchSpy;
  });

  it('skip silently — trigger 가 삭제됨', async () => {
    triggerRepo.findOne.mockResolvedValue(null);
    await expect(processor.process(makeJob({}))).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skip silently — notification.url 미설정', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger({ config: {} }));
    await processor.process(makeJob({}));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skip silently — events 에 미구독 이벤트', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.failed'], // completed 미구독
            signing: { algorithm: 'hmac-sha256', secret: SECRET },
          },
        },
      }),
    );
    await processor.process(makeJob({ eventType: 'execution.completed' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('성공 — 2xx 응답 → notification_health=healthy 갱신', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      SAFE_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Clemvion-Event': 'execution.completed',
          'X-Clemvion-Delivery': 'd-1',
        }),
      }),
    );
    expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
      notificationHealth: 'healthy',
      notificationLastError: null,
    });
  });

  it('HMAC 헤더 — 발신 서명을 검증 헬퍼로 verify 통과', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });

    await processor.process(
      makeJob({
        eventType: 'execution.completed',
        eventBody: { type: 'execution.completed', executionId: 'exec-1' },
      }),
    );

    const fetchOpts = fetchSpy.mock.calls[0][1] as {
      headers: Record<string, string>;
      body: string;
    };
    const sigHeader = fetchOpts.headers['X-Clemvion-Signature'];
    const verifyResult = verifySignatureHeader(
      sigHeader,
      fetchOpts.body,
      SECRET,
      'hmac-sha256',
      // tolerance 충분히 크게 — 테스트 환경의 timestamp 진동 흡수
      { nowSec: Math.floor(Date.now() / 1000) },
    );
    expect(verifyResult.valid).toBe(true);
  });

  it('Secret rotation — primary 와 secondary 둘 다 v1= 로 동봉되어 둘 다 검증 가능', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({ notificationSecretV2: SECRET_V2 }),
    );
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });
    await processor.process(makeJob({ eventType: 'execution.completed' }));
    const fetchOpts = fetchSpy.mock.calls[0][1] as {
      headers: Record<string, string>;
      body: string;
    };
    const sigHeader = fetchOpts.headers['X-Clemvion-Signature'];
    // primary, secondary 두 secret 으로 모두 verify 통과 (모든 secret 보유자가 검증 가능 — 24h grace).
    expect(
      verifySignatureHeader(sigHeader, fetchOpts.body, SECRET, 'hmac-sha256', {
        nowSec: Math.floor(Date.now() / 1000),
      }).valid,
    ).toBe(true);
    expect(
      verifySignatureHeader(
        sigHeader,
        fetchOpts.body,
        SECRET_V2,
        'hmac-sha256',
        {
          nowSec: Math.floor(Date.now() / 1000),
        },
      ).valid,
    ).toBe(true);
  });

  it('Stale 차단 — waiting_for_input 이벤트인데 execution 이 이미 cancelled', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    executionRepo.findOne.mockResolvedValue({
      id: 'exec-1',
      status: ExecutionStatus.CANCELLED,
    } as Execution);

    await processor.process(
      makeJob({ eventType: 'execution.waiting_for_input' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Stale 차단 — execution 자체가 사라진 경우도 skip', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    executionRepo.findOne.mockResolvedValue(null);
    await processor.process(
      makeJob({ eventType: 'execution.waiting_for_input' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SSRF — 등록 후 URL 이 사설 IP 로 바뀐 경우 degraded + skip', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: 'https://192.168.0.1/x',
            events: ['execution.completed'],
            signing: { algorithm: 'hmac-sha256', secret: SECRET },
          },
        },
      }),
    );

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({ notificationHealth: 'degraded' }),
    );
  });

  it('Secret 미설정 — degraded + skip', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: { algorithm: 'hmac-sha256' }, // secret 누락
          },
        },
      }),
    );
    await processor.process(makeJob({ eventType: 'execution.completed' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({ notificationHealth: 'degraded' }),
    );
  });

  it('HTTP 5xx — throw + non-final attempt 에서는 health 변경 안 함', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockResolvedValue({ status: 500, statusText: 'Internal' });

    await expect(
      processor.process(
        makeJob(
          { eventType: 'execution.completed' },
          { attempts: 5, attemptsMade: 1 },
        ),
      ),
    ).rejects.toThrow(/HTTP 500/);
    expect(triggerRepo.update).not.toHaveBeenCalled();
  });

  it('HTTP 5xx — final attempt 에서는 degraded 갱신 후 throw', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockResolvedValue({ status: 503, statusText: 'Unavailable' });

    await expect(
      processor.process(
        makeJob(
          { eventType: 'execution.completed' },
          { attempts: 5, attemptsMade: 4 },
        ),
      ),
    ).rejects.toThrow(/HTTP 503/);
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({
        notificationHealth: 'degraded',
        notificationLastError: expect.stringContaining('HTTP 503'),
      }),
    );
  });

  it('Network throw (timeout / DNS) — 마지막 attempt 에서 degraded + 재throw', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      processor.process(
        makeJob(
          { eventType: 'execution.completed' },
          { attempts: 2, attemptsMade: 1 },
        ),
      ),
    ).rejects.toThrow(/ENOTFOUND/);
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({ notificationHealth: 'degraded' }),
    );
  });

  it('algorithm — hmac-sha512 명시 시 서명도 sha512', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: { algorithm: 'hmac-sha512', secret: SECRET },
          },
        },
      }),
    );
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });
    await processor.process(makeJob({ eventType: 'execution.completed' }));
    const fetchOpts = fetchSpy.mock.calls[0][1] as {
      headers: Record<string, string>;
      body: string;
    };
    const sigHeader = fetchOpts.headers['X-Clemvion-Signature'];
    // sha512 hex 는 128 bytes. header 의 v1= 부분이 그 길이여야 함.
    expect(sigHeader).toMatch(/v1=[a-f0-9]{128}/);
    // verify 검증
    expect(
      verifySignatureHeader(sigHeader, fetchOpts.body, SECRET, 'hmac-sha512', {
        nowSec: Math.floor(Date.now() / 1000),
      }).valid,
    ).toBe(true);
  });

  it('Body — JSON.stringify(eventBody) 가 signature 와 정확히 정합', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });
    const eventBody = { foo: 1, bar: 'baz' };
    await processor.process(
      makeJob({ eventType: 'execution.completed', eventBody }),
    );
    const fetchOpts = fetchSpy.mock.calls[0][1] as {
      headers: Record<string, string>;
      body: string;
    };
    expect(fetchOpts.body).toBe(JSON.stringify(eventBody));
    const tsHeader = fetchOpts.headers['X-Clemvion-Timestamp'];
    const expectedHex = computeHmacSignature(
      'hmac-sha256',
      SECRET,
      Number(tsHeader),
      fetchOpts.body,
    );
    expect(fetchOpts.headers['X-Clemvion-Signature']).toContain(
      `v1=${expectedHex}`,
    );
  });
});
