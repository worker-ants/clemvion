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
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
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
  @ApiOkResponse({
    description: '알림 목록 (페이지네이션)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            totalItems: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
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
  @ApiOkResponse({
    description: '읽지 않은 알림 개수',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { count: { type: 'number', example: 3 } },
        },
      },
    },
  })
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
  @ApiOkResponse({
    description: '읽음 처리된 알림 정보',
    schema: {
      type: 'object',
      properties: { data: { type: 'object' } },
    },
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
  @ApiOkResponse({
    description: '읽음 처리된 건수',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: { affected: { type: 'number', example: 12 } },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async markAllRead(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAllRead(workspaceId, user.sub);
  }
}
