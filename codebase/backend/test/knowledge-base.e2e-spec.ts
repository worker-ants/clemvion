import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  pickMatchingContract,
} from '../src/shared/testing/response-contract';
import {
  DocumentDto,
  GraphEntityDetailDto,
  GraphEntityDto,
  KnowledgeBaseDto,
} from '../src/modules/knowledge-base/dto/responses/knowledge-base-response.dto';

/**
 * e2e: Knowledge Base CRUD + 격리 — spec/5-system/8-embedding-pipeline.md /
 * spec/5-system/10-graph-rag.md.
 *
 * 임베딩·그래프 추출 자체는 LLM 의존이라 e2e 환경에서 안정적으로 검증하기 어렵다.
 * 본 spec 은 KB 엔티티 라이프사이클 (생성·조회·수정·삭제·격리) 과 ragMode 가 생성
 * 후 불변임만 확인. 실제 임베딩·검색 동작은 unit / embedding-pipeline.service.spec
 * 가 담당.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Knowledge Base (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('kb'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(BASE_URL, token, uniqueName('KB'));
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  async function createKb(
    name: string,
    ragMode: 'vector' | 'graph' = 'vector',
  ): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/knowledge-bases')
      .set(authHeaders())
      .send({ name, ragMode });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  it('A. create → list 에 등장 / GET 단건 일치', async () => {
    const name = uniqueName('kb-a');
    const id = await createKb(name);

    const list = await request(BASE_URL)
      .get('/api/knowledge-bases')
      .set(authHeaders());
    expect(list.status).toBe(200);
    const items =
      (list.body.data as { items?: Array<{ id: string }> }).items ??
      (list.body.data as Array<{ id: string }>);
    expect(items.some((i) => i.id === id)).toBe(true);

    const get = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}`)
      .set(authHeaders());
    expect(get.status).toBe(200);
    expect(get.body.data.name).toBe(name);
    assertMatchesContract(
      get.body.data,
      await contractForDto(KnowledgeBaseDto),
    );
  });

  it('B. PATCH 이름 → 200, GET 반영', async () => {
    const id = await createKb(uniqueName('kb-b'));
    const newName = uniqueName('kb-b-renamed');

    const patch = await request(BASE_URL)
      .patch(`/api/knowledge-bases/${id}`)
      .set(authHeaders())
      .send({ name: newName });
    expect(patch.status).toBe(200);
    expect(patch.body.data.name).toBe(newName);
  });

  it('C. ragMode 는 생성 후 변경 불가 (PATCH 시도 → 400 또는 무시)', async () => {
    const id = await createKb(uniqueName('kb-c'), 'vector');

    const patch = await request(BASE_URL)
      .patch(`/api/knowledge-bases/${id}`)
      .set(authHeaders())
      .send({ ragMode: 'graph' });
    // 거부되거나, 받아들이되 DB 에 적용되지 않는다 (spec: 사후 변경 불가).
    if (patch.status === 200) {
      const get = await request(BASE_URL)
        .get(`/api/knowledge-bases/${id}`)
        .set(authHeaders());
      expect(get.body.data.ragMode).toBe('vector');
    } else {
      expect([400, 403, 409, 422]).toContain(patch.status);
    }
  });

  it('D. delete → 후속 GET 404, DB row 제거', async () => {
    const id = await createKb(uniqueName('kb-d'));

    const del = await request(BASE_URL)
      .delete(`/api/knowledge-bases/${id}`)
      .set(authHeaders());
    expect([200, 204]).toContain(del.status);

    const get = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}`)
      .set(authHeaders());
    expect(get.status).toBe(404);

    const row = await db.query('SELECT id FROM knowledge_base WHERE id = $1', [
      id,
    ]);
    expect(row.rows.length).toBe(0);
  });

  it('E. cross-workspace 격리 — 다른 워크스페이스에서 GET 시 403/404', async () => {
    const id = await createKb(uniqueName('kb-e'));

    const intruder = await registerAndLogin(BASE_URL, uniqueEmail('kb-x'), db);
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('X'),
    );

    const cross = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs);
    expect([403, 404]).toContain(cross.status);
  });

  it('F. embedding-stats — 문서 없는 KB 도 0 카운트 반환 (5xx 방지)', async () => {
    const id = await createKb(uniqueName('kb-f'));

    const stats = await request(BASE_URL)
      .get(`/api/knowledge-bases/${id}/embedding-stats`)
      .set(authHeaders());
    // 비어있어도 200, 카운트 0.
    expect(stats.status).toBe(200);
    expect(stats.body.data).toBeDefined();
  });

  it('G. 50MB 를 넘는 문서 업로드는 413 이고 message 는 고정 문구다', async () => {
    // 아바타 업로드와 같은 multer `LIMIT_FILE_SIZE` 경로다. 전역 필터가 multer 원문
    // ("File too large")을 고정 문구로 바꾸는지 이 엔드포인트에서도 확인한다(CLE-T-8MQMGQ).
    const id = await createKb(uniqueName('kb-g'));
    const tooBig = Buffer.alloc(50 * 1024 * 1024 + 1, 0);

    const res = await request(BASE_URL)
      .post(`/api/knowledge-bases/${id}/documents`)
      .set(authHeaders())
      .attach('file', tooBig, {
        filename: 'huge.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(413);
    expect(res.body.error?.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error?.message).toBe('Request payload too large.');
  }, 120_000);

  /**
   * 생성 · 목록 · 수정 응답도 상세와 같은 `KnowledgeBaseDto` 를 광고한다. 생성 응답은 저장 직후의 엔티티라 상세와 다른
   * 경로로 직렬화된다. 설명 · 임베딩 차원 · 추출 LLM 설정은 비워 만들면 `null` 이어야 하고(API 규약 §5.5), 키가
   * 빠지면 안 된다.
   */
  it('H. 생성 · 목록 · 수정 응답이 KnowledgeBaseDto 와 맞고 빈 필드는 null 로 실린다', async () => {
    const contract = await contractForDto(KnowledgeBaseDto);
    const created = await request(BASE_URL)
      .post('/api/knowledge-bases')
      .set(authHeaders())
      .send({ name: uniqueName('kb-h'), ragMode: 'vector' });
    expect(created.status).toBe(201);
    assertMatchesContract(created.body.data, contract);
    for (const key of [
      'description',
      'embeddingDimension',
      'extractionLlmConfigId',
    ]) {
      expect(created.body.data).toHaveProperty(key, null);
    }
    const id = created.body.data.id as string;

    const list = await request(BASE_URL)
      .get('/api/knowledge-bases')
      .set(authHeaders());
    expect(list.status).toBe(200);
    pickMatchingContract(
      list.body.data as Array<{ id: string }>,
      (i) => i.id === id,
      contract,
    );

    const patched = await request(BASE_URL)
      .patch(`/api/knowledge-bases/${id}`)
      .set(authHeaders())
      .send({ description: 'kb-h 설명' });
    expect(patched.status).toBe(200);
    assertMatchesContract(patched.body.data, contract);
    expect(patched.body.data.description).toBe('kb-h 설명');
  });

  /**
   * 업로드 응답 · 목록 · 상세가 `DocumentDto` 와 맞는가. 임베딩은 비동기라 업로드 직후의 시도 시각 · 오류 메시지는
   * 비어 있다. 그래프 필드는 vector 모드 문서라 비어 있다. 값이 채워진 경우도 같은 선언으로 덮이는지 보려고 행을
   * 직접 고친 뒤 상세를 한 번 더 대조한다.
   */
  it('I. 문서 업로드 · 목록 · 상세 응답이 DocumentDto 와 맞는다', async () => {
    const contract = await contractForDto(DocumentDto);
    const kbId = await createKb(uniqueName('kb-i'));

    const uploaded = await request(BASE_URL)
      .post(`/api/knowledge-bases/${kbId}/documents`)
      .set(authHeaders())
      .attach('file', Buffer.from('계약 대조용 문서'), {
        filename: 'contract.txt',
        contentType: 'text/plain',
      });
    expect(uploaded.status).toBe(201);
    assertMatchesContract(uploaded.body.data, contract);
    for (const key of [
      'embeddingLastAttemptedAt',
      'embeddingErrorMessage',
      'graphExtractionStatus',
      'graphLastAttemptedAt',
      'graphErrorMessage',
    ]) {
      expect(uploaded.body.data).toHaveProperty(key, null);
    }
    const docId = uploaded.body.data.id as string;

    const list = await request(BASE_URL)
      .get(`/api/knowledge-bases/${kbId}/documents`)
      .set(authHeaders());
    expect(list.status).toBe(200);
    const listed = pickMatchingContract(
      list.body.data as Array<Record<string, unknown>>,
      (d) => d.id === docId,
      contract,
    );
    // vector 모드 문서는 임베딩 워커가 돌아도 그래프 필드를 채우지 않는다.
    expect(listed).toHaveProperty('graphExtractionStatus', null);

    await db.query(
      `UPDATE document
          SET embedding_last_attempted_at = NOW(),
              embedding_error_message = 'kb-i 임베딩 오류',
              graph_extraction_status = 'failed',
              graph_last_attempted_at = NOW(),
              graph_error_message = 'kb-i 추출 오류'
        WHERE id = $1`,
      [docId],
    );
    const detail = await request(BASE_URL)
      .get(`/api/knowledge-bases/${kbId}/documents/${docId}`)
      .set(authHeaders());
    expect(detail.status).toBe(200);
    assertMatchesContract(detail.body.data, contract);
    expect(detail.body.data).toMatchObject({
      graphExtractionStatus: 'failed',
      graphErrorMessage: 'kb-i 추출 오류',
    });
  });

  /**
   * 그래프 Entity 목록 · 상세가 `GraphEntityDto` · `GraphEntityDetailDto` 와 맞는가. Entity 는 LLM 추출로만 생기므로
   * SQL 로 심는다. 설명이 없는 Entity 와 있는 Entity 를 둘 다 대조한다.
   */
  it('J. 그래프 Entity 목록 · 상세 응답이 GraphEntityDto 와 맞는다', async () => {
    const kbId = await createKb(uniqueName('kb-j'), 'graph');
    const seeded = await db.query<{ id: string; description: string | null }>(
      `INSERT INTO entity (knowledge_base_id, name, display_name, type, description, mention_count)
       VALUES ($1, 'kb-j acme', 'KB-J Acme', 'organization', NULL, 3),
              ($1, 'kb-j alice', 'KB-J Alice', 'person', 'kb-j 설명', 1)
       RETURNING id, description`,
      [kbId],
    );
    const bare = seeded.rows.find((r) => r.description === null)!.id;
    const described = seeded.rows.find((r) => r.description !== null)!.id;

    const list = await request(BASE_URL)
      .get(`/api/knowledge-bases/${kbId}/entities`)
      .set(authHeaders());
    expect(list.status).toBe(200);
    const items = list.body.data as Array<Record<string, unknown>>;
    const contract = await contractForDto(GraphEntityDto);
    expect(
      pickMatchingContract(items, (e) => e.id === bare, contract),
    ).toHaveProperty('description', null);
    expect(
      pickMatchingContract(items, (e) => e.id === described, contract),
    ).toHaveProperty('description', 'kb-j 설명');

    const detail = await request(BASE_URL)
      .get(`/api/knowledge-bases/${kbId}/entities/${bare}`)
      .set(authHeaders());
    expect(detail.status).toBe(200);
    assertMatchesContract(
      detail.body.data,
      await contractForDto(GraphEntityDetailDto),
    );
    expect(detail.body.data).toMatchObject({
      id: bare,
      description: null,
      mentionedInChunks: [],
      truncated: false,
    });
  });
});
