import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  DataSource,
  type DataSourceOptions,
  EntitySchema,
  IsNull,
} from 'typeorm';
import { ROOT_ENTITIES } from './root-entities';
import {
  buildRootTypeOrmOptions,
  INVALID_WHERE_VALUES_BEHAVIOR,
} from './typeorm-options';

const configOf = (values: Record<string, unknown>): ConfigService =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

const CONFIG = {
  'database.host': 'db',
  'database.port': 5432,
  'database.username': 'u',
  'database.password': 'p',
  'database.database': 'clemvion',
  'database.poolMax': 20,
  'database.poolIdleTimeoutMs': 10000,
  'database.poolConnectionTimeoutMs': 5000,
};

describe('buildRootTypeOrmOptions', () => {
  let options: TypeOrmModuleOptions;

  beforeAll(() => {
    options = buildRootTypeOrmOptions(configOf(CONFIG));
  });

  it('where 의 null · undefined 를 예외로 던지게 설정한다', () => {
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

  describe('logging 은 NODE_ENV=development 에서만 켠다', () => {
    const original = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = original;
    });

    it.each([
      ['development', true],
      ['production', false],
      ['test', false],
    ])('NODE_ENV=%s → logging %s', (env, expected) => {
      process.env.NODE_ENV = env;
      expect(buildRootTypeOrmOptions(configOf(CONFIG)).logging).toBe(expected);
    });
  });
});

/**
 * 설정값이 DataSource 까지 가서 실제로 던지는지 본다. DB 에 연결하지 않고 메타데이터만 빌드해
 * `setFindOptions`(find 계열과 같은 where 변환)로 쿼리를 만든다.
 */
describe('루트 옵션의 where 처리 (DataSource 메타데이터만, DB 연결 없음)', () => {
  class MetadataOnlyDataSource extends DataSource {
    prepareMetadata(): Promise<void> {
      return this.buildMetadatas();
    }
  }

  interface Probe {
    id: string;
    acceptedAt: Date | null;
  }
  const ProbeSchema = new EntitySchema<Probe>({
    name: 'Probe',
    tableName: 'probe',
    columns: {
      id: { type: 'uuid', primary: true },
      acceptedAt: { type: 'timestamptz', nullable: true, name: 'accepted_at' },
    },
  });

  let ds: MetadataOnlyDataSource;

  beforeAll(async () => {
    const root = buildRootTypeOrmOptions(configOf(CONFIG));
    ds = new MetadataOnlyDataSource({
      ...root,
      entities: [ProbeSchema],
    } as DataSourceOptions);
    await ds.prepareMetadata();
  });

  const queryWith = (where: Record<string, unknown>): string =>
    ds
      .createQueryBuilder(ProbeSchema, 'p')
      .setFindOptions({ where: where as never })
      .getQuery();

  it('undefined 값은 던진다', () => {
    expect(() => queryWith({ id: undefined })).toThrow(/undefined value/i);
  });

  it('null 값은 던진다', () => {
    expect(() => queryWith({ acceptedAt: null })).toThrow(/null value/i);
  });

  it('IsNull() 은 SQL IS NULL 이 된다', () => {
    expect(queryWith({ acceptedAt: IsNull() })).toMatch(
      /accepted_at"? IS NULL/i,
    );
  });
});
