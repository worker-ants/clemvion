import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import {
  ModelConfigDto,
  ModelTestConnectionResultDto,
} from './model-config-response.dto';

/**
 * 모델 설정 응답 DTO 의 부재 표현 선언 회귀 가드(API 규약 §5.5).
 *
 * `apiKey` · `baseUrl` · `dimension` 은 금지 조합(optional + nullable)이었다가 기본형으로 갚았다. 서비스가 저장할 때 세 값을
 * `null` 로 채우고 응답마다 실으므로 늘 있는 키다. 연결 테스트의 `message` 는 실패할 때만 실리는 키 생략형이다.
 *
 * `swagger-dto-contract` 래칫은 optional + nullable 로 되돌리는 회귀만 잡는다. `@ApiPropertyOptional()` 로 되돌리면 래칫도
 * e2e 계약 대조도 통과하므로 선언 모양을 여기서 직접 본다.
 */
describe('모델 설정 응답 DTO 선언', () => {
  it('ModelConfigDto — apiKey · baseUrl · dimension 은 늘 실리고 null 일 수 있다', async () => {
    const { schema } = await contractForDto(ModelConfigDto);

    expect(schema.required).toEqual(
      expect.arrayContaining(['apiKey', 'baseUrl', 'dimension']),
    );
    expect(schema.properties?.apiKey).toStrictEqual({
      type: 'string',
      nullable: true,
      example: 'sk-****abcd',
    });
    expect(schema.properties?.baseUrl).toStrictEqual({
      type: 'string',
      nullable: true,
    });
    expect(schema.properties?.dimension).toStrictEqual({
      type: 'number',
      nullable: true,
      example: 1536,
    });
  });

  it('ModelTestConnectionResultDto — message 는 실패할 때만 실리고 null 이 아니다', async () => {
    const { schema } = await contractForDto(ModelTestConnectionResultDto);

    expect(schema.required ?? []).not.toContain('message');
    expect(schema.properties?.message).toStrictEqual({ type: 'string' });
  });
});
