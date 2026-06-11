import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthConfigsController } from './auth-configs.controller';
import { AuthConfigsService } from './auth-configs.service';
import { ROLES_KEY } from '../../common/guards/roles.guard';

describe('AuthConfigsController — @Roles metadata', () => {
  const reflector = new Reflector();

  // Auth Config CRUD 는 spec 인증 §3.2 권한 매트릭스상 Admin+ (Editor=R). 자격증명
  // 생성·수정·삭제·재발급·평문노출 모두 Admin 이상으로 가드한다.
  const cases: { method: keyof AuthConfigsController; expected: string[] }[] = [
    { method: 'create', expected: ['admin'] },
    { method: 'update', expected: ['admin'] },
    { method: 'regenerate', expected: ['admin'] },
    { method: 'remove', expected: ['admin'] },
    { method: 'reveal', expected: ['admin'] },
  ];

  it.each(cases)(
    '$method 는 @Roles($expected) 로 가드된다',
    ({ method, expected }) => {
      const handler = AuthConfigsController.prototype[method];
      const roles = reflector.get<string[]>(ROLES_KEY, handler);
      expect(roles).toEqual(expected);
    },
  );

  it('read 엔드포인트(findAll/findOne/getUsage) 는 @Roles 미적용 — viewer 도 접근 가능', () => {
    expect(
      reflector.get<string[]>(
        ROLES_KEY,
        AuthConfigsController.prototype.findAll,
      ),
    ).toBeUndefined();
    expect(
      reflector.get<string[]>(
        ROLES_KEY,
        AuthConfigsController.prototype.findOne,
      ),
    ).toBeUndefined();
    expect(
      reflector.get<string[]>(
        ROLES_KEY,
        AuthConfigsController.prototype.getUsage,
      ),
    ).toBeUndefined();
  });
});

// CRUD 핸들러가 @CurrentUser('sub') 와 req.ip 를 service 로 그대로 전파하는지 — 감사
// 로그(auth_config.*)의 주체·IP 가 핸들러 인자 위치에서 누락·스왑되지 않음을 보장한다.
describe('AuthConfigsController — userId/req.ip 전파', () => {
  const WS = 'ws-1';
  const USER = 'user-1';
  const IP = '1.2.3.4';
  const req = { ip: IP } as Request;

  let service: jest.Mocked<
    Pick<
      AuthConfigsService,
      'create' | 'update' | 'regenerate' | 'remove' | 'reveal'
    >
  >;
  let controller: AuthConfigsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      regenerate: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      reveal: jest.fn().mockResolvedValue({ config: {} }),
    } as never;
    controller = new AuthConfigsController(service as never);
  });

  it('create → service.create(workspaceId, body, userId, req.ip)', async () => {
    const body = { type: 'api_key' } as never;
    await controller.create(WS, body, USER, req);
    expect(service.create).toHaveBeenCalledWith(WS, body, USER, IP);
  });

  it('update → service.update(id, workspaceId, body, userId, req.ip)', async () => {
    const body = { name: 'x' } as never;
    await controller.update('ac-1', WS, body, USER, req);
    expect(service.update).toHaveBeenCalledWith('ac-1', WS, body, USER, IP);
  });

  it('regenerate → service.regenerate(id, workspaceId, userId, req.ip)', async () => {
    await controller.regenerate('ac-1', WS, USER, req);
    expect(service.regenerate).toHaveBeenCalledWith('ac-1', WS, USER, IP);
  });

  it('remove → service.remove(id, workspaceId, userId, req.ip)', async () => {
    await controller.remove('ac-1', WS, USER, req);
    expect(service.remove).toHaveBeenCalledWith('ac-1', WS, USER, IP);
  });

  it('reveal → service.reveal(id, workspaceId, userId, password, req.ip)', async () => {
    await controller.reveal('ac-1', WS, USER, { password: 'pw' } as never, req);
    expect(service.reveal).toHaveBeenCalledWith('ac-1', WS, USER, 'pw', IP);
  });

  it('req.ip 미설정(trust proxy off) 시 undefined 를 그대로 전파', async () => {
    await controller.create(WS, { type: 'api_key' } as never, USER, {
      ip: undefined,
    } as Request);
    expect(service.create).toHaveBeenCalledWith(
      WS,
      expect.anything(),
      USER,
      undefined,
    );
  });
});
