import { getMetadataArgsStorage } from 'typeorm';
import { Execution } from '../../executions/entities/execution.entity';
import { NodeExecution } from '../../node-executions/entities/node-execution.entity';
import { Node } from '../../nodes/entities/node.entity';
import { ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL } from './orphan-running-node-executions.sql';

type EntityClass = abstract new (...args: never[]) => unknown;

/** 엔티티(와 부모 클래스)에 선언된 DB 컬럼 이름. */
function columnNamesOf(entity: EntityClass): Set<string> {
  const storage = getMetadataArgsStorage();
  const targets = new Set<unknown>();
  for (
    let t: unknown = entity;
    typeof t === 'function' && t !== Function.prototype;
    t = Object.getPrototypeOf(t)
  ) {
    targets.add(t);
  }
  return new Set(
    storage.columns
      .filter((c) => targets.has(c.target))
      .map((c) => c.options.name ?? c.propertyName),
  );
}

function tableNameOf(entity: EntityClass): string | undefined {
  return getMetadataArgsStorage().tables.find((t) => t.target === entity)?.name;
}

// 정리 단계 SQL 은 테이블 · 컬럼 이름을 엔티티 메타데이터에서 끼워 넣지 않고 그대로 적는다.
// 엔티티 이름이 바뀌면 SQL 만 낡지 않도록 TypeORM 메타데이터와 대조한다(CLE-T-S03WEV).
describe('ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL — 엔티티 메타데이터 대조', () => {
  const entityByTable = new Map<string, EntityClass>(
    [NodeExecution, Execution, Node].map((e) => [tableNameOf(e) ?? '', e]),
  );
  const aliasToTable = new Map(
    [
      ...ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL.matchAll(
        /\b(?:FROM|JOIN)\s+"([a-z_]+)"\s+([a-z]+)\b/g,
      ),
    ].map((m) => [m[2], m[1]]),
  );

  it('따옴표로 감싼 테이블 이름은 모두 엔티티 테이블 이름이다', () => {
    const tables = [
      ...ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL.matchAll(
        /\b(?:FROM|JOIN)\s+"([a-z_]+)"/g,
      ),
    ].map((m) => m[1]);
    expect(new Set(tables)).toEqual(
      new Set(['node_execution', 'execution', 'node']),
    );
    for (const table of tables) expect(entityByTable.has(table)).toBe(true);
  });

  it('테이블 별칭으로 쓴 컬럼은 모두 그 엔티티의 컬럼이다', () => {
    expect([...aliasToTable.keys()].sort()).toEqual(
      ['e', 'n', 'ne', 'p', 'pn'].sort(),
    );
    const refs = [
      ...ORPHAN_RUNNING_NODE_EXECUTION_IDS_SQL.matchAll(
        /\b([a-z]+)\.([a-z_]+)\b/g,
      ),
    ].filter((m) => aliasToTable.has(m[1]));
    // 별칭 참조가 실제로 있어야 아래 대조가 비지 않는다.
    expect(refs.length).toBeGreaterThanOrEqual(10);
    for (const [ref, alias, column] of refs) {
      const entity = entityByTable.get(aliasToTable.get(alias) ?? '');
      expect(entity).toBeDefined();
      expect({ ref, ok: columnNamesOf(entity!).has(column) }).toEqual({
        ref,
        ok: true,
      });
    }
  });

  it('대조가 낡은 이름을 실제로 잡는다', () => {
    expect(columnNamesOf(NodeExecution).has('started_at')).toBe(true);
    expect(columnNamesOf(NodeExecution).has('startedAt')).toBe(false);
    expect(columnNamesOf(Node).has('type')).toBe(true);
    expect(columnNamesOf(Execution).has('status')).toBe(true);
  });
});
