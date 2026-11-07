import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  pickMatchingContract,
  type DtoContract,
} from '../src/shared/testing/response-contract';
import {
  ModelConfigDto,
  ModelTestConnectionResultDto,
} from '../src/modules/model-config/dto/responses/model-config-response.dto';

/**
 * e2e: 모델 설정 응답이 `ModelConfigDto` 선언과 맞는가(API 규약 §5.5 「부재 표현」).
 *
 * `apiKey` · `baseUrl` · `dimension` 은 행마다 늘 실리고 값이 없으면 `null` 이다. 서비스가 저장할 때 `null` 을 채우고
 * 응답 직전에 `apiKey` 를 마스킹하기 때문이다. 세 필드가 각각 값이 있는 경우와 `null` 인 경우를 모두 만들려고 provider ·
 * 종류가 다른 설정 셋을 만든다.
 *
 * - openai chat: `apiKey` 마스킹 값, `baseUrl` · `dimension` 은 `null`
 * - local chat: `apiKey` 는 `null`(키가 필요 없는 provider), `baseUrl` 은 값
 * - openai embedding: `dimension` 은 값
 *
 * provider 호출은 하지 않는다. 생성 · 조회 · 수정은 자격 증명을 쓰지 않는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('모델 설정 응답의 계약 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let contract: DtoContract;

  function headers() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  async function create(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const res = await request(BASE_URL)
      .post('/api/model-configs')
      .set(headers())
      .send({ name: uniqueName('mcc'), isDefault: false, ...body });
    expect(res.status).toBe(201);
    assertMatchesContract(res.body.data, contract);
    return res.body.data as Record<string, unknown>;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('mcc'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('MCC'));
    contract = await contractForDto(ModelConfigDto);
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('생성 응답 — 값이 없는 apiKey · baseUrl · dimension 은 null 로 실린다', async () => {
    const openaiChat = await create({
      kind: 'chat',
      provider: 'openai',
      apiKey: 'sk-mcc-contract-key',
      defaultModel: 'gpt-4o-mini',
    });
    expect(typeof openaiChat.apiKey).toBe('string');
    expect(openaiChat.apiKey).not.toBe('sk-mcc-contract-key');
    expect(openaiChat).toHaveProperty('baseUrl', null);
    expect(openaiChat).toHaveProperty('dimension', null);

    const localChat = await create({
      kind: 'chat',
      provider: 'local',
      baseUrl: 'http://ollama.mcc.test:11434',
      defaultModel: 'llama3',
    });
    expect(localChat).toHaveProperty('apiKey', null);
    expect(localChat.baseUrl).toBe('http://ollama.mcc.test:11434');

    const embedding = await create({
      kind: 'embedding',
      provider: 'openai',
      apiKey: 'sk-mcc-embed-key',
      defaultModel: 'text-embedding-3-small',
      dimension: 1536,
    });
    expect(embedding.dimension).toBe(1536);
  });

  it('목록 · 상세 · 수정 응답도 같은 선언과 맞는다', async () => {
    const created = await create({
      kind: 'chat',
      provider: 'local',
      baseUrl: 'http://ollama.mcc.test:11434',
      defaultModel: 'llama3',
    });
    const id = created.id as string;

    for (const kind of ['chat', 'embedding'] as const) {
      const list = await request(BASE_URL)
        .get('/api/model-configs')
        .query({ kind })
        .set(headers());
      expect(list.status).toBe(200);
      for (const item of list.body.data as Array<{ id: string }>) {
        assertMatchesContract(item, contract);
      }
    }
    const listed = await request(BASE_URL)
      .get('/api/model-configs')
      .query({ kind: 'chat' })
      .set(headers());
    pickMatchingContract(
      listed.body.data as Array<{ id: string }>,
      (i) => i.id === id,
      contract,
    );

    const detail = await request(BASE_URL)
      .get(`/api/model-configs/${id}`)
      .set(headers());
    expect(detail.status).toBe(200);
    assertMatchesContract(detail.body.data, contract);
    expect(detail.body.data).toHaveProperty('apiKey', null);

    const patched = await request(BASE_URL)
      .patch(`/api/model-configs/${id}`)
      .set(headers())
      .send({ name: uniqueName('mcc-renamed') });
    expect(patched.status).toBe(200);
    assertMatchesContract(patched.body.data, contract);
    expect(patched.body.data).toHaveProperty('dimension', null);
  });

  /**
   * 연결 테스트 결과의 `message` 는 실패할 때만 실리는 키 생략형이다. 성공이든 실패든 `null` 로 오면 안 된다.
   */
  it('연결 테스트 응답이 ModelTestConnectionResultDto 와 맞는다', async () => {
    const created = await create({
      kind: 'chat',
      provider: 'openai',
      apiKey: 'sk-mcc-test-key',
      defaultModel: 'gpt-4o-mini',
    });

    const res = await request(BASE_URL)
      .post(`/api/model-configs/${created.id as string}/test`)
      .set(headers())
      .send();
    expect(res.status).toBe(200);
    assertMatchesContract(
      res.body.data,
      await contractForDto(ModelTestConnectionResultDto),
    );
    const data = res.body.data as { success: boolean; message?: unknown };
    if (data.success) {
      expect(data).not.toHaveProperty('message');
    } else {
      expect(typeof data.message).toBe('string');
    }
  });
});
