import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsObject,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { TestDatasetVisibility } from '../entities/workflow-test-dataset.entity';

/** 테스트 데이터셋 생성 요청 (§2.2 저장). */
export class CreateWorkflowTestDatasetDto {
  @ApiProperty({ example: '로그인 성공 케이스', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Mock Input JSON (워크플로우 실행 입력).',
  })
  @IsObject()
  input: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: TestDatasetVisibility,
    default: TestDatasetVisibility.PRIVATE,
    description:
      'private(기본, 소유자만) / workspace(워크스페이스 read-only 공유).',
  })
  @IsOptional()
  @IsEnum(TestDatasetVisibility)
  visibility?: TestDatasetVisibility;
}
