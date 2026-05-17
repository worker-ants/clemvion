/**
 * AuthConfig.config 평문 → AES-256-GCM 재암호화 1회용 스크립트.
 *
 * 사용 (개발, ts-node):
 *   INTEGRATION_ENCRYPTION_KEY=<32byte-hex> \
 *     npx ts-node codebase/backend/src/scripts/encrypt-auth-config.ts
 *
 * 사용 (운영, 컴파일된 dist 산출물):
 *   docker compose exec backend npm run encrypt-auth-config
 *   # 또는 dist 직접:
 *   INTEGRATION_ENCRYPTION_KEY=... node codebase/backend/dist/scripts/encrypt-auth-config.js
 *
 * 동작:
 *   - 모든 auth_config row 를 entity 로 읽고 save() 호출
 *   - transformer 가 평문이면 암호화, 이미 enc:v1: 프리픽스면 그대로 (idempotent)
 *   - 실패 시 row id 출력 후 계속 (graceful per-row)
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { AuthConfig } from '../modules/auth-configs/entities/auth-config.entity';

// Load `codebase/backend/.env` relative to this script so the CLI works from any CWD.
// `dotenv.config` does not override values already in process.env, so Docker
// env injection and inline overrides keep winning.
{
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error && require.main === module) {
    console.warn(
      `[encrypt-auth-config] .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
    );
  }
}

async function main(): Promise<void> {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    console.error(
      'INTEGRATION_ENCRYPTION_KEY must be set (>= 32 bytes) before running this script.',
    );
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'workflow',
    password: process.env.DB_PASSWORD ?? 'workflow_dev',
    database: process.env.DB_DATABASE ?? 'workflow',
    entities: [AuthConfig],
    synchronize: false,
  });
  await dataSource.initialize();
  const repo = dataSource.getRepository(AuthConfig);

  const rows = await repo.find();
  console.log(`Scanning ${rows.length} auth_config row(s)…`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      // save() 가 transformer.to() 를 호출해 자동으로 enc: envelope 로 직렬화한다.
      // 이미 객체 형태로 들어와 있던 행도 동일 경로로 다시 저장 → 암호화.
      await repo.save(row);
      migrated += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `[encrypt-auth-config] row ${row.id} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `Done. migrated=${migrated} skipped=${skipped} failed=${failed} total=${rows.length}`,
  );
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
