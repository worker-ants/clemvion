import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsBoolean,
  IsUUID,
  IsArray,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { NodeCategory } from '../../nodes/entities/node.entity';
import { EdgeType } from '../../edges/entities/edge.entity';

export class SaveCanvasNodeDto {
  @IsString()
  @MaxLength(36)
  id: string;

  @IsString()
  @MaxLength(50)
  type: string;

  @IsEnum(NodeCategory)
  category: NodeCategory;

  @IsString()
  @MaxLength(255)
  label: string;

  @IsNumber()
  positionX: number;

  @IsNumber()
  positionY: number;

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

export class SaveCanvasEdgeDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  sourceNodeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourcePort?: string;

  @IsString()
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

export class SaveCanvasDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCanvasNodeDto)
  nodes: SaveCanvasNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCanvasEdgeDto)
  edges: SaveCanvasEdgeDto[];
}
