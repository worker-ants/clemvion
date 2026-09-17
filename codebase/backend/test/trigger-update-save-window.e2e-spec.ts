import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { ROOT_ENTITIES } from '../src/database/root-entities';
import { Trigger } from '../src/modules/triggers/entities/trigger.entity';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * **창 1(`TriggersService.update()`)이 왜 부분 객체로 `save` 해야 하는가** — 그 근거를 실제
 * Postgres + TypeORM 에서 고정하는 특성 테스트.
 *
 * 창 1 은 advisory lock 안에서 행을 재읽고 저장한다. 그 **재읽기와 저장 사이**의 창은 HTTP 로
 * 열 수 없다 — 락은 읽기 *전에* 잡히므로 테스트가 락을 쥐어도 PATCH 는 재읽기 이전에 멈춘다.
 * 운영 코드에 대기 훅을 넣는 대신, TypeORM 을 직접 붙여 창을 결정적으로 재현한다:
 * 트랜잭션 A 재읽기 → 연결 B 경합 커밋 → A 저장.
 *
 * **이 파일이 단언하는 것은 TypeORM·Postgres 의 동작이지 우리 코드가 아니다.** 우리 코드가
 * 부분 객체를 넘기는지는 `triggers.service.spec.ts` 의 «저장 대상은 이 요청이 바꾸는 필드뿐»
 * 이 본다. 둘이 짝을 이뤄야 «창 1 은 락 밖 컬럼을 되돌리지 않는다» 가 성립한다 — TypeORM 이
 * 바뀌어 ②b 의 보존이 깨지면 이 파일이 먼저 RED 가 된다.
 *
 * **인접 파일과의 경계**: `trigger-config-lost-update.e2e-spec.ts` 는 **`config` JSONB 병합**의
 * 경합(두 PATCH 가 서로의 키를 되돌리는가)을 HTTP 로 본다. 이 파일은 **`config` 밖 컬럼**과
 * **FK CASCADE** 가 재읽기 뒤 끼어드는 창을 ORM 수준에서 본다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

interface DbError {
  name?: string;
  code?: string;
  driverError?: { code?: string };
}

