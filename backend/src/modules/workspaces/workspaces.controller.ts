import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { WorkspacesService } from './workspaces.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/add-member.dto';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
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
      '이미 가입된 사용자만 즉시 추가할 수 있어요. 미가입자 초대 토큰 흐름은 후속에서 추가됩니다.',
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
  @ApiOperation({
    summary: '미가입자 초대(Admin+)',
    description:
      '이메일로 초대 토큰을 발송합니다. 수신자는 가입 후 또는 같은 이메일로 로그인한 상태에서 토큰을 사용해 수락할 수 있어요.',
  })
  @ApiParam({ name: 'id', description: '워크스페이스 UUID', format: 'uuid' })
  @ApiCreatedWrappedResponse(InvitationCreatedDto, {
    description: '생성된 초대',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '초대 권한 부족 (Admin+)' })
  @ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })
  @ApiConflictResponse({ description: '동일 이메일의 대기 초대가 이미 존재' })
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
      '본인 이메일과 일치하는 초대 토큰을 사용해 워크스페이스에 합류합니다.',
  })
  @ApiOkWrappedResponse(InvitationAcceptResultDto, {
    description: '초대 수락 결과 (합류한 워크스페이스 정보)',
  })
  @ApiBadRequestResponse({
    description: '토큰 유효하지 않음·만료·이메일 불일치',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AcceptInvitationDto,
  ) {
    const result = await this.invitationsService.accept(dto.token, user.sub);
    return { data: result };
  }
}
