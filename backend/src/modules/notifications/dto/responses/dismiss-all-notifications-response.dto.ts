import { ApiProperty } from '@nestjs/swagger';

/**
 * 일괄 알림 dismiss 결과.
 *
 * spec/data-flow/8-notifications.md §4.2 — `POST /notifications/dismiss-all`
 * 현재 워크스페이스에서 로그인 사용자의 모든 visible 알림 (`dismissed_at IS NULL`) 을
 * 일괄 dismiss 처리한 건수를 반환한다. shape 는 `MarkAllReadResultDto` 와 동일하지만,
 * 의미가 다르므로 (읽음 처리 vs 닫기) 별도 클래스로 둔다 — Swagger 문서에서도 명확히
 * 분리된다.
 */
export class DismissAllNotificationsResponseDto {
  /** dismiss 처리된 건수 (이미 dismissed 였던 row 제외) */
  @ApiProperty({ example: 7 })
  affected: number;
}
