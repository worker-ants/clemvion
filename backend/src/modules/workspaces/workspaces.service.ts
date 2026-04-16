import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
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
      throw new ConflictException({
        code: 'WORKSPACE_NAME_TOO_SHORT',
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

  /** 멤버 제거(Admin+). owner는 제거 불가. 자기 자신은 가능(탈퇴). */
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
    if (member.role === 'owner') {
      throw new ForbiddenException({
        code: 'CANNOT_REMOVE_OWNER',
        message: 'owner는 제거할 수 없습니다.',
      });
    }
    if (member.userId !== requesterId) {
      await this.assertAdmin(workspaceId, requesterId);
    }
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
