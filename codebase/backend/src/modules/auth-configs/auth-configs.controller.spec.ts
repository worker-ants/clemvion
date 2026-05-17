import { Reflector } from '@nestjs/core';
import { AuthConfigsController } from './auth-configs.controller';
import { ROLES_KEY } from '../../common/guards/roles.guard';

describe('AuthConfigsController — @Roles metadata', () => {
  const reflector = new Reflector();

  const cases: { method: keyof AuthConfigsController; expected: string[] }[] = [
    { method: 'create', expected: ['editor'] },
    { method: 'update', expected: ['editor'] },
    // regenerate 는 키 교체로 외부 호출자 중단을 유발하므로 Admin+ 가드.
    { method: 'regenerate', expected: ['admin'] },
    { method: 'remove', expected: ['editor'] },
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
