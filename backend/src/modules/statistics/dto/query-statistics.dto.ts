import { IsOptional, IsIn, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryStatisticsDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'custom'])
  period?: string = '7d';

  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  workflowId?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
