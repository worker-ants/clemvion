import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { validatePasswordStrength } from '../../common/utils/password.util';

const BCRYPT_ROUNDS = 12;

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: '현재 사용자 프로필 조회',
    description: '액세스 토큰의 subject에 해당하는 사용자 프로필을 반환합니다.',
  })
  @ApiOkResponse({
    description: '현재 사용자 프로필',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            locale: { type: 'string', example: 'ko' },
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              example: 'light',
            },
          },
        },
      },
    },
  })
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
      },
    };
  }

  @Patch('me')
  @ApiOperation({
    summary: '현재 사용자 프로필 수정',
    description:
      '이름, 언어(locale), 테마, 아바타 URL 중 전달된 필드만 부분 갱신합니다. 비밀번호 변경은 별도 엔드포인트(`POST /users/me/change-password`)를 이용하세요.',
  })
  @ApiOkResponse({ description: '수정된 프로필' })
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
      '현재 비밀번호가 일치해야 하며, 새 비밀번호는 기존 가입/재설정과 동일한 강도 정책을 따릅니다.',
  })
  @ApiOkResponse({ description: '비밀번호 변경 성공' })
  @ApiBadRequestResponse({ description: '새 비밀번호 정책 위반' })
  @ApiUnauthorizedResponse({
    description: '현재 비밀번호 불일치 또는 인증 실패',
  })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })
  async changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    validatePasswordStrength(dto.newPassword);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersService.update(payload.sub, { passwordHash });

    return { data: { success: true } };
  }
}
