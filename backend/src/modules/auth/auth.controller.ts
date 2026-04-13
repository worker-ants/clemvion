import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CheckEmailDto } from './dto/check-email.dto';

// Express types used directly to avoid isolatedModules + emitDecoratorMetadata issue
import Express from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly cookieDomain: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.cookieDomain =
      this.configService.get<string>('app.cookieDomain') || '';
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '회원가입',
    description:
      '신규 사용자를 등록하고 이메일 검증 메일을 발송합니다. 비밀번호는 강도 요건(8자 이상, 3종 이상 문자)을 통과해야 합니다.',
  })
  @ApiCreatedResponse({
    description: '등록 성공 (이메일 검증 메일 발송)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Registration successful. Please verify your email.',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 비밀번호 강도 미달',
  })
  @ApiConflictResponse({ description: '이미 가입된 이메일' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 검증',
    description:
      '이메일 인증 토큰을 검증하고 개인 워크스페이스를 생성하며, 즉시 액세스 토큰과 Refresh Token 쿠키를 발급합니다.',
  })
  @ApiOkResponse({
    description:
      '검증 성공 및 로그인 세션 생성 (Refresh Token은 httpOnly 쿠키로 전달)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'JWT Access Token' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: '토큰이 유효하지 않거나 만료됨',
  })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const result = await this.authService.verifyEmail(dto.token);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인',
    description:
      '이메일/비밀번호로 로그인합니다. 성공 시 Access Token을 본문으로, Refresh Token을 httpOnly 쿠키로 발급합니다. 비밀번호 5회 실패 시 10분간 계정이 잠깁니다.',
  })
  @ApiOkResponse({
    description: '로그인 성공',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT Access Token (15분 유효)',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: '이메일/비밀번호 불일치, 이메일 미검증, 또는 계정 잠김',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken, dto.rememberMe);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그아웃',
    description:
      '현재 세션의 Refresh Token 패밀리 전체를 무효화하고 Refresh Token 쿠키를 제거합니다. 쿠키가 없어도 200을 반환합니다.',
  })
  @ApiOkResponse({
    description: '로그아웃 처리 완료',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Logged out successfully' },
          },
        },
      },
    },
  })
  async logout(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const refreshToken = (req as unknown as { cookies: Record<string, string> })
      .cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
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
  @ApiOkResponse({
    description: '새 Access Token 발급 (Refresh Token 쿠키도 함께 갱신)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
          },
        },
      },
    },
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
    const result = await this.authService.refresh(token);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { data: { accessToken: result.accessToken } };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '비밀번호 재설정 메일 요청',
    description:
      '해당 이메일 계정이 존재할 경우 재설정 토큰(30분 유효) 이메일을 발송합니다. 이메일 열람 여부를 유출하지 않도록 존재 여부와 무관하게 동일한 응답을 반환합니다.',
  })
  @ApiOkResponse({
    description: '재설정 메일 발송 요청 접수',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example:
                'If an account exists, a password reset link has been sent.',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '이메일 형식 오류' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '비밀번호 재설정',
    description:
      '재설정 토큰으로 비밀번호를 변경합니다. 성공 시 해당 사용자의 모든 Refresh Token을 무효화하여 재로그인을 요구합니다.',
  })
  @ApiOkResponse({
    description: '재설정 성공',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Password reset successful. Please sign in.',
            },
          },
        },
      },
    },
  })
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
  @ApiOkResponse({
    description: '사용 가능 여부',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            available: {
              type: 'boolean',
              description: 'true면 해당 이메일로 가입 가능',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '이메일 형식 오류' })
  async checkEmail(@Body() dto: CheckEmailDto) {
    return this.authService.checkEmail(dto.email);
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
