import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  WorkspaceInvitationsService,
  invitationNotFoundException,
} from './workspace-invitations.service';
import {
  InvitationAcceptResultDto,
  InvitationMetaDto,
} from './dto/responses/workspace-response.dto';

// 근거: [워크스페이스 초대 「이미 가입한 사용자의 수락 경로」](CLE-ACCT-WS-INVITE#이미-가입한-사용자의-수락-경로)
/**
 * 로그인 사용자가 초대 id 로 자기 이메일로 온 초대를 보고 수락하는 엔드포인트. 초대 알림(`team_invite`)이 넘기는
 * 초대 id 로 수락 페이지를 연다. 토큰 없이 초대 id 와 로그인 이메일 일치로 본인을 확인하고, 없거나 남의 초대면
 * 같은 404 를 낸다. 워크스페이스 헤더는 쓰지 않는다(받는 사람은 아직 멤버가 아니다).
 *
 * 초대 id 의 형식은 `ParseUUIDPipe` 가 보되 예외를 404 `invitation_not_found` 로 바꾼다. 기본 400 을 쓰면 잘못된 id 와
 * 남의 id 가 다른 응답이 된다.
 */
@ApiTags('Invitations')
@ApiBearerAuth('access-token')
@Controller('users/me/invitations')
@UseGuards(JwtAuthGuard)
export class MyInvitationsController {
  constructor(
    private readonly invitationsService: WorkspaceInvitationsService,
  ) {}

  @Get(':invitationId')
  @ApiOperation({
    summary: '내 초대 메타 조회',
    description:
      '로그인 이메일로 온 초대의 워크스페이스 이름 · 초대자 · 역할 · 만료 시각을 돌려줍니다. 없거나 다른 이메일로 온 초대는 404, 이미 수락했거나 만료된 초대는 410 입니다.',
  })
  @ApiParam({
    name: 'invitationId',
    format: 'uuid',
    description: '초대 ID (UUID)',
  })
  @ApiOkWrappedResponse(InvitationMetaDto, { description: '초대 메타' })
  @ApiNotFoundResponse({
    description: '없거나 내 초대가 아님 (invitation_not_found)',
  })
  @ApiGoneResponse({
    description:
      '이미 수락했거나 만료된 초대 (invitation_already_used · invitation_expired)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getMeta(
    @CurrentUser() user: JwtPayload,
    @Param(
      'invitationId',
      new ParseUUIDPipe({ exceptionFactory: invitationNotFoundException }),
    )
    invitationId: string,
  ) {
    const meta = await this.invitationsService.getMetaForRecipient(
      invitationId,
      user.sub,
    );
    return { data: meta };
  }

  @Post(':invitationId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '내 초대를 수락해 합류',
    description:
      '로그인 이메일로 온 초대를 초대 ID 로 수락해 워크스페이스에 합류합니다. 없거나 다른 이메일로 온 초대는 404, 이미 수락했거나 만료된 초대는 410 입니다.',
  })
  @ApiParam({
    name: 'invitationId',
    format: 'uuid',
    description: '초대 ID (UUID)',
  })
  @ApiOkWrappedResponse(InvitationAcceptResultDto, {
    description: '초대 수락 결과 (합류한 워크스페이스 정보)',
  })
  @ApiNotFoundResponse({
    description: '없거나 내 초대가 아님 (invitation_not_found)',
  })
  @ApiGoneResponse({
    description:
      '이미 수락했거나 만료된 초대 (invitation_already_used · invitation_expired)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async accept(
    @CurrentUser() user: JwtPayload,
    @Param(
      'invitationId',
      new ParseUUIDPipe({ exceptionFactory: invitationNotFoundException }),
    )
    invitationId: string,
  ) {
    const result = await this.invitationsService.acceptById(
      invitationId,
      user.sub,
    );
    return { data: result };
  }
}
