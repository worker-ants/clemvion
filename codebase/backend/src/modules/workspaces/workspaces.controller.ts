import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// 초대 발송·재발송 폭격 방지. 운영 중 조정 시 한 곳만 고치면 됨.
const INVITATION_THROTTLE = { default: { ttl: 60_000, limit: 10 } };
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/add-member.dto';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import {
  InvitationAcceptResultDto,
  InvitationCreatedDto,
  MemberRoleDto,
  OkResultDto,
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceListItemDto,
  WorkspaceMemberDto,
} from './dto/responses/workspace-response.dto';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/guards/roles.guard';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly invitationsService: WorkspaceInvitationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '내가 속한 워크스페이스 목록',
    description:
      '현재 로그인 사용자가 멤버로 속한 워크스페이스와 각 워크스페이스에서의 역할(role)을 반환합니다.',
  })
  @ApiOkWrappedArrayResponse(WorkspaceListItemDto, {
    description: '워크스페이스 + 내 역할 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async list(@CurrentUser() user: JwtPayload) {
    const items = await this.workspacesService.listForUser(user.sub);
    return {
      data: items.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        slug: w.slug,
        role: w.role,
      })),
    };
  }

  @Post()
  @ApiOperation({
    summary: '팀 워크스페이스 생성',
    description:
      '새 팀 워크스페이스를 생성합니다. 요청자는 자동으로 owner 역할이 됩니다.',
  })
  @ApiCreatedWrappedResponse(WorkspaceDto, {
    description: '생성된 워크스페이스',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiConflictResponse({ description: '동일 slug 중복' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const ws = await this.workspacesService.createTeam(user.sub, dto.name);
    return {
      data: { id: ws.id, name: ws.name, type: ws.type, slug: ws.slug },
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: '워크스페이스 이름 변경(Admin+)',
    description: '지정한 워크스페이스의 이름을 변경합니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(WorkspaceDto, { description: '변경된 워크스페이스' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const ws = await this.workspacesService.renameWorkspace(
      workspaceId,
      dto.name,
      user.sub,
    );
    return {
      data: { id: ws.id, name: ws.name, type: ws.type, slug: ws.slug },
    };
  }

  @Patch(':id/settings')
  @ApiOperation({
    summary: '워크스페이스 설정 변경(Admin+)',
    description:
      '워크스페이스 설정을 변경합니다. 현재는 외부 상호작용 허용 origin 목록(interactionAllowedOrigins)을 갱신합니다. 기존 설정의 다른 키는 보존됩니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(WorkspaceDto, { description: '변경된 워크스페이스' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async updateSettings(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: UpdateWorkspaceSettingsDto,
  ) {
    const ws = await this.workspacesService.updateWorkspaceSettings(
      workspaceId,
      dto,
      user.sub,
    );
    return {
      data: {
        id: ws.id,
        name: ws.name,
        type: ws.type,
        slug: ws.slug,
        settings: ws.settings,
      },
    };
  }

  @Get(':id/settings')
  @ApiOperation({
    summary: '워크스페이스 설정 조회(멤버)',
    description:
      '워크스페이스 설정을 조회합니다. 현재는 외부 상호작용 허용 origin 목록(interactionAllowedOrigins)만 반환합니다. 모든 멤버가 조회 가능(편집은 Admin+).',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(UpdateWorkspaceSettingsDto, { description: '워크스페이스 설정' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '멤버 아님' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async getSettings(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    const settings = await this.workspacesService.getWorkspaceSettings(
      workspaceId,
      user.sub,
    );
    return { data: settings };
  }

  @Delete(':id')
  @ApiOperation({
    summary: '워크스페이스 삭제(Owner)',
    description:
      '팀 워크스페이스를 영구 삭제합니다. 멤버/초대 등 연관 리소스가 함께 정리됩니다. 개인 워크스페이스는 삭제할 수 없습니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(OkResultDto, { description: '삭제 결과' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({
    description: '권한 부족(Owner) 또는 개인 워크스페이스',
  })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    await this.workspacesService.deleteWorkspace(workspaceId, user.sub);
    return { data: { ok: true } };
  }

  @Post(':id/leave')
  @ApiOperation({
    summary: '워크스페이스 나가기(본인)',
    description:
      '팀 워크스페이스에서 본인의 멤버십을 제거합니다. 유일한 owner는 나갈 수 없습니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(OkResultDto, { description: '나가기 결과' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({
    description: '개인 워크스페이스이거나 유일한 owner이거나 멤버가 아닌 경우',
  })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async leave(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    await this.workspacesService.leaveWorkspace(workspaceId, user.sub);
    return { data: { ok: true } };
  }

  @Post(':id/transfer-ownership')
  // 가드 + service-level 검증을 함께 둠. 가드는 첫 차단선, service 의 OWNER_REQUIRED 는
  // 트랜잭션 내부에서 (락 보유 상태로) 동시 다른 owner-related 변경과의 경합을 차단.
  @Roles('owner')
  @ApiOperation({
    summary: '워크스페이스 owner 이양 (Owner)',
    description:
      '같은 워크스페이스의 비-owner 멤버에게 owner 권한을 이양합니다. 트랜잭션 내에서 두 멤버 role 이 동시에 swap (대상 → owner, 기존 owner → admin) 되고 `workspace.ownerId` 도 갱신됩니다. 개인 워크스페이스는 이양 불가.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(OkResultDto, { description: '이양 결과' })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 본인 지정 (TARGET_IS_SELF)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({
    description: '권한 부족 (Owner 필요) 또는 개인 워크스페이스',
  })
  @ApiNotFoundResponse({
    description: '워크스페이스 또는 대상 멤버를 찾을 수 없음',
  })
  @ApiConflictResponse({ description: '대상이 이미 owner 인 경우' })
  async transferOwnership(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    await this.workspacesService.transferOwnership(
      workspaceId,
      user.sub,
      dto.newOwnerMemberId,
    );
    return { data: { ok: true } };
  }

  @Get(':id/members')
  @ApiOperation({
    summary: '워크스페이스 멤버 목록',
    description: '지정한 워크스페이스의 모든 멤버와 역할을 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedArrayResponse(WorkspaceMemberDto, { description: '멤버 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '해당 워크스페이스 멤버가 아님' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async listMembers(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    const members = await this.workspacesService.listMembers(
      workspaceId,
      user.sub,
    );
    return { data: members };
  }

  @Post(':id/members')
  @ApiOperation({
    summary: '이메일로 멤버 추가',
    description:
      '이미 가입된 사용자를 즉시 멤버로 추가합니다. 미가입자에게는 `POST /workspaces/:id/invitations` 의 초대 토큰 흐름을 사용하세요.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiCreatedWrappedResponse(MemberRoleDto, { description: '추가된 멤버 정보' })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 존재하지 않는 이메일',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '멤버 추가 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  @ApiConflictResponse({ description: '이미 속한 멤버' })
  async addMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: AddMemberDto,
  ) {
    const member = await this.workspacesService.addMemberByEmail(
      workspaceId,
      dto.email,
      dto.role,
      user.sub,
    );
    return { data: { id: member.id, role: member.role } };
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({
    summary: '멤버 역할 변경',
    description: '지정한 멤버의 역할(role)을 변경합니다. Admin+ 권한 필요.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'memberId', description: '멤버 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(MemberRoleDto, { description: '변경된 멤버 정보' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '역할 변경 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '워크스페이스 또는 멤버를 찾을 수 없음' })
  async updateMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const member = await this.workspacesService.updateMemberRole(
      workspaceId,
      memberId,
      dto.role,
      user.sub,
    );
    return { data: { id: member.id, role: member.role } };
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({
    summary: '멤버 제거(또는 자가 탈퇴)',
    description:
      '멤버를 워크스페이스에서 제거합니다. 본인(자가 탈퇴) 또는 Admin+ 권한으로 다른 멤버를 제거할 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiParam({ name: 'memberId', description: '멤버 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(OkResultDto, { description: '제거 결과' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '제거 권한 부족' })
  @ApiNotFoundResponse({ description: '워크스페이스 또는 멤버를 찾을 수 없음' })
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    await this.workspacesService.removeMember(workspaceId, memberId, user.sub);
    return { data: { ok: true } };
  }

  @Get(':id/invitations')
  @ApiOperation({
    summary: '대기 중인 초대 목록(Admin+)',
    description: '아직 수락되지 않은 워크스페이스 초대를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiOkWrappedArrayResponse(WorkspaceInvitationDto, {
    description: '대기 중 초대 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '초대 조회 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  async listInvitations(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    const invitations = await this.invitationsService.listPending(
      workspaceId,
      user.sub,
    );
    return {
      data: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        invitedBy: i.invitedBy,
        createdAt: i.createdAt,
      })),
    };
  }

  @Post(':id/invitations')
  // Email-bombing 방지. 같은 워크스페이스에서 분당 10건까지 허용.
  @Throttle(INVITATION_THROTTLE)
  @ApiOperation({
    summary: '미가입자 초대(Admin+)',
    description:
      '이메일로 초대 토큰을 발송합니다. 동일 이메일의 대기 중 초대가 있으면 기존 토큰을 무효화하고 새 토큰으로 재발급합니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiCreatedWrappedResponse(InvitationCreatedDto, {
    description: '생성된(또는 갱신된) 초대',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '초대 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  @ApiConflictResponse({ description: '이미 워크스페이스 멤버인 이메일' })
  @ApiTooManyRequestsResponse({
    description: '요청 빈도 초과 (분당 10건)',
  })
  async createInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    const invitation = await this.invitationsService.invite(
      workspaceId,
      dto.email,
      dto.role,
      user.sub,
    );
    return {
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  @Post(':id/invitations/:invitationId/resend')
  @HttpCode(200)
  @Throttle(INVITATION_THROTTLE)
  @ApiOperation({
    summary: '초대 재발송(Admin+)',
    description:
      '대기 중인 초대의 토큰을 새로 발급(기존 토큰 즉시 무효)하고 메일을 재전송합니다. 만료 시계도 발송 시점부터 다시 7일 동안 유효합니다.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiParam({
    name: 'invitationId',
    description: '초대 UUID',
    format: 'uuid',
  })
  @ApiOkWrappedResponse(InvitationCreatedDto, {
    description: '갱신된 초대 정보',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '재발송 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '초대 또는 워크스페이스를 찾을 수 없음' })
  @ApiConflictResponse({
    description: '이미 수락된 초대는 재발송할 수 없음',
  })
  @ApiTooManyRequestsResponse({
    description: '요청 빈도 초과 (분당 10건)',
  })
  async resendInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
  ) {
    const invitation = await this.invitationsService.resend(
      workspaceId,
      invitationId,
      user.sub,
    );
    return {
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  @Delete(':id/invitations/:invitationId')
  @ApiOperation({
    summary: '대기 중인 초대 취소(Admin+)',
    description: '발송된 초대를 취소합니다. Admin+ 권한 필요.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiParam({
    name: 'invitationId',
    description: '초대 UUID',
    format: 'uuid',
  })
  @ApiNoContentResponse({ description: '초대 취소 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '초대 취소 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '초대 또는 워크스페이스를 찾을 수 없음' })
  async revokeInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
  ) {
    await this.invitationsService.revoke(workspaceId, invitationId, user.sub);
    return { data: { ok: true } };
  }

  @Post('invitations/accept')
  @ApiOperation({
    summary: '초대 수락',
    description:
      '본인 이메일과 일치하는 초대 토큰을 사용해 워크스페이스에 합류합니다. 토큰 만료/이미 사용 시 410, 이메일 불일치 시 400을 반환합니다.',
  })
  @ApiOkWrappedResponse(InvitationAcceptResultDto, {
    description: '초대 수락 결과 (합류한 워크스페이스 정보)',
  })
  @ApiBadRequestResponse({
    description: '이메일 불일치 (invitation_email_mismatch)',
  })
  @ApiGoneResponse({
    description: '만료 또는 이미 사용된 초대',
  })
  @ApiNotFoundResponse({ description: '존재하지 않는 토큰' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AcceptInvitationDto,
  ) {
    const result = await this.invitationsService.accept(dto.token, user.sub);
    return { data: result };
  }
}
