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
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/add-member.dto';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
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
  @ApiOperation({ summary: '내가 속한 워크스페이스 목록' })
  @ApiOkResponse({ description: '워크스페이스 + 내 역할 목록' })
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
  @ApiOperation({ summary: '팀 워크스페이스 생성' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiOperation({ summary: '워크스페이스 멤버 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiOperation({ summary: '멤버 역할 변경' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiOperation({ summary: '멤버 제거(또는 자가 탈퇴)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiOperation({ summary: '대기 중인 초대 취소(Admin+)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AcceptInvitationDto,
  ) {
    const result = await this.invitationsService.accept(dto.token, user.sub);
    return { data: result };
  }
}
