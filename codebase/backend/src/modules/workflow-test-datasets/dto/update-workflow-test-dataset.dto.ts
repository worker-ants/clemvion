import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsObject,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { TestDatasetVisibility } from '../entities/workflow-test-dataset.entity';

/** 테스트 데이터셋 수정 요청 (소유자만). 제공된 필드만 부분 갱신. */
export class UpdateWorkflowTestDatasetDto {
  @ApiPropertyOptional({ example: '로그인 실패 케이스', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      '워크플로우 Mock Input JSON — 루트 노드에 전달될 테스트 데이터',
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: TestDatasetVisibility })
  @IsOptional()
  @IsEnum(TestDatasetVisibility)
  visibility?: TestDatasetVisibility;
}
