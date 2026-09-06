import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import {
  USER_SECRET_KEYS,
  expectNoUserSecrets,
  findUserSecretLeaks,
} from './user-secret-absence';

/**
 * 단언 헬퍼 자신의 회귀 가드.
 *
 * 이 헬퍼가 무르게 바뀌면 그것을 부르는 모든 e2e 가 **동시에** 조용히 통과한다. 그래서
 * 통과 경로만 보지 않고 **실패해야 하는 경로**를 각각 문다 (자매 헬퍼
 * `schedule-trigger-ref.spec.ts` 와 같은 이유).
 */
describe('findUserSecretLeaks', () => {
  it('깨끗한 응답에는 아무것도 없다', () => {
    expect(
      findUserSecretLeaks({
        data: { items: [{ id: 'u1', name: 'a', email: 'a@b.c' }] },
      }),
    ).toEqual([]);
  });

  it('민감 7컬럼을 **각각** 잡는다 — 하나라도 목록에서 빠지면 여기서 걸린다', () => {
    for (const key of USER_SECRET_KEYS) {
      expect(findUserSecretLeaks({ data: { user: { [key]: 'x' } } })).toEqual([
        `data.user.${key}`,
      ]);
    }
  });

  it('**최상위**(봉투 없음)에 와도 잡는다 — 경로가 빈 문자열이 되는 자리다', () => {
    // 실 응답은 전부 `{ data: … }` 봉투라 이 분기가 fixture 로 관측되지 않고 있었다
    // (`review/code/2026/09/06/13_39_20` INFO#15). 봉투를 벗기는 헬퍼나 raw 반환이
    // 생기면 곧바로 이 형태가 되므로, 경로 조립이 depth 0 에서도 성립하는지 문는다.
    expect(findUserSecretLeaks({ passwordHash: 'x' })).toEqual([
      'passwordHash',
    ]);
  });

  it('중첩·배열 안쪽도 훑는다 — 유출은 최상위가 아니라 거기서 났다', () => {
    const body = {
      data: { items: [{ id: 'a' }, { id: 'b', user: { passwordHash: 'x' } }] },
    };
    expect(findUserSecretLeaks(body)).toEqual([
      'data.items[1].user.passwordHash',
    ]);
  });

  it('snake_case 로 나가는 형태도 막는다 (raw 쿼리 결과 경로)', () => {
    expect(
      findUserSecretLeaks({ data: { user: { password_hash: 'x' } } }),
    ).toEqual(['data.user.password_hash']);
  });

  it('여러 건이면 경로를 전부 돌려준다 — 하나만 고치고 끝내지 않도록', () => {
    const body = {
      data: {
        user: { passwordHash: 'x', twoFactorSecret: 'y' },
      },
    };
    expect(findUserSecretLeaks(body).sort()).toEqual([
      'data.user.passwordHash',
      'data.user.twoFactorSecret',
    ]);
  });

  it('`null` 값이어도 **키가 있으면** 잡는다 — 키 존재 자체가 계약 위반이다', () => {
    expect(
      findUserSecretLeaks({ data: { user: { passwordHash: null } } }),
    ).toEqual(['data.user.passwordHash']);
  });

  it('이름이 비슷할 뿐인 키는 놓아 준다', () => {
    expect(
      findUserSecretLeaks({
        data: { hasPassword: true, passwordChangedAt: 't', userEmail: 'a' },
      }),
    ).toEqual([]);
  });

  it('원시값·null 을 넘겨도 터지지 않는다', () => {
    expect(findUserSecretLeaks(null)).toEqual([]);
    expect(findUserSecretLeaks('passwordHash')).toEqual([]);
    expect(findUserSecretLeaks(42)).toEqual([]);
  });

  it('expectNoUserSecrets 는 위반이 있으면 던진다', () => {
    expect(() =>
      expectNoUserSecrets({ data: { user: { passwordHash: 'x' } } }),
    ).toThrow();
    expect(() =>
      expectNoUserSecrets({ data: { user: { id: 'u1' } } }),
    ).not.toThrow();
  });
});

