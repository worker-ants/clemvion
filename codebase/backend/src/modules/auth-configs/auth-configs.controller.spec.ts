import { Reflector } from '@nestjs/core';
import { AuthConfigsController } from './auth-configs.controller';
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
