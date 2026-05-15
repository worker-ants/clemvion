import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Background 본문 모니터링 API 의 cursor 페이지네이션 쿼리.
 *
 * cursor 는 opaque base64 token — 서버 내부 구조에 의존하지 말고 응답의
 * `nextCursor` 값을 그대로 다음 요청에 전달한다 (spec/4-nodes/1-logic/12-background.md §8.3).
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
