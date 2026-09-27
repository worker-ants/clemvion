import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  type DtoContract,
} from '../src/shared/testing/response-contract';
import { FolderDto } from '../src/modules/folders/dto/responses/folder-response.dto';

/**
 * e2e: 폴더 API 의 응답 계약 — `GET/POST /folders` · `GET/PATCH/DELETE /folders/:id`.
 *
 * 이 모듈엔 e2e 가 없어 `FolderDto` 를 실제 응답과 대조한 적이 없었다(§5.4 응답-계약 스윕 2차). 대조를 걸면서 드러난 것:
 * 루트 폴더의 POST 응답에 `parentId` **키가 없었다**. TypeORM 은 INSERT 뒤 default 가 있는 컬럼만 되읽는데, 루트 폴더는
 * `parentId` 없이 만들어졌기 때문이다. 같은 폴더를 GET 하면 `null` 이었다 — 같은 리소스가 응답마다 부재 표현이 달랐다.
 * 서비스가 이제 `null` 을 명시해 저장하고, DTO 는 `parentId` 를 항상 실리는 필드(§5.4 기본형)로 광고한다.
 *
 * 계층 무결성(깊이 · 순환 · 다른 워크스페이스 부모)은 단위 테스트(`folders.service.spec.ts`)가 덮는다 — 여기는 응답 형태만 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Folders (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let folderContract: DtoContract;

  const authed = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  beforeAll(async () => {
    folderContract = await contractForDto(FolderDto);
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(BASE_URL, uniqueEmail('folders'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('FOLDERS'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. 루트 폴더 생성 응답에 parentId 가 null 로 실린다 (키 생략이 아니다)', async () => {
    const res = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('root-a'),
    });
    expect(res.status).toBe(201);

    // 양성 단언이 먼저다 — 대조는 선언을 기준으로 보므로, 선언이 optional 이면 키가 빠져도 통과한다.
    expect(res.body.data).toHaveProperty('parentId', null);
    // default 가 있는 컬럼은 INSERT 뒤 되읽힌다 — 같은 응답에서 두 컬럼의 차이를 함께 고정한다.
    expect(res.body.data).toHaveProperty('sortOrder', 0);
    assertMatchesContract(res.body.data, folderContract);
  });

  it('B. 하위 폴더 생성 · 목록 · 단건 — 모두 FolderDto 와 맞는다', async () => {
    const root = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('root-b'),
    });
    expect(root.status).toBe(201);
    const rootId = (root.body.data as { id: string }).id;

    const child = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('child-b'),
      parentId: rootId,
    });
    expect(child.status).toBe(201);
    expect(child.body.data).toHaveProperty('parentId', rootId);
    assertMatchesContract(child.body.data, folderContract);
    const childId = (child.body.data as { id: string }).id;

    const list = await authed(request(BASE_URL).get('/api/folders'));
    expect(list.status).toBe(200);
    const items = list.body.data as Array<{ id: string }>;
    const ids = items.map((f) => f.id);
    // 방금 만든 둘이 목록에 있어야 원소 대조가 vacuous 하지 않다.
    expect(ids).toEqual(expect.arrayContaining([rootId, childId]));
    for (const item of items) {
      assertMatchesContract(item, folderContract);
    }

    const one = await authed(request(BASE_URL).get(`/api/folders/${childId}`));
    expect(one.status).toBe(200);
    expect(one.body.data).toHaveProperty('parentId', rootId);
    assertMatchesContract(one.body.data, folderContract);
  });

  it('C. 수정(이름 · 루트로 이동) 응답도 FolderDto 와 맞고 parentId 가 null 이다', async () => {
    const root = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('root-c'),
    });
    const rootId = (root.body.data as { id: string }).id;
    const child = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('child-c'),
      parentId: rootId,
    });
    const childId = (child.body.data as { id: string }).id;

    const renamed = uniqueName('moved-c');
    const patched = await authed(
      request(BASE_URL).patch(`/api/folders/${childId}`),
    ).send({ name: renamed, parentId: null });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toHaveProperty('name', renamed);
    expect(patched.body.data).toHaveProperty('parentId', null);
    assertMatchesContract(patched.body.data, folderContract);
  });

  it('D. 삭제 → 204, 이후 단건 조회는 404', async () => {
    const root = await authed(request(BASE_URL).post('/api/folders')).send({
      name: uniqueName('root-d'),
    });
    const rootId = (root.body.data as { id: string }).id;

    const del = await authed(
      request(BASE_URL).delete(`/api/folders/${rootId}`),
    );
    expect(del.status).toBe(204);

    const after = await authed(request(BASE_URL).get(`/api/folders/${rootId}`));
    expect(after.status).toBe(404);
  });
});
