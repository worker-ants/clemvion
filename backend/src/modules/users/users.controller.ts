import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

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
}
