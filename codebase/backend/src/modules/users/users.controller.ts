import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOkWrappedResponse } from '../../common/swagger';
import {
  MessageResponseDto,
  PasswordChangeResultDto,
  UserProfileDto,
} from './dto/responses/user-response.dto';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailChangeRequestDto } from './dto/email-change-request.dto';
import { EmailChangeVerifyDto } from './dto/email-change-verify.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';
import { AuthService } from '../auth/auth.service';
import { authContextFromRequest } from '../auth/utils/auth-context';
import { setRefreshTokenCookie } from '../auth/utils/refresh-cookie';
import Express from 'express';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly cookieDomain: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogsService: AuditLogsService,
    // forwardRef: AuthModule↔UsersModule 순환 (refactor 04 A-1). 비밀번호 변경 후
    // 전 세션 revoke + 현재 디바이스 세션 재발급을 위임한다.
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.cookieDomain =
      this.configService.get<string>('app.cookieDomain') || '';
  }

  @Get('me')
  @ApiOperation({
    summary: '현재 사용자 프로필 조회',
    description: '액세스 토큰의 subject에 해당하는 사용자 프로필을 반환합니다.',
  })
  @ApiOkWrappedResponse(UserProfileDto, { description: '현재 사용자 프로필' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  async getMe(@CurrentUser() payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        locale: user.locale ?? 'ko',
        theme: user.theme ?? 'light',
        // 진행 중인 이메일 변경 표시용 (spec/5-system/1-auth.md §1.1.B).
        pendingEmail: user.pendingEmail ?? null,
      },
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: '현재 사용자 프로필 수정',
    description:
      '이름, 언어(locale), 테마, 아바타 URL 중 전달된 필드만 부분 갱신합니다. 비밀번호 변경은 별도 엔드포인트(`POST /users/me/change-password`)를 이용하세요.',
  })
  @ApiOkWrappedResponse(UserProfileDto, { description: '수정된 프로필' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  async updateMe(@CurrentUser() payload: JwtPayload, @Body() dto: UpdateMeDto) {
    const existing = await this.usersService.findById(payload.sub);
    if (!existing) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const updated = await this.usersService.update(payload.sub, dto);
    return {
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        locale: updated.locale ?? 'ko',
        theme: updated.theme ?? 'light',
      },
    };
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '현재 사용자 비밀번호 변경',
    description:
      '현재 비밀번호가 일치해야 하며, 새 비밀번호는 기존 가입/재설정과 동일한 강도 정책을 따릅니다. 변경 성공 시 전 세션을 revoke 하고 현재 디바이스에 새 세션을 재발급합니다 (새 access token 반환 + refresh 쿠키 회전, 인증 §2.3 / Rationale 2.3.C).',
  })
  @ApiOkWrappedResponse(PasswordChangeResultDto, {
    description: '비밀번호 변경 성공 — 새 access token 반환',
  })
  @ApiBadRequestResponse({ description: '새 비밀번호 정책 위반' })
  @ApiUnauthorizedResponse({
    description: '현재 비밀번호 불일치 또는 인증 실패',
  })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  async changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    // 도메인 로직(현재 비밀번호 검증·강도·해시·저장)은 service 로 이전 (refactor 04 B-2).
    await this.usersService.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );

    // [Spec 인증 §2.3 / Rationale 2.3.C] 옵션 B — 전 세션 revoke + 현재 디바이스 재발급.
    // 세션 회전·refresh 쿠키는 액터 컨텍스트(refresh 쿠키·workspaceId)가 controller 에만
    // 있어 controller 책임으로 둔다.
    const ctx = authContextFromRequest(req);
    const tokens = await this.authService.rotateSessionAfterPasswordChange(
      payload.sub,
      ctx,
    );
    setRefreshTokenCookie(res, tokens.refreshToken, {
      cookieDomain: this.cookieDomain,
    });

    // [Spec Auth §4.1 / Rationale 4.1.B] 액터의 현재 세션 workspaceId 에 귀속
    // (audit_log.workspaceId non-nullable). ipAddress 동반(포렌식, data-flow §1.1).
    // record 는 내부적으로 실패를 삼켜 주 동작을 깨지 않는다.
    await this.auditLogsService.record({
      workspaceId: payload.workspaceId,
      userId: payload.sub,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
      resourceType: 'user',
      resourceId: payload.sub,
      ipAddress: ctx.ip ?? undefined,
    });

    return { data: { accessToken: tokens.accessToken } };
  }

  @Post('me/email-change/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: '이메일 변경 시작',
    description:
      '재인증(비밀번호 또는 TOTP) 후 신규 이메일로 확인 메일을 발송합니다. 신규 이메일이 현재와 같으면 400, 다른 계정이 사용 중이면 409, 재인증 수단이 없는 OAuth 전용 계정은 403(`REAUTH_NOT_AVAILABLE`). 인증 §1.1.B.',
  })
  @ApiOkWrappedResponse(MessageResponseDto, {
    description: '신규 이메일로 확인 메일 발송됨',
  })
  @ApiBadRequestResponse({ description: '신규 이메일이 현재와 동일·형식 오류' })
  @ApiUnauthorizedResponse({ description: '재인증 실패' })
  async requestEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: EmailChangeRequestDto,
  ) {
    await this.authService.requestEmailChange(payload.sub, dto.newEmail, {
      password: dto.password,
      totpCode: dto.totpCode,
    });
    return {
      data: {
        message: 'A confirmation email has been sent to the new address.',
      },
    };
  }

  @Post('me/email-change/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 변경 확인',
    description:
      '신규 이메일로 받은 토큰을 인증된 본인 세션에서 검증해 이메일을 교체합니다. 성공 시 전 세션을 revoke 하고 현재 디바이스에 새 세션을 재발급(새 access token + refresh 쿠키 회전)하며, 옛 이메일로 변경 통지를 보냅니다. 토큰 무효·만료는 400, 신규 이메일 선점은 409. 인증 §1.1.B / Rationale 2.3.C.',
  })
  @ApiOkWrappedResponse(PasswordChangeResultDto, {
    description: '이메일 변경 성공 — 새 access token 반환',
  })
  @ApiBadRequestResponse({ description: '토큰 무효 또는 만료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async verifyEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: EmailChangeVerifyDto,
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const ctx = authContextFromRequest(req);
    const tokens = await this.authService.verifyEmailChange(
      payload.sub,
      dto.token,
      ctx,
    );
    setRefreshTokenCookie(res, tokens.refreshToken, {
      cookieDomain: this.cookieDomain,
    });

    // [Spec Auth §4.1 / Rationale 4.1.B] 액터 현재 세션 workspaceId 귀속, ipAddress 포렌식.
    // record 는 내부적으로 실패를 삼켜 주 동작을 깨지 않는다. raw 이메일은 details 에 미저장(R 1.1.B-6).
    await this.auditLogsService.record({
      workspaceId: payload.workspaceId,
      userId: payload.sub,
      action: AUDIT_ACTIONS.USER_EMAIL_CHANGED,
      resourceType: 'user',
      resourceId: payload.sub,
      ipAddress: ctx.ip ?? undefined,
    });

    return { data: { accessToken: tokens.accessToken } };
  }

  @Post('me/email-change/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: '이메일 변경 확인 메일 재발송',
    description:
      '진행 중인 이메일 변경의 확인 메일을 재발송합니다(토큰 재발급, 1h). 진행 중인 변경이 없으면 400. 인증 §1.1.B.',
  })
  @ApiOkWrappedResponse(MessageResponseDto, {
    description: '확인 메일 재발송됨',
  })
  @ApiBadRequestResponse({ description: '진행 중인 이메일 변경 없음' })
  async resendEmailChange(@CurrentUser() payload: JwtPayload) {
    await this.authService.resendEmailChange(payload.sub);
    return {
      data: { message: 'A confirmation email has been re-sent.' },
    };
  }

  @Post('me/email-change/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '이메일 변경 취소',
    description:
      '진행 중인 이메일 변경을 취소합니다(대기 중인 신규 이메일·토큰 제거). 진행 중인 변경이 없어도 정상(멱등). 인증 §1.1.B.',
  })
  @ApiOkWrappedResponse(MessageResponseDto, {
    description: '이메일 변경 취소됨',
  })
  async cancelEmailChange(@CurrentUser() payload: JwtPayload) {
    await this.authService.cancelEmailChange(payload.sub);
    return {
      data: { message: 'The pending email change has been cancelled.' },
    };
  }
}
