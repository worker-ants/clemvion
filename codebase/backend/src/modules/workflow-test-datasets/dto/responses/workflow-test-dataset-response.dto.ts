import { ApiProperty } from '@nestjs/swagger';
import { TestDatasetVisibility } from '../../entities/workflow-test-dataset.entity';

/** 테스트 데이터셋 응답 DTO (§2.2). */
export class WorkflowTestDatasetDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  @ApiProperty({ format: 'uuid', description: '소유 유저 id.' })
  ownerId: string;

  @ApiProperty({ enum: TestDatasetVisibility, example: 'private' })
  visibility: TestDatasetVisibility;

  @ApiProperty({ example: '로그인 성공 케이스' })
  name: string;

  /**
   * Mock Input JSON. 응답 키는 `input` — TransformInterceptor 의 top-level `data`
   * 키 래핑 휴리스틱과 충돌하지 않도록 `data` 를 피한다 (entity 컬럼명은 `data`).
   */
  @ApiProperty({ type: 'object', additionalProperties: true })
  input: Record<string, unknown>;

  /**
   * 요청 유저가 이 데이터셋의 소유자인지 — 워크스페이스 공유본은 false 로 내려가
   * 프론트가 "수정/삭제" 대신 "복제(clone)" 만 노출하도록 한다.
   */
  @ApiProperty({ example: true })
  isOwner: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
