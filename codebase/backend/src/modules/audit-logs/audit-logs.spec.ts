import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import { AuditLog } from './entities/audit-log.entity';
import { AUDIT_ACTIONS } from './audit-action.const';
import { ROLES_KEY } from '../../common/guards/roles.guard';

/**
 * [Spec Auth §4.2 / §5] GET /api/audit-logs — Admin+ 한정 + 사용자(userId) 필터.
 * 감사 보고 V-03: @Roles 부재 시 전역 RolesGuard 가 미지정 라우트를 통과시켜
 * 비멤버까지 열람 가능했던 보안 갭의 회귀 차단.
 */
describe('AuditLogsController — Admin+ 가드 (V-03)', () => {
  it('findAll 에 @Roles("admin") 메타데이터가 부착되어 있다', () => {
    const roles: string[] | undefined = Reflect.getMetadata(
      ROLES_KEY,
      AuditLogsController.prototype.findAll,
    ) as string[] | undefined;
    expect(roles).toBeDefined();
    expect(roles).toContain('admin');
  });
});

describe('AuditLogsService.findAll — 필터 (Spec Auth §4.2)', () => {
  let service: AuditLogsService;
  let qb: {
    leftJoin: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    offset: jest.Mock;
    limit: jest.Mock;
    getCount: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            createQueryBuilder: jest.fn(() => qb),
          } as unknown as Repository<AuditLog>,
        },
      ],
    }).compile();
    service = moduleRef.get(AuditLogsService);
  });

  it('userId 쿼리 전달 시 al.user_id 조건이 추가된다', async () => {
    await service.findAll('ws-1', {
      userId: 'a3a3a3a3-1111-2222-3333-444444444444',
    } as never);
    expect(qb.andWhere).toHaveBeenCalledWith('al.user_id = :userId', {
      userId: 'a3a3a3a3-1111-2222-3333-444444444444',
    });
  });

  it('userId 미전달 시 al.user_id 조건이 없다', async () => {
    await service.findAll('ws-1', {} as never);
    const clauses = qb.andWhere.mock.calls.map((c: unknown[]) => c[0]);
    expect(clauses).not.toContain('al.user_id = :userId');
  });

  /**
   * 이 컨트롤러는 엔티티를 그대로 반환하므로, join 이 `User` 를 통째로 실으면 그대로
   * 응답에 나간다 — 실제로 `passwordHash`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
   * `passwordResetToken` 을 포함한 26개 키가 나갔다(e2e 로 확인).
   *
   * e2e 에도 캐너리가 있지만 여기에도 두는 이유: 되돌리는 편집(`leftJoinAndSelect` 로
   * 복귀)은 이 파일 바로 옆에서 일어나고, 단위 층이 훨씬 빨리 말해 준다.
   */
  it('user 조인은 AuditLogUserDto 가 광고하는 3필드만 select 한다', async () => {
    await service.findAll('ws-1', {} as never);
    expect(qb.leftJoin).toHaveBeenCalledWith('al.user', 'user');
    expect(qb.addSelect).toHaveBeenCalledWith([
      'user.id',
      'user.name',
      'user.email',
    ]);
    // `*AndSelect` 계열은 전 컬럼을 싣는다 — mock 에 그 키 자체를 두지 않아, 되돌리면
    // "함수가 없다" 로 즉시 깨진다.
    expect(qb).not.toHaveProperty('leftJoinAndSelect');
  });
});

/**
 * record() 의 best-effort(swallow) 계약 — 감사 기록 실패가 주 동작(CRUD)을
 * 실패시키지 않아야 한다. 모든 audit producer(integrations/auth-configs/workspaces
 * 등)의 docstring 이 "swallow 는 여기서 검증" 이라 참조하므로, 그 계약의 단일
 * 회귀 방지 지점이다.
 */
describe('AuditLogsService.record — best-effort (swallow)', () => {
  function makeService(repo: {
    create: jest.Mock;
    save: jest.Mock;
  }): AuditLogsService {
    return new AuditLogsService(repo as unknown as Repository<AuditLog>);
  }

  const entry = {
    workspaceId: 'ws-1',
    userId: 'user-1',
    action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE,
    resourceType: 'auth_config',
    resourceId: 'ac-1',
  };

  it('save 가 reject 해도 예외를 삼키고 resolve 한다 (주 동작 비실패)', async () => {
    const repo = {
      create: jest.fn((d: unknown) => d),
      save: jest.fn().mockRejectedValue(new Error('audit DB unreachable')),
    };
    const service = makeService(repo);
    await expect(service.record(entry)).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('정상 경로에서는 save 된 로그를 기록한다', async () => {
    const repo = {
      create: jest.fn((d: unknown) => d),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = makeService(repo);
    await expect(service.record(entry)).resolves.toBeUndefined();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE,
        resourceId: 'ac-1',
      }),
    );
  });
});

