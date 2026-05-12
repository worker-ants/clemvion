import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { InvitationMetaDto } from './dto/responses/workspace-response.dto';

/**
 * 회원가입 페이지가 초대 토큰을 워크스페이스 메타데이터로 풀어낼 수 있게
 * 해주는 공개 엔드포인트 (이메일 prefill + readOnly 처리용). 토큰 자체가
 * 자격 증명 역할을 하므로 인증은 일부러 두지 않는다.
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
  // 공개 엔드포인트라 enumeration · 정찰성 폭격을 차단해야 한다. 분당 30회면
  // 정상 사용자(가입 페이지 진입 1~2회)는 절대 닿지 않는 상한.
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
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
  @ApiTooManyRequestsResponse({
    description: '요청 빈도 초과 (분당 30건)',
  })
  async getMeta(@Param('token') token: string) {
    const meta = await this.invitationsService.getMetaByToken(token);
    return { data: meta };
  }
}
