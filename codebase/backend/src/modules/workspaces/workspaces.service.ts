import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';
import { isValidIanaTimezone } from '../../common/utils/timezone';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceRole } from './dto/add-member.dto';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';
import { resolveTriggerResourceReleaser } from '../triggers/trigger-resource-release';
import {
  ADMIN_ROLES,
  NOT_A_MEMBER,
  ROLE_REQUIRED,
} from '../../common/constants/workspace-roles';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditLogsService: AuditLogsService,
    private readonly moduleRef: ModuleRef,
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

  /**
   * `manager` 를 주면 그 트랜잭션의 커넥션에서 읽는다 — 행 락을 쥔 트랜잭션 안에서 역할을 다시 볼 때(통합 rotate ·
   * OAuth 재인증 콜백의 커밋 직전 재판정) 풀에서 두 번째 커넥션을 빌리지 않도록.
   */
  async getMemberRole(
    workspaceId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<string | null> {
    const repo = manager
      ? manager.getRepository(WorkspaceMember)
      : this.memberRepository;
    const member = await repo.findOne({
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

  /**
   * Batch variant of {@link findAdminUserIds} — owner/admin user IDs for many
   * workspaces in a single query, grouped by workspaceId. Eliminates the
   * per-workspace N+1 in callers that resolve admins for a set of workspaces
   * (M-2). Workspaces with no admin members are simply absent from the map.
   */
  async findAdminUserIdsByWorkspaces(
    workspaceIds: string[],
  ): Promise<Map<string, string[]>> {
    const byWorkspace = new Map<string, string[]>();
    if (workspaceIds.length === 0) return byWorkspace;
    const admins = await this.memberRepository.find({
      where: {
        workspaceId: In(workspaceIds),
        role: In([...ADMIN_ROLES]),
      },
    });
    for (const m of admins) {
      const arr = byWorkspace.get(m.workspaceId);
      if (arr) arr.push(m.userId);
      else byWorkspace.set(m.workspaceId, [m.userId]);
    }
    return byWorkspace;
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
    // 감사 로그(best-effort). 팀 워크스페이스 생성은 조직 경계 신설이므로 audit 대상(결정4=B).
    await this.auditLogsService.record({
      workspaceId: saved.id,
      userId,
      action: AUDIT_ACTIONS.WORKSPACE_CREATED,
      resourceType: 'workspace',
      resourceId: saved.id,
    });
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
      // **DB 레벨 투영이다 — JS 단 매핑이 아니라.** 아래 `.map` 이 이미 응답을 좁히고
      // 있었지만, `user-entity-exposure-guard` 는 **로드 형태**만 보므로 그 자리는 보호
      // 범위 밖이었다(방어가 검출이지 강제가 아니었다). 여기서 컬럼을 좁히면 `User` 의
      // 민감 7컬럼([데이터 모델 §2.1.1](../../../../../spec/1-data-model.md))이 애초에
      // 로드되지 않는다.
      //
      // 엔티티 전역 `select: false` 와는 **다른 것**이다 — 그쪽은 그 컬럼을 값으로 읽는
      // 내부 경로를 fail-silent 로 만들어 기각됐다(같은 문서 `## Rationale`).
      // 이것은 **이 쿼리 하나**의 투영이라 다른 경로를 건드리지 않는다.
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: { id: true, email: true, name: true },
      },
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
    // 인가가 조회보다 먼저다 — 거꾸로면 비관리자가 워크스페이스의 존재 · 유형을 구분한다
    // (`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다").
    await this.assertAdmin(workspaceId, requesterId);
    await this.assertWorkspaceType(workspaceId, 'team');
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
    const savedMember = await this.memberRepository.save(member);
    // 감사 로그(best-effort). 직접 멤버 추가는 초대 흐름과 구분되게 mode='direct_add'.
    await this.auditLogsService.record({
      workspaceId,
      userId: requesterId,
      action: AUDIT_ACTIONS.MEMBER_INVITED,
      resourceType: 'member',
      resourceId: savedMember.id,
      details: { mode: 'direct_add', memberUserId: user.id, role },
    });
    return savedMember;
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
    if (!member) this.throwMemberNotFound();
    if (member.role === 'owner' || role === 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_ROLE_PROTECTED',
        message: 'owner 역할은 별도 양도 흐름이 필요합니다.',
      });
    }
    const previousRole = member.role;
    member.role = role;
    const saved = await this.memberRepository.save(member);
    // 감사 로그(best-effort). 역할 변경 전/후를 details 에 남긴다.
    await this.auditLogsService.record({
      workspaceId,
      userId: requesterId,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      resourceType: 'member',
      resourceId: memberId,
      details: { from: previousRole, to: role, memberUserId: member.userId },
    });
    return saved;
  }

  /**
   * «없다» 를 그대로 던진다 — 형제 `triggers.service.ts` 의 `throwTriggerNotFound()` /
   * `schedules.service.ts` 의 `throwScheduleNotFound()` / `integrations.service.ts` 의
   * `throwIntegrationNotFound()` 선례와 같은 이유다. 같은 리터럴이 `updateMemberRole` ·
   * `removeMember`(두 판정)까지 세 곳에 복제돼 있었다 (`/ai-review`
   * `review/code/2026/09/21/12_57_05` maintainability WARNING 3).
   *
   * `transferOwnership()` 의 "대상 멤버를 찾을 수 없습니다." 는 대상을 특정하는 별도 문구라
   * 여기 재사용하지 않는다 — 갈아 끼우면 API 응답 메시지가 조용히 바뀐다.
   */
  private throwMemberNotFound(): never {
    throw new NotFoundException({
      code: 'MEMBER_NOT_FOUND',
      message: '멤버를 찾을 수 없습니다.',
    });
  }

  /**
   * «owner 는 제거할 수 없다» — `removeMember` 의 **두 자리**가 쓴다: 무락 선조회 위의 이른
   * 가드와, DELETE 가 0행일 때 `role: Not('owner')` 술어가 걸렀음을 확인한 자리다.
   * 같은 이유로 헬퍼다 — 리터럴을 두 벌 두면 한쪽 문구만 바뀌어 같은 코드가 다른 메시지를 낸다
   * (바로 위 `throwMemberNotFound()` 가 세 벌 복제로 지적받아 생긴 선례).
   */
  private throwCannotRemoveOwner(): never {
    throw new ForbiddenException({
      code: 'CANNOT_REMOVE_OWNER',
      message: 'owner는 제거할 수 없습니다.',
    });
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
    const saved = await this.workspaceRepository.save(workspace);
    // 감사 로그(best-effort). 어떤 필드가 바뀌었는지 details.field 로 구분.
    await this.auditLogsService.record({
      workspaceId,
      userId: requesterId,
      action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
      resourceType: 'workspace',
      resourceId: workspaceId,
      details: { field: 'name' },
    });
    return saved;
  }

  /**
   * 워크스페이스 설정 변경 (Admin+). 현재는 `interactionAllowedOrigins` 와 `timezone` 을 갱신한다.
   * 형식 검증(scheme 필수·path/query 불가)은 DTO가 선행 수행한다. 여기서는 각 origin 의
   * 단일 trailing slash 만 제거해 정규화하고, 기존 settings 의 다른 키(timezone 등)는 보존한다.
   */
  async updateWorkspaceSettings(
    workspaceId: string,
    dto: UpdateWorkspaceSettingsDto,
    userId: string,
  ): Promise<Workspace> {
    await this.assertAdmin(workspaceId, userId);
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: '워크스페이스를 찾을 수 없습니다.',
      });
    }
    // personal 워크스페이스도 허용한다 — delete/leave/transfer 와 달리, 공개 웹챗 트리거(임베드)는
    // personal 워크스페이스에도 존재할 수 있어 interactionAllowedOrigins 편집이 정당하다(owner=admin-tier).
    // 동시 편집은 last-write-wins(전체 목록 교체 의미라 허용 가능). 향후 settings 다중 키 동시 쓰기가
    // 생기면 jsonb `||` 원자 머지 전환 고려(현재 origins 만 편집 가능하므로 키 간 lost-update 없음).
    // partial patch: 각 키는 제공 시에만 병합하고 미제공 키는 기존 값을 보존한다
    // (timezone 단독 저장이 origins 목록을 침묵 삭제하지 않도록 — timezone/maxConcurrent 와 동일 패턴).
    let nextSettings: Record<string, unknown> = {
      ...(workspace.settings ?? {}),
    };
    if (dto.interactionAllowedOrigins !== undefined) {
      const normalized = dto.interactionAllowedOrigins.map((o) =>
        o.replace(/\/$/, ''),
      );
      nextSettings = { ...nextSettings, interactionAllowedOrigins: normalized };
    }
    // 타임존: 제공 시 IANA 유효성 검증 후 병합. 빈 문자열은 설정 해제(undefined)로 처리.
    if (dto.timezone !== undefined) {
      const tz = dto.timezone.trim();
      if (tz.length === 0) {
        const { timezone: _drop, ...rest } = nextSettings;
        nextSettings = rest;
      } else {
        if (!isValidIanaTimezone(tz)) {
          throw new BadRequestException({
            code: 'INVALID_TIMEZONE',
            message: `유효하지 않은 타임존입니다: ${tz}`,
          });
        }
        nextSettings = { ...nextSettings, timezone: tz };
      }
    }
    // §8 동시성 cap — 제공 시 병합(DTO @IsInt @Min(1) 이 양의 정수 보장). 미제공은 보존.
    if (dto.maxConcurrentExecutions !== undefined) {
      nextSettings = {
        ...nextSettings,
        maxConcurrentExecutions: dto.maxConcurrentExecutions,
      };
    }
    workspace.settings = nextSettings;
    const saved = await this.workspaceRepository.save(workspace);
    // 감사 로그(best-effort). settings 변경(origins·timezone·maxConcurrent)은 field='settings'.
    await this.auditLogsService.record({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
      resourceType: 'workspace',
      resourceId: workspaceId,
      details: { field: 'settings' },
    });
    return saved;
  }

  /**
   * 워크스페이스 설정 조회 — `interactionAllowedOrigins` 와 `timezone`(설정된 경우)을 반환.
   * **멤버 read**(viewer 포함): 설정 화면에서 현재 값을 표시(편집은 Admin+, 조회는 모든 멤버).
   */
  async getWorkspaceSettings(
    workspaceId: string,
    userId: string,
  ): Promise<{
    interactionAllowedOrigins: string[];
    timezone?: string;
    maxConcurrentExecutions?: number;
  }> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) this.throwNotAMember();
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: '워크스페이스를 찾을 수 없습니다.',
      });
    }
    const origins = workspace.settings?.interactionAllowedOrigins;
    const tz = workspace.settings?.timezone;
    const cap = workspace.settings?.maxConcurrentExecutions;
    return {
      interactionAllowedOrigins: Array.isArray(origins)
        ? origins.filter((o): o is string => typeof o === 'string')
        : [],
      ...(typeof tz === 'string' && tz.length > 0 ? { timezone: tz } : {}),
      ...(typeof cap === 'number' ? { maxConcurrentExecutions: cap } : {}),
    };
  }

  /**
   * §2.2 — 워크스페이스 기본 타임존(`settings.timezone`)을 RBAC 없이 조회하는 **내부용** 헬퍼.
   * 다른 모듈(예: SchedulesService)이 타임존 fallback 에 사용한다. 값이 없거나 무효한 IANA 식별자면
   * `undefined` 를 반환(저장 시 검증하지만 레거시 row 방어). 모듈 경계를 위해 Workspace 엔티티를
   * 직접 노출하지 않고 본 메서드만 제공한다.
   */
  async getWorkspaceTimezone(workspaceId: string): Promise<string | undefined> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    const tz = workspace?.settings?.timezone;
    return typeof tz === 'string' && isValidIanaTimezone(tz) ? tz : undefined;
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
    // **권한 검사를 외부 해제보다 먼저** 한다 — 트랜잭션 안에서만 검사하면 403 이 날 요청이
    // provider 등록·schedule job 부터 뜯는다. 결정은 여전히 아래 잠금 뒤 재검사가 한다.
    await this.assertWorkspaceDeletable(
      this.memberRepository,
      this.workspaceRepository,
      workspaceId,
      requesterId,
    );
    // 트리거는 FK CASCADE 로 함께 지워진다 — 외부 자원은 트랜잭션 **밖에서 먼저**, 비밀은
    // **커밋 뒤** 정리한다(spec 트리거 목록 §4.3 · data-flow 12-workspace §1.10).
    const releaser = resolveTriggerResourceReleaser(this.moduleRef);
    await releaser.releaseExternalForParent({ workspaceId });
    const triggerIds = await this.memberRepository.manager
      .transaction(async (manager) => {
        const memRepo = manager.getRepository(WorkspaceMember);
        const wsRepo = manager.getRepository(Workspace);
        const invRepo = manager.getRepository(WorkspaceInvitation);

        // **첫 호출이다** — 잠금 대기 상한을 걸고 워크스페이스 행을 잠근 뒤 트리거를 연다. 잠금 뒤엔
        // 새 트리거가 끼지 못하고, 아래 재검사의 잠금(워크스페이스 → 멤버십)에도 상한이 걸린다.
        const locked = await releaser.lockParentAndListTriggerIds(manager, {
          workspaceId,
        });
        // 동시 DELETE 두 건이 잠금 없는 선검사(`assertWorkspaceDeletable` — 메서드 진입부)를 모두
        // 통과할 수 있다. 먼저 커밋한 쪽이 워크스페이스를 지웠으면 CASCADE 로 멤버 행도 함께
        // 사라지므로, 아래 재검사는 «존재» 가 아니라 **«멤버십(권한)» 을 먼저 봐** 403
        // `OWNER_REQUIRED` 로 오답한다(워크플로 경로가 이미 겪은 것과 같은 패턴). 재검사에
        // 넘기기 전에 여기서 먼저 막아 404 로 끝낸다.
        if (locked.parentPresence === 'absent') {
          throw new NotFoundException({
            code: 'WORKSPACE_NOT_FOUND',
            message: '워크스페이스를 찾을 수 없습니다.',
          });
        }
        const workspace = await this.assertWorkspaceDeletable(
          memRepo,
          wsRepo,
          workspaceId,
          requesterId,
          { mode: 'pessimistic_write' },
        );

        await invRepo.delete({ workspaceId });
        await memRepo.delete({ workspaceId });
        await wsRepo.remove(workspace);
        return locked.triggerIds;
      })
      .catch((err: unknown) => {
        // 동시 삭제로 행이 이미 사라진 경우는 **반쯤 삭제된 상태가 아니다** — 먼저 커밋한 요청이
        // 워크스페이스도 지우고 같은 자원도 해제했다. 아래 error 로그는 «트리거가 발화하지 않을
        // 수 있다» 고 말하므로 이 경우까지 실으면 거짓 경보가 된다(워크플로 경로와 같은 가드).
        if (err instanceof NotFoundException) throw err;
        // 잠금 뒤 재검사 거부(선검사와 재검사 사이의 역할 변경)도 여기로 온다. 외부 해제는 되돌릴
        // 수 없으므로 «발화하지 않는 트리거가 남은 워크스페이스» 를 소리내어 남긴다.
        this.logger.error(
          `WorkspacesService.deleteWorkspace: workspace=${workspaceId} 삭제가 트랜잭션에서 실패했다 — ` +
            `그 트리거들의 schedule job·provider teardown·listener 해제는 **이미 끝났으므로** 워크스페이스는 ` +
            `남았지만 트리거는 발화하지 않을 수 있다(비밀은 남아 있다): ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      });
    await releaser.releaseSecretsAfterCommit(
      triggerIds,
      'WorkspacesService.deleteWorkspace',
    );
  }

  /**
   * 워크스페이스 삭제 가능 여부 — owner 이고 team 워크스페이스여야 한다.
   *
   * 두 번 부른다: 트랜잭션 **밖에서 잠금 없이**(외부 해제 전 선검사)와 **안에서 잠금으로**(결정).
   * 둘 사이에 역할이 바뀌면 안쪽이 거부하고 외부 해제만 먼저 끝난 상태가 남는다 — 동시 역할 변경과
   * 삭제가 겹치는 좁은 창이다. 그 사실은 `deleteWorkspace` 가 error 로그로 남긴다.
   *
   * **잠금 순서는 워크스페이스 → 멤버십**이다 — `transferOwnership` 과 같게 둬야 둘이 겹칠 때
   * 교착(`40P01`)이 나지 않는다. 판정 순서(권한 → 존재 → 타입)는 그와 별개로 유지한다.
   */
  private async assertWorkspaceDeletable(
    memRepo: Repository<WorkspaceMember>,
    wsRepo: Repository<Workspace>,
    workspaceId: string,
    requesterId: string,
    lock?: { mode: 'pessimistic_write' },
  ): Promise<Workspace> {
    const workspace = await wsRepo.findOne({
      where: { id: workspaceId },
      ...(lock ? { lock } : {}),
    });
    const myMembership = await memRepo.findOne({
      where: { workspaceId, userId: requesterId },
      ...(lock ? { lock } : {}),
    });
    if (!myMembership || myMembership.role !== 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_REQUIRED',
        message: '워크스페이스 삭제는 owner만 가능합니다.',
      });
    }
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
    return workspace;
  }

  /**
   * 워크스페이스 나가기 (자가 탈퇴, team 전용). 유일한 owner는 차단.
   * sole-owner 판정과 멤버십 삭제는 비관적 락이 걸린 트랜잭션 내에서 수행해 TOCTOU를 방지한다.
   */
  async leaveWorkspace(
    workspaceId: string,
    requesterId: string,
  ): Promise<void> {
    // 인가가 조회보다 먼저다 — 거꾸로면 비멤버가 «없음 · 개인 · 팀» 을 구분한다(존재 · 유형
    // 오라클). 아래 트랜잭션의 멤버십 재조회는 락을 잡은 채 sole-owner 를 판정하려는 것이라 남는다.
    await this.assertMembership(workspaceId, requesterId);
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

    let leftMembershipId: string | undefined;
    await this.memberRepository.manager.transaction(async (manager) => {
      const memRepo = manager.getRepository(WorkspaceMember);

      const membership = await memRepo.findOne({
        where: { workspaceId, userId: requesterId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!membership) this.throwNotAMember();
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
      // remove() 는 in-memory 엔티티의 id 를 지우므로 커밋 후 감사용으로 미리 캡처한다.
      leftMembershipId = membership.id;
      await memRepo.remove(membership);
    });

    // 감사 로그는 트랜잭션 커밋 후 best-effort. 자가 탈퇴는 mode='left' 로 admin 제거(removed)와 구분.
    await this.auditLogsService.record({
      workspaceId,
      userId: requesterId,
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      resourceType: 'member',
      resourceId: leftMembershipId ?? requesterId,
      details: { mode: 'left', memberUserId: requesterId },
    });
  }

  /**
   * 워크스페이스 owner 권한을 다른 멤버에게 이양한다.
   * - 호출자는 현재 owner 여야 한다 (`@Roles('owner')` 가드 + service-level 재검증).
   * - 대상은 같은 팀 워크스페이스의 비-owner 멤버.
   * - personal 워크스페이스는 이양 불가.
   *
   * 인가는 트랜잭션 **밖**에서 무락으로 먼저 판정한다(존재 · 유형 오라클 제거). 아래 락 재검사는 동시 owner 변경과의
   * 경합 대비로 남는다.
   *
   * 동시성 보장:
   * 1) `workspace` 행을 트랜잭션 내부에서 `pessimistic_write` 로 락. type 검증·
   *    ownerId 갱신 모두 같은 락 범위에서 수행해 동시 호출 간 stale snapshot 덮어쓰기를 차단.
   * 2) 두 멤버는 그 뒤 요청자 → 대상 순으로 한 행씩 `pessimistic_write` 로 락한다. 같은 워크스페이스의 동시
   *    이양은 1) 의 워크스페이스 행 락에서 먼저 직렬화되므로 멤버 락 순서가 달라도(A→B / B→A) 데드락이
   *    생기지 않는다.
   *    (2026-09-25 정정 — 종전 이 줄은 «두 멤버를 단일 `IN` 쿼리로 동시에 락» 이라 적었으나, 그 문장을 넣은
   *    `eb009f99c` 의 구현부터 순차 `findOne` 두 번이었다.)
   */
  async transferOwnership(
    workspaceId: string,
    requesterId: string,
    newOwnerMemberId: string,
  ): Promise<void> {
    // 인가가 조회보다 먼저다 — 아래 트랜잭션은 워크스페이스를 먼저 읽어 «없음 404 · 개인 · 팀 비-owner»
    // 로 갈리므로, 그 앞에서 무락으로 한 번 판정한다(`leaveWorkspace` 와 같은 모양). 트랜잭션 안의 락 재검사는
    // 동시 owner 변경과의 경합을 막으려는 것이라 남긴다.
    const requesterRole = await this.getMemberRole(workspaceId, requesterId);
    if (!requesterRole) this.throwNotAMember();
    if (requesterRole !== 'owner') this.throwOwnerTransferRequired();

    await this.memberRepository.manager.transaction(async (manager) => {
      const memRepo = manager.getRepository(WorkspaceMember);
      const wsRepo = manager.getRepository(Workspace);

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
          code: 'CANNOT_TRANSFER_PERSONAL',
          message: '개인 워크스페이스는 owner 이양 대상이 아닙니다.',
        });
      }

      const requesterMembership = await memRepo.findOne({
        where: { workspaceId, userId: requesterId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requesterMembership || requesterMembership.role !== 'owner') {
        this.throwOwnerTransferRequired();
      }
      if (newOwnerMemberId === requesterMembership.id) {
        throw new BadRequestException({
          code: 'TARGET_IS_SELF',
          message: '본인을 새 owner 로 지정할 수 없습니다.',
        });
      }

      // 같은 트랜잭션에서 이미 락이 걸린 requesterMembership 을 다시 잠그지 않도록
      // 대상 멤버만 추가로 잠근다 (단일 row 락 → 데드락 위험 없음).
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
      // 단일 왕복으로 두 멤버 갱신 (TypeORM batch save).
      await memRepo.save([targetMembership, requesterMembership]);

      workspace.ownerId = targetMembership.userId;
      await wsRepo.save(workspace);
    });

    // 감사 로그는 트랜잭션 커밋 후 best-effort 로 기록 (record() 자체가 실패를 swallow).
    // NF-SC-06 요구사항: owner 이양은 워크스페이스의 최종 통제권 변경이므로 감사 대상.
    await this.auditLogsService.record({
      workspaceId,
      userId: requesterId,
      action: AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP,
      resourceType: 'workspace',
      resourceId: workspaceId,
      details: { newOwnerMemberId },
    });
  }

  /**
   * 멤버 제거(Admin+). 자기 자신 제거는 `leaveWorkspace`로 위임해 동일한 가드를 적용한다.
   *
   * 판정 순서: **멤버십 → 대상 존재 → self 위임 → admin → 대상이 owner 인가.** 인가(앞의 둘)를
   * 끝내기 전에는 대상에 대해 아무것도 답하지 않는다 — 그러지 않으면 비-멤버가 응답 차이로
   * 대상의 존재·owner 여부를 알아낸다.
   *
   * 동시성 보장: 잠글 행이 없어 동시 요청들이 모두 무락 검사를 통과할 수 있지만, 단일
   * 원자적 `DELETE`(`affected === 0` 명시 비교)가 승자만 갈라 **둘**을 막는다 —
   * 감사 로그 중복(동시 제거), 그리고 **owner 삭제**(동시 `transferOwnership`).
   * 후자는 `role: Not('owner')` 술어가 DELETE 안으로 들어가 막는다.
   */
  async removeMember(
    workspaceId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    // **인가를 대상 조회보다 먼저 한다.** 종전에는 `findOne` → 404 → self → owner 403 →
    // `assertAdmin` 순서라, 이 워크스페이스와 무관한 사용자도 `(workspaceId, memberId)` 쌍에
    // 대해 세 갈래로 구분되는 답을 받았다(없음 404 · owner 403 · 비-owner 403). ~~가드 층은
    // 이 라우트를 막지 못한다 — `@Roles()` 가 없고 `handlerConsumesWorkspaceId` 가 false
    // (`@WorkspaceId()` 가 아니라 `@Param('id')`)라 `RolesGuard` 가 단축 통과시킨다.~~
    // (2026-09-25 정정) 이제 `@WorkspaceParam('id')` 라 `RolesGuard` 가 경로 워크스페이스의
    // 멤버십을 먼저 본다 — 비멤버는 여기 닿기 전에 `NOT_A_MEMBER` 다. 이 순서는 가드 인식이
    // 깨졌을 때의 두 번째 선으로 남는다(`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터
    // 워크스페이스도 가드가 본다").
    //
    // 형제(`addMemberByEmail` · `updateMemberRole`)처럼 `assertAdmin` 을 첫 줄에 둘 수는 없다 —
    // **자가 탈퇴는 비-admin 도 해야 하고**, 자기 자신인지는 대상을 읽어야 안다. 그래서 인가를
    // 두 단으로 나눈다: 멤버십은 여기서, admin 은 self 위임 뒤에서.
    //
    // 요청자 role 을 **한 번만** 읽는다 — `assertMembership` 과 `assertAdmin` 은 둘 다
    // `getMemberRole` 을 부르므로 그대로 이어 쓰면 같은 쿼리가 두 번 돈다.
    const requesterRole = await this.getMemberRole(workspaceId, requesterId);
    if (!requesterRole) this.throwNotAMember();

    const member = await this.memberRepository.findOne({
      where: { id: memberId, workspaceId },
    });
    if (!member) this.throwMemberNotFound();
    if (member.userId === requesterId) {
      // 자가 탈퇴: sole-owner 보호, personal 차단 등 공통 가드가 적용된 leaveWorkspace로 위임
      await this.leaveWorkspace(workspaceId, requesterId);
      return;
    }
    // **admin 판정이 owner 판정보다 앞이다.** 뒤집으면 비-admin 멤버가 owner 를 지목했을 때
    // `CANNOT_REMOVE_OWNER` 를 받는데, 그것은 «대상이 owner 만 아니면 가능하다» 는 거짓 함의를
    // 준다 — editor 는 누구도 제거할 수 없다. 인가를 끝내고 대상 조건을 보는 것이 형제 둘의
    // 순서와도 같다.
    if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired();
    // 무락 읽기 위의 **이른** 가드라 이것만으로는 부족하고, 아래 DELETE 의 `role: Not('owner')`
    // 술어가 뒤를 받는다(동시 `transferOwnership`).
    if (member.role === 'owner') this.throwCannotRemoveOwner();
    const removedMemberUserId = member.userId;

    // 위 `findOne` 은 잠그지 않으므로 동시 제거 두 건이 **둘 다** 여기까지 온다. 종전의
    // `remove(member)` 는 0행이어도 던지지 않아 둘 다 감사를 남겼다 (실측: 한 memberId 에
    // `member.removed` 2건). 형제 다섯(#1369~#1372)과 달리 이 경로엔 잠글 것이 없으므로 —
    // advisory lock 도 행 락도 없다 — 락을 새로 들이지 않고 **단일 원자적 DELETE** 로 가른다.
    // `DELETE … WHERE id = $1 AND workspace_id = $2` 한 문장은 그 자체로 원자적이라
    // 둘 중 하나만 1행을 지운다.
    //
    // 판정은 `affected === 0` **명시 비교**다. `null`·`undefined` 는 드라이버가 «보고하지
    // 않았다» 는 뜻이지 «지우지 못했다» 가 아니며, 그것을 0 과 같이 읽으면 정상 삭제를 404 로
    // 뒤집는다 (같은 규율: `rewriteTriggerConfigLocked`).
    //
    // **owner 가드도 같은 문장 안에서 판정한다.** 위 `member.role === 'owner'` 검사와 이 DELETE
    // 사이에 동시 `transferOwnership` 이 대상을 승격시키면, 술어가 없을 때 owner 가 지워지고
    // `workspace.ownerId` 가 멤버십 없는 사용자를 가리킨다 (e2e 로 재현: 고치기 전 **200**).
    //
    // 술어 하나로 충분한 이유는 Postgres 의 동작이다 — `transferOwnership` 은 그 행에
    // `pessimistic_write` 를 쥐므로 이 DELETE 는 커밋을 기다렸다가 **갱신된 행 버전에 대해
    // `WHERE` 를 다시 평가**한다(READ COMMITTED 의 EvalPlanQual). 그래서 승격된 행이 제외된다.
    // 이 경로에 락을 새로 들이지 않는다.
    //
    // **`4-execution-engine.md` §8 의 조건부 UPDATE 와 혼동하지 말 것.** 그쪽은 **타-행 집계**
    // (동시 실행 수)를 조건으로 삼아 조건부 문장만으로는 TOCTOU 가 남고 advisory lock 이
    // 따로 필요했다. 여기 조건은 **지우려는 바로 그 행 자신의 컬럼**이라 위 재평가가 곧
    // 원자성이다 — 같은 모양이지만 보장이 다르다.
    const { affected } = await this.memberRepository.delete({
      id: memberId,
      workspaceId,
      role: Not('owner'),
    });
    if (affected === 0) {
      // 0 의 이유가 **둘**이다 — 행이 사라졌나(동시 제거), owner 였나(동시 이양).
      // 0-행 경로에서만 한 번 더 읽어 가른다. 이 재조회는 잠그지 않는다: 고르는 것은 에러
      // 코드뿐이고 어느 답이든 **어떤 직렬화의 정당한 결과**다.
      const still = await this.memberRepository.findOne({
        where: { id: memberId, workspaceId },
      });
      // **존재 여부만 본다 — 지금의 role 은 보지 않는다.** 위 문장의 술어는 `role` 하나뿐이라,
      // `(id, workspaceId)` 가 맞는 행이 남아 있는데 0행이었다면 그 시점에 **owner 였다는 뜻**
      // 말고는 없다. 재조회가 그 사이의 강등을 볼 수도 있지만(이양 연쇄), 그래도 «DELETE 를
      // 막은 것은 owner 였다» 는 사실은 그대로다 — 여기서 현재 role 을 다시 물으면 실재하는
      // 멤버를 404 로 보고하게 된다 (`/ai-review` `review/code/2026/09/24/08_09_57` W3).
      if (still) this.throwCannotRemoveOwner();
      this.throwMemberNotFound();
    }
    // 감사 로그(best-effort). admin 에 의한 제거는 mode='removed' 로 자가 탈퇴(left)와 구분.
    await this.auditLogsService.record({
      workspaceId,
      userId: requesterId,
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      resourceType: 'member',
      resourceId: memberId,
      details: { mode: 'removed', memberUserId: removedMemberUserId },
    });
  }

  /**
   * «워크스페이스 멤버가 아니다» — `assertMembership` 과, 요청자 role 을 **직접** 읽어
   * 재사용하는 `removeMember` 가 쓴다. 후자는 `assertMembership` 을 못 부른다(같은
   * `getMemberRole` 을 두 번 돌리게 된다)므로 **판정문만** 공유한다. 본문은 `RolesGuard` 와 같은
   * 표(`common/constants/workspace-roles.ts`)에서 온다 — 두 선이 같은 실패에 같은 문장을 낸다.
   */
  private throwNotAMember(): never {
    throw new ForbiddenException({ ...NOT_A_MEMBER });
  }

  /** 위 `throwNotAMember()` 와 같은 이유로 판정문만 공유한다. */
  private throwAdminRequired(): never {
    throw new ForbiddenException({ ...ROLE_REQUIRED.admin });
  }

  /**
   * owner 이양 거부 — `transferOwnership` 의 인가 선행과 트랜잭션 안 락 재검사가 같은 문장을 낸다.
   * 코드는 가드와 같은 `OWNER_REQUIRED` 이고, 문장은 이 동작에 맞춘 서비스 고유 문구다.
   */
  private throwOwnerTransferRequired(): never {
    throw new ForbiddenException({
      ...ROLE_REQUIRED.owner,
      message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.',
    });
  }

  /**
   * 아래 두 검사(`assertMembership` · `assertAdmin`)는 경로 워크스페이스 라우트에서 `RolesGuard` 가
   * **같은 조회를 먼저 한다** — 요청당 멤버십 쿼리가 한 번 더 도는 것은 의도된 중복이다. 이 검사는
   * 가드 인식이 깨져 단축 통과가 일어날 때의 두 번째 선이고, 가드가 읽은 role 을 넘겨받으면 그 선이
   * 가드에 기대게 돼 독립성을 잃는다(`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터
   * 워크스페이스도 가드가 본다" — «서비스 계층 검사는 남는다»).
   */
  private async assertMembership(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) this.throwNotAMember();
  }

  private async assertAdmin(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const role = await this.getMemberRole(workspaceId, userId);
    // 비멤버는 요구 역할과 무관하게 NOT_A_MEMBER — `RolesGuard` 와 같은 규칙(`12-workspace.md`
    // §Rationale "가드 거부의 오류 코드" 규칙 (나)). 두 선이 같은 실패에 같은 답을 낸다.
    if (!role) this.throwNotAMember();
    if (!ADMIN_ROLES.has(role)) this.throwAdminRequired();
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
