import 'reflect-metadata';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import {
  bodyParamDesignType,
  buildSwaggerDocument,
  schemaOf,
} from '../../shared/testing/swagger-probe';
import { TriggersController } from './triggers.controller';
import { ChatChannelRotateBotTokenRequestDto } from './dto/chat-channel-rotate-bot-token-request.dto';

/**
 * `POST /triggers/:id/chat-channel/rotate-bot-token` 본문 — **문서만 광고하고 계약은 그대로**인지 지키는 캐너리.
 *
 * `@Body()` 는 인라인 객체 타입이라 전역 `CustomValidationPipe` 가 검증을 건너뛴다. `newBotToken` 의 누락 · 비-string 은
 * 핸들러가 `INVALID_BOT_TOKEN` 으로 거부한다(`spec/5-system/15-chat-channel.md` §5.4). `ChatChannelRotateBotTokenRequestDto` 는
 * 그 사실을 바꾸지 않고 OpenAPI 스키마만 제공한다 — 선례 `workflows/workflows-execute-body.spec.ts`.
 *
 * > **여기가 RED 면 문서 작업이 계약 변경으로 번진 것이다.** 파라미터를 DTO 로 타입하고 싶다면 그건 에러 코드 · 여분 키
 * > 계약을 바꾸는 별도 결정이다 — 이 테스트를 조용히 고쳐 통과시키지 말 것.
 */
describe('POST /triggers/:id/chat-channel/rotate-bot-token 본문', () => {
  it('[캐너리] `@Body()` 파라미터는 DTO 로 타입되지 않는다 — 타입하면 파이프가 진입한다', () => {
    expect(bodyParamDesignType(TriggersController, 'rotateBotToken')).toBe(
      Object,
    );
  });

  it('[캐너리] 비-string newBotToken · 여분 키도 파이프를 통과한다 — 거부는 핸들러의 INVALID_BOT_TOKEN 몫이다', async () => {
    const body = { newBotToken: 12345, legacyClientField: 'ignored-so-far' };
    await expect(
      new CustomValidationPipe().transform(body, {
        type: 'body',
        metatype: bodyParamDesignType(
          TriggersController,
          'rotateBotToken',
        ) as never,
      }),
    ).resolves.toStrictEqual(body);
  });

  it('[가드] 실 컨트롤러의 `@ApiBody` 가 ChatChannelRotateBotTokenRequestDto 를 가리킨다', () => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      TriggersController.prototype.rotateBotToken,
    ) as Array<Record<string, unknown>> | undefined;
    const bodyParam = (params ?? []).find((p) => p.in === 'body');
    expect(bodyParam?.type).toBe(ChatChannelRotateBotTokenRequestDto);
  });

  it('[렌더] 스키마 — newBotToken 하나, 필수 · writeOnly string', async () => {
    @Controller('stub')
    class StubController {
      @Post()
      @ApiBody({ type: ChatChannelRotateBotTokenRequestDto })
      run(@Body() _body: unknown): void {}
    }
    const doc = await buildSwaggerDocument({ controllers: [StubController] });
    const schema = schemaOf(doc, 'ChatChannelRotateBotTokenRequestDto');
    expect(Object.keys(schema.properties ?? {})).toStrictEqual(['newBotToken']);
    expect(schema.required).toStrictEqual(['newBotToken']);
    const token = schema.properties?.newBotToken as
      { type?: string; writeOnly?: boolean } | undefined;
    expect(token?.type).toBe('string');
    // secret store 입력 plaintext — `swagger.md` §1-5 의무.
    expect(token?.writeOnly).toBe(true);
  });
});
