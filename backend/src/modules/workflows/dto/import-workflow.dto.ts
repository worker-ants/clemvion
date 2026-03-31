import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const ALLOWED_NODE_TYPES = [
  'manual_trigger',
  'if_else',
  'switch',
  'loop',
  'variable_declaration',
  'variable_modification',
  'split',
  'map',
  'foreach',
  'merge',
  'workflow',
  'http_request',
  'database_query',
  'slack',
  'send_email',
  'transform',
  'code',
  'carousel',
  'table',
  'chart',
  'form',
  'template',
  'pdf',
];

const ALLOWED_CATEGORIES = [
  'trigger',
  'logic',
  'flow',
  'ai',
  'integration',
  'data',
  'presentation',
];

class ImportNodeDto {
  @IsString()
  @IsIn(ALLOWED_NODE_TYPES)
  type: string;

  @IsString()
  @IsIn(ALLOWED_CATEGORIES)
  category: string;

  @IsString()
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
  containerId?: number | null;

  @IsOptional()
  toolOwnerId?: string | null;
}

class ImportEdgeDto {
  @IsNumber()
  sourceNodeIndex: number;

  @IsOptional()
  @IsString()
  sourcePort?: string;

  @IsNumber()
  targetNodeIndex: number;

  @IsOptional()
  @IsString()
  targetPort?: string;

  @IsOptional()
  @IsIn(['data', 'error'])
  type?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}

export class ImportWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportNodeDto)
  nodes: ImportNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEdgeDto)
  edges?: ImportEdgeDto[];
}
