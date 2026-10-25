import * as path from 'node:path';
import {
  NODE_ROW_WRITERS,
  findNodeRowWriteScopes,
  listNodeRowWriters,
} from './node-row-writers-guard';

/**
 * 노드 `config` 에 통합 참조를 쓰는 경로가 모두 개인 통합 사용 판정을 거치게 한다(CLE-INT-MANAGE 「개인 통합 사용 판정」,
 * NERV Task `CLE-T-1BQZ10`).
 *
 * 판정은 저장 경로마다 부르는 쪽이 건다. 캔버스 저장 · 노드 생성 · 수정은 거절하고 복제 · 가져오기 · 버전 복원은 비운다. 노드 행을
 * 쓰는 새 함수가 판정 없이 생기면 남의 개인 통합 참조가 저장된다. 그래서 노드 행을 쓰는 지점을 전부 세어 허용 목록과 맞춘다.
 *
 * 새 지점이 걸리면 그 경로가 통합 참조를 어떻게 다룰지 정하고 CLE-PLAT-DATA 「참조의 소속」 표와 `NODE_ROW_WRITERS` 에 함께
 * 적는다. 노드 행을 쓰지만 통합 참조를 바꾸지 않는 지점(이관 스크립트 등)도 그 이유를 적어 올린다.
 */
describe('노드 행 쓰기 지점 허용 목록', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');
  const found = listNodeRowWriters(repoRoot, srcDir);

  it('노드 행을 쓰는 지점이 허용 목록과 같다', () => {
    expect(found).toEqual(Object.keys(NODE_ROW_WRITERS).sort());
  });

  it('[전제] 스캔이 실제 저장 경로를 찾는다', () => {
    expect(found).toContain(
      'codebase/backend/src/modules/workflows/workflows.service.ts::syncNodes',
    );
  });
});

describe('findNodeRowWriteScopes', () => {
  it.each<[string, string]>([
    [
      'manager.save(Node, …)',
      `async function a(manager) { await manager.save(Node, rows); }`,
    ],
    [
      'manager.insert(Node, …)',
      `async function a(manager) { await manager.insert(Node, rows); }`,
    ],
    [
      '@InjectRepository(Node) 저장소',
      `class S {
         constructor(@InjectRepository(Node) private readonly repo: Repository<Node>) {}
         async a() { await this.repo.update({ id }, { config }); }
       }`,
    ],
    [
      'Repository<Node> 형 매개변수',
      `async function a(nodes: Repository<Node>) { await nodes.save(node); }`,
    ],
    [
      'getRepository(Node) 변수',
      `async function a(manager) { const r = manager.getRepository(Node); await r.upsert(row, ['id']); }`,
    ],
    [
      'getRepository(Node) 에 바로 이어 쓰기',
      `async function a(manager) { await manager.getRepository(Node).save(row); }`,
    ],
    [
      '쿼리 빌더 update(Node)',
      `async function a(qb) { await qb.update(Node).set({ config }).execute(); }`,
    ],
    [
      '쿼리 빌더 insert().into(Node)',
      `async function a(qb) { await qb.insert().into(Node).values(rows).execute(); }`,
    ],
    [
      '원시 SQL UPDATE node',
      'async function a(m) { await m.query(`UPDATE node SET config = $1 WHERE id = $2`, []); }',
    ],
    [
      '원시 SQL INSERT INTO "node"',
      `async function a(m) { await m.query('INSERT INTO "node" (id) VALUES ($1)', []); }`,
    ],
  ])('%s 를 잡는다', (_label, source) => {
    expect(findNodeRowWriteScopes(source)).toEqual(['a']);
  });

  it.each<[string, string]>([
    [
      '다른 엔티티의 쓰기',
      `async function a(manager) { await manager.save(Edge, rows); }`,
    ],
    [
      '노드 저장소의 읽기 · 지우기',
      `async function a(nodes: Repository<Node>) { await nodes.find({}); await nodes.delete({ id }); }`,
    ],
    [
      'node_execution 원시 SQL',
      `async function a(m) { await m.query('UPDATE node_execution SET status = $1', []); }`,
    ],
    [
      '주석 속 SQL',
      `async function a() { /* UPDATE node SET config */ // manager.save(Node, rows)
       }`,
    ],
  ])('%s 는 잡지 않는다', (_label, source) => {
    expect(findNodeRowWriteScopes(source)).toEqual([]);
  });
});
