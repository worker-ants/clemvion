import { Client } from 'pg';
import { DataSource } from 'typeorm';

import { ROOT_ENTITIES } from '../../src/database/root-entities';
import { Integration } from '../../src/modules/integrations/entities/integration.entity';
import { IntegrationExpiryScannerService } from '../../src/modules/integrations/integration-expiry-scanner.service';

/** 이 도우미가 설치 토큰 발급 시각으로 쓰는 과거 시각. 실제 행의 발급 시각은 이보다 늘 늦다. */
const BACKDATED_ISSUED_AT = new Date('2000-01-01T00:00:00Z');
/** 스캔 기준 시각. 설치 대기 기한(24시간)이 `BACKDATED_ISSUED_AT` 행만 막 지난 시각이다. */
const SCAN_NOW = new Date('2000-01-02T00:00:01Z');

/**
 * 설치 대기 행 `ids` 의 설치 기한을 지나게 한 뒤 만료 스캐너의 `expirePendingInstalls` 를 테스트 프로세스에서 한 번
 * 돌린다. 만료 처리를 SQL 로 흉내 내지 않고 스캐너 코드를 그대로 지나게 하려는 것이다(REQ-INTSTAT-040).
 *
 * 스캐너는 워크스페이스를 가리지 않고 기한이 지난 설치 대기 행을 전부 바꾼다. 그래서 발급 시각을 2000-01-01 로 옮기고
 * 그 행만 기한을 막 넘긴 시각(`SCAN_NOW`)으로 스캔한다. 다른 테스트가 남긴 행은 발급 시각이 그보다 늦어 걸리지 않는다.
 * 스캐너가 쓰는 의존성은 통합 저장소 하나라 나머지 생성자 인자는 비워 둔다.
 *
 * @returns 스캐너가 바꾼 행 수. 호출부는 `ids.length` 와 같은지 본다.
 */
export async function expirePendingInstallsNow(
  db: Client,
  ids: string[],
): Promise<number> {
  await db.query(
    `UPDATE integration SET install_token_issued_at = $2
      WHERE id = ANY($1) AND status = 'pending_install'`,
    [ids, BACKDATED_ISSUED_AT],
  );
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'postgres',
    port: Number(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME ?? 'clemvion',
    password: process.env.DB_PASSWORD ?? 'clemvion-e2e',
    database: process.env.DB_DATABASE ?? 'clemvion_e2e',
    // `ROOT_ENTITIES` 는 `readonly` 튜플이라 펼쳐 넘긴다 — `app.module.ts` 와 같은 형태.
    entities: [...ROOT_ENTITIES],
    synchronize: false,
  });
  await ds.initialize();
  try {
    const scanner = new IntegrationExpiryScannerService(
      ds.getRepository(Integration),
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
    );
    return await scanner.expirePendingInstalls(SCAN_NOW);
  } finally {
    await ds.destroy();
  }
}
