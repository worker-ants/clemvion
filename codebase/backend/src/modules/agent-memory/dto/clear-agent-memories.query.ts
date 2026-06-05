import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `DELETE /agent-memories?scopeKey=` 쿼리 (spec/5-system/17-agent-memory.md §6, AGM-13).
 *
 * 한 scope 의 메모리 전체를 hard delete 한다. `scopeKey` 는 필수 (없으면 400).
 * workspace_id 는 쿼리로 받지 않고 인증 컨텍스트(@WorkspaceId())에서만 온다 (§5).
 */
export class ClearAgentMemoriesQueryDto {
  /** 전체 삭제할 메모리 네임스페이스 키 (필수). */
  @ApiProperty({
    description: '전체 삭제할 scope_key (필수)',
    example: 'cust-42',
    maxLength: 512,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  scopeKey: string;
}
