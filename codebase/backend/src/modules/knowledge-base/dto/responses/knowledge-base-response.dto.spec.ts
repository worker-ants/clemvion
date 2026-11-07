import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import {
  DocumentDto,
  GraphEntityDto,
  KnowledgeBaseDto,
} from './knowledge-base-response.dto';

/**
 * 지식 베이스 응답 DTO 의 부재 표현 선언 회귀 가드(API 규약 §5.5).
 *
 * 금지 조합(optional + nullable)이었던 필드를 기본형으로 갚았다. 모두 엔티티의 nullable 컬럼이라 응답에 늘 실리고 값이
 * 없으면 `null` 이다. `GraphEntityDto` 는 이미 실리고 있던 `knowledgeBaseId` · `lastSeenChunkId` 선언도 더했다.
 *
 * `swagger-dto-contract` 래칫은 optional + nullable 로 되돌리는 회귀만 잡는다. `@ApiPropertyOptional()` 로 되돌리면 래칫도
 * e2e 계약 대조도 통과하므로 선언 모양을 여기서 직접 본다.
 */
describe('지식 베이스 응답 DTO 선언', () => {
  it.each([
    {
      dto: KnowledgeBaseDto,
      fields: ['description', 'embeddingDimension', 'extractionLlmConfigId'],
    },
    {
      dto: DocumentDto,
      fields: [
        'embeddingLastAttemptedAt',
        'embeddingErrorMessage',
        'graphExtractionStatus',
        'graphLastAttemptedAt',
        'graphErrorMessage',
      ],
    },
    { dto: GraphEntityDto, fields: ['description', 'lastSeenChunkId'] },
  ])(
    '$dto.name — $fields 는 늘 실리고 null 일 수 있다',
    async ({ dto, fields }) => {
      const { schema } = await contractForDto(dto);

      expect(schema.required).toEqual(expect.arrayContaining(fields));
      for (const field of fields) {
        expect(schema.properties?.[field]).toMatchObject({ nullable: true });
      }
    },
  );

  it('GraphEntityDto — knowledgeBaseId 는 늘 실리고 null 이 아니다', async () => {
    const { schema } = await contractForDto(GraphEntityDto);

    expect(schema.required).toEqual(
      expect.arrayContaining(['knowledgeBaseId']),
    );
    expect(schema.properties?.knowledgeBaseId).toStrictEqual({
      type: 'string',
      format: 'uuid',
    });
  });

  it('스칼라 필드의 타입이 선언에서 빠지지 않는다', async () => {
    const kb = (await contractForDto(KnowledgeBaseDto)).schema.properties;
    expect(kb?.description).toMatchObject({ type: 'string' });
    expect(kb?.embeddingDimension).toMatchObject({ type: 'number' });
    expect(kb?.extractionLlmConfigId).toMatchObject({
      type: 'string',
      format: 'uuid',
    });

    const doc = (await contractForDto(DocumentDto)).schema.properties;
    expect(doc?.embeddingLastAttemptedAt).toMatchObject({
      type: 'string',
      format: 'date-time',
    });
    expect(doc?.graphExtractionStatus).toMatchObject({
      enum: ['pending', 'processing', 'completed', 'error', 'failed'],
    });
  });
});
