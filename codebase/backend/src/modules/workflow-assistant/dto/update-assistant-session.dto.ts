import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssistantSessionDto {
  @ApiPropertyOptional({ description: '세션 제목', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'LLM Config UUID. null 전달 시 workspace default로 폴백.',
    format: 'uuid',
    nullable: true,
  })
  // Allow explicit null to clear the pinned config; @IsUUID only runs on defined+non-null.
  @ValidateIf(
    (o: UpdateAssistantSessionDto) =>
      o.llmConfigId !== null && o.llmConfigId !== undefined,
  )
  @IsUUID()
  llmConfigId?: string | null;

  @ApiPropertyOptional({
    description: '세션 상태',
    enum: ['active', 'archived'],
  })
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}
