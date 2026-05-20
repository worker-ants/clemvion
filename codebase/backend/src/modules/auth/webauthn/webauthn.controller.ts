import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';

import { ApiOkWrappedResponse } from '../../../common/swagger';
import { Public, CurrentUser } from '../../../common/decorators';
import type { JwtPayload } from '../../../common/decorators';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UsersService } from '../../users/users.service';

import { AuthService } from '../auth.service';
import { AccessTokenDto } from '../dto/responses/auth-response.dto';
import { extractClientIp } from '../utils/client-ip';
import { setRefreshTokenCookie } from '../utils/refresh-cookie';

import { WebAuthnService } from './webauthn.service';
import {
  WebAuthnAuthOptionsDto,
  WebAuthnAuthVerifyDto,
  WebAuthnRecoveryDto,
  WebAuthnRegenerateRecoveryDto,
  WebAuthnRegisterVerifyDto,
  WebAuthnRenameDto,
} from './dto/webauthn.dto';
import {
  WebAuthnAuthOptionsResultDto,
  WebAuthnCredentialDto,
  WebAuthnCredentialListDto,
  WebAuthnRecoveryCodesDto,
  WebAuthnRegisterOptionsDto,
  WebAuthnRegisterVerifyResultDto,
} from './dto/responses/webauthn-response.dto';

import Express from 'express';

function authContextFromRequest(req: Express.Request) {
  const headers = req.headers ?? {};
  return {
    ip: extractClientIp(req),
    userAgent: headers['user-agent'] ?? null,
  };
}

@ApiTags('Auth')
@ApiBearerAuth('access-token')
@Controller('auth/2fa/webauthn')
export class WebAuthnController {
  private readonly cookieDomain: string;

  constructor(
    private readonly authService: AuthService,
    private readonly webauthnService: WebAuthnService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.cookieDomain =
      this.configService.get<string>('app.cookieDomain') || '';
  }

