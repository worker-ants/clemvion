import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Background 본문 모니터링 API 의 cursor 페이지네이션 쿼리.
 *
 * cursor 는 opaque base64 — 서버가 `{ lastCreatedAt, lastId }` 를 직렬화하며
 * 클라이언트는 해석하지 않는다 (spec/4-nodes/1-logic/12-background.md §8.3).
 */
export class QueryBackgroundRunDto {
  @ApiPropertyOptional({
    description:
      'nodeExecutions 페이지네이션 cursor (opaque base64). 첫 페이지는 생략.',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTE1VDA1OjA0OjM3WiIsImlkIjoiMTIzIn0=',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: '페이지당 NodeExecution 수',
    minimum: 1,
    maximum: 200,
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
