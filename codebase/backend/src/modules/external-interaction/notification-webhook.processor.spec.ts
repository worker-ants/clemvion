import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import {
  NotificationWebhookProcessor,
  REDIRECT_NOT_FOLLOWED_HINT,
} from './notification-webhook.processor';
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
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import * as ssrfSafeUrl from '../../common/utils/ssrf-safe-url.util';

// 발송 직전 DNS 결과 검사(`checkResolvedHostIp`)가 부르는 OS 해석기. 검사는 운영 기본 또는 opt-in 때만 돌아서 다른
// 테스트는 이 가짜에 닿지 않는다. 닿으면 공인 주소 하나로 답한다(실제 DNS 를 묻지 않게).
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));
const mockedLookup = lookup as unknown as jest.MockedFunction<
  (hostname: string, options: { all: true }) => Promise<LookupAddress[]>
>;

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

/** 각 테스트가 `globalThis.fetch` 를 mock 으로 바꾸기 전의 실제 fetch. */
const realFetch = globalThis.fetch;

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}/`);
    });
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

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

function makeSecretsMock(): jest.Mocked<SecretResolverService> {
  return {
    resolve: jest.fn(),
    store: jest.fn(),
    rotate: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn().mockResolvedValue(0),
    exists: jest.fn(),
  } as unknown as jest.Mocked<SecretResolverService>;
}

describe('NotificationWebhookProcessor.process', () => {
  let processor: NotificationWebhookProcessor;
  let triggerRepo: RepoMocks;
  let executionRepo: RepoMocks;
  let fetchSpy: jest.Mock;
  let secrets: jest.Mocked<SecretResolverService>;
  let outboundRateLimiter: { consume: jest.Mock };

  beforeEach(() => {
    triggerRepo = makeTriggerRepo() as unknown as RepoMocks;
    executionRepo = makeExecutionRepo() as unknown as RepoMocks;
    secrets = makeSecretsMock();
    // default: secrets.resolve throws (legacy plaintext fallback path used)
    (secrets.resolve as jest.Mock).mockRejectedValue(new Error('not found'));
    // §8.4/EIA-NX-11 — 기본은 "폭주 아님"(false). 폭주 케이스는 테스트에서 override.
    outboundRateLimiter = { consume: jest.fn().mockResolvedValue(false) };
    processor = new NotificationWebhookProcessor(
      triggerRepo as never,
      executionRepo as never,
      secrets as never,
      outboundRateLimiter as never,
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

  it('성공 + outbound 폭주(§8.4/EIA-NX-11) → healthy 대신 degraded(폭주 원인), 발송은 그대로', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });
    outboundRateLimiter.consume.mockResolvedValue(true); // 분당 60 초과

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    // 알림은 그대로 발송(폐기 없음).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // healthy 로 마감하지 않고 degraded — 원인은 last_error 로 "발송 실패"와 구분.
    expect(outboundRateLimiter.consume).toHaveBeenCalledWith('trg-1');
    const update = triggerRepo.update.mock.calls.at(-1);
    expect(update?.[1].notificationHealth).toBe('degraded');
    expect(update?.[1].notificationLastError).toContain(
      'Outbound rate exceeded',
    );
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

  // IPv4 를 품은 IPv6 리터럴은 품은 IPv4 로 판정한다(NERV Task `CLE-T-DCQWEB`). 등록 뒤 저장값이 바뀌었어도 발송 직전에 막는다.
  it.each([
    ['https://[::ffff:127.0.0.1]/x', 'IPv4-mapped → loopback'],
    [
      'https://[::ffff:a9fe:a9fe]/latest/meta-data/',
      'IPv4-mapped → 메타데이터',
    ],
    ['https://[::7f00:1]/x', 'IPv4-compatible → loopback'],
    ['https://[::ffff:0:c0a8:1]/x', 'SIIT → 192.168.0.1'],
    ['https://[64:ff9b::10.0.0.5]/x', 'NAT64 → 10/8'],
    // 앞뒤 16비트가 달라서 순서를 바꿔 읽으면 `1.1.192.168` 이 되어 통과하는 값
    ['https://[::ffff:c0a8:101]/x', 'IPv4-mapped → 192.168.1.1 (hi/lo 비대칭)'],
  ])('SSRF — 알림 URL 이 %s (%s) 면 degraded + skip', async (url) => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url,
            events: ['execution.completed'],
            signing: { algorithm: 'hmac-sha256', secret: SECRET },
          },
        },
      }),
    );

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
      notificationHealth: 'degraded',
      notificationLastError:
        'outbound URL 거부: URL hostname must not be a private IPv6 address',
    });
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

  // «있음» 판정은 생성 · PATCH 의 판정(`decideNotificationSigning`)과 같은 함수(`readStoredSigningSecret`)다
  // (NERV Task `CLE-T-EQDYC1`). 형식이 틀린 참조는 없는 것이고 빈 문자열 평문도 없는 것이다.
  it('형식이 틀린 참조 옆에 옛 평문이 있으면 참조를 읽지 않고 옛 평문으로 서명한다', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: {
              algorithm: 'hmac-sha256',
              secretRef: 'not-a-ref',
              secret: SECRET,
            },
          },
        },
      }),
    );
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });
    await processor.process(makeJob({ eventType: 'execution.completed' }));
    expect(secrets.resolve).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('옛 평문이 빈 문자열이면 없는 것으로 보고 degraded + skip', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: { algorithm: 'hmac-sha256', secret: '' },
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

  it('Body — JSON.stringify(eventBody) 가 signature 와 정확히 정합 (legacy plaintext fallback)', async () => {
    // 기존 테스트: config.signing.secret = plaintext SECRET → legacyPlaintext fallback 경로.
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

  it('legacy plaintext fallback 경로 — config.signing.secret 평문 사용 (SUMMARY#16)', async () => {
    // secretRef 없음, secret = plaintext → 마이그레이션 전 호환성 경로.
    triggerRepo.findOne.mockResolvedValue(makeTrigger()); // config.signing.secret = SECRET
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    // 발송 성공 — legacyPlaintext fallback 으로 SECRET 사용.
    expect(fetchSpy).toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
      notificationHealth: 'healthy',
      notificationLastError: null,
    });
  });

  it('secretRef resolve 실패 → markDegraded + skip (SUMMARY#15)', async () => {
    const SECRET_REF = 'secret://triggers/trg-1/notification-signing';
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: { algorithm: 'hmac-sha256', secretRef: SECRET_REF },
          },
        },
      }),
    );
    // secrets.resolve throws (secretRef 존재하지만 decryption 실패 등)
    (secrets.resolve as jest.Mock).mockRejectedValueOnce(
      new Error('Secret decryption failed'),
    );

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({ notificationHealth: 'degraded' }),
    );
  });

  // 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
  // NERV Task `CLE-T-XYR067`. 저장된 행이 다른 트리거의 서명 비밀을 가리켜도 그 비밀로 서명하지 않는다.
  it('secretRef 가 다른 트리거를 가리키면 자기 트리거의 참조로 resolve 하고 오류 로그를 남긴다', async () => {
    const OWN_REF = 'secret://triggers/trg-1/notification-signing';
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: {
              algorithm: 'hmac-sha256',
              secretRef: 'secret://triggers/trg-victim/notification-signing',
            },
          },
        },
      }),
    );
    (secrets.resolve as jest.Mock).mockImplementation(async (ref: string) => {
      if (ref === OWN_REF) return SECRET;
      throw new Error('not found');
    });
    fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    // `mockRestore()` 는 호출 기록까지 지우므로 복원 전에 옮겨 둔다.
    let errorMessages: unknown[];
    try {
      await processor.process(makeJob({ eventType: 'execution.completed' }));
      errorMessages = errorSpy.mock.calls.map((call) => call[0]);
    } finally {
      errorSpy.mockRestore();
    }

    expect(secrets.resolve).toHaveBeenCalledTimes(1);
    expect(secrets.resolve).toHaveBeenCalledWith(OWN_REF);
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]).toContain('trg-1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('secretRef 와 옛 평문이 함께 있고 자기 비밀을 못 읽으면 옛 평문으로 내려가지 않고 degraded 로 닫힌다', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        config: {
          notification: {
            url: SAFE_URL,
            events: ['execution.completed'],
            signing: {
              algorithm: 'hmac-sha256',
              secretRef: 'secret://triggers/trg-victim/notification-signing',
              secret: 'legacy-plain-secret',
            },
          },
        },
      }),
    );
    (secrets.resolve as jest.Mock).mockRejectedValue(new Error('not found'));
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      await processor.process(makeJob({ eventType: 'execution.completed' }));
    } finally {
      errorSpy.mockRestore();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({ notificationHealth: 'degraded' }),
    );
  });

  // 리다이렉트를 따라가지 않는다(NERV Task `CLE-T-ZGYXSZ`). 발송 전 검사는 등록 URL 의 호스트만 보므로 따라가면
  // 공개 호스트의 3xx 가 사설 · 메타데이터 주소로 서명한 본문을 보낸다. 3xx 는 2xx 가 아니라 다른 실패와 같게 다룬다.
  // 근거: [EIA 알림 웹훅 「재시도와 실패 처리」](CLE-EIA-NOTIFY#재시도와-실패-처리)
  describe('리다이렉트', () => {
    it('fetch 에 redirect: manual 을 준다', async () => {
      triggerRepo.findOne.mockResolvedValue(makeTrigger());
      fetchSpy.mockResolvedValue({ status: 200, statusText: 'OK' });

      await processor.process(makeJob({ eventType: 'execution.completed' }));

      expect(fetchSpy).toHaveBeenCalledWith(
        SAFE_URL,
        expect.objectContaining({ redirect: 'manual' }),
      );
    });

    // 300 · 399 는 3xx 범위의 양 끝이다. 경계가 한 칸 어긋나면(예: `> 300`, `<= 399`) 여기서 걸린다.
    it.each([
      [300, 'Multiple Choices'],
      [301, 'Moved Permanently'],
      [302, 'Found'],
      [303, 'See Other'],
      [307, 'Temporary Redirect'],
      [308, 'Permanent Redirect'],
      [399, 'Unassigned'],
    ])(
      'HTTP %d — 한 번만 보내고 실패로 던진다. 마지막 시도가 아니면 건강도를 바꾸지 않는다',
      async (status, statusText) => {
        triggerRepo.findOne.mockResolvedValue(makeTrigger());
        fetchSpy.mockResolvedValue({
          status,
          statusText,
          headers: new Headers({
            location: 'http://169.254.169.254/latest/meta-data/',
          }),
        });

        await expect(
          processor.process(
            makeJob(
              { eventType: 'execution.completed' },
              { attempts: 5, attemptsMade: 1 },
            ),
          ),
        ).rejects.toThrow(
          new Error(
            `HTTP ${status} ${statusText}. ${REDIRECT_NOT_FOLLOWED_HINT}`,
          ),
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(triggerRepo.update).not.toHaveBeenCalled();
      },
    );

    it('HTTP 302 — 마지막 시도면 degraded 로 바꾸고 따라가지 않는다는 안내를 남긴다', async () => {
      triggerRepo.findOne.mockResolvedValue(makeTrigger());
      fetchSpy.mockResolvedValue({ status: 302, statusText: 'Found' });

      await expect(
        processor.process(
          makeJob(
            { eventType: 'execution.completed' },
            { attempts: 5, attemptsMade: 4 },
          ),
        ),
      ).rejects.toThrow(/HTTP 302/);
      expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
        notificationHealth: 'degraded',
        notificationLastError: `HTTP 302 Found. ${REDIRECT_NOT_FOLLOWED_HINT}`,
      });
    });

    it('statusText 가 비어 있으면 상태 코드와 안내 사이에 공백이 남지 않는다', async () => {
      triggerRepo.findOne.mockResolvedValue(makeTrigger());
      fetchSpy.mockResolvedValue({ status: 308, statusText: '' });

      await expect(
        processor.process(
          makeJob(
            { eventType: 'execution.completed' },
            { attempts: 1, attemptsMade: 0 },
          ),
        ),
      ).rejects.toThrow(new Error(`HTTP 308. ${REDIRECT_NOT_FOLLOWED_HINT}`));
      expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
        notificationHealth: 'degraded',
        notificationLastError: `HTTP 308. ${REDIRECT_NOT_FOLLOWED_HINT}`,
      });
    });

    // 3xx 바로 위인 400 과 대표적인 404 · 500 이다. 이 값들에는 안내를 붙이지 않는다.
    it.each([
      [400, 'Bad Request'],
      [404, 'Not Found'],
      [500, 'Internal Server Error'],
    ])(
      'HTTP %d — 3xx 가 아닌 실패에는 리다이렉트 안내를 붙이지 않는다',
      async (status, statusText) => {
        triggerRepo.findOne.mockResolvedValue(makeTrigger());
        fetchSpy.mockResolvedValue({ status, statusText });

        await expect(
          processor.process(
            makeJob(
              { eventType: 'execution.completed' },
              { attempts: 1, attemptsMade: 0 },
            ),
          ),
        ).rejects.toThrow(new Error(`HTTP ${status} ${statusText}`));
        expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
          notificationHealth: 'degraded',
          notificationLastError: `HTTP ${status} ${statusText}`,
        });
      },
    );

    it('3xx 가 아닌 실패도 statusText 가 비어 있으면 끝에 공백이 남지 않는다', async () => {
      triggerRepo.findOne.mockResolvedValue(makeTrigger());
      fetchSpy.mockResolvedValue({ status: 500, statusText: '' });

      await expect(
        processor.process(
          makeJob(
            { eventType: 'execution.completed' },
            { attempts: 1, attemptsMade: 0 },
          ),
        ),
      ).rejects.toThrow(new Error('HTTP 500'));
      expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
        notificationHealth: 'degraded',
        notificationLastError: 'HTTP 500',
      });
    });

    it('실제 fetch — 307 이 가리키는 주소로 서명한 본문을 보내지 않는다', async () => {
      const landingHits: string[] = [];
      const landing = createServer((req, res) => {
        landingHits.push(req.method ?? '');
        res.writeHead(200).end();
      });
      const landingUrl = await listen(landing);
      const redirectorHits: string[] = [];
      const redirector = createServer((req, res) => {
        redirectorHits.push(req.method ?? '');
        res.writeHead(307, { Location: landingUrl }).end();
      });
      const redirectorUrl = await listen(redirector);
      // 알림 URL 은 SSRF 검사를 지나는 공개 호스트(SAFE_URL)로 두고 연결만 로컬 서버로 돌린다. 처리기가 준
      // 옵션(`redirect` 포함)은 그대로 실제 fetch 에 넘긴다. `redirect: 'manual'` 이 빠지면 fetch 가 307 을 따라가
      // landing 이 POST 를 받고 200 으로 성공한다.
      (globalThis as unknown as { fetch: typeof fetch }).fetch = (
        _input,
        init,
      ) => realFetch(redirectorUrl, init);
      triggerRepo.findOne.mockResolvedValue(makeTrigger());

      try {
        await expect(
          processor.process(
            makeJob(
              { eventType: 'execution.completed' },
              { attempts: 1, attemptsMade: 0 },
            ),
          ),
        ).rejects.toThrow(/HTTP 307/);
      } finally {
        await close(redirector);
        await close(landing);
      }

      expect(redirectorHits).toEqual(['POST']);
      expect(landingHits).toEqual([]);
      expect(triggerRepo.update).toHaveBeenCalledWith(
        'trg-1',
        expect.objectContaining({ notificationHealth: 'degraded' }),
      );
    });
  });
});

// CLE-T-M1P83C — 발송 직전 DNS 결과 검사는 운영에서 기본으로 켜고 `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD=0` 으로만 끈다.
// 운영 밖은 `=1` 일 때만 켠다. 켜지면 사설 주소로 풀리는 호스트에는 보내지 않고 발송 건강도를 degraded 로 둔다.
describe('NotificationWebhookProcessor — 발송 직전 DNS 결과 검사', () => {
  const ENV_KEYS = [
    'NODE_ENV',
    'NOTIFICATION_ENFORCE_DNS_REBIND_GUARD',
  ] as const;
  let saved: Record<(typeof ENV_KEYS)[number], string | undefined>;
  let triggerRepo: RepoMocks;
  let fetchSpy: jest.Mock;

  const setEnv = (nodeEnv: string, flag: string | undefined): void => {
    process.env.NODE_ENV = nodeEnv;
    if (flag === undefined)
      delete process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD;
    else process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD = flag;
  };

  const makeProcessor = (): NotificationWebhookProcessor => {
    triggerRepo = makeTriggerRepo() as unknown as RepoMocks;
    const secrets = makeSecretsMock();
    (secrets.resolve as jest.Mock).mockRejectedValue(new Error('not found'));
    return new NotificationWebhookProcessor(
      triggerRepo as never,
      makeExecutionRepo() as never,
      secrets as never,
      { consume: jest.fn().mockResolvedValue(false) } as never,
    );
  };

  beforeEach(() => {
    saved = {
      NODE_ENV: process.env.NODE_ENV,
      NOTIFICATION_ENFORCE_DNS_REBIND_GUARD:
        process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD,
    };
    mockedLookup.mockReset();
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    fetchSpy = jest.fn().mockResolvedValue({ status: 200, statusText: 'OK' });
    (globalThis as unknown as { fetch: Mock }).fetch = fetchSpy;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    jest.restoreAllMocks();
    (globalThis as unknown as { fetch: typeof realFetch }).fetch = realFetch;
  });

  it('운영 기본(값 없음) — 사설 주소로 풀리면 보내지 않고 degraded 로 둔다', async () => {
    setEnv('production', undefined);
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    mockedLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(mockedLookup).toHaveBeenCalledWith('customer.example.com', {
      all: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
      notificationHealth: 'degraded',
      notificationLastError: expect.stringMatching(
        /^DNS rebinding 차단: resolved IPv4 10\.0\.0\.5 /,
      ),
    });
  });

  it('운영 기본(값 없음) — 공인 주소로 풀리면 그대로 보낸다', async () => {
    setEnv('production', undefined);
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(mockedLookup).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
      notificationHealth: 'healthy',
      notificationLastError: null,
    });
  });

  it('운영 기본 — 해석 실패는 그대로 보낸다(fail-open)', async () => {
    setEnv('production', undefined);
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    mockedLookup.mockRejectedValue(
      Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }),
    );

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 조회가 시간 안에 끝나지 않으면 검사는 `{ ok: true, reason }` 을 돌려준다. 발송은 이어 가고 발송 건강도는 바꾸지 않으며
  // 검사 없이 나간 발송이 보이도록 트리거 id 와 함께 경고 로그를 남긴다(CLE-EIA-NOTIFY 「SSRF」).
  it('운영 기본 — 조회 시간 초과는 그대로 보내고 경고 로그만 남긴다', async () => {
    setEnv('production', undefined);
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    const reason = 'DNS lookup timed out after 3000ms (fail-open)';
    const check = jest
      .spyOn(ssrfSafeUrl, 'checkResolvedHostIp')
      .mockResolvedValue({ ok: true, reason });
    const markDegraded = jest.spyOn(
      processor as unknown as {
        markDegraded: (triggerId: string, reason: string) => Promise<void>;
      },
      'markDegraded',
    );
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(check).toHaveBeenCalledWith('customer.example.com');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(markDegraded).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith('trg-1', {
      notificationHealth: 'healthy',
      notificationLastError: null,
    });
    expect(warn).toHaveBeenCalledWith(
      `notification DNS check fail-open — ${reason} (triggerId=trg-1)`,
    );
  });

  it('운영 기본 — 사유 없는 통과는 경고 로그를 남기지 않는다', async () => {
    setEnv('production', undefined);
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // 옛 평문 서명 비밀 경고는 이 트리거에서 따로 나온다. DNS 통과 경고만 없어야 한다.
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('DNS check fail-open'),
    );
  });

  it('운영에서 =0 이면 검사하지 않고 보낸다', async () => {
    setEnv('production', '0');
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    mockedLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('운영 밖 기본(값 없음)은 검사하지 않는다', async () => {
    setEnv('test', undefined);
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    mockedLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('운영 밖에서 =1 이면 검사한다', async () => {
    setEnv('test', '1');
    const processor = makeProcessor();
    triggerRepo.findOne.mockResolvedValue(makeTrigger());
    mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await processor.process(makeJob({ eventType: 'execution.completed' }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(triggerRepo.update).toHaveBeenCalledWith(
      'trg-1',
      expect.objectContaining({ notificationHealth: 'degraded' }),
    );
  });
});
