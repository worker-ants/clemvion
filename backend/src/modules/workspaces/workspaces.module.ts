import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { MailModule } from '../mail/mail.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

// RolesGuard 는 AppModule 의 APP_GUARD 로 등록되어 전역에서 동작한다.
// RolesGuard 는 WorkspacesService 에 의존하므로, 이 모듈을 @Global 로 export 해두면
// AppModule 컨테이너가 가드 인스턴스를 생성할 때 DI 가 깔끔하게 해결된다.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceMember,
      WorkspaceInvitation,
      User,
    ]),
    MailModule,
    AuditLogsModule,
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceInvitationsService],
  exports: [WorkspacesService, WorkspaceInvitationsService],
})
export class WorkspacesModule {}
