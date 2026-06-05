import { ApiProperty } from '@nestjs/swagger';
import { AGENT_MEMORY_KINDS } from '../list-agent-memories.query';

/**
 * scope 목록 항목 DTO (`GET /agent-memories/scopes`, AGM-12). 워크스페이스의
 * distinct scope_key 와 각 scope 의 메모리 건수·최신 갱신 시각을 노출한다.
 * embedding 은 포함하지 않는다 (대용량·불필요, spec §6).
 */
export class AgentMemoryScopeDto {
  @ApiProperty({ description: '메모리 네임스페이스 키', example: 'cust-42' })
  scopeKey: string;

  @ApiProperty({ description: '해당 scope 의 메모리 건수', example: 12 })
  count: number;

  @ApiProperty({
    description: '해당 scope 의 가장 최신 updated_at (ISO8601)',
    example: '2026-06-04T09:30:00.000Z',
  })
  latestUpdatedAt: string;
}

/**
 * 단일 메모리 행 DTO (`GET /agent-memories`, AGM-12). 명시 컬럼만 노출하며
 * **embedding 벡터는 절대 포함하지 않는다** (spec §6). `kind` 는 `metadata->>'kind'`
 * 에서 추출하고, 없으면 `fact` 로 표기한다 (AGM-11 fallback).
 */
export class AgentMemoryItemDto {
  @ApiProperty({ format: 'uuid', description: '메모리 행 UUID' })
  id: string;

  @ApiProperty({
    description: '추출된 사실/선호 텍스트',
    example: 'user prefers tea',
  })
  content: string;

  @ApiProperty({
    description: '추출 분류 (metadata.kind, 미지정 시 fact)',
    enum: AGENT_MEMORY_KINDS,
    example: 'fact',
  })
  kind: string;

  @ApiProperty({ description: '메모리 네임스페이스 키', example: 'cust-42' })
  scopeKey: string;

  @ApiProperty({
    description: '추출 시각 (ISO8601)',
    example: '2026-06-04T09:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: '마지막 갱신 시각 (ISO8601)',
    example: '2026-06-04T09:30:00.000Z',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'TTL 만료 시각 (ISO8601, 무만료면 null)',
    nullable: true,
    example: null,
  })
  expiresAt: string | null;
}
