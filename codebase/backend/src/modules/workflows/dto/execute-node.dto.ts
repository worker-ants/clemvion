import { IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `POST /api/workflows/:id/nodes/:nodeId/execute` 요청 본문 (§1.3 단일 노드 실행).
 *
 * 대상 노드(`:nodeId`)는 path parameter 로 전달되므로 본문에 포함하지 않는다.
 * 입력은 두 가지 경로로 결정된다(상호 보완):
 *  - `previousExecutionId`: 그 실행의 상류(predecessor) 노드 출력을 자동 주입(권장 기본).
 *  - `input`: 수동 입력. predecessor 가 seed 되지 않은 포트는 이 값으로 대체(override).
 */
export class ExecuteNodeDto {
  @ApiPropertyOptional({
    description:
      '입력 seed 출처가 되는 직전 실행 id. 그 실행의 상류 노드 출력을 단일 노드 입력으로 자동 주입한다. 미지정 시 input(수동 입력)만 사용.',
    format: 'uuid',
    example: '3f5a9b0c-2b8d-4e9a-8f1b-7c9e2d4a5b6c',
  })
  @IsOptional()
  @IsUUID()
  previousExecutionId?: string;

  @ApiPropertyOptional({
    description:
      '수동 입력(JSON). previousExecutionId 로 seed 되지 않은 입력에 대한 대체값.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
