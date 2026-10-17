import { MODULE_METADATA } from '@nestjs/common/constants';
import type { Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Subject } from 'rxjs';

import { WebsocketService } from '../websocket/websocket.service';
import { ExternalInteractionModule } from './external-interaction.module';
import {
  INTERACTION_STREAM_CLOSER,
  resolveAndCloseTriggerTokenStreams,
} from './interaction-stream-closer';
import { SseAdapter, type SseSubscriber } from './sse-adapter.service';
import { SseFanoutService } from './sse-fanout.service';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * `INTERACTION_STREAM_CLOSER` 가 실제로 `SseAdapter` 로 해석되는지 — 다른 단위 테스트는 모두 이 포트를 가짜 provider 로
 * 바꿔 `useExisting: SseAdapter` 선언을 한 번도 밟지 않는다. 선언이 지워지거나 다른 클래스를 가리켜도 그 테스트들은
 * 통과하고, 실제 서버에서는 호출자(`TriggersModule` · `SchedulesModule`)가 `ModuleRef.get(TOKEN, { strict: false })`
 * 에서 던지는 오류를 삼켜 트리거 단위 토큰이 무효가 된 뒤에도 스트림이 열려 있게 된다.
 *
 * 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰)
 */
describe('INTERACTION_STREAM_CLOSER 와이어링', () => {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    ExternalInteractionModule,
  ) as Provider[];
  const declared = providers.find(
    (p) =>
      typeof p === 'object' &&
      'provide' in p &&
      p.provide === INTERACTION_STREAM_CLOSER,
  );

  it('ExternalInteractionModule 이 SseAdapter 를 가리키는 provider 를 선언한다', () => {
    expect(declared).toBeDefined();
    expect(declared).toMatchObject({ useExisting: SseAdapter });
    // 가리키는 클래스가 같은 모듈의 provider 여야 한다.
    expect(providers).toContain(SseAdapter);
    // SseAdapter 가 주입받는 Redis 쪽 서비스도 같은 모듈에 있다.
    expect(providers).toContain(SseFanoutService);
  });

  it('선언 그대로 ModuleRef(strict: false)로 해석되어 itk 스트림을 닫는다', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SseAdapter,
        SseFanoutService,
        // Redis 없이 부팅한 것과 같다. 이 서버 인스턴스의 구독자를 닫는 경로를 본다.
        {
          provide: RedisConnectionProvider,
          useValue: { getClientOrNull: () => null },
        },
        // 모듈 메타데이터에서 꺼낸 그 선언이다 — 테스트가 따로 적은 것이 아니다.
        declared!,
        {
          provide: WebsocketService,
          useValue: { executionEvents$: new Subject() },
        },
      ],
    }).compile();
    await moduleRef.init();
    const adapter = moduleRef.get(SseAdapter);
    const close = jest.fn();
    const iextClose = jest.fn();
    const itk: SseSubscriber = {
      id: 's-itk',
      executionId: 'e1',
      token: { family: 'itk', triggerId: 't1' },
      push: jest.fn(),
      close,
    };
    const iext: SseSubscriber = {
      id: 's-iext',
      executionId: 'e1',
      token: { family: 'iext' },
      push: jest.fn(),
      close: iextClose,
    };
    for (const sub of [itk, iext]) {
      expect(await adapter.admit(sub)).toBe(true);
      await adapter.start(sub);
    }
    const logger = { error: jest.fn() };

    // 호출자와 같은 방식이다: `moduleRef` 로 토큰을 해석한다.
    resolveAndCloseTriggerTokenStreams(
      moduleRef.get(ModuleRef),
      ['t1'],
      logger,
      'wiring-spec',
    );

    expect(logger.error).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    // 실행 단위 토큰으로 연 스트림은 대상이 아니다.
    expect(iextClose).not.toHaveBeenCalled();
    await moduleRef.close();
  });
});
