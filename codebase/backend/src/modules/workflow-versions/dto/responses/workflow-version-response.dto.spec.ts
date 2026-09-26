import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import {
  WorkflowVersionDto,
  WorkflowVersionListItemDto,
} from './workflow-version-response.dto';

/**
 * 버전 응답 DTO 의 `creator` · `changeSummary` 선언 회귀 가드 — `GET /workflows/:wfId/versions`(목록) ·
 * `GET /workflows/:wfId/versions/:versionId`(상세).
 *
 * 두 필드는 §5.4 금지 조합(optional + nullable)이었다가 기본형으로 갚았다: `creator` 는 항상 실리는 참조, `changeSummary` 는
 * 항상 실리고 값이 null 일 수 있다.
 *
 * ## 왜 래칫 · e2e 로 부족한가
 *
 * - `swagger-dto-contract` 래칫은 «optional + nullable» 로 되돌리는 회귀만 잡는다. `@ApiPropertyOptional()`(nullable 없이)로
 *   되돌리면 래칫은 통과한다.
 * - e2e 계약 대조는 **선언을 기준으로** 값을 본다 — optional 선언은 값이 있든 없든 통과하므로 선언이 넓어지는 회귀를 못 본다.
 */
describe('워크플로 버전 응답 DTO 선언', () => {
  it.each([{ dto: WorkflowVersionDto }, { dto: WorkflowVersionListItemDto }])(
    '$dto.name — creator 는 항상 실리는 참조, changeSummary 는 항상 실리고 null 일 수 있다',
    async ({ dto }) => {
      const { schema } = await contractForDto(dto);

      expect(schema.required).toEqual(
        expect.arrayContaining(['creator', 'changeSummary']),
      );
      expect(schema.properties?.creator).toStrictEqual({
        $ref: '#/components/schemas/WorkflowVersionCreatorDto',
      });
      expect(schema.properties?.changeSummary).toStrictEqual({
        type: 'string',
        nullable: true,
      });
    },
  );
});
