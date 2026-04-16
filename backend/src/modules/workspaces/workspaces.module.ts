import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MailModule } from '../mail/mail.module';

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
  providers: [WorkspacesService, WorkspaceInvitationsService, RolesGuard],
  exports: [WorkspacesService, WorkspaceInvitationsService, RolesGuard],
})
export class WorkspacesModule {}
