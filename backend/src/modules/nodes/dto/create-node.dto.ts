import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NodeCategory } from '../entities/node.entity';

export class CreateNodeDto {
  @IsString()
  @MaxLength(50)
  type: string;

  @IsEnum(NodeCategory)
  category: NodeCategory;

  @IsString()
  @MaxLength(255)
  label: string;

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
  containerId?: string;

  @IsOptional()
  @IsUUID()
  toolOwnerId?: string;
}
