import {
  IsOptional,
  IsInt,
  IsString,
  IsNotEmpty,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 추출 분류 (spec §3 AGM-11). 회수·가시화 시 사실/선호/개체를 구분한다. */
export const AGENT_MEMORY_KINDS = ['fact', 'preference', 'entity'] as const;
export type AgentMemoryKind = (typeof AGENT_MEMORY_KINDS)[number];

/**
 * `GET /agent-memories` 쿼리 (spec/5-system/17-agent-memory.md §6, AGM-12).
 *
 * 단일 scope 의 메모리 행을 조회한다. `scopeKey` 는 필수. `kind` 는 옵션 필터로
 * `metadata->>'kind'` 와 매칭한다. 페이지네이션은 `limit`/`offset`. workspace_id 는
 * 쿼리로 받지 않고 인증 컨텍스트(@WorkspaceId())에서만 온다 (격리 의무 §5).
 */
export class ListAgentMemoriesQueryDto {
  /** 조회할 메모리 네임스페이스 키 (필수). */
  @ApiProperty({
    description: '조회할 scope_key (필수)',
    example: 'cust-42',
    maxLength: 512,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  scopeKey: string;

  /** kind 필터 (fact|preference|entity). 미지정 시 전체. */
  @ApiPropertyOptional({
    description: '추출 분류 필터',
    enum: AGENT_MEMORY_KINDS,
    example: 'fact',
  })
  @IsOptional()
  @IsIn(AGENT_MEMORY_KINDS)
  kind?: AgentMemoryKind;

  /** 반환할 메모리 수 (1~100, 기본 30). */
  @ApiPropertyOptional({
    description: '반환할 메모리 수',
    minimum: 1,
    maximum: 100,
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  /** 건너뛸 메모리 수 (offset, 기본 0). */
  @ApiPropertyOptional({
    description: '건너뛸 메모리 수 (offset)',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