/**
 * 삼킨 실패가 **보이는지** — swallow 계약의 나머지 절반.
 *
 * 위 스위트는 "실패해도 주 동작을 안 깨뜨린다" 를 고정한다. 그건 옳지만 절반이다.
 * 종전에는 나머지 절반이 `logger.warn` 한 줄뿐이라 **"작업은 200 으로 성공, 감사 행만
 * 조용히 비어 있음"** 이 아무에게도 안 보였다:
 *
 *   - 로그는 사후 조회만 되고 **비율·추세로 알람을 걸 수 없다**
 *   - 그 로그조차 **무엇이 유실됐는지** 안 적었다 — 에러 문구뿐이라 어느 감사가 사라졌는지
 *     알 수 없었다. 유실 사실만 알고 대상을 모르면 조사도 복구도 시작할 수 없다.
 *
 * 감사 로그는 "계정 탈취 후 조용한 시크릿 교체를 재구성한다" 는 신뢰를 지탱하는데, 그
 * 신뢰는 **적재가 실제로 됐을 때만** 성립한다. 여기서 그 갭이 보이는지를 고정한다.
 */
describe('AuditLogsService.record — 삼킨 실패의 관측', () => {
  const entry = {
    workspaceId: 'ws-1',
    userId: 'user-1',
    action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE,
    resourceType: 'auth_config',
    resourceId: 'ac-1',
  };

  function build(saveRejects: boolean) {
    const repo = {
      create: jest.fn((d: unknown) => d),
      save: saveRejects
        ? jest.fn().mockRejectedValue(new Error('audit DB unreachable'))
        : jest.fn().mockResolvedValue(undefined),
    };
    const metrics = { recordAuditWriteFailed: jest.fn() };
    const service = new AuditLogsService(
      repo as unknown as Repository<AuditLog>,
      metrics as unknown as BusinessMetricsService,
    );
    return { service, repo, metrics };
  }

  it('적재 실패를 카운터로 올린다 (알람을 걸 수 있게)', async () => {
    const { service, metrics } = build(true);
    await service.record(entry);
    expect(metrics.recordAuditWriteFailed).toHaveBeenCalledWith('auth_config');
  });

  it('정상 경로에서는 카운터를 올리지 않는다', async () => {
    // 이 단언이 없으면 "항상 올린다" 도 위 테스트를 통과한다.
    const { service, metrics } = build(false);
    await service.record(entry);
    expect(metrics.recordAuditWriteFailed).not.toHaveBeenCalled();
  });

  it('로그에 무엇이 유실됐는지 적는다 (action·resourceType·resourceId·workspaceId)', async () => {
    const { service } = build(true);
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      await service.record(entry);
      const msg = String(warn.mock.calls[0][0]);
      // 넷을 각각 단언한다 — 하나만 보면 나머지가 빠져도 통과한다.
      expect(msg).toContain(AUDIT_ACTIONS.AUTH_CONFIG_CREATE);
      expect(msg).toContain('auth_config');
      expect(msg).toContain('ac-1');
      expect(msg).toContain('ws-1');
      // 원인도 여전히 남아야 한다.
      expect(msg).toContain('audit DB unreachable');
    } finally {
      warn.mockRestore();
    }
  });

  it('metrics 호출이 던져도 삼킨다 — 관측이 새 실패 경로가 되면 안 된다', async () => {
    // 이 메서드의 존재 이유가 "감사 실패가 본 요청을 절대 깨뜨리지 않는다" 인데, 관측을
    // 붙이면서 관측이 그 계약을 역행하면 본말전도다. 12개+ 특권 CRUD producer 가 이
    // chokepoint 를 지난다.
    const repo = {
      create: jest.fn((d: unknown) => d),
      save: jest.fn().mockRejectedValue(new Error('audit DB unreachable')),
    };
    const metrics = {
      recordAuditWriteFailed: jest.fn(() => {
        throw new Error('meter exploded');
      }),
    };
    const service = new AuditLogsService(
      repo as unknown as Repository<AuditLog>,
      metrics as unknown as BusinessMetricsService,
    );
    await expect(service.record(entry)).resolves.toBeUndefined();
    expect(metrics.recordAuditWriteFailed).toHaveBeenCalled();
  });

  it('metrics provider 없이 DI 조립이 성공한다 (@Optional)', async () => {
    // **DI 를 실제로 태운다.** 종전에는 `new AuditLogsService(repo)` 로 생성자를 직접
    // 불러서 `@Optional()` 이 있든 없든 항상 통과했다 — 이름은 `@Optional` 회귀라면서
    // 정작 그 데코레이터를 안 물었다. 뮤테이션으로 확인하니 RED 를 내는 것은 이 테스트가
    // 아니라 **무관한 `findAll` DI 스위트**였고, 그 스위트가 리팩터되면 이 계약은 아무도
    // 안 지키게 된다(리뷰 3라운드 실측).
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        // BusinessMetricsService 를 **일부러 넣지 않는다** — 없어도 조립돼야 한다.
      ],
    }).compile();
    expect(moduleRef.get(AuditLogsService)).toBeInstanceOf(AuditLogsService);
  });

  it('metrics 없이도 감사 기록은 동작한다 (런타임)', async () => {
    // 관측이 없다고 감사가 멈추면 본말이 뒤집힌다.
    const repo = {
      create: jest.fn((d: unknown) => d),
      save: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const service = new AuditLogsService(
      repo as unknown as Repository<AuditLog>,
    );
    await expect(service.record(entry)).resolves.toBeUndefined();
  });
});
