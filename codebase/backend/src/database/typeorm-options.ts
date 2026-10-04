import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ROOT_ENTITIES } from './root-entities';

/**
 * find 계열 · update · delete 의 where 에 null · undefined 값이 들어오면 예외로 던진다.
 *
 * typeorm 0.3 은 그 조건을 조용히 빼고 조회했다. 그래서 `{ id, workspaceId }` 의 `workspaceId` 가 undefined 면
 * 워크스페이스 조건 없이 조회되는 식으로 범위가 넓어질 수 있었다. 1.x 기본값과 같지만 결정을 코드에 남기려고
 * 명시한다(NERV Task CLE-T-91JNWW). SQL 의 IS NULL 이 필요하면 `IsNull()` 을 쓴다.
 * QueryBuilder 의 `.where()` · `.andWhere()` 는 이 설정의 영향을 받지 않는다.
 */
export const INVALID_WHERE_VALUES_BEHAVIOR = {
  null: 'throw',
  undefined: 'throw',
} as const;

/** 앱 루트 `TypeOrmModule.forRootAsync` 의 옵션. */
export function buildRootTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.username'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.database'),
    entities: [...ROOT_ENTITIES],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    invalidWhereValuesBehavior: INVALID_WHERE_VALUES_BEHAVIOR,
    // M-5: node-postgres pool 튜닝을 env 로 노출 (database.config). 기본값은
    // 현 동작(pg 기본 max=10)과 동일 — 배포 무변경. 운영이 pg_stat_activity
    // 피크 측정 후 env 만으로 상향 가능 (max_connections 역산 필수).
    extra: {
      max: configService.get<number>('database.poolMax'),
      idleTimeoutMillis: configService.get<number>(
        'database.poolIdleTimeoutMs',
      ),
      connectionTimeoutMillis: configService.get<number>(
        'database.poolConnectionTimeoutMs',
      ),
    },
  };
}