/**
 * **목록을 손으로 적었으면 소스와 대조해야 한다.**
 *
 * 이 PR 의 형제 가드(`user-entity-exposure-guard.ts`)는 관계 이름을 엔티티 **타입 주석에서
 * 파생**한다 — 손으로 적은 목록이 한 칸 좁아 살아있는 유출을 놓쳤기 때문이다. 그런데 값 축인
 * `USER_SECRET_KEYS` 는 여전히 손으로 적혀 있고 엔티티와 대조하는 테스트가 **0건**이었다.
 * 같은 PR 안에서 원칙이 갈렸다 (`review/code/2026/09/06/14_59_48` W2).
 *
 * 파생을 그대로 옮길 수는 없다 — "민감함" 은 타입이 아니라 **의미**라 AST 로 판정되지 않는다.
 * 대신 두 방향을 건다:
 *
 * 1. **패턴 부분집합** — 이름이 비밀 형태(`*Hash`·`*Secret`·`*Token`·`*RecoveryCodes`)인
 *    컬럼은 전부 목록에 있어야 한다. 아는 형태는 확실히 잡는다.
 * 2. **컬럼 수 카나리아** — 형태를 모르는 새 비밀 컬럼(`ssn` 같은)은 1번이 못 본다.
 *    총 컬럼 수가 바뀌면 실패해 **사람이 한 번 보게** 만든다. 키워드 목록을 넓히는 것은
 *    다음 키워드를 모르므로 원리적으로 닫히지 않는다 — 그 자리를 이 카나리아가 맡는다.
 */
describe('USER_SECRET_KEYS ↔ user.entity.ts 대조', () => {
  const ENTITY = path.join(
    __dirname,
    '..',
    '..',
    'modules',
    'users',
    'entities',
    'user.entity.ts',
  );

  /** `@Column(...)` 데코레이터가 달린 프로퍼티 이름 전부. */
  function entityColumnNames(): string[] {
    const sf = ts.createSourceFile(
      ENTITY,
      fs.readFileSync(ENTITY, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const names: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyDeclaration(node) && node.name) {
        const decorated = ts
          .getDecorators(node)
          ?.some((d) => d.getText(sf).startsWith('@Column'));
        if (decorated) names.push(node.name.getText(sf));
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    return names;
  }

  const SECRET_SHAPE = /(Hash|Secret|Token|RecoveryCodes)$/;

  it('[전제] 엔티티 스캔이 비어 있지 않다 — 0건이면 아래 단언이 조용히 통과한다', () => {
    expect(entityColumnNames().length).toBeGreaterThan(10);
  });

  it('비밀 형태 이름의 컬럼은 하나도 빠짐없이 목록에 있다', () => {
    const shaped = entityColumnNames().filter((n) => SECRET_SHAPE.test(n));
    const missing = shaped.filter(
      (n) => !(USER_SECRET_KEYS as readonly string[]).includes(n),
    );
    expect(missing).toEqual([]);
    // 반대 방향 — 목록에만 있고 엔티티에 없는 유령 항목도 잡는다.
    const columns = new Set(entityColumnNames());
    expect(USER_SECRET_KEYS.filter((k) => !columns.has(k))).toEqual([]);
  });

  it('[카나리아] 엔티티 컬럼 수가 바뀌면 목록을 다시 본다', () => {
    // 형태를 모르는 새 비밀 컬럼(`ssn`·`recoveryEmail` 등)은 위 패턴이 못 본다.
    // 이 숫자가 틀리면 **컬럼이 늘거나 줄었다는 뜻**이니, 목록을 갱신하거나 이 수를
    // 갱신하면서 한 번 확인하게 된다. 2026-09-06 실측.
    expect(entityColumnNames()).toHaveLength(23);
  });
});
