import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  // AuditLogsModule: UsersController.changePassword 의 user.password_changed
  // 감사 이벤트 기록 (액터 세션 workspaceId 귀속, §Rationale 4.1.B).
  imports: [TypeOrmModule.forFeature([User]), AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
