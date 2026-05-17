import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkflowVersionCreatorDto {
  /** 작성자 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 작성자 이름 */
  @ApiProperty()
  name: string;

  /** 작성자 이메일 */
  @ApiProperty({ format: 'email' })
  email: string;
}

export class WorkflowVersionDto {
  /** 버전 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 버전 번호 (1부터 시작, DESC 정렬) */
  @ApiProperty({ example: 3 })
  version: number;

  /** 변경 요약 */
  @ApiPropertyOptional({ nullable: true })
  changeSummary?: string | null;

  /** 버전 스냅샷 (노드/엣지 포함) */
  @ApiProperty({ type: 'object', additionalProperties: true })
  snapshot: Record<string, unknown>;

  /** 작성자 UUID */
  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  /** 작성자 정보 (조인 시 포함) */
  @ApiPropertyOptional({
    type: () => WorkflowVersionCreatorDto,
    nullable: true,
  })
  creator?: WorkflowVersionCreatorDto | null;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
