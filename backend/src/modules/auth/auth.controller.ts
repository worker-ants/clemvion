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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
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
  async logout(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const refreshToken = (req as unknown as { cookies: Record<string, string> })
      .cookies?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('refreshToken', { path: '/' });
    return { data: { message: 'Logged out successfully' } };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      data: { message: 'Password reset successful. Please sign in.' },
    };
  }

  @Public()
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
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
    });
  }
}
