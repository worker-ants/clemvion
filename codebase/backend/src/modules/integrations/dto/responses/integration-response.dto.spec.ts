import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import {
  IntegrationActivityItemDto,
  IntegrationDto,
  TestConnectionResultDto,
} from './integration-response.dto';

/**
 * 통합 응답 DTO 의 부재 표현 선언 회귀 가드(API 규약 §5.5).
 *
 * 금지 조합(optional + nullable)이었던 필드를 기본형으로 갚았다.
 *
 * - `IntegrationDto.statusReason` · `lastError`: 엔티티 컬럼이라 늘 실린다. 값이 없으면 `null` 이다.
 * - `IntegrationDto.lastCheckedAt` · `expiresAt`: 응답에 실린 적이 없어 선언을 지웠다.
 * - `IntegrationActivityItemDto`: 활동 로그 행을 그대로 싣는다. 선언이 실제 응답과 달랐던 것을 행 모양에 맞췄다.
 * - `TestConnectionResultDto.message`: 성공 · 실패 모두 실리는 문자열이다.
 *
 * `swagger-dto-contract` 래칫은 optional + nullable 로 되돌리는 회귀만 잡는다. `@ApiPropertyOptional()` 로 되돌리면 래칫도
 * e2e 계약 대조도 통과하므로 선언 모양을 여기서 직접 본다.
 */
describe('통합 응답 DTO 선언', () => {
  it('IntegrationDto — statusReason · lastError 는 늘 실리고 null 일 수 있다', async () => {
    const { schema } = await contractForDto(IntegrationDto);

    expect(schema.required).toEqual(
      expect.arrayContaining(['statusReason', 'lastError']),
    );
    expect(schema.properties?.statusReason).toStrictEqual({
      type: 'string',
      nullable: true,
    });
    expect(schema.properties?.lastError).toMatchObject({
      type: 'object',
      nullable: true,
    });
  });

  it('IntegrationDto — 실린 적 없는 lastCheckedAt · expiresAt 은 선언하지 않는다', async () => {
    const { schema } = await contractForDto(IntegrationDto);

    expect(schema.properties).not.toHaveProperty('lastCheckedAt');
    expect(schema.properties).not.toHaveProperty('expiresAt');
  });

  it('IntegrationActivityItemDto — 활동 로그 행의 필드를 모두 required 로 선언하고 nullable 컬럼만 null 을 허용한다', async () => {
    const { schema } = await contractForDto(IntegrationActivityItemDto);

    expect([...(schema.required ?? [])].sort()).toEqual(
      [
        'apiLabel',
        'apiMethod',
        'apiPath',
        'at',
        'durationMs',
        'error',
        'id',
        'integrationId',
        'nodeExecutionId',
        'status',
        'workflowId',
      ].sort(),
    );
    const nullable = Object.entries(schema.properties ?? {})
      .filter(([, prop]) => (prop as { nullable?: boolean }).nullable === true)
      .map(([name]) => name)
      .sort();
    expect(nullable).toEqual(['apiLabel', 'apiMethod', 'apiPath', 'error']);
    expect(schema.properties?.status).toMatchObject({
      enum: ['success', 'failed'],
    });
  });

  it('TestConnectionResultDto — message 는 늘 실리는 문자열이다', async () => {
    const { schema } = await contractForDto(TestConnectionResultDto);

    expect(schema.required).toEqual(expect.arrayContaining(['message']));
    expect(schema.properties?.message).toStrictEqual({ type: 'string' });
  });
});
