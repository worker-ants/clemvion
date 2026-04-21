import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssistantSessionDto {
  @ApiProperty({
    description: '세션이 소속될 워크플로우 UUID',
    format: 'uuid',
  })
  @IsUUID()
  workflowId: string;

  @ApiPropertyOptional({
    description: '사용할 LLM Config UUID. 생략 시 워크스페이스 기본값 사용',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  llmConfigId?: string;

  @ApiPropertyOptional({
    description: '세션 제목. 생략 시 첫 메시지로 자동 생성',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  title?: string;
}
