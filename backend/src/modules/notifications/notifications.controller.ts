import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import {
  MarkAllReadResultDto,
  NotificationDto,
  UnreadCountDto,
} from './dto/responses/notification-response.dto';
import { DismissNotificationResponseDto } from './dto/responses/dismiss-notification-response.dto';
import { DismissAllNotificationsResponseDto } from './dto/responses/dismiss-all-notifications-response.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: '알림 목록 조회',
    description:
      '현재 워크스페이스에서 로그인 사용자에게 전달된 알림을 페이지네이션하여 반환합니다. 타입·읽음 여부로 필터링할 수 있습니다.',
  })
  @ApiOkPaginatedResponse(NotificationDto, {
    description: '알림 목록 (페이지네이션)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationsService.findAll(workspaceId, user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: '미확인 알림 개수 조회',
    description:
      '현재 워크스페이스에서 로그인 사용자의 읽지 않은 알림 수를 반환합니다.',
  })
  @ApiOkWrappedResponse(UnreadCountDto, { description: '읽지 않은 알림 개수' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getUnreadCount(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.getUnreadCount(workspaceId, user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: '알림 읽음 처리',
    description: '지정한 알림 단건을 읽음 상태로 변경합니다.',
  })
  @ApiParam({ name: 'id', description: '알림 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(NotificationDto, {
    description: '읽음 처리된 알림 정보',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 알림을 찾을 수 없음' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '전체 알림 읽음 처리',
    description:
      '현재 워크스페이스에서 로그인 사용자의 모든 미확인 알림을 일괄 읽음 처리합니다.',
  })
  @ApiOkWrappedResponse(MarkAllReadResultDto, {
    description: '읽음 처리된 건수',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async markAllRead(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAllRead(workspaceId, user.sub);
  }

  // 라우트 선언 순서: 고정 경로(`dismiss-all`) 가 파라미터 경로(`:id/dismiss`) 보다
  // 먼저 와야 NestJS 라우터의 잠재적 shadowing 위험을 회피한다 (현재 NestJS 는
  // 명시적 path > param 우선 매칭으로 declaration order 무관이지만, 코드 가독성과
  // 향후 라우터 교체·미들웨어 변경 안전성을 위해 명시 순서를 둔다).
  @Post('dismiss-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '전체 알림 닫기 (soft delete 일괄)',
    description:
      '현재 워크스페이스에서 로그인 사용자의 모든 visible 알림을 일괄 닫기 처리합니다. `mark-all-read` 와 독립이며 (한쪽이 다른쪽을 함의하지 않음), 이미 닫힌 알림은 affected count 에서 제외됩니다.',
  })
  @ApiOkWrappedResponse(DismissAllNotificationsResponseDto, {
    description: 'dismiss 처리된 건수',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async dismissAll(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.dismissAll(workspaceId, user.sub);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '알림 닫기 (soft delete)',
    description:
      '지정한 알림 단건을 visible 목록에서 숨깁니다 (`dismissed_at=now()`). row 는 보존되며, 이미 닫힌 알림에 다시 호출하면 기존 시각을 멱등하게 반환합니다. 자세한 라이프사이클은 spec/data-flow/8-notifications.md §4 참조.',
  })
  @ApiParam({ name: 'id', description: '알림 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(DismissNotificationResponseDto, {
    description: 'dismiss 처리된 알림의 id 와 dismissed_at',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 알림을 찾을 수 없음' })
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.dismiss(id, user.sub);
  }
}
