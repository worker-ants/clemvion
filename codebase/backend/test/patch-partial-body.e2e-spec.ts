import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
} from '../src/shared/testing/response-contract';
import { WorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';
import { NodeDto } from '../src/modules/nodes/dto/responses/node-response.dto';
import { AuthConfigDto } from '../src/modules/auth-configs/dto/responses/auth-config-response.dto';

/**
 * e2e: PATCH 에 일부 필드만 보내도 응답 · 저장값이 보내지 않은 필드를 잃지 않는다 — 워크플로 · 노드 · 인증 설정.
 *
 * DTO 인스턴스는 보내지 않은 optional 필드도 `undefined` own property 로 갖는다(`useDefineForClassFields`). 그것을 로드한
 * 엔티티에 그대로 병합하면 nullable 이 아닌 컬럼은 응답에서 키가 사라지고, nullable 컬럼은 TypeORM 이 저장 뒤 undefined 를
 * null 로 채워 거짓 null 이 실린다(폴더 · 트리거가 같은 원인으로 고쳐졌다 — `omitUndefined`).
 *
 * 단언 순서가 판정의 일부다: 저장값(GET) → 응답 **값** → 응답 계약. 계약 대조만으로는 부족하다 — 이 필드들은 선언이 optional +
 * nullable(§5.4 래칫에 동결)이라 키가 빠져도, 거짓 null 이어도 통과한다. 그래서 보내지 않은 nullable 필드에 null 이 아닌 값을
 * 미리 넣고 **값**을 단언한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 응답에서 비교할 키만 뽑는다 — 키가 없으면 `undefined` 로 남아 `toStrictEqual` 이 차이를 보인다. */
function pick(
  obj: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}

describe('PATCH 부분 본문 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  const authed = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('patchpart'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('PATCHPART'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. 워크플로 — 이름만 PATCH 해도 설명 · 폴더 · 태그 · 활성 여부가 응답에 저장값으로 실린다', async () => {
    const folder = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('pp-folder'),
    });
    expect(folder.status).toBe(201);
    const created = await authed(request(BASE_URL).post('/api/workflows')).send(
      {
        name: uniqueName('pp-wf'),
        description: 'before',
        tags: ['alpha', 'beta'],
        folderId: (folder.body.data as { id: string }).id,
      },
    );
    expect(created.status).toBe(201);
    const id = (created.body.data as { id: string }).id;
    const keys = ['description', 'folderId', 'tags', 'isActive'] as const;
    const before = await authed(request(BASE_URL).get(`/api/workflows/${id}`));
    const stored = pick(before.body.data, keys);
    // 픽스처가 가르는지 — nullable 인 둘이 null 이면 거짓 null 을 볼 수 없다.
    expect(stored.description).toBe('before');
    expect(stored.folderId).toEqual(expect.any(String));

    const patched = await authed(
      request(BASE_URL).patch(`/api/workflows/${id}`),
    ).send({ name: uniqueName('pp-wf-renamed') });
    expect(patched.status).toBe(200);

    const after = await authed(request(BASE_URL).get(`/api/workflows/${id}`));
    expect(pick(after.body.data, keys)).toStrictEqual(stored);

    expect(pick(patched.body.data, keys)).toStrictEqual(stored);
    assertMatchesContract(patched.body.data, await contractForDto(WorkflowDto));
  });

  it('B. 워크플로 settings — 빈 settings 를 보내도 저장된 설정 키가 남는다', async () => {
    const created = await authed(request(BASE_URL).post('/api/workflows')).send(
      { name: uniqueName('pp-wf-settings') },
    );
    const id = (created.body.data as { id: string }).id;
    const set = await authed(
      request(BASE_URL).patch(`/api/workflows/${id}`),
    ).send({ settings: { maxConcurrentExecutions: 5 } });
    expect(set.status).toBe(200);

    const patched = await authed(
      request(BASE_URL).patch(`/api/workflows/${id}`),
    ).send({ settings: {} });
    expect(patched.status).toBe(200);

    const after = await authed(request(BASE_URL).get(`/api/workflows/${id}`));
    expect(after.body.data.settings).toStrictEqual({
      maxConcurrentExecutions: 5,
    });
    expect(patched.body.data.settings).toStrictEqual({
      maxConcurrentExecutions: 5,
    });
  });

  it('C. 노드 — 라벨만 PATCH 해도 설명 · 컨테이너 · 위치 · 비활성 · 설정이 응답에 저장값으로 실린다', async () => {
    const wf = await authed(request(BASE_URL).post('/api/workflows')).send({
      name: uniqueName('pp-wf-nodes'),
    });
    const workflowId = (wf.body.data as { id: string }).id;
    const nodesUrl = `/api/workflows/${workflowId}/nodes`;
    const box = await authed(request(BASE_URL).post(nodesUrl)).send({
      type: 'loop',
      category: 'flow',
      label: 'Box',
    });
    expect(box.status).toBe(201);
    const child = await authed(request(BASE_URL).post(nodesUrl)).send({
      type: 'code',
      category: 'data',
      label: 'Child',
      positionX: 120,
      positionY: 80,
      config: { language: 'javascript' },
      isDisabled: true,
      description: 'memo',
      containerId: (box.body.data as { id: string }).id,
    });
    expect(child.status).toBe(201);
    const childId = (child.body.data as { id: string }).id;
    const keys = [
      'description',
      'containerId',
      'toolOwnerId',
      'positionX',
      'positionY',
      'isDisabled',
      'config',
    ] as const;
    const readChild = async (): Promise<Record<string, unknown>> => {
      const list = await authed(request(BASE_URL).get(nodesUrl));
      const found = (list.body.data as Array<Record<string, unknown>>).find(
        (n) => n.id === childId,
      );
      expect(found).toBeDefined();
      return found as Record<string, unknown>;
    };
    const stored = pick(await readChild(), keys);
    expect(stored.description).toBe('memo');
    expect(stored.containerId).toEqual(expect.any(String));

    const patched = await authed(
      request(BASE_URL).patch(`/api/nodes/${childId}`),
    ).send({ label: 'Child renamed' });
    expect(patched.status).toBe(200);

    expect(pick(await readChild(), keys)).toStrictEqual(stored);

    expect(pick(patched.body.data, keys)).toStrictEqual(stored);
    assertMatchesContract(patched.body.data, await contractForDto(NodeDto));
  });

  it('D. 인증 설정 — 이름만 PATCH 해도 IP 화이트리스트 · 활성 여부가 응답에 저장값으로 실린다', async () => {
    const created = await authed(
      request(BASE_URL).post('/api/auth-configs'),
    ).send({
      name: uniqueName('pp-ac'),
      type: 'bearer_token',
      ipWhitelist: ['10.0.0.1'],
      isActive: false,
    });
    expect(created.status).toBe(201);
    const id = (created.body.data as { id: string }).id;
    const keys = ['ipWhitelist', 'isActive'] as const;
    const before = await authed(
      request(BASE_URL).get(`/api/auth-configs/${id}`),
    );
    const stored = pick(before.body.data, keys);
    expect(stored).toStrictEqual({
      ipWhitelist: ['10.0.0.1'],
      isActive: false,
    });

    const patched = await authed(
      request(BASE_URL).patch(`/api/auth-configs/${id}`),
    ).send({ name: uniqueName('pp-ac-renamed') });
    expect(patched.status).toBe(200);

    const after = await authed(
      request(BASE_URL).get(`/api/auth-configs/${id}`),
    );
    expect(pick(after.body.data, keys)).toStrictEqual(stored);

    expect(pick(patched.body.data, keys)).toStrictEqual(stored);
    assertMatchesContract(
      patched.body.data,
      await contractForDto(AuthConfigDto),
    );
  });
});
