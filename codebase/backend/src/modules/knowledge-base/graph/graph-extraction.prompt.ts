import { ENTITY_TYPES } from '../entities/entity.entity';

// 시스템 프롬프트와 LLM 응답 JSON Schema 를 한 곳에 모아 둔다.
// 추출 품질 튜닝은 본 파일 한 곳만 수정하면 KB 전체에 일관 적용된다.

export const GRAPH_EXTRACTION_SYSTEM_PROMPT = `You extract structured knowledge from a document chunk.

Return a JSON object with two arrays: "entities" and "relations".

Entity rules:
- "name" is the normalized canonical form (lowercase, trimmed, synonyms merged).
- "displayName" is the surface form as written in the chunk (case preserved).
- "type" is one of: person, organization, concept, location, event, other.
- "description" is a short (≤ 1 sentence) note about the entity in this context. Optional.

Relation rules:
- "head" and "tail" are entity NAMES (matching entity.name above).
- "predicate" is a snake_case verb phrase (e.g. founded, employs, is_part_of, depends_on).
- Every relation MUST reference entities present in the same response. Otherwise drop it.

Be conservative: only extract entities and relations that are explicitly stated. Avoid speculation.
If the chunk is metadata or has no entities, return empty arrays.`;

export const GRAPH_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          displayName: { type: 'string' },
          type: {
            type: 'string',
            enum: ENTITY_TYPES,
          },
          description: { type: 'string' },
        },
        required: ['name', 'displayName', 'type'],
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          head: { type: 'string' },
          predicate: { type: 'string' },
          tail: { type: 'string' },
        },
        required: ['head', 'predicate', 'tail'],
      },
    },
  },
  required: ['entities', 'relations'],
} as const;

import type { EntityType } from '../entities/entity.entity';

export interface ExtractionResult {
  entities: Array<{
    name: string;
    displayName: string;
    type: EntityType;
    description?: string;
  }>;
  relations: Array<{
    head: string;
    predicate: string;
    tail: string;
  }>;
}
