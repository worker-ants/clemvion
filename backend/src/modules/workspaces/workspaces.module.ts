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

// RolesGuard 는 AppModule 의 APP_GUARD 로 등록되어 전역에서 동작한다.
// WorkspacesService 만 @Global 로 export 해두면 RolesGuard 의 DI 가 해결된다.
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
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceInvitationsService],
  exports: [WorkspacesService, WorkspaceInvitationsService],
})
export class WorkspacesModule {}
