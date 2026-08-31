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
  UploadedFile,
  UseGuards,
  UseInterceptors,
  forwardRef,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiPayloadTooLargeResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOkWrappedResponse } from '../../common/swagger';
import {
  MessageResponseDto,
  PasswordChangeResultDto,
  UserProfileDto,
} from './dto/responses/user-response.dto';
import { User } from './entities/user.entity';
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
// `Express` 로 default import 하면 **전역 `Express` 네임스페이스를 가린다** —
// `@types/multer` 가 `Express.Multer.File` 을 그 전역에 augment 하므로, 가려진 상태에서는
// 파일 업로드 파라미터의 타입을 쓸 수 없다(실측: `Namespace 'e' has no exported member
// 'Multer'`). 아바타 업로드가 그 지점을 처음 밟아서 이름을 바꾼다.
// `Express` 가 아니라 `ExpressNS` 인 이유: default import 이름이 `Express` 면 **전역
// `Express` 네임스페이스를 가려서**, `@types/multer` 가 거기 augment 한
// `Express.Multer.File` 을 이 파일에서 쓸 수 없다(실측: `Namespace 'e' has no exported
// member 'Multer'`). 다른 컨트롤러 4곳은 Multer 타입을 쓰지 않아 `Express` 그대로다 —
// 전역 컨벤션으로 승격하려면 `spec/conventions/` 문서화가 선행돼야 한다.
import ExpressNS from 'express';

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

  /**
   * 프로필 응답 봉투의 `data`. `getMe`·`updateMe`·`uploadAvatar` 세 곳이 같은 모양을
   * 내보내므로 한 곳에서 만든다 — 필드가 늘 때 세 군데를 따로 고치면 조용히 갈린다.
   * `pendingEmail` 은 `getMe` 만 싣는다(스프레드로 덧붙인다).
   */
  private toProfileData(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      locale: user.locale ?? 'ko',
      theme: user.theme ?? 'light',
    };
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
        ...this.toProfileData(user),
        // 진행 중인 이메일 변경 표시용 (spec/5-system/1-auth.md §1.1.B).
        pendingEmail: user.pendingEmail ?? null,
      },
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: '현재 사용자 프로필 수정',
    description:
      '이름, 언어(locale), 테마, 아바타 URL 중 전달된 필드만 부분 갱신합니다. ' +
      '`avatarUrl` 을 **다른 값으로** 바꾸면 직전에 업로드된 아바타 객체가 스토리지에서 ' +
      '함께 정리됩니다(best-effort — 실패해도 이 요청은 성공합니다). 비밀번호 변경은 ' +
      '별도 엔드포인트(`POST /users/me/change-password`)를 이용하세요.',
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
    return { data: this.toProfileData(updated) };
  }

  @Post('me/avatar')
  // 이 컨트롤러의 다른 POST 5개와 같이 명시 200. 없으면 NestJS 기본 201 이 나가
  // `@ApiOkWrappedResponse`(200 문서)와 런타임이 어긋난다.
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      // 상수를 **직접 참조**하므로 서비스와 갈릴 수 없다. multer 는 스트림 단계에서
      // 끊어 413 을 내고, 서비스 상수는 계약 서술이다.
      //
      // 초판 주석은 여기 "회귀 테스트가 두 값의 동일성을 고정한다" 고 적었다 — **그런
      // 테스트는 없었고, 직접 참조라 애초에 필요하지도 않았다.** 존재하지 않는 보호를
      // 근거로 드는 주석은 다음 사람이 그 보호를 믿고 상수를 리터럴로 바꾸게 만든다.
      // 진짜 드리프트 지점은 아래 Swagger 리터럴("최대 2MB")이고, 그건 아래 테스트가 문다.
      limits: { fileSize: UsersService.AVATAR_MAX_BYTES },
    }),
  )
  @ApiOperation({
    summary: '아바타 이미지 업로드',
    description:
      '아바타 이미지를 업로드하고 프로필의 `avatarUrl` 을 갱신합니다 (최대 2MB, png/jpg/jpeg/webp/gif). ' +
      '업로드된 이미지는 **URL 을 아는 누구나 접근할 수 있는 공개 오브젝트**이며, URL 은 추측 불가능한 ' +
      'UUID 를 포함합니다. 기존 아바타 객체는 교체 후 정리됩니다.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '업로드할 아바타 이미지',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '이미지 파일 (최대 2MB, png/jpg/jpeg/webp/gif)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkWrappedResponse(UserProfileDto, { description: '갱신된 프로필' })
  @ApiBadRequestResponse({
    description: '파일 누락 또는 허용되지 않는 이미지 형식',
  })
  @ApiPayloadTooLargeResponse({ description: '파일 크기 초과 (2MB)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  async uploadAvatar(
    @CurrentUser() payload: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const updated = await this.usersService.updateAvatar(payload.sub, file);
    return { data: this.toProfileData(updated) };
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
    @Req() req: ExpressNS.Request,
    @Res({ passthrough: true }) res: ExpressNS.Response,
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
  @ApiUnauthorizedResponse({
    description: '재인증 실패 (비밀번호/TOTP 불일치)',
  })
  @ApiForbiddenResponse({
    description: '재인증 수단 없음 — OAuth 전용 계정(REAUTH_NOT_AVAILABLE)',
  })
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
  @ApiBadRequestResponse({ description: '이메일 변경 토큰 무효 또는 만료' })
  @ApiUnauthorizedResponse({
    description: 'JWT 인증 실패 (access token 만료·미제공)',
  })
  async verifyEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: EmailChangeVerifyDto,
    @Req() req: ExpressNS.Request,
    @Res({ passthrough: true }) res: ExpressNS.Response,
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