describe('창 1 save — 재읽기 뒤 경합 (TypeORM + Postgres 특성)', () => {
  let db: Client;
  let ds: DataSource;
  let token: string;
  let workspaceId: string;

  async function createWorkflowAndTrigger(tag: string) {
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName(`save-window-wf-${tag}`) });
    const workflowId = wf.body.data.id as string;
    const tr = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName(`save-window-tr-${tag}`),
        endpointPath: crypto.randomUUID(),
      });
    expect(tr.status).toBe(201);
    return { workflowId, triggerId: tr.body.data.id as string };
  }

  /** 창 1 과 같은 재읽기 — 관계까지 싣는다. */
  function rereadLikeWindow1(m: DataSource['manager'], triggerId: string) {
    return m.findOne(Trigger, {
      where: { id: triggerId, workspaceId },
      relations: ['workflow'],
    });
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    ds = new DataSource({
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
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('save-window'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('SAVEWIN'),
    );
  }, 60_000);

  afterAll(async () => {
    await ds?.destroy().catch(() => undefined);
    await db?.end().catch(() => undefined);
  });

  describe('① 재읽기 뒤 workflow 삭제 (FK CASCADE — advisory lock 으로 못 막는 경로)', () => {
    async function saveAfterCascade(
      build: (fresh: Trigger) => Partial<Trigger>,
    ) {
      const { workflowId, triggerId } =
        await createWorkflowAndTrigger('cascade');
      let caught: DbError | null = null;
      await ds.manager
        .transaction(async (m) => {
          const fresh = await rereadLikeWindow1(m, triggerId);
          expect(fresh).not.toBeNull();
          await db.query('DELETE FROM workflow WHERE id = $1', [workflowId]);
          await m.save(Trigger, build(fresh!));
        })
        .catch((err: DbError) => {
          caught = err;
        });
      const after = await db.query('SELECT id FROM trigger WHERE id = $1', [
        triggerId,
      ]);
      return { caught: caught as DbError | null, rowsAfter: after.rowCount };
    }

    it('통째 엔티티 — FK 위반으로 시끄럽게 실패하고 되살아나지 않는다', async () => {
      const { caught, rowsAfter } = await saveAfterCascade((fresh) =>
        Object.assign(fresh, { name: 'renamed-after-cascade' }),
      );
      expect(caught?.name).toBe('QueryFailedError');
      expect(caught?.code ?? caught?.driverError?.code).toBe('23503');
      expect(rowsAfter).toBe(0);
    });

    it('부분 객체(창 1 의 현재 형태) — 여전히 시끄럽게 실패하고 되살아나지 않는다', async () => {
      const { caught, rowsAfter } = await saveAfterCascade((fresh) => ({
        id: fresh.id,
        name: 'renamed-after-cascade',
        config: fresh.config ?? {},
      }));
      // 부분 객체는 INSERT 로 넘어가면 NOT NULL(`workspace_id`·`workflow_id`·`type`)부터 걸린다 —
      // 코드가 23503(FK)이 아니라 23502 로 바뀐다. **어느 쪽이든 롤백이고 부활은 없다**; 코드를
      // 고정해 두는 것은 이 차이가 우연이 아니라 부분 객체의 결과임을 적어 두기 위해서다.
      expect(caught?.name).toBe('QueryFailedError');
      expect(caught?.code ?? caught?.driverError?.code).toBe('23502');
      expect(rowsAfter).toBe(0);
    });
  });

  describe('② 재읽기 뒤 락 밖 컬럼 한정 갱신', () => {
    async function saveAfterColumnWrite(
      build: (fresh: Trigger) => Partial<Trigger>,
    ) {
      const { triggerId } = await createWorkflowAndTrigger('column');
      await ds.manager.transaction(async (m) => {
        const fresh = await rereadLikeWindow1(m, triggerId);
        await db.query(
          "UPDATE trigger SET notification_secret_v2 = 'v2-from-B', last_triggered_at = now() WHERE id = $1",
          [triggerId],
        );
        await m.save(Trigger, build(fresh!));
      });
      const after = await db.query<{
        name: string;
        config: Record<string, unknown>;
        notification_secret_v2: string | null;
        last_triggered_at: Date | null;
      }>(
        'SELECT name, config, notification_secret_v2, last_triggered_at FROM trigger WHERE id = $1',
        [triggerId],
      );
      return after.rows[0];
    }

    it('통째 엔티티 — 락 밖 커밋이 **옛 값으로 되돌아간다** (창 1 이 부분 객체여야 하는 이유)', async () => {
      const row = await saveAfterColumnWrite((fresh) =>
        Object.assign(fresh, { name: 'renamed-race' }),
      );
      expect(row.name).toBe('renamed-race');
      expect(row.notification_secret_v2).toBeNull();
      expect(row.last_triggered_at).toBeNull();
    });

    it('부분 객체의 save 반환값은 DB 재조회가 아니다 — 넘기지 않은 컬럼은 null 로 온다', async () => {
      // 이 반환값을 재읽은 엔티티에 통째로 덮으면 실값이 `null` 로 지워진다 — 창 1 이 한때
      // 그렇게 해서 `endpointPath` 를 지우고 `chatChannel` PATCH 를 전부 400 으로 만들었다.
      // 창 1 이 반환값에서 `updatedAt` 하나만 취하는 근거를 고정한다.
      const { triggerId } = await createWorkflowAndTrigger('written');
      await db.query(
        "UPDATE trigger SET notification_secret_v2 = 'v2-in-db' WHERE id = $1",
        [triggerId],
      );
      const written = await ds.manager.save(Trigger, {
        id: triggerId,
        name: 'written-probe',
        config: {},
      });
      const row = await db.query<{
        endpoint_path: string | null;
        notification_secret_v2: string | null;
      }>(
        'SELECT endpoint_path, notification_secret_v2 FROM trigger WHERE id = $1',
        [triggerId],
      );
      expect(row.rows[0].notification_secret_v2).toBe('v2-in-db');
      expect(row.rows[0].endpoint_path).not.toBeNull();
      expect(written.notificationSecretV2).toBeNull();
      expect(written.endpointPath).toBeNull();
      expect(written.updatedAt).toBeInstanceOf(Date);
    });

    it('부분 객체 — 락 밖 커밋이 보존되고 이 요청의 변경만 반영된다', async () => {
      const row = await saveAfterColumnWrite((fresh) => ({
        id: fresh.id,
        name: 'renamed-partial',
        config: { ...(fresh.config ?? {}), fromA: 'yes' },
      }));
      expect(row.notification_secret_v2).toBe('v2-from-B');
      expect(row.last_triggered_at).not.toBeNull();
      expect(row.name).toBe('renamed-partial');
      expect(row.config).toMatchObject({ fromA: 'yes' });
    });
  });

  it('③ 없는 행 update 의 affected 는 0 이다 (`rewriteTriggerConfigLocked` 의 0행 판정 근거)', async () => {
    const r = await ds.manager.update(
      Trigger,
      { id: crypto.randomUUID() },
      { name: 'nobody' },
    );
    expect(r.affected).toBe(0);
  });
});
