import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  folderId?: string | null;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
