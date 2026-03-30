import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTriggerDto {
  @IsUUID()
  workflowId: string;

  @IsIn(['webhook', 'manual'])
  type: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  endpointPath?: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  authConfigId?: string | null;
}
