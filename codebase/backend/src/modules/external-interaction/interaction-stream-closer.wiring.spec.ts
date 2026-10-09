import { MODULE_METADATA } from '@nestjs/common/constants';
import type { Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Subject } from 'rxjs';

import { WebsocketService } from '../websocket/websocket.service';
import { ExternalInteractionModule } from './external-interaction.module';
import {
  INTERACTION_STREAM_CLOSER,
  closeTriggerTokenStreams,
} from './interaction-stream-closer';
import { SseAdapter } from './sse-adapter.service';

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
  });

  it('선언 그대로 ModuleRef(strict: false)로 해석되어 itk 스트림을 닫는다', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SseAdapter,
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
    adapter.subscribe({
      id: 's-itk',
      executionId: 'e1',
      push: jest.fn(),
      tokenFamily: 'itk',
      triggerId: 't1',
      close,
    });
    adapter.subscribe({
      id: 's-iext',
      executionId: 'e1',
      push: jest.fn(),
      tokenFamily: 'iext',
      triggerId: null,
      close: iextClose,
    });
    const logger = { error: jest.fn() };

    // 호출자와 같은 방식이다: `moduleRef` 로 토큰을 해석한다.
    closeTriggerTokenStreams(
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
