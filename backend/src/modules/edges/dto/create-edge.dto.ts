import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { EdgeType } from '../entities/edge.entity';

export class CreateEdgeDto {
  @IsUUID()
  sourceNodeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourcePort?: string;

  @IsUUID()
  targetNodeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetPort?: string;

  @IsOptional()
  @IsEnum(EdgeType)
  type?: EdgeType;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}
