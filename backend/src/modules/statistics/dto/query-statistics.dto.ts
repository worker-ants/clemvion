import { IsOptional, IsIn, IsUUID, IsDateString } from 'class-validator';

export class QueryStatisticsDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'custom'])
  period?: string = '7d';

  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
