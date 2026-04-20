import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/alert-rule.dto';
import { AlertRuleDto } from './dto/responses/alert-rule-response.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Alerts')
@ApiBearerAuth('access-token')
@Controller('alerts')
@UseGuards(RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({
    summary: '워크스페이스의 알림 규칙 목록',
    description:
      '현재 워크스페이스에 등록된 모든 알림 규칙(실패율/지속시간/LLM 비용 기반)을 반환합니다.',
  })
  @ApiOkWrappedArrayResponse(AlertRuleDto, { description: '알림 규칙 배열' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async list(@WorkspaceId() workspaceId: string) {
    const rules = await this.alertsService.list(workspaceId);
    return { data: rules };
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '알림 규칙 생성 (Admin+)',
    description:
      '새 알림 규칙을 생성합니다. 관리자(admin) 이상 권한이 필요하며, 생성 즉시 활성 상태일 경우 감시 대상이 됩니다.',
  })
  @ApiCreatedWrappedResponse(AlertRuleDto, { description: '생성된 알림 규칙' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '관리자 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAlertRuleDto,
  ) {
    const rule = await this.alertsService.create(workspaceId, user.sub, dto);
    return { data: rule };
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({
    summary: '알림 규칙 수정 (Admin+)',
    description:
      '알림 규칙의 임계값·윈도우·채널·활성 여부를 부분 수정합니다. 관리자(admin) 이상 권한 필요.',
  })
  @ApiParam({ name: 'id', description: '알림 규칙 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(AlertRuleDto, { description: '수정된 알림 규칙' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '관리자 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 알림 규칙을 찾을 수 없음' })
  async update(
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    const rule = await this.alertsService.update(id, workspaceId, dto);
    return { data: rule };
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '알림 규칙 삭제 (Admin+)',
    description: '알림 규칙을 영구 삭제합니다. 관리자(admin) 이상 권한 필요.',
  })
  @ApiParam({ name: 'id', description: '알림 규칙 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '관리자 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 알림 규칙을 찾을 수 없음' })
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.alertsService.remove(id, workspaceId);
  }
}