  @Public()
  @Get('availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 기능 활성 여부',
    description:
      '서버 env (WEBAUTHN_RP_ID + WEBAUTHN_ORIGIN) 설정 여부를 알려줍니다. 프론트엔드가 Passkey UI 노출 여부를 결정할 때 사용. 인증 불요.',
  })
  webauthnAvailability() {
    return { data: { enabled: this.webauthnService.isEnabled() } };
  }

  @Post('register/options')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 등록 options 발급',
    description:
      'navigator.credentials.create() 에 필요한 options 와 5분 짜리 optionsToken JWT 를 발급합니다. 인증 필수.',
  })
  @ApiOkWrappedResponse(WebAuthnRegisterOptionsDto, {
    description: 'options + optionsToken',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async webauthnRegisterOptions(@CurrentUser() user: JwtPayload) {
    const result = await this.webauthnService.generateRegistrationOptionsFor(
      user.sub,
    );
    return {
      data: {
        publicKey: result.publicKey,
        optionsToken: result.optionsToken,
      },
    };
  }

  @Post('register/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 등록 verify',
    description:
      'navigator.credentials.create() 결과를 검증해 credential 을 저장합니다. 첫 등록인 경우 webauthn 전용 복구 코드 10개가 함께 반환됩니다 (일회성 표시).',
  })
  @ApiOkWrappedResponse(WebAuthnRegisterVerifyResultDto, {
    description: '등록 결과 + 첫 등록 시 복구 코드',
  })
  @ApiBadRequestResponse({
    description: 'optionsToken 만료/위변조 또는 검증 실패',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async webauthnRegisterVerify(
    @CurrentUser() user: JwtPayload,
    @Body() dto: WebAuthnRegisterVerifyDto,
  ) {
    const result = await this.webauthnService.verifyRegistration(
      user.sub,
      dto.optionsToken,
      dto.response as never,
      dto.deviceName,
    );
    return { data: result };
  }

  @Public()
  @Post('authenticate/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 로그인 2FA options',
    description:
      '`/auth/login` 발급 challengeToken 으로 사용자를 식별하고 navigator.credentials.get() options 와 optionsToken (5분) 을 발급합니다. 인증 불요.',
  })
  @ApiOkWrappedResponse(WebAuthnAuthOptionsResultDto, {
    description: 'options + optionsToken',
  })
  @ApiUnauthorizedResponse({ description: 'challengeToken 만료/위변조' })
  async webauthnAuthOptions(@Body() dto: WebAuthnAuthOptionsDto) {
    const { user } = await this.authService.consumeChallengeToken(
      dto.challengeToken,
      'webauthn',
    );
    const result =
      await this.webauthnService.generateAuthenticationOptionsForUser(user.id);
    return {
      data: {
        publicKey: result.publicKey,
        optionsToken: result.optionsToken,
      },
    };
  }

  @Public()
  @Post('authenticate/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 로그인 2FA verify',
    description:
      'WebAuthn 응답을 검증하고 access/refresh 토큰을 발급합니다. counter 역행 감지 시 credential 즉시 삭제 + LoginHistory `webauthn_failed` 기록.',
  })
  @ApiOkWrappedResponse(AccessTokenDto, {
    description: '2FA 통과 + 정식 토큰 발급',
  })
  @ApiUnauthorizedResponse({
    description: 'challengeToken/optionsToken 만료, 검증 실패, counter 역행',
  })
  async webauthnAuthVerify(
    @Body() dto: WebAuthnAuthVerifyDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const ctx = authContextFromRequest(req);
    const { user, rememberMe } = await this.authService.consumeChallengeToken(
      dto.challengeToken,
      'webauthn',
    );
    await this.webauthnService.verifyAuthentication(
      user.id,
      dto.optionsToken,
      dto.response as never,
      ctx,
    );
    const tokens = await this.authService.issueTokensAfterMfa(
      user,
      rememberMe,
      ctx,
    );
    setRefreshTokenCookie(res, tokens.refreshToken, {
      cookieDomain: this.cookieDomain,
      rememberMe,
    });
    return { data: { accessToken: tokens.accessToken } };
  }

  @Public()
  @Post('recovery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 복구 코드로 2FA 통과',
    description:
      'WebAuthn 인증이 불가한 사용자가 등록 시 발급된 복구 코드로 2FA 를 통과해 access/refresh 토큰을 발급받습니다.',
  })
  @ApiOkWrappedResponse(AccessTokenDto, {
    description: '복구 코드 통과 + 정식 토큰 발급',
  })
  @ApiUnauthorizedResponse({
    description: 'challengeToken 만료, 복구 코드 불일치',
  })
  async webauthnRecovery(
    @Body() dto: WebAuthnRecoveryDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const ctx = authContextFromRequest(req);
    const { user, rememberMe } = await this.authService.consumeChallengeToken(
      dto.challengeToken,
      'webauthn',
    );
    const ok = await this.webauthnService.verifyRecoveryCode(user.id, dto.code);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'RECOVERY_CODE_INVALID',
        message: '복구 코드가 올바르지 않아요.',
      });
    }
    const tokens = await this.authService.issueTokensAfterMfa(
      user,
      rememberMe,
      ctx,
    );
    setRefreshTokenCookie(res, tokens.refreshToken, {
      cookieDomain: this.cookieDomain,
      rememberMe,
    });
    return { data: { accessToken: tokens.accessToken } };
  }

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn credential 목록',
    description:
      '사용자 본인의 등록된 인증기 목록 (publicKey·counter 미노출). 인증 필수.',
  })
  @ApiOkWrappedResponse(WebAuthnCredentialListDto, {
    description: 'credential 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async webauthnList(@CurrentUser() user: JwtPayload) {
    const credentials = await this.webauthnService.listCredentials(user.sub);
    return {
      data: {
        items: credentials.map((c) => this.mapCredential(c)),
      },
    };
  }

  @Patch('credentials/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn credential 이름 변경',
    description: '사용자 본인의 인증기 device_name 을 수정합니다. 인증 필수.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'credential UUID' })
  @ApiOkWrappedResponse(WebAuthnCredentialDto, {
    description: '갱신된 credential',
  })
  @ApiBadRequestResponse({ description: '입력 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async webauthnRename(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) credentialUuid: string,
    @Body() dto: WebAuthnRenameDto,
  ) {
    const credential = await this.webauthnService.renameCredential(
      user.sub,
      credentialUuid,
      dto.deviceName,
    );
    return { data: this.mapCredential(credential) };
  }

  @Delete('credentials/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'WebAuthn credential 삭제',
    description:
      '사용자 본인의 인증기를 삭제합니다. 마지막 credential 삭제 시 `webauthn_recovery_codes` 도 NULL 화됩니다.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'credential UUID' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async webauthnDelete(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) credentialUuid: string,
  ) {
    await this.webauthnService.deleteCredential(user.sub, credentialUuid);
  }

  @Post('recovery-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 복구 코드 재발급',
    description:
      '비밀번호 재확인 후 기존 미사용 복구 코드를 폐기하고 10개를 새로 발급합니다.',
  })
  @ApiOkWrappedResponse(WebAuthnRecoveryCodesDto, {
    description: '새 복구 코드 10개 (일회성)',
  })
  @ApiBadRequestResponse({ description: '입력 검증 실패' })
  @ApiUnauthorizedResponse({ description: '비밀번호 불일치 또는 토큰 만료' })
  async webauthnRegenerateRecovery(
    @CurrentUser() user: JwtPayload,
    @Body() dto: WebAuthnRegenerateRecoveryDto,
  ) {
    const userEntity = await this.usersService.findById(user.sub);
    if (!userEntity || !userEntity.passwordHash) {
      throw new UnauthorizedException({
        code: 'PASSWORD_REQUIRED',
        message: '비밀번호 확인이 필요합니다.',
      });
    }
    const ok = await bcrypt.compare(dto.password, userEntity.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'PASSWORD_INVALID',
        message: '비밀번호가 일치하지 않습니다.',
      });
    }
    const codes = await this.webauthnService.regenerateRecoveryCodes(user.sub);
    return { data: { webauthnRecoveryCodes: codes } };
  }

  private mapCredential(c: {
    id: string;
    deviceName: string | null;
    transports: string[];
    lastUsedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: c.id,
      deviceName: c.deviceName,
      transports: c.transports,
      lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
