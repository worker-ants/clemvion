import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `POST /api/external/executions/:id/cancel` body.
 * [Spec EIA §5.4]. `command: "cancel"` 을 별도 endpoint 로 노출하는 alias.
 */
export class CancelDto {
  /** 취소 사유 (옵션, 디버그 표시). */
  @ApiPropertyOptional({ maxLength: 200, example: 'user_aborted' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
