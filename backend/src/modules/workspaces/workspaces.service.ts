import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceRole } from './dto/add-member.dto';

const ADMIN_ROLES = new Set<string>(['owner', 'admin']);

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createPersonalWorkspace(
    userId: string,
    userName: string,
    email: string,
    manager?: EntityManager,
  ): Promise<Workspace> {
    const wsRepo = manager
      ? manager.getRepository(Workspace)
      : this.workspaceRepository;
    const memRepo = manager
      ? manager.getRepository(WorkspaceMember)
      : this.memberRepository;

    const localPart = email.split('@')[0] || 'user';
    const randomSuffix = uuidv4().substring(0, 4);
    const slug = `${localPart}-${randomSuffix}`;

    const workspace = wsRepo.create({
      name: `${userName}'s Workspace`,
      type: 'personal',
      ownerId: userId,
      slug,
      settings: {},
    });
    const saved = await wsRepo.save(workspace);

    const member = memRepo.create({
      workspaceId: saved.id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
    });
    await memRepo.save(member);

    return saved;
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaceRepository.findOne({ where: { id } });
  }

  async findPersonalWorkspace(userId: string): Promise<Workspace | null> {
    return this.workspaceRepository.findOne({
      where: { ownerId: userId, type: 'personal' },
    });
  }

  async findOrCreatePersonalWorkspace(
    userId: string,
    userName: string,
    email: string,
  ): Promise<Workspace> {
    const existing = await this.findPersonalWorkspace(userId);
    if (existing) {
      return existing;
    }

    try {
      return await this.createPersonalWorkspace(userId, userName, email);
    } catch {
      const fallback = await this.findPersonalWorkspace(userId);
      if (fallback) {
        return fallback;
      }
      throw new Error('Failed to create personal workspace');
    }
  }

  async getMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<string | null> {
    const member = await this.memberRepository.findOne({
      where: { workspaceId, userId },
    });
    return member?.role ?? null;
  }

  /** Return user IDs of admin-tier members (owner/admin) in the workspace. */
  async findAdminUserIds(workspaceId: string): Promise<string[]> {
    const admins = await this.memberRepository.find({
      where: [
        { workspaceId, role: 'owner' },
        { workspaceId, role: 'admin' },
      ],
    });
    return admins.map((m) => m.userId);
  }

  /** 사용자가 속한 모든 워크스페이스 목록(역할 포함). */
  async listForUser(
    userId: string,
  ): Promise<Array<Workspace & { role: string }>> {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['workspace'],
    });
    return memberships
      .map((m) => Object.assign(m.workspace, { role: m.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 팀 워크스페이스 생성. 생성자는 owner. */
  async createTeam(userId: string, name: string): Promise<Workspace> {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException({
        code: 'WORKSPACE_NAME_INVALID',
        message: '워크스페이스 이름은 2자 이상이어야 합니다.',
      });
    }
    const slug = `team-${uuidv4().substring(0, 8)}`;
    const workspace = this.workspaceRepository.create({
      name: trimmed,
      type: 'team',
      ownerId: userId,
      slug,
      settings: {},
    });
    const saved = await this.workspaceRepository.save(workspace);
    const member = this.memberRepository.create({
      workspaceId: saved.id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
    });
    await this.memberRepository.save(member);
    return saved;
  }

  /** 멤버 목록(요청자가 해당 워크스페이스 멤버여야 한다). */
  async listMembers(
    workspaceId: string,
    requesterId: string,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      email: string;
      name: string;
      role: string;
      joinedAt: Date | null;
    }>
  > {
    await this.assertMembership(workspaceId, requesterId);
    const members = await this.memberRepository.find({
      where: { workspaceId },
      relations: ['user'],
    });
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user?.email ?? '',
      name: m.user?.name ?? '',
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /** 이메일로 기존 가입 사용자 멤버 추가(Admin+). 미가입자는 별도 초대 흐름(2nd 컷). */
  async addMemberByEmail(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    requesterId: string,
  ): Promise<WorkspaceMember> {
    await this.assertWorkspaceType(workspaceId, 'team');
    await this.assertAdmin(workspaceId, requesterId);
    if (role === 'owner') {
      throw new ForbiddenException({
        code: 'CANNOT_ASSIGN_OWNER',
        message: 'owner 역할은 직접 부여할 수 없습니다.',
      });
    }
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: '해당 이메일로 가입된 사용자가 없습니다.',
      });
    }
    const existing = await this.memberRepository.findOne({
      where: { workspaceId, userId: user.id },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_A_MEMBER',
        message: '이미 워크스페이스 멤버입니다.',
      });
    }
    const member = this.memberRepository.create({
      workspaceId,
      userId: user.id,
      role,
      joinedAt: new Date(),
    });
    return this.memberRepository.save(member);
  }

  /** 멤버 역할 변경(Admin+). owner 부여/박탈은 차단. */
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
    requesterId: string,
  ): Promise<WorkspaceMember> {
    await this.assertAdmin(workspaceId, requesterId);
    const member = await this.memberRepository.findOne({
      where: { id: memberId, workspaceId },
    });
    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: '멤버를 찾을 수 없습니다.',
      });
    }
    if (member.role === 'owner' || role === 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_ROLE_PROTECTED',
        message: 'owner 역할은 별도 양도 흐름이 필요합니다.',
      });
    }
    member.role = role;
    return this.memberRepository.save(member);
  }

  /** 워크스페이스 이름 변경 (Admin+). 길이 검증은 DTO가 선행 수행한다. */
  async renameWorkspace(
    workspaceId: string,
    name: string,
    requesterId: string,
  ): Promise<Workspace> {
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
    workspace.name = name.trim();
    return this.workspaceRepository.save(workspace);
  }

  /**
   * 워크스페이스 삭제 (Owner만, team 전용).
   * 멤버·초대 레코드는 `WorkspaceMember`가 FK cascade를 갖지만 `WorkspaceInvitation`은
   * 관계가 선언되어 있지 않으므로 트랜잭션 내에서 명시적으로 정리한다.
   */
  async deleteWorkspace(
    workspaceId: string,
    requesterId: string,
  ): Promise<void> {
    await this.memberRepository.manager.transaction(async (manager) => {
      const memRepo = manager.getRepository(WorkspaceMember);
      const wsRepo = manager.getRepository(Workspace);
      const invRepo = manager.getRepository(WorkspaceInvitation);

      const myMembership = await memRepo.findOne({
        where: { workspaceId, userId: requesterId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!myMembership || myMembership.role !== 'owner') {
        throw new ForbiddenException({
          code: 'OWNER_REQUIRED',
          message: '워크스페이스 삭제는 owner만 가능합니다.',
        });
      }

      const workspace = await wsRepo.findOne({
        where: { id: workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workspace) {
        throw new NotFoundException({
          code: 'WORKSPACE_NOT_FOUND',
          message: '워크스페이스를 찾을 수 없습니다.',
        });
      }
      if (workspace.type === 'personal') {
        throw new ForbiddenException({
          code: 'CANNOT_DELETE_PERSONAL',
          message: '개인 워크스페이스는 삭제할 수 없습니다.',
        });
      }

      await invRepo.delete({ workspaceId });
      await memRepo.delete({ workspaceId });
      await wsRepo.remove(workspace);
    });
  }

  /**
   * 워크스페이스 나가기 (자가 탈퇴, team 전용). 유일한 owner는 차단.
   * sole-owner 판정과 멤버십 삭제는 비관적 락이 걸린 트랜잭션 내에서 수행해 TOCTOU를 방지한다.
   */
  async leaveWorkspace(
    workspaceId: string,
    requesterId: string,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: '워크스페이스를 찾을 수 없습니다.',
      });
    }
    if (workspace.type === 'personal') {
      throw new ForbiddenException({
        code: 'CANNOT_LEAVE_PERSONAL',
        message: '개인 워크스페이스에서는 나갈 수 없습니다.',
      });
    }

    await this.memberRepository.manager.transaction(async (manager) => {
      const memRepo = manager.getRepository(WorkspaceMember);

      const membership = await memRepo.findOne({
        where: { workspaceId, userId: requesterId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!membership) {
        throw new ForbiddenException({
          code: 'NOT_A_MEMBER',
          message: '워크스페이스 멤버가 아닙니다.',
        });
      }
      if (membership.role === 'owner') {
        const owners = await memRepo.find({
          where: { workspaceId, role: 'owner' },
          lock: { mode: 'pessimistic_write' },
        });
        if (owners.length <= 1) {
          throw new ForbiddenException({
            code: 'SOLE_OWNER_CANNOT_LEAVE',
            message:
              '유일한 owner는 나갈 수 없습니다. 다른 멤버를 owner로 승격하거나 워크스페이스를 삭제해 주세요.',
          });
        }
      }
      await memRepo.remove(membership);
    });
  }

  /**
   * 워크스페이스 owner 권한을 다른 멤버에게 이양한다.
   * - 호출자는 현재 owner여야 한다 (`@Roles` 가드와 별개로 service-level 검증).
   * - 대상은 같은 팀 워크스페이스의 비-owner 멤버.
   * - 트랜잭션 + FOR UPDATE 락 안에서 두 멤버 role 을 동시 swap 하고
   *   `workspace.ownerId` 를 새 owner 의 userId 로 갱신한다.
   * - personal 워크스페이스는 이양 불가.
   */
  async transferOwnership(
    workspaceId: string,
    requesterId: string,
    newOwnerMemberId: string,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: '워크스페이스를 찾을 수 없습니다.',
      });
    }
    if (workspace.type === 'personal') {
      throw new ForbiddenException({
        code: 'CANNOT_TRANSFER_PERSONAL',
        message: '개인 워크스페이스는 owner 이양 대상이 아닙니다.',
      });
    }

    await this.memberRepository.manager.transaction(async (manager) => {
      const memRepo = manager.getRepository(WorkspaceMember);
      const wsRepo = manager.getRepository(Workspace);

      const requesterMembership = await memRepo.findOne({
        where: { workspaceId, userId: requesterId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requesterMembership || requesterMembership.role !== 'owner') {
        throw new ForbiddenException({
          code: 'OWNER_REQUIRED',
          message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.',
        });
      }

      if (newOwnerMemberId === requesterMembership.id) {
        throw new BadRequestException({
          code: 'TARGET_IS_SELF',
          message: '본인을 새 owner 로 지정할 수 없습니다.',
        });
      }

      const targetMembership = await memRepo.findOne({
        where: { id: newOwnerMemberId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!targetMembership) {
        throw new NotFoundException({
          code: 'MEMBER_NOT_FOUND',
          message: '대상 멤버를 찾을 수 없습니다.',
        });
      }
      if (targetMembership.role === 'owner') {
        throw new ConflictException({
          code: 'TARGET_ALREADY_OWNER',
          message: '대상이 이미 owner 입니다.',
        });
      }

      targetMembership.role = 'owner';
      requesterMembership.role = 'admin';
      await memRepo.save(targetMembership);
      await memRepo.save(requesterMembership);

      workspace.ownerId = targetMembership.userId;
      await wsRepo.save(workspace);
    });
  }

  /** 멤버 제거(Admin+). 자기 자신 제거는 `leaveWorkspace`로 위임해 동일한 가드를 적용한다. */
  async removeMember(
    workspaceId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId, workspaceId },
    });
    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: '멤버를 찾을 수 없습니다.',
      });
    }
    if (member.userId === requesterId) {
      // 자가 탈퇴: sole-owner 보호, personal 차단 등 공통 가드가 적용된 leaveWorkspace로 위임
      await this.leaveWorkspace(workspaceId, requesterId);
      return;
    }
    if (member.role === 'owner') {
      throw new ForbiddenException({
        code: 'CANNOT_REMOVE_OWNER',
        message: 'owner는 제거할 수 없습니다.',
      });
    }
    await this.assertAdmin(workspaceId, requesterId);
    await this.memberRepository.remove(member);
  }

  private async assertMembership(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) {
      throw new ForbiddenException({
        code: 'NOT_A_MEMBER',
        message: '워크스페이스 멤버가 아닙니다.',
      });
    }
  }

  private async assertAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role || !ADMIN_ROLES.has(role)) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Admin 이상의 권한이 필요합니다.',
      });
    }
  }

  private async assertWorkspaceType(
    workspaceId: string,
    type: 'personal' | 'team',
  ): Promise<void> {
    const ws = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!ws) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: '워크스페이스를 찾을 수 없습니다.',
      });
    }
    if (ws.type !== type) {
      throw new ForbiddenException({
        code: 'WORKSPACE_TYPE_MISMATCH',
        message: `${type} 워크스페이스에서만 가능한 동작입니다.`,
      });
    }
  }
}
