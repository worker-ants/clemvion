import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsBoolean,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[^#]*$/, { message: 'Node label must not contain "#" character' })
  label?: string;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  containerId?: string | null;

  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  toolOwnerId?: string | null;
}
