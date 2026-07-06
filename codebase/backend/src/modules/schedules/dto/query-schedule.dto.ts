import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * `GET /api/schedules` 쿼리 파라미터. 페이지네이션·검색·정렬(부모)에 더해
 * 트리거 단일 필터를 받는다.
 */
export class QueryScheduleDto extends PaginationQueryDto {
  /**
   * 트리거 단일 필터 — 해당 트리거에 연결된 스케줄만 조회한다.
   * 트리거→스케줄 딥링크(`/schedules?triggerId=…`, [2-navigation/3-schedule §2.1])가
   * 페이지네이션과 무관하게(cross-page) 대상 스케줄을 찾는 데 사용한다.
   * 빈 값이면 클라이언트가 아예 전송하지 않으므로 필터가 적용되지 않는다.
   */
  @ApiPropertyOptional({
    description: '트리거 UUID 필터 (해당 트리거에 연결된 스케줄만 반환)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  triggerId?: string;
}
