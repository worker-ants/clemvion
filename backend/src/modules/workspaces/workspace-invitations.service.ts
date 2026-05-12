import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
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

export interface InvitationMeta {
  workspaceName: string;
  invitedByName: string | null;
  email: string;
  role: InvitationRole;
  expiresAt: Date;
}

function generateToken(): string {
  // 48 random bytes → 64-char base64url string. Matches spec/5-system/1-auth.md §1.5.1.
  return randomBytes(48).toString('base64url');
}

/**
 * Manages pending workspace invitations for users who may not yet have accounts.
 * Spec: spec/5-system/1-auth.md §1.5, spec/2-navigation/9-user-profile.md §4.1.1
 *
 * Per-(workspace, email) pending row is **single** (enforced by partial UNIQUE
 * idx_workspace_invitation_pending_unique). Re-inviting the same email or
 * resending overwrites the same row — the previous token becomes invalid as
 * soon as the column is replaced.
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
    private readonly dataSource: DataSource,
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

    // Spec policy: same (workspace, email) pending → invalidate old token + reissue.
    // We update the existing row (partial UNIQUE keeps it singular) so the previous
    // token stops working immediately.
    const pending = await this.invitationRepository.findOne({
      where: { workspaceId, email: normalized, acceptedAt: null as never },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    let saved: WorkspaceInvitation;
    if (pending) {
      pending.token = token;
      pending.role = role;
      pending.invitedBy = requesterId;
      pending.expiresAt = expiresAt;
      saved = await this.invitationRepository.save(pending);
    } else {
      const invitation = this.invitationRepository.create({
        workspaceId,
        email: normalized,
        role,
        token,
        invitedBy: requesterId,
        expiresAt,
      });
      saved = await this.invitationRepository.save(invitation);
    }

    const inviter = await this.userRepository.findOne({
      where: { id: requesterId },
    });
    await this.dispatchEmail(
      normalized,
      workspace.name,
      inviter?.name ?? null,
      token,
    );

    return saved;
  }

  /**
   * Admin+ resends a pending invitation. Issues a fresh token (old one becomes
   * invalid) and resets the expiry clock from now.
   */
  async resend(
    workspaceId: string,
    invitationId: string,
    requesterId: string,
  ): Promise<WorkspaceInvitation> {
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
        message: '이미 수락된 초대는 재발송할 수 없습니다.',
      });
    }

    invitation.token = generateToken();
    invitation.expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    invitation.invitedBy = requesterId;
    const saved = await this.invitationRepository.save(invitation);

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    const inviter = await this.userRepository.findOne({
      where: { id: requesterId },
    });
    await this.dispatchEmail(
      invitation.email,
      workspace?.name ?? '',
      inviter?.name ?? null,
      saved.token,
    );

    return saved;
  }

  /**
   * Public token lookup for the registration page (no auth). Returns the
   * minimum metadata needed to prefill the sign-up form. Expired / consumed
   * tokens raise GoneException(410) so the frontend can show a clear message.
   */
  async getMetaByToken(token: string): Promise<InvitationMeta> {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'invitation_not_found',
        message: '초대 토큰이 유효하지 않습니다.',
      });
    }
    if (invitation.acceptedAt) {
      throw new GoneException({
        code: 'invitation_already_used',
        message: '이미 사용된 초대입니다.',
      });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        code: 'invitation_expired',
        message: '초대가 만료되었습니다.',
      });
    }

    const [workspace, inviter] = await Promise.all([
      this.workspaceRepository.findOne({
        where: { id: invitation.workspaceId },
      }),
      invitation.invitedBy
        ? this.userRepository.findOne({ where: { id: invitation.invitedBy } })
        : Promise.resolve(null),
    ]);

    return {
      workspaceName: workspace?.name ?? '',
      invitedByName: inviter?.name ?? null,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept an invitation. Caller must be an authenticated user whose email
   * matches the invitation's email (case-insensitive).
   *
   * Single transaction with a guarded UPDATE on accepted_at so a concurrent
   * second accept call observes the row already consumed (returns 410).
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
        code: 'invitation_not_found',
        message: '초대 토큰이 유효하지 않습니다.',
      });
    }
    if (invitation.acceptedAt) {
      throw new GoneException({
        code: 'invitation_already_used',
        message: '이미 사용된 초대입니다.',
      });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        code: 'invitation_expired',
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
      throw new BadRequestException({
        code: 'invitation_email_mismatch',
        message: '초대 이메일과 로그인 이메일이 일치하지 않습니다.',
      });
    }

    return this.dataSource.transaction(async (manager) =>
      this.applyAccept(
        manager,
        invitation.id,
        invitation.workspaceId,
        invitation.role,
        userId,
      ),
    );
  }

  /**
   * Used by AuthService during invitationToken-driven sign-up. Caller is
   * responsible for creating the User row in the same transaction; we just add
   * the membership and stamp the invitation as consumed.
   *
   * Email comparison is the caller's responsibility (sign-up uses the token's
   * email as the source of truth).
   */
  async consumeForRegistration(
    manager: EntityManager,
    token: string,
    userId: string,
  ): Promise<{ workspaceId: string; role: InvitationRole; email: string }> {
    const invitationRepo = manager.getRepository(WorkspaceInvitation);
    const invitation = await invitationRepo.findOne({ where: { token } });
    if (!invitation) {
      throw new NotFoundException({
        code: 'invitation_not_found',
        message: '초대 토큰이 유효하지 않습니다.',
      });
    }
    if (invitation.acceptedAt) {
      throw new GoneException({
        code: 'invitation_already_used',
        message: '이미 사용된 초대입니다.',
      });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new GoneException({
        code: 'invitation_expired',
        message: '초대가 만료되었습니다.',
      });
    }

    const consumed = await this.applyAccept(
      manager,
      invitation.id,
      invitation.workspaceId,
      invitation.role,
      userId,
    );
    return { ...consumed, email: invitation.email };
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

  private async applyAccept(
    manager: EntityManager,
    invitationId: string,
    workspaceId: string,
    role: InvitationRole,
    userId: string,
  ): Promise<{ workspaceId: string; role: InvitationRole }> {
    const invitationRepo = manager.getRepository(WorkspaceInvitation);
    const memberRepo = manager.getRepository(WorkspaceMember);

    // Atomic consume — second concurrent caller sees affected=0 and races out.
    const update = await invitationRepo
      .createQueryBuilder()
      .update(WorkspaceInvitation)
      .set({ acceptedAt: () => 'NOW()', acceptedBy: userId })
      .where('id = :id AND accepted_at IS NULL', { id: invitationId })
      .execute();
    if (!update.affected) {
      throw new GoneException({
        code: 'invitation_already_used',
        message: '이미 사용된 초대입니다.',
      });
    }

    const existingMember = await memberRepo.findOne({
      where: { workspaceId, userId },
    });
    if (!existingMember) {
      const member = memberRepo.create({
        workspaceId,
        userId,
        role,
        joinedAt: new Date(),
      });
      await memberRepo.save(member);
    }

    return { workspaceId, role };
  }

  private async dispatchEmail(
    email: string,
    workspaceName: string,
    invitedByName: string | null,
    token: string,
  ): Promise<void> {
    try {
      await this.mailService.sendWorkspaceInvitationEmail(
        email,
        workspaceName,
        invitedByName,
        token,
      );
    } catch (err) {
      // Mail failure shouldn't roll back the invitation row — admin can
      // resend or surface the link manually. Log loudly so the operator
      // knows to investigate the mail transport.
      this.logger.error(
        `Failed to send invitation email to ${email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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
