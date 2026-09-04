import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EdgeType } from '../../entities/edge.entity';

/** 워크플로우 엣지(연결선) 응답 DTO */
export class EdgeDto {
  /** 엣지 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** source 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  sourceNodeId: string;

  /** source 포트 이름 */
  @ApiProperty({ example: 'out' })
  sourcePort: string;

  /** target 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  targetNodeId: string;

  /** target 포트 이름 */
  @ApiProperty({ example: 'in' })
  targetPort: string;

  /** 엣지 타입 */
  @ApiProperty({ enum: EdgeType, enumName: 'EdgeType' })
  type: EdgeType;

  /** 조건부 엣지에 적용되는 조건식 */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  condition?: Record<string, unknown> | null;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
