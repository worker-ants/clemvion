import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiFoundResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkWrappedResponse,
  ApiOkWrappedOneOfResponse,
} from '../../common/swagger';
import {
  AccessTokenDto,
  AuthMessageDto,
  CheckEmailResultDto,
  LoginChallengeDto,
  OauthProvidersDto,
  RegisterResultDto,
  TotpDisableResultDto,
  TotpSetupDto,
  TotpVerifyDto,
} from './dto/responses/auth-response.dto';
import { AuthService } from './auth.service';
import { AuthOauthService, AUTH_OAUTH_PROVIDERS } from './auth-oauth.service';
import { TotpService } from './totp.service';
import { Public, CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { LoginTotpDto, Verify2faDto, Disable2faDto } from './dto/totp.dto';
import {
  WebAuthnAuthOptionsDto,
  WebAuthnAuthVerifyDto,
  WebAuthnRecoveryDto,
  WebAuthnRegenerateRecoveryDto,
  WebAuthnRegisterVerifyDto,
  WebAuthnRenameDto,
} from './webauthn/dto/webauthn.dto';
import {
  WebAuthnAuthOptionsResultDto,
  WebAuthnCredentialDto,
  WebAuthnCredentialListDto,
  WebAuthnRecoveryCodesDto,
  WebAuthnRegisterOptionsDto,
  WebAuthnRegisterVerifyResultDto,
} from './webauthn/dto/responses/webauthn-response.dto';
import { WebAuthnService } from './webauthn/webauthn.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { extractClientIp } from './utils/client-ip';

// Express types used directly to avoid isolatedModules + emitDecoratorMetadata issue
import Express from 'express';

function authContextFromRequest(req: Express.Request) {
  const headers = req.headers ?? {};
  return {
    ip: extractClientIp(req),
    userAgent: headers['user-agent'] ?? null,
  };
}

const OAUTH_PROVIDER_ENUM = AUTH_OAUTH_PROVIDERS.reduce<Record<string, string>>(
  (acc, p) => {
    acc[p] = p;
    return acc;
  },
  {},
);

@ApiTags('Auth')
@ApiBearerAuth('access-token')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly cookieDomain: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly authOauthService: AuthOauthService,
    private readonly totpService: TotpService,
    private readonly usersService: UsersService,
    private readonly webauthnService: WebAuthnService,
  ) {
    this.cookieDomain =
      this.configService.get<string>('app.cookieDomain') || '';
    this.frontendUrl =
      this.configService.get<string>('app.frontendUrl') ??
      'http://localhost:3002';
  }

  @Public()
  // W-47 — credential stuffing / 계정 생성 남용 차단. IP 당 10 req/min.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '회원가입',
    description:
      '신규 사용자를 등록합니다. 비밀번호는 강도 요건(8자 이상, 3종 이상 문자)을 통과해야 합니다. `invitationToken` 동봉 시: 토큰의 이메일과 가입 이메일이 일치해야 하며, 이메일 인증 없이 즉시 가입·자동 로그인됩니다 (개인 워크스페이스 자동 생성 없음).',
  })
  @ApiCreatedWrappedResponse(RegisterResultDto, {
    description:
      '등록 성공. 일반 가입은 이메일 검증 메일 발송 후 `message`만 반환. 초대 토큰 가입은 `accessToken` 동봉 + Refresh Token 쿠키 발급.',
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패, 비밀번호 강도 미달, 초대 이메일 불일치',
  })
  @ApiConflictResponse({ description: '이미 가입된 이메일' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const result = await this.authService.register(
      dto,
      authContextFromRequest(req),
    );
    if ('accessToken' in result) {
      this.setRefreshTokenCookie(res, result.refreshToken);
      return {
        data: { message: result.message, accessToken: result.accessToken },
      };
    }
    return { data: { message: result.message } };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 검증',
    description:
      '이메일 인증 토큰을 검증하고 개인 워크스페이스를 생성하며, 즉시 액세스 토큰과 Refresh Token 쿠키를 발급합니다.',
  })
  @ApiOkWrappedResponse(AccessTokenDto, {
    description:
      '검증 성공 및 로그인 세션 생성 (Refresh Token은 httpOnly 쿠키로 전달)',
  })
  @ApiBadRequestResponse({
    description: '토큰이 유효하지 않거나 만료됨',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const result = await this.authService.verifyEmail(
      dto.token,
      authContextFromRequest(req),
    );
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  // W-47 — brute force 차단. IP 당 10 req/min. 계정별 lockout (5회 실패 → 10분)
  // 와 별개 — IP 가 여러 계정을 순회해도 throttle 이 먼저 막는다.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인',
    description:
      '이메일/비밀번호로 로그인합니다. 성공 시 Access Token을 본문으로, Refresh Token을 httpOnly 쿠키로 발급합니다. 비밀번호 5회 실패 시 10분간 계정이 잠깁니다.',
  })
  @ApiOkWrappedOneOfResponse([AccessTokenDto, LoginChallengeDto], {
    description:
      '로그인 성공. 2FA 비활성 계정: `{ accessToken }`. 2FA 활성 계정: `{ requires2fa, methods, challengeToken }` — 후속 verify 호출 필요.',
  })
  @ApiUnauthorizedResponse({
    description: '이메일/비밀번호 불일치, 이메일 미검증, 또는 계정 잠김',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const result = await this.authService.login(
      dto,
      authContextFromRequest(req),
    );
    if ('requires2fa' in result) {
      return {
        data: {
          requires2fa: result.requires2fa,
          methods: result.methods,
          challengeToken: result.challengeToken,
        },
      };
    }
    this.setRefreshTokenCookie(res, result.refreshToken, dto.rememberMe);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('login/totp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인 2단계 인증 (TOTP)',
    description:
      '`/auth/login`에서 받은 challengeToken과 6자리 인증 코드(또는 복구 코드)로 2단계 인증을 완료해 정식 토큰을 발급합니다.',
  })
  @ApiOkWrappedResponse(AccessTokenDto, { description: '2단계 인증 성공' })
  @ApiUnauthorizedResponse({
    description: '인증 코드 불일치 또는 challenge 만료',
  })
  async loginTotp(
    @Body() dto: LoginTotpDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const result = await this.authService.loginWithTotp(
      dto.challengeToken,
      dto.code,
      (user, code) => this.totpService.verifyForLogin(user, code),
      authContextFromRequest(req),
    );
    this.setRefreshTokenCookie(res, result.refreshToken, false);
    return { data: { accessToken: result.accessToken } };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '2FA 설정 시작',
    description:
      'TOTP secret을 발급하고 Authenticator 앱이 스캔할 수 있는 QR 코드(data URL)를 반환합니다. 검증 전까지 활성화되지 않습니다.',
  })
  @ApiOkWrappedResponse(TotpSetupDto, {
    description: 'TOTP secret 의 otpauth URL 및 QR 코드 data URL',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async setup2fa(@CurrentUser() user: JwtPayload) {
    const result = await this.totpService.setup(user.sub);
    return {
      data: {
        otpauthUrl: result.otpauthUrl,
        qrCodeDataUrl: result.qrCodeDataUrl,
      },
    };
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '2FA 검증·활성화',
    description:
      'setup으로 발급한 secret과 일치하는 6자리 코드를 검증해 2FA를 활성화하고 복구 코드 10개를 반환합니다(일회성 표시).',
  })
  @ApiOkWrappedResponse(TotpVerifyDto, {
    description: '2FA 활성화 성공 및 복구 코드 반환 (일회성 표시)',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패 또는 코드 불일치' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async verify2fa(@CurrentUser() user: JwtPayload, @Body() dto: Verify2faDto) {
    const result = await this.totpService.verifyAndEnable(user.sub, dto.code);
    return { data: { recoveryCodes: result.recoveryCodes } };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '2FA 비활성',
    description:
      '비밀번호 재확인 후 2FA를 비활성화하고 복구 코드를 폐기합니다.',
  })
  @ApiOkWrappedResponse(TotpDisableResultDto, {
    description: '2FA 비활성화 완료',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({
    description: '인증 실패, 토큰 만료, 또는 비밀번호 불일치',
  })
  async disable2fa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Disable2faDto,
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
    await this.totpService.disable(user.sub);
    return { data: { ok: true } };
  }

  // ============================================================
  // WebAuthn 2FA endpoints — spec/5-system/1-auth.md §1.4 + §5
  // ============================================================

  @Public()
  @Get('2fa/webauthn/availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'WebAuthn 기능 활성 여부',
    description:
      '서버 env (WEBAUTHN_RP_ID + WEBAUTHN_ORIGIN) 설정 여부를 알려줍니다. 프론트엔드가 Passkey UI 노출 여부를 결정할 때 사용. 인증 불요.',
  })
  webauthnAvailability() {
    return { data: { enabled: this.webauthnService.isEnabled() } };
  }

  @Post('2fa/webauthn/register/options')
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

  @Post('2fa/webauthn/register/verify')
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
  @Post('2fa/webauthn/authenticate/options')
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
  @Post('2fa/webauthn/authenticate/verify')
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
    this.setRefreshTokenCookie(res, tokens.refreshToken, rememberMe);
    return { data: { accessToken: tokens.accessToken } };
  }

  @Public()
  @Post('2fa/webauthn/recovery')
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
    this.setRefreshTokenCookie(res, tokens.refreshToken, rememberMe);
    return { data: { accessToken: tokens.accessToken } };
  }

  @Get('2fa/webauthn/credentials')
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

  @Patch('2fa/webauthn/credentials/:id')
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

  @Delete('2fa/webauthn/credentials/:id')
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

  @Post('2fa/webauthn/recovery-codes/regenerate')
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

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그아웃',
    description:
      '현재 세션의 Refresh Token 패밀리 전체를 무효화하고 Refresh Token 쿠키를 제거합니다. 쿠키가 없어도 200을 반환합니다.',
  })
  @ApiOkWrappedResponse(AuthMessageDto, { description: '로그아웃 처리 완료' })
  async logout(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const refreshToken = (req as unknown as { cookies: Record<string, string> })
      .cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken, authContextFromRequest(req));
    }
    res.clearCookie('refreshToken', {
      path: '/',
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    });
    return { data: { message: 'Logged out successfully' } };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '액세스 토큰 재발급',
    description:
      'httpOnly 쿠키의 Refresh Token을 검증하고 새 Access Token · Refresh Token을 발급합니다. 재사용이 감지되면 해당 토큰 패밀리 전체가 무효화됩니다.',
  })
  @ApiOkWrappedResponse(AccessTokenDto, {
    description: '새 Access Token 발급 (Refresh Token 쿠키도 함께 갱신)',
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh Token 없음 · 만료 · 무효 또는 재사용 감지',
  })
  async refresh(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const token = (req as unknown as { cookies: Record<string, string> })
      .cookies?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const result = await this.authService.refresh(
      token,
      authContextFromRequest(req),
    );
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: '비밀번호 재설정 메일 요청',
    description:
      '해당 이메일 계정이 존재할 경우 재설정 토큰(30분 유효) 이메일을 발송합니다. 이메일 열람 여부를 유출하지 않도록 존재 여부와 무관하게 동일한 응답을 반환합니다.',
  })
  @ApiOkWrappedResponse(AuthMessageDto, {
    description: '재설정 메일 발송 요청 접수',
  })
  @ApiBadRequestResponse({ description: '이메일 형식 오류' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto.email);
    return { data: result };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '비밀번호 재설정',
    description:
      '재설정 토큰으로 비밀번호를 변경합니다. 성공 시 해당 사용자의 모든 Refresh Token을 무효화하여 재로그인을 요구합니다.',
  })
  @ApiOkWrappedResponse(AuthMessageDto, { description: '재설정 성공' })
  @ApiBadRequestResponse({
    description: '토큰이 유효하지 않거나 만료됨, 또는 비밀번호 강도 미달',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      data: { message: 'Password reset successful. Please sign in.' },
    };
  }

  @Public()
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 중복 확인',
    description: '회원가입 전 이메일 사용 가능 여부를 확인합니다.',
  })
  @ApiOkWrappedResponse(CheckEmailResultDto, { description: '사용 가능 여부' })
  @ApiBadRequestResponse({ description: '이메일 형식 오류' })
  async checkEmail(@Body() dto: CheckEmailDto) {
    const result = await this.authService.checkEmail(dto.email);
    return { data: result };
  }

  @Public()
  @Get('oauth/providers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '활성화된 OAuth provider 목록',
    description:
      '백엔드 환경에 자격증명이 설정된 provider 목록을 반환합니다. 클라이언트는 이 목록이 비어있으면 SSO UI를 표시하지 않습니다.',
  })
  @ApiOkWrappedResponse(OauthProvidersDto, {
    description: '활성화된 provider 목록',
  })
  @Header('Cache-Control', 'private, max-age=300')
  getOauthProviders() {
    const providers = this.authOauthService.getEnabledProviders();
    return { data: { providers } };
  }

  @Public()
  @Get('oauth/:provider')
  @ApiOperation({
    summary: 'OAuth 로그인 시작',
    description:
      '지정한 OAuth 제공자(Google/GitHub)로 인증 요청을 시작하여 해당 제공자의 인증 페이지로 302 리다이렉트합니다.',
  })
  @ApiParam({ name: 'provider', enum: ['google', 'github'] })
  @ApiQuery({ name: 'mode', enum: ['login', 'register'], required: false })
  @ApiQuery({ name: 'rememberMe', type: Boolean, required: false })
  @ApiFoundResponse({ description: 'OAuth 제공자 인증 URL로 리다이렉트' })
  @ApiBadRequestResponse({ description: '지원하지 않는 provider' })
  async beginOauth(
    @Param('provider', new ParseEnumPipe(OAUTH_PROVIDER_ENUM))
    provider: string,
    @Query('mode') mode: 'login' | 'register' = 'login',
    @Query('rememberMe') rememberMe: string | undefined,
    @Res() res: Express.Response,
  ) {
    const { authUrl } = await this.authOauthService.beginAuth(provider, {
      mode: mode === 'register' ? 'register' : 'login',
      rememberMe: rememberMe === 'true',
    });
    return res.redirect(authUrl);
  }

  @Public()
  @Get('oauth/:provider/callback')
  @ApiOperation({
    summary: 'OAuth 콜백',
    description:
      'OAuth 제공자의 콜백을 처리하여 사용자를 생성/매칭한 뒤 Refresh Token 쿠키를 설정하고 프론트엔드 `/callback`으로 리다이렉트합니다.',
  })
  @ApiParam({ name: 'provider', enum: ['google', 'github'] })
  @ApiFoundResponse({
    description:
      '성공: `{frontendUrl}/callback?success=true&token={accessToken}` / 실패: `{frontendUrl}/callback?error={code}`',
  })
  async oauthCallback(
    @Param('provider', new ParseEnumPipe(OAUTH_PROVIDER_ENUM))
    provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() req: Express.Request,
    @Res() res: Express.Response,
  ) {
    const frontendUrl = this.frontendUrl;

    if (providerError) {
      return res.redirect(
        `${frontendUrl}/callback?error=${encodeURIComponent('token_exchange_failed')}`,
      );
    }
    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/callback?error=${encodeURIComponent('invalid_state')}`,
      );
    }

    try {
      const result = await this.authOauthService.handleCallback(
        provider,
        code,
        state,
        authContextFromRequest(req),
      );
      this.setRefreshTokenCookie(res, result.refreshToken, result.rememberMe);
      return res.redirect(
        `${frontendUrl}/callback?success=true&token=${encodeURIComponent(result.accessToken)}`,
      );
    } catch (err) {
      const errorCode = mapOauthError(err);
      if (errorCode === 'server_error') {
        this.logger.error(
          `OAuth callback failed for ${provider}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return res.redirect(
        `${frontendUrl}/callback?error=${encodeURIComponent(errorCode)}`,
      );
    }
  }

  private setRefreshTokenCookie(
    res: Express.Response,
    token: string,
    rememberMe = false,
  ): void {
    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge,
      path: '/',
      ...(this.cookieDomain ? { domain: this.cookieDomain } : {}),
    });
  }
}

function mapOauthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { code?: string } }).response?.code
      : undefined;
  switch (code) {
    case 'OAUTH_STATE_MISMATCH':
    case 'OAUTH_STATE_EXPIRED':
    case 'OAUTH_PROVIDER_UNKNOWN':
      return 'invalid_state';
    case 'OAUTH_TOKEN_EXCHANGE_FAILED':
    case 'OAUTH_PROFILE_FAILED':
      return 'token_exchange_failed';
    case 'OAUTH_EMAIL_REQUIRED':
      return 'email_required';
    default:
      return 'server_error';
  }
}
