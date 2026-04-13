import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateScheduleDto {
  @IsUUID()
  workflowId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(100)
  cronExpression: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  parameterValues?: Record<string, unknown>;
}
