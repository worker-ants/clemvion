import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SessionsService } from './sessions.service';
import { LoginHistoryService } from './login-history.service';
import { RevokeSessionDto } from './dto/requests/revoke-session.dto';
import { SessionListDto } from './dto/responses/session.dto';
import { LoginHistoryPageDto } from './dto/responses/login-history.dto';
import { extractClientIp } from './utils/client-ip';

import Express from 'express';

/**
 * URL 네임스페이스 메모
 *   /api/users/me/sessions 와 /api/users/me/login-history 는 spec(user-profile §6.1) 의
 *   요구 경로. 본 컨트롤러는 RefreshToken 의존성 때문에 `auth` 모듈에 두지만,
 *   URL 만 users 네임스페이스에 맞춰 매핑한다.
 */
@ApiTags('Sessions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly loginHistoryService: LoginHistoryService,
  ) {}

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '활성 세션 목록',
    description:
      '본인의 현재 활성 refresh-token 세션을 family 단위로 반환합니다. 요청자의 refreshToken 쿠키와 일치하는 family 에는 `isCurrent=true` 가 표시됩니다.',
  })
  @ApiOkWrappedResponse(SessionListDto, { description: '세션 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async listSessions(
    @CurrentUser() user: JwtPayload,
    @Req() req: Express.Request,
  ): Promise<{ data: SessionListDto }> {
    const refreshToken = readRefreshTokenCookie(req);
    const sessions = await this.sessionsService.listActiveSessions(
      user.sub,
      refreshToken,
    );
    return { data: { items: sessions } };
  }

  @Post('sessions/:familyId/revoke')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: '단일 세션 강제 종료',
    description:
      '지정한 family 의 모든 refresh-token 을 무효화합니다. 본인 인증(비밀번호 또는 TOTP) 필수. DELETE 대신 POST 를 사용해 일부 CDN/프록시가 DELETE 바디를 제거하는 호환성 이슈를 피합니다.',
  })
  @ApiParam({ name: 'familyId', format: 'uuid' })
  @ApiOkWrappedResponse(SessionListDto, {
    description: '종료 완료 후 갱신된 세션 목록',
  })
  @ApiBadRequestResponse({
    description: '본인 인증 누락 또는 현재 세션 self-revoke 시도',
  })
  @ApiUnauthorizedResponse({ description: '비밀번호/TOTP 불일치' })
  @ApiForbiddenResponse({
    description: '재인증 수단 부재 (OAuth-only + 2FA 미설정)',
  })
  @ApiNotFoundResponse({
    description: '해당 세션이 존재하지 않거나 본인 소유가 아님',
  })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Body() dto: RevokeSessionDto,
    @Req() req: Express.Request,
  ): Promise<{ data: SessionListDto }> {
    const refreshToken = readRefreshTokenCookie(req);
    await this.sessionsService.revokeFamily(
      user.sub,
      familyId,
      dto,
      {
        ip: extractClientIp(req),
        userAgent: getUserAgent(req),
      },
      refreshToken,
    );
    const sessions = await this.sessionsService.listActiveSessions(
      user.sub,
      refreshToken,
    );
    return { data: { items: sessions } };
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: '다른 모든 세션 종료',
    description:
      '현재 요청을 보낸 세션(refresh-token 쿠키와 매칭되는 family) 을 제외한 모든 활성 세션을 종료합니다.',
  })
  @ApiOkWrappedResponse(SessionListDto, {
    description: '종료 후 갱신된 세션 목록 (현재 세션만 남음)',
  })
  @ApiBadRequestResponse({
    description: '현재 세션을 식별할 수 없음 또는 재인증 누락',
  })
  @ApiUnauthorizedResponse({ description: '비밀번호/TOTP 불일치' })
  @ApiForbiddenResponse({ description: '재인증 수단 부재' })
  async revokeOtherSessions(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RevokeSessionDto,
    @Req() req: Express.Request,
  ): Promise<{ data: SessionListDto }> {
    const refreshToken = readRefreshTokenCookie(req);
    if (!refreshToken) {
      throw new BadRequestException({
        code: 'CURRENT_SESSION_REQUIRED',
        message: '현재 세션을 식별할 수 없어요. 다시 로그인 후 시도해 주세요.',
      });
    }
    await this.sessionsService.revokeOtherFamilies(
      user.sub,
      refreshToken,
      dto,
      {
        ip: extractClientIp(req),
        userAgent: getUserAgent(req),
      },
    );
    const sessions = await this.sessionsService.listActiveSessions(
      user.sub,
      refreshToken,
    );
    return { data: { items: sessions } };
  }

  @Get('login-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '본인 로그인 이력',
    description:
      '본인의 인증 이벤트(login_success/login_failed/totp_failed/logout/session_revoked/token_reuse_detected) 를 시간 역순으로 페이징 반환합니다. 보존 기간 180일.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description:
      '이전 페이지 마지막 항목의 ISO timestamp + id (예: 2026-05-12T03:14:00.000Z|uuid)',
  })
  @ApiOkWrappedResponse(LoginHistoryPageDto, {
    description: '로그인 이력 페이지',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async getLoginHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<{ data: LoginHistoryPageDto }> {
    const parsedLimit = limit ? Number(limit) : undefined;
    const safeLimit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.floor(parsedLimit)
        : undefined;

    const page = await this.loginHistoryService.findForUser({
      userId: user.sub,
      cursor,
      limit: safeLimit,
    });
    return { data: page };
  }
}

function readRefreshTokenCookie(req: Express.Request): string | null {
  const cookies = (req as unknown as { cookies?: Record<string, string> })
    .cookies;
  const value = cookies?.refreshToken;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getUserAgent(req: Express.Request): string | null {
  const headers = req.headers ?? {};
  const ua = headers['user-agent'];
  return typeof ua === 'string' && ua.length > 0 ? ua : null;
}
