import { Reflector } from '@nestjs/core';
import { FoldersController } from './folders.controller';
import { ROLES_KEY } from '../../common/guards/roles.guard';

describe('FoldersController — @Roles metadata', () => {
  const reflector = new Reflector();

  const cases: { method: keyof FoldersController; expected: string[] }[] = [
    { method: 'create', expected: ['editor'] },
    { method: 'update', expected: ['editor'] },
    { method: 'remove', expected: ['editor'] },
  ];

  it.each(cases)(
    '$method 는 @Roles($expected) 로 가드된다',
    ({ method, expected }) => {
      const handler = FoldersController.prototype[method];
      const roles = reflector.get<string[]>(ROLES_KEY, handler);
      expect(roles).toEqual(expected);
    },
  );

  it('read 엔드포인트(findAll/findOne) 는 @Roles 미적용 — viewer 도 접근 가능', () => {
    expect(
      reflector.get<string[]>(ROLES_KEY, FoldersController.prototype.findAll),
    ).toBeUndefined();
    expect(
      reflector.get<string[]>(ROLES_KEY, FoldersController.prototype.findOne),
    ).toBeUndefined();
  });
});
