import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { InvitationMetaDto } from './dto/responses/workspace-response.dto';

/**
 * Public-facing endpoint that lets the sign-up page resolve an invitation
 * token into workspace metadata (so the email field can be prefilled and
 * locked). Auth is intentionally not required — the token *is* the credential.
 *
 * spec/2-navigation/10-auth-flow.md §2.6, spec/5-system/1-auth.md §1.5
 */
@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: WorkspaceInvitationsService,
  ) {}

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: '초대 토큰 메타 조회',
    description:
      '회원가입 페이지에서 토큰의 이메일·워크스페이스 이름·초대자 이름을 prefill 하기 위한 공개 조회입니다. 만료·사용된 토큰은 410을 반환합니다.',
  })
  @ApiParam({ name: 'token', description: '초대 토큰 (base64url 64자)' })
  @ApiOkWrappedResponse(InvitationMetaDto, { description: '초대 메타' })
  @ApiNotFoundResponse({ description: '존재하지 않는 토큰' })
  @ApiGoneResponse({ description: '만료 또는 이미 사용된 초대' })
  async getMeta(@Param('token') token: string) {
    const meta = await this.invitationsService.getMetaByToken(token);
    return { data: meta };
  }
}
