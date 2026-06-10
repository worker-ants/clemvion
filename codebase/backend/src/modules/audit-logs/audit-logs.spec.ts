import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from './entities/audit-log.entity';
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
    leftJoinAndSelect: jest.Mock;
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
      leftJoinAndSelect: jest.fn().mockReturnThis(),
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
});
