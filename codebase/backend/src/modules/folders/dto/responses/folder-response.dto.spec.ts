import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import { FolderDto } from './folder-response.dto';

/**
 * `FolderDto.parentId` 선언 회귀 가드 — 폴더 API 5개 라우트의 응답.
 *
 * `parentId` 는 §5.4 금지 조합(optional + nullable)이었다가 기본형(required + nullable)으로 갚았다. 키는 원래 모든 응답(생성
 * 포함)에 실렸다 — 넓었던 것은 선언뿐이다(`folder-crud.e2e-spec.ts` 가 응답마다 키를 단언한다).
 *
 * ## 왜 래칫 · e2e 로 부족한가
 *
 * - `swagger-dto-contract` 래칫은 «optional + nullable» 로 되돌리는 회귀만 잡는다. `@ApiPropertyOptional()`(nullable 없이)로
 *   되돌리면 래칫은 통과한다.
 * - e2e 계약 대조는 **선언을 기준으로** 값을 본다 — optional 선언은 키가 빠져도 통과하므로 선언이 넓어지는 회귀를 못 본다.
 */
describe('FolderDto 선언', () => {
  it('parentId 는 항상 실리고 루트면 null 인 uuid 문자열이다', async () => {
    const { schema } = await contractForDto(FolderDto);

    expect(schema.required).toContain('parentId');
    expect(schema.properties?.parentId).toStrictEqual({
      type: 'string',
      format: 'uuid',
      nullable: true,
    });
  });
});
