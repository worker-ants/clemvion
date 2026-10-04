import { ConfigService } from '@nestjs/config';
import { ROOT_ENTITIES } from './root-entities';
import {
  buildRootTypeOrmOptions,
  INVALID_WHERE_VALUES_BEHAVIOR,
} from './typeorm-options';

const configOf = (values: Record<string, unknown>): ConfigService =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

describe('buildRootTypeOrmOptions', () => {
  const options = buildRootTypeOrmOptions(
    configOf({
      'database.host': 'db',
      'database.port': 5432,
      'database.username': 'u',
      'database.password': 'p',
      'database.database': 'clemvion',
      'database.poolMax': 20,
      'database.poolIdleTimeoutMs': 10000,
      'database.poolConnectionTimeoutMs': 5000,
    }),
  );

  it('where 의 null · undefined 는 조용히 빼지 않고 예외로 던진다', () => {
    // typeorm 0.3 은 그 조건을 빼고 조회해 범위가 넓어졌다(예: workspaceId 가 undefined 면 전 워크스페이스).
    // 1.x 기본값과 같지만 결정을 코드에 남기려고 명시한다(NERV Task CLE-T-91JNWW).
    expect(INVALID_WHERE_VALUES_BEHAVIOR).toEqual({
      null: 'throw',
      undefined: 'throw',
    });
    expect(options).toMatchObject({
      invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
    });
  });

  it('스키마는 Flyway 가 관리하므로 synchronize 를 켜지 않는다', () => {
    expect(options).toMatchObject({ type: 'postgres', synchronize: false });
  });

  it('접속 · 풀 설정과 루트 엔티티를 그대로 넘긴다', () => {
    expect(options).toMatchObject({
      host: 'db',
      port: 5432,
      username: 'u',
      password: 'p',
      database: 'clemvion',
      extra: {
        max: 20,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      },
    });
    expect(options.entities).toEqual([...ROOT_ENTITIES]);
  });
});
