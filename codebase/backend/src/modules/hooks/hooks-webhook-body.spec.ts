import 'reflect-metadata';

import { bodyParamDesignType } from '../../shared/testing/swagger-probe';
import { HooksController } from './hooks.controller';

/**
 * `POST /hooks/:endpointPath` 본문 — OpenAPI 가 «본문을 받는다» 는 사실을 광고하는지.
 *
 * 형태는 외부 발신자가 정한다(`spec/5-system/12-webhook.md` WH-EP-04 · WH-EP-05 — JSON · form-urlencoded, 객체가 아닐 수도 있다).
 * 그래서 스키마는 «임의 값»(`{}`)이고 선택이다. 파라미터는 `unknown` 이라 전역 파이프를 타지 않는다.
 */
describe('POST /hooks/:endpointPath 본문', () => {
  it('[캐너리] `@Body()` 파라미터는 DTO 로 타입되지 않는다', () => {
    expect(bodyParamDesignType(HooksController, 'receiveWebhook')).toBe(Object);
  });

  it('[가드] `@ApiBody` 는 선택 · 임의 값 스키마다', () => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      HooksController.prototype.receiveWebhook,
    ) as Array<Record<string, unknown>> | undefined;
    const bodyParam = (params ?? []).find((p) => p.in === 'body');
    expect(bodyParam).toBeDefined();
    expect(bodyParam?.required).toBe(false);
    expect(bodyParam?.schema).toStrictEqual({});
  });

  it('[가드] JSON 과 form-urlencoded 를 받는다고 광고한다(WH-EP-04)', () => {
    const consumes = Reflect.getMetadata(
      'swagger/apiConsumes',
      HooksController.prototype.receiveWebhook,
    ) as string[] | undefined;
    expect(consumes).toStrictEqual([
      'application/json',
      'application/x-www-form-urlencoded',
    ]);
  });
});
