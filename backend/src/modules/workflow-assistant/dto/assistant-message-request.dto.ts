import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MAX_NODES_PER_SNAPSHOT = 500;
const MAX_EDGES_PER_SNAPSHOT = 2_000;
const MAX_MESSAGE_CHARS = 8_000;

export class AssistantWorkflowNodeDto {
  @ApiProperty({ description: '노드 ID (UUID 또는 클라이언트 임시 ID)' })
  @IsString()
  @MaxLength(64)
  id: string;

  @ApiProperty({ description: '노드 타입 식별자', example: 'http_request' })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({ description: '노드 라벨 (워크플로우 내 유일)' })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiProperty({ description: '노드 카테고리', example: 'integration' })
  @IsString()
  @MaxLength(32)
  category: string;

  @ApiProperty({ description: '캔버스 X 좌표' })
  @IsNumber()
  positionX: number;

  @ApiProperty({ description: '캔버스 Y 좌표' })
  @IsNumber()
  positionY: number;

  @ApiPropertyOptional({
    description: '노드 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '소속 컨테이너 노드 UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  containerId?: string | null;

  @ApiPropertyOptional({
    description: '도구 소유자 노드 UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  toolOwnerId?: string | null;
}

export class AssistantWorkflowEdgeDto {
  @ApiPropertyOptional({ description: '엣지 식별자 (선택)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiProperty({ description: 'source 노드 ID' })
  @IsString()
  @MaxLength(64)
  sourceNodeId: string;

  @ApiPropertyOptional({ description: 'source 포트', example: 'out' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourcePort?: string;

  @ApiProperty({ description: 'target 노드 ID' })
  @IsString()
  @MaxLength(64)
  targetNodeId: string;

  @ApiPropertyOptional({ description: 'target 포트', example: 'in' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetPort?: string;

  @ApiPropertyOptional({
    description: '엣지 타입 (data | error)',
    enum: ['data', 'error'],
  })
  @IsOptional()
  @IsIn(['data', 'error'])
  type?: 'data' | 'error';
}

export class AssistantWorkflowSnapshotDto {
  @ApiProperty({
    description: '캔버스의 모든 노드',
    type: () => [AssistantWorkflowNodeDto],
  })
  @IsArray()
  @ArrayMaxSize(MAX_NODES_PER_SNAPSHOT)
  @ValidateNested({ each: true })
  @Type(() => AssistantWorkflowNodeDto)
  nodes: AssistantWorkflowNodeDto[];

  @ApiProperty({
    description: '캔버스의 모든 엣지',
    type: () => [AssistantWorkflowEdgeDto],
  })
  @IsArray()
  @ArrayMaxSize(MAX_EDGES_PER_SNAPSHOT)
  @ValidateNested({ each: true })
  @Type(() => AssistantWorkflowEdgeDto)
  edges: AssistantWorkflowEdgeDto[];
}

export class AssistantMessageRequestDto {
  @ApiProperty({
    description: '사용자 메시지 본문',
    maxLength: MAX_MESSAGE_CHARS,
  })
  @IsString()
  @MaxLength(MAX_MESSAGE_CHARS)
  content: string;

  @ApiProperty({
    description: '현재 에디터 캔버스 스냅샷',
    type: AssistantWorkflowSnapshotDto,
  })
  @ValidateNested()
  @Type(() => AssistantWorkflowSnapshotDto)
  currentWorkflow: AssistantWorkflowSnapshotDto;

  @ApiPropertyOptional({
    description: '이 요청에만 적용할 LLM Config 오버라이드',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  llmConfigId?: string;
}
