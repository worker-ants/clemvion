import { IsOptional, IsIn, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryTriggerDto extends PaginationQueryDto {
  /** 트리거 타입 필터 */
  @ApiPropertyOptional({
    description: '트리거 타입 필터',
    enum: ['webhook', 'schedule', 'manual'],
    example: 'webhook',
  })
  @IsOptional()
  @IsIn(['webhook', 'schedule', 'manual'])
  type?: string;

  /** 활성화 상태 필터 */
  @ApiPropertyOptional({
    description: '활성화 상태 필터',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  /**
   * inbound interaction 채널(웹채팅 등) 활성화 여부 필터.
   * `config.interaction.enabled` 가 일치하는 트리거만 반환한다 (웹채팅 콘솔 목록용).
   *
   * CustomValidationPipe 는 implicit 변환을 쓰지 않으므로 query string('true'/'false')을
   * 명시 Transform 으로 boolean 화한다(@Type(() => Boolean) 은 비어있지 않은 문자열을 모두
   * true 로 만들어 'false' 를 오역하므로 사용 불가).
   */
  @ApiPropertyOptional({
    description:
      'inbound interaction(웹채팅 등) 활성화 여부 필터. config.interaction.enabled 일치만 반환.',
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  interactionEnabled?: boolean;
}
