import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: PATCH 로 NOT NULL 필드에 `null` 을 보내면 400 `VALIDATION_ERROR` 다 — 500 이 아니다.
 *
 * `@IsOptional()` 은 값이 `undefined` **또는 `null`** 이면 다른 검증기를 전부 건너뛴다. 그래서 null 이 엔티티에 병합돼 저장 때 NOT NULL
 * 위반(23502)이 나거나(500), 서비스가 null 에서 메서드를 불러 TypeError(500)가 나거나, 엉뚱한 409 · 조용한 경로 삭제가 됐다. 이제
 * 그 필드들은 `IsOptionalNonNull()` 로 키 생략(= 값 불변)만 허용하고 null 은 입구에서 거부한다.
 *
 * 라우트마다 대표 필드를 고른다(픽스처가 가벼운 12개 라우트). 43필드 전수는 DTO 단위 테스트가 본다(`src/repo-guards/__tests__/patch-null-rejection.spec.ts`).
 * 통합 · 지식 베이스는 픽스처가 무거워 단위로만.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('PATCH 의 NOT NULL 필드에 null (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  const ids: Record<string, string> = {};

  const authed = (req: request.Test): request.Test =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  const created = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> => {
    const res = await authed(request(BASE_URL).post(path)).send(body);
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('nullpatch'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('NULLPATCH'),
    );

    ids.folder = await created('/api/folders', { name: uniqueName('np-f') });
    ids.workflow = await created('/api/workflows', {
      name: uniqueName('np-w'),
    });
    ids.node = await created(`/api/workflows/${ids.workflow}/nodes`, {
      type: 'code',
      category: 'data',
      label: 'NullProbe',
    });
    ids.authConfig = await created('/api/auth-configs', {
      name: uniqueName('np-ac'),
      type: 'bearer_token',
    });
    ids.trigger = await created('/api/triggers', {
      workflowId: ids.workflow,
      type: 'webhook',
      name: uniqueName('np-t'),
      endpointPath: randomUUID(),
    });
    ids.alert = await created('/api/alerts', {
      type: 'failure_rate',
      threshold: 10,
      channel: 'in_app',
    });
    ids.dataset = await created(
      `/api/workflows/${ids.workflow}/test-datasets`,
      { name: uniqueName('np-ds'), input: { a: 1 } },
    );
    ids.schedule = await created('/api/schedules', {
      workflowId: ids.workflow,
      name: uniqueName('np-s'),
      cronExpression: '0 0 1 1 *',
      timezone: 'Asia/Seoul',
    });
    ids.modelConfig = await created('/api/model-configs', {
      kind: 'chat',
      provider: 'openai',
      name: uniqueName('np-mc'),
      apiKey: 'stub-not-used',
      defaultModel: 'stub-model',
      defaultParams: {},
      isDefault: false,
    });
    ids.session = await created('/api/workflow-assistant/sessions', {
      workflowId: ids.workflow,
      title: 'null probe',
    });
  }, 120_000);

  afterAll(async () => {
    await db.end();
  });

  const cases: Array<{ label: string; url: () => string; field: string }> = [
    { label: '폴더', url: () => `/api/folders/${ids.folder}`, field: 'name' },
    {
      label: '폴더',
      url: () => `/api/folders/${ids.folder}`,
      field: 'sortOrder',
    },
    {
      label: '워크플로',
      url: () => `/api/workflows/${ids.workflow}`,
      field: 'name',
    },
    {
      label: '워크플로',
      url: () => `/api/workflows/${ids.workflow}`,
      field: 'tags',
    },
    {
      label: '워크플로',
      url: () => `/api/workflows/${ids.workflow}`,
      field: 'isActive',
    },
    { label: '노드', url: () => `/api/nodes/${ids.node}`, field: 'label' },
    { label: '노드', url: () => `/api/nodes/${ids.node}`, field: 'config' },
    { label: '노드', url: () => `/api/nodes/${ids.node}`, field: 'positionX' },
    { label: '노드', url: () => `/api/nodes/${ids.node}`, field: 'isDisabled' },
    {
      label: '인증 설정',
      url: () => `/api/auth-configs/${ids.authConfig}`,
      field: 'name',
    },
    {
      label: '인증 설정',
      url: () => `/api/auth-configs/${ids.authConfig}`,
      field: 'isActive',
    },
    {
      label: '트리거',
      url: () => `/api/triggers/${ids.trigger}`,
      field: 'name',
    },
    {
      label: '트리거',
      url: () => `/api/triggers/${ids.trigger}`,
      field: 'isActive',
    },
    {
      label: '트리거',
      url: () => `/api/triggers/${ids.trigger}`,
      field: 'endpointPath',
    },
    {
      label: '알림 규칙',
      url: () => `/api/alerts/${ids.alert}`,
      field: 'threshold',
    },
    {
      label: '알림 규칙',
      url: () => `/api/alerts/${ids.alert}`,
      field: 'window',
    },
    {
      label: '알림 규칙',
      url: () => `/api/alerts/${ids.alert}`,
      field: 'channel',
    },
    {
      label: '알림 규칙',
      url: () => `/api/alerts/${ids.alert}`,
      field: 'enabled',
    },
    {
      label: '테스트 데이터셋',
      url: () => `/api/test-datasets/${ids.dataset}`,
      field: 'name',
    },
    {
      label: '테스트 데이터셋',
      url: () => `/api/test-datasets/${ids.dataset}`,
      field: 'input',
    },
    {
      label: '테스트 데이터셋',
      url: () => `/api/test-datasets/${ids.dataset}`,
      field: 'visibility',
    },
    {
      label: '워크스페이스 설정',
      url: () => `/api/workspaces/${workspaceId}/settings`,
      field: 'timezone',
    },
    {
      label: '워크스페이스 설정',
      url: () => `/api/workspaces/${workspaceId}/settings`,
      field: 'interactionAllowedOrigins',
    },
    { label: '내 프로필', url: () => '/api/users/me', field: 'name' },
    { label: '내 프로필', url: () => '/api/users/me', field: 'locale' },
    { label: '내 프로필', url: () => '/api/users/me', field: 'theme' },
    {
      label: '스케줄',
      url: () => `/api/schedules/${ids.schedule}`,
      field: 'isActive',
    },
    {
      label: '스케줄',
      url: () => `/api/schedules/${ids.schedule}`,
      field: 'parameterValues',
    },
    {
      label: '모델 설정',
      url: () => `/api/model-configs/${ids.modelConfig}`,
      field: 'provider',
    },
    {
      label: '모델 설정',
      url: () => `/api/model-configs/${ids.modelConfig}`,
      field: 'name',
    },
    {
      label: '모델 설정',
      url: () => `/api/model-configs/${ids.modelConfig}`,
      field: 'defaultModel',
    },
    {
      label: '모델 설정',
      url: () => `/api/model-configs/${ids.modelConfig}`,
      field: 'defaultParams',
    },
    {
      label: '어시스턴트 세션',
      url: () => `/api/workflow-assistant/sessions/${ids.session}`,
      field: 'status',
    },
  ];

  it.each(cases)(
    '$label 의 $field 에 null 을 보내면 400',
    async ({ url, field }) => {
      const res = await authed(request(BASE_URL).patch(url())).send({
        [field]: null,
      });
      expect({ status: res.status, code: res.body?.error?.code }).toStrictEqual(
        {
          status: 400,
          code: 'VALIDATION_ERROR',
        },
      );
      const fields = (
        (res.body.error.details ?? []) as Array<{ field: string }>
      ).map((d) => d.field);
      expect(fields).toContain(field);
    },
  );

  // null 을 막은 데코레이터가 유효 값 · 키 생략까지 막지 않는지 — 모델 설정 PATCH 는 다른 e2e 가 값 경로를 밟지 않는다
  // (나머지 라우트는 각자 e2e 가 유효 값 PATCH 를 이미 돈다).
  it('모델 설정 PATCH — 유효 값은 200 으로 저장되고, 생략한 키는 값이 그대로다', async () => {
    const url = `/api/model-configs/${ids.modelConfig}`;
    const name = uniqueName('np-mc2');
    const set = await authed(request(BASE_URL).patch(url)).send({
      provider: 'openai',
      name,
      defaultModel: 'stub-model-2',
      defaultParams: { temperature: 0.2 },
    });
    expect(set.status).toBe(200);
    const expected = {
      provider: 'openai',
      name,
      defaultModel: 'stub-model-2',
      defaultParams: { temperature: 0.2 },
    };
    expect(set.body.data).toMatchObject(expected);

    const omitted = await authed(request(BASE_URL).patch(url)).send({});
    expect(omitted.status).toBe(200);
    expect(omitted.body.data).toMatchObject(expected);
  });
});
