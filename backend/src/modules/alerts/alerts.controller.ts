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
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/alert-rule.dto';
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
  @ApiOperation({ summary: '워크스페이스의 알림 규칙 목록' })
  @ApiOkResponse({ description: '알림 규칙 배열' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async list(@WorkspaceId() workspaceId: string) {
    const rules = await this.alertsService.list(workspaceId);
    return { data: rules };
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '알림 규칙 생성 (Admin+)' })
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
  @ApiOperation({ summary: '알림 규칙 수정 (Admin+)' })
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
  @ApiOperation({ summary: '알림 규칙 삭제 (Admin+)' })
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.alertsService.remove(id, workspaceId);
  }
}
