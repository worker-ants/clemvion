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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeCategory } from '../../nodes/entities/node.entity';
import { EdgeType } from '../../edges/entities/edge.entity';

export class SaveCanvasNodeDto {
  /** 노드 ID (UUID 또는 클라이언트 임시 ID; 최대 36자) */
  @ApiProperty({
    description: '노드 ID. 기존 노드의 UUID 또는 클라이언트 임시 ID',
    maxLength: 36,
    example: '3f5a9b0c-2b8d-4e9a-8f1b-7c9e2d4a5b6c',
  })
  @IsString()
  @MaxLength(36)
  id: string;

  /** 노드 타입 식별자 */
  @ApiProperty({
    description: '노드 타입 식별자',
    maxLength: 50,
    example: 'http_request',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  /** 노드 카테고리 */
  @ApiProperty({
    description: '노드 카테고리',
    enum: NodeCategory,
    enumName: 'NodeCategory',
  })
  @IsEnum(NodeCategory)
  category: NodeCategory;

  /** 노드 라벨 (워크플로우 내 유일) */
  @ApiProperty({
    description: '노드 라벨. 워크플로우 내 유일해야 합니다.',
    maxLength: 255,
    example: 'Fetch API',
  })
  @IsString()
  @MaxLength(255)
  label: string;

  /** 캔버스 X 좌표 */
  @ApiProperty({ description: '캔버스 X 좌표', example: 250 })
  @IsNumber()
  positionX: number;

  /** 캔버스 Y 좌표 */
  @ApiProperty({ description: '캔버스 Y 좌표', example: 300 })
  @IsNumber()
  positionY: number;

  /** 노드 설정 객체 */
  @ApiPropertyOptional({
    description: '노드별 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** 비활성화 여부 */
  @ApiPropertyOptional({ description: '비활성화 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  /** 노드 설명 */
  @ApiPropertyOptional({ description: '노드 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  /** 소속 컨테이너 노드 UUID (없으면 null) */
  @ApiPropertyOptional({
    description: '소속 컨테이너 노드 UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  containerId?: string | null;

  /** 도구 소유자 노드 UUID (없으면 null) */
  @ApiPropertyOptional({
    description: '도구 소유자 노드 UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  toolOwnerId?: string | null;
}

export class SaveCanvasEdgeDto {
  /** 엣지 ID (클라이언트 식별용, 선택) */
  @ApiPropertyOptional({ description: '엣지 식별자 (선택)' })
  @IsOptional()
  @IsString()
  id?: string;

  /** source 노드 ID */
  @ApiProperty({ description: 'source 노드 ID' })
  @IsString()
  sourceNodeId: string;

  /** source 포트 이름 (기본 out) */
  @ApiPropertyOptional({
    description: 'source 포트 이름',
    maxLength: 100,
    example: 'out',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourcePort?: string;

  /** target 노드 ID */
  @ApiProperty({ description: 'target 노드 ID' })
  @IsString()
  targetNodeId: string;

  /** target 포트 이름 (기본 in) */
  @ApiPropertyOptional({
    description: 'target 포트 이름',
    maxLength: 100,
    example: 'in',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetPort?: string;

  /** 엣지 타입 (data: 일반 흐름, error: 에러 포트) */
  @ApiPropertyOptional({
    description: '엣지 타입',
    enum: EdgeType,
    enumName: 'EdgeType',
  })
  @IsOptional()
  @IsEnum(EdgeType)
  type?: EdgeType;

  /** 조건부 엣지에 적용되는 조건식 */
  @ApiPropertyOptional({
    description: '조건부 엣지에 적용되는 조건식',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}

export class SaveCanvasDto {
  /** 변경할 워크플로우 이름 (옵션) */
  @ApiPropertyOptional({
    description: '변경할 워크플로우 이름',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 캔버스의 모든 노드 (서버 상태와 동기화됨, 제출되지 않은 노드는 삭제) */
  @ApiProperty({
    description:
      '캔버스에 존재하는 모든 노드. 서버 상태는 이 배열과 동기화되며, 포함되지 않은 노드는 삭제됩니다.',
    type: () => [SaveCanvasNodeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCanvasNodeDto)
  nodes: SaveCanvasNodeDto[];

  /** 캔버스의 모든 엣지 (기존 엣지는 전부 제거 후 교체됨) */
  @ApiProperty({
    description:
      '캔버스의 모든 엣지. 기존 엣지는 전부 삭제되고 이 배열로 교체됩니다.',
    type: () => [SaveCanvasEdgeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCanvasEdgeDto)
  edges: SaveCanvasEdgeDto[];

  /** 이 저장에 대한 변경 요약 (버전 이력에 기록됨) */
  @ApiPropertyOptional({
    description: '이 저장에 대한 변경 요약. 버전 이력 목록에 표시됩니다.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeSummary?: string;
}
