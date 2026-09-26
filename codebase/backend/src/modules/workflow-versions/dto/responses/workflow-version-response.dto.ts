import { ApiProperty } from '@nestjs/swagger';

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

  /** 변경 요약. 없으면 null */
  // §5.4 기본형 — 두 조회의 `select` 가 늘 싣는 키라 required, 컬럼이 nullable 이라 값은 null 일 수 있다. `type` 을 적는 것은
  // `string | null` 의 설계 타입(`Object`)이 플러그인 없는 스키마에서 `type: object` 로 새지 않게 하려는 것이다.
  @ApiProperty({ type: String, nullable: true })
  changeSummary: string | null;

  /** 작성자 UUID */
  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  /** 작성자 정보 */
  // 항상 실린다 — `created_by` 가 `NOT NULL REFERENCES "user"(id)`(`ON DELETE` 없음)라 관계 로드가 늘 행을 찾고, 두 조회가
  // `CREATOR_PROJECTION` 으로 싣는다. 종전 선언(optional + nullable)은 런타임보다 넓었다.
  @ApiProperty({ type: () => WorkflowVersionCreatorDto })
  creator: WorkflowVersionCreatorDto;

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

  /** 변경 요약. 없으면 null */
  // §5.4 기본형 — 두 조회의 `select` 가 늘 싣는 키라 required, 컬럼이 nullable 이라 값은 null 일 수 있다. `type` 을 적는 것은
  // `string | null` 의 설계 타입(`Object`)이 플러그인 없는 스키마에서 `type: object` 로 새지 않게 하려는 것이다.
  @ApiProperty({ type: String, nullable: true })
  changeSummary: string | null;

  /** 버전 스냅샷 (노드/엣지 포함) */
  @ApiProperty({ type: 'object', additionalProperties: true })
  snapshot: Record<string, unknown>;

  /** 작성자 UUID */
  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  /** 작성자 정보 */
  // 항상 실린다 — `created_by` 가 `NOT NULL REFERENCES "user"(id)`(`ON DELETE` 없음)라 관계 로드가 늘 행을 찾고, 두 조회가
  // `CREATOR_PROJECTION` 으로 싣는다. 종전 선언(optional + nullable)은 런타임보다 넓었다.
  @ApiProperty({ type: () => WorkflowVersionCreatorDto })
  creator: WorkflowVersionCreatorDto;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
