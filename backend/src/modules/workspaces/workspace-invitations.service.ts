import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  InvitationRole,
  WorkspaceInvitation,
} from './entities/workspace-invitation.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_ROLES = new Set<string>(['owner', 'admin']);

/**
 * Manages pending workspace invitations for users who may not yet have accounts.
 * The flow:
 *   1. Admin calls invite() with email + role → row created, email dispatched
 *   2. Invitee clicks the link, signs up if needed, then calls accept(token)
 *   3. accept() validates expiry, creates WorkspaceMember, marks row accepted
 *
 * Sibling to {@link WorkspacesService.addMemberByEmail} which only handles
 * users that *already* exist in the system.
 */
@Injectable()
export class WorkspaceInvitationsService {
  private readonly logger = new Logger(WorkspaceInvitationsService.name);

  constructor(
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  /** Admin+ invites an email address to a team workspace. */
  async invite(
    workspaceId: string,
    email: string,
    role: InvitationRole,
    requesterId: string,
  ): Promise<WorkspaceInvitation> {
    const normalized = email.trim().toLowerCase();
    await this.assertAdmin(workspaceId, requesterId);

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: '워크스페이스를 찾을 수 없습니다.',
      });
    }
    if (workspace.type !== 'team') {
      throw new ForbiddenException({
        code: 'WORKSPACE_TYPE_MISMATCH',
        message: '팀 워크스페이스에서만 초대할 수 있습니다.',
      });
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: normalized },
    });
    if (existingUser) {
      const existingMember = await this.memberRepository.findOne({
        where: { workspaceId, userId: existingUser.id },
      });
      if (existingMember) {
        throw new ConflictException({
          code: 'ALREADY_A_MEMBER',
          message: '이미 워크스페이스 멤버입니다.',
        });
      }
    }

    const pending = await this.invitationRepository.findOne({
      where: { workspaceId, email: normalized, acceptedAt: null as never },
    });
    if (pending) {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_PENDING',
        message: '이미 발송된 미수락 초대가 있습니다.',
      });
    }

    const token = randomBytes(24).toString('hex');
    const invitation = this.invitationRepository.create({
      workspaceId,
      email: normalized,
      role,
      token,
      invitedBy: requesterId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });
    const saved = await this.invitationRepository.save(invitation);

    try {
      await this.mailService.sendWorkspaceInvitationEmail(
        normalized,
        workspace.name,
        token,
      );
    } catch (err) {
      // Mail failure shouldn't roll back the invitation row — admin can
      // resend or surface the link manually. Log loudly so the operator
      // knows to investigate the mail transport.
      this.logger.error(
        `Failed to send invitation email to ${normalized}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return saved;
  }

  /**
   * Accept an invitation. Caller must be an authenticated user whose email
   * matches the invitation's email (case-insensitive).
   */
  async accept(
    token: string,
    userId: string,
  ): Promise<{ workspaceId: string; role: InvitationRole }> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: '초대 토큰이 유효하지 않습니다.',
      });
    }
    if (invitation.acceptedAt) {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: '이미 사용된 초대입니다.',
      });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ConflictException({
        code: 'INVITATION_EXPIRED',
        message: '초대가 만료되었습니다.',
      });
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다.',
      });
    }
    if (user.email.toLowerCase() !== invitation.email) {
      throw new ForbiddenException({
        code: 'INVITATION_EMAIL_MISMATCH',
        message: '초대 이메일과 로그인 이메일이 일치하지 않습니다.',
      });
    }

    const existingMember = await this.memberRepository.findOne({
      where: { workspaceId: invitation.workspaceId, userId },
    });
    if (!existingMember) {
      const member = this.memberRepository.create({
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        joinedAt: new Date(),
      });
      await this.memberRepository.save(member);
    }

    invitation.acceptedAt = new Date();
    invitation.acceptedBy = userId;
    await this.invitationRepository.save(invitation);

    return { workspaceId: invitation.workspaceId, role: invitation.role };
  }

  /** Admin+ lists pending invitations for a workspace. */
  async listPending(
    workspaceId: string,
    requesterId: string,
  ): Promise<WorkspaceInvitation[]> {
    await this.assertAdmin(workspaceId, requesterId);
    return this.invitationRepository.find({
      where: { workspaceId, acceptedAt: null as never },
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin+ revokes a pending invitation. No-op if already accepted. */
  async revoke(
    workspaceId: string,
    invitationId: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertAdmin(workspaceId, requesterId);
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, workspaceId },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: '초대를 찾을 수 없습니다.',
      });
    }
    if (invitation.acceptedAt) {
      throw new ConflictException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: '이미 수락된 초대는 취소할 수 없습니다.',
      });
    }
    await this.invitationRepository.remove(invitation);
  }

  /**
   * Drop expired & unaccepted invitations. Called by a periodic job (or test).
   * Returns the number of rows removed.
   */
  async pruneExpired(now: Date): Promise<number> {
    const result = await this.invitationRepository.delete({
      acceptedAt: null as never,
      expiresAt: LessThan(now),
    });
    return result.affected ?? 0;
  }

  private async assertAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { workspaceId, userId },
    });
    if (!member || !ADMIN_ROLES.has(member.role)) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Admin 이상의 권한이 필요합니다.',
      });
    }
  }
}
