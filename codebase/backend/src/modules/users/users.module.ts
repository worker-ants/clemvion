import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuditLogsModule: UsersController.changePassword 의 user.password_changed
  // 감사 이벤트 기록 (액터 세션 workspaceId 귀속, §Rationale 4.1.B).
  // forwardRef(AuthModule): changePassword 가 변경 후 세션 회전(AuthService.
  // rotateSessionAfterPasswordChange)을 위해 AuthService 를 주입 — AuthModule 도
  // UsersModule 을 import 하므로 순환을 forwardRef 로 해소 (refactor 04 A-1).
  imports: [
    TypeOrmModule.forFeature([User]),
    AuditLogsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
