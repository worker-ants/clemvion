import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RetryFailedBodyDto {
  @ApiPropertyOptional({
    enum: ['embedding', 'graph', 'all'],
    default: 'all',
    description:
      "재시도할 파이프라인 범위. 'embedding'·'graph' 는 해당 status='failed' 문서만, 'all' 은 둘 다.",
  })
  @IsOptional()
  @IsIn(['embedding', 'graph', 'all'])
  scope?: 'embedding' | 'graph' | 'all';
}
