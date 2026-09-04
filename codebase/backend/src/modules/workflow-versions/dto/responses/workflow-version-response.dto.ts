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

/**
 * 목록(`GET /workflows/:wfId/versions`) 응답 항목 — 메타데이터 + 작성자만.
 * `snapshot` 은 의도적으로 제외 (목록 over-fetch 방지, m-3). 상세는
 * {@link WorkflowVersionDto} 가 snapshot 을 포함한다.
 * spec/3-workflow-editor/5-version-history.md §7.1(목록) / §7.2(상세).
 */
export class WorkflowVersionListItemDto {
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
