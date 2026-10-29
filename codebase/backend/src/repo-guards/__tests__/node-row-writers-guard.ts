// 노드 행(`node` 테이블)을 쓰는 지점 허용 목록 가드 — 스캔 · 판정 순수 로직.
//
// 소비처는 형제 파일 `node-row-writers.spec.ts`. 배경 · 근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';
import {
  collectTsFiles,
  enclosingScopeName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/**
 * 노드 행을 쓰는 지점(`<저장소 루트 상대 경로>::<감싸는 함수>`)과 그 지점이 통합 참조를 어떻게 다루는지.
 *
 * 노드 `config` 에 통합 참조를 쓰는 경로는 모두 개인 통합 사용 판정을 거친다(CLE-INT-MANAGE 「개인 통합 사용 판정」).
 * 거절할지 비울지는 CLE-PLAT-DATA 「참조의 소속」 의 「통합 참조」 표가 정한다. 새 지점을 여기 올릴 때는 그 표에 경로를 더하거나
 * 통합 참조를 쓰지 않는 이유를 적는다.
 */
export const NODE_ROW_WRITERS: Readonly<Record<string, string>> = {
  'codebase/backend/src/modules/workflows/workflows.service.ts::syncNodes':
    '캔버스 저장 · 버전 복원. 부르는 writeCanvas 가 워크플로우 행을 잠근 뒤 applyIntegrationRefRules 로 거절하거나 비운다',
  'codebase/backend/src/modules/workflows/workflows.service.ts::duplicate':
    '복제. 넣기 전에 clearUnusableNodeIntegrationRefs 로 비운다(REQ-WFLIST-055)',
  'codebase/backend/src/modules/workflows/workflows.service.ts::importWorkflow':
    '가져오기. 넣기 전에 clearUnusableNodeIntegrationRefs 로 비운다(REQ-WFLIST-054)',
  'codebase/backend/src/modules/workflows/workflows.service.ts::create':
    '워크플로우 생성. 기본 Manual Trigger 노드만 넣고 통합 참조가 없다',
  'codebase/backend/src/modules/nodes/nodes.service.ts::saveWithUniqueConstraint':
    '노드 생성 · 수정. create · update 가 워크플로우 행을 잠근 뒤 assertNodeIntegrationRefsUsable 로 거절한다',
  'codebase/backend/src/scripts/migrate-button-ids.ts::runMigration':
    '일회성 이관. 버튼 id 만 채우고 통합 참조 자리는 그대로 둔다',
  'codebase/backend/src/scripts/migrate-node-output-refs.ts::main':
    '일회성 이관. 표현식 문자열 안의 노드 출력 참조만 고친다. 표현식 참조는 저장 판정 대상이 아니고 실행 시점에 판정한다',
};

const WRITE_METHODS = new Set(['save', 'insert', 'update', 'upsert']);

/** 노드 행을 넣거나 고치는 원시 SQL. `node_execution` 같은 다른 테이블은 걸리지 않는다. */
const RAW_NODE_WRITE = /\b(?:INSERT\s+INTO|UPDATE)\s+"?node"?(?=[\s(]|$)/i;

function isNodeIdentifier(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isIdentifier(node) && node.text === 'Node';
}

function isGetRepositoryOfNode(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'getRepository' &&
    isNodeIdentifier(node.arguments[0])
  );
}

function isNodeRepositoryType(
  type: ts.TypeNode | undefined,
  sf: ts.SourceFile,
): boolean {
  if (!type || !ts.isTypeReferenceNode(type)) return false;
  const [arg] = type.typeArguments ?? [];
  return (
    type.typeName.getText(sf) === 'Repository' &&
    arg !== undefined &&
    ts.isTypeReferenceNode(arg) &&
    arg.typeName.getText(sf) === 'Node'
  );
}

/** `@InjectRepository(Node)` · `Repository<Node>` 형 · `getRepository(Node)` 초기자로 노드 저장소가 된 이름들. */
function nodeRepositoryNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      (ts.isParameter(node) || ts.isPropertyDeclaration(node)) &&
      ts.isIdentifier(node.name)
    ) {
      const injected = (ts.getDecorators(node) ?? []).some(
        (d) =>
          ts.isCallExpression(d.expression) &&
          d.expression.expression.getText(sf) === 'InjectRepository' &&
          isNodeIdentifier(d.expression.arguments[0]),
      );
      if (injected || isNodeRepositoryType(node.type, sf)) {
        names.add(node.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      ((node.initializer && isGetRepositoryOfNode(node.initializer)) ||
        isNodeRepositoryType(node.type, sf))
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

function receiverName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

/**
 * 소스 하나에서 노드 행을 쓰는 지점의 감싸는 함수 이름을 모은다(중복 없이 정렬).
 *
 * - 노드 저장소의 `save` · `insert` · `update` · `upsert`
 * - 첫 인자가 `Node` 인 같은 메서드(`manager.save(Node, …)`, 쿼리 빌더의 `.update(Node)`)와 `.into(Node)`
 * - `INSERT INTO node` · `UPDATE node` 원시 SQL 문자열
 *
 * 저장소 이름은 파일 단위로 모은다. 같은 이름의 다른 저장소가 있으면 더 넓게 잡을 뿐 놓치지는 않는다.
 */
export function findNodeRowWriteScopes(source: string): string[] {
  if (!/\bNode\b|\bnode\b/.test(source)) return [];
  const sf = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const repos = nodeRepositoryNames(sf);
  const scopes = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const method = node.expression.name.text;
      const receiver = node.expression.expression;
      const name = receiverName(receiver);
      const onNodeRepository =
        isGetRepositoryOfNode(receiver) || (name !== null && repos.has(name));
      const firstIsNode = isNodeIdentifier(node.arguments[0]);
      if (
        (WRITE_METHODS.has(method) && (onNodeRepository || firstIsNode)) ||
        (method === 'into' && firstIsNode)
      ) {
        scopes.add(enclosingScopeName(node, sf));
      }
    }
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node)) &&
      RAW_NODE_WRITE.test(node.text)
    ) {
      scopes.add(enclosingScopeName(node, sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...scopes].sort();
}

/** `srcDir` 아래 운영 코드(`.spec.ts` 제외)에서 노드 행을 쓰는 지점(`<경로>::<함수>`, 정렬). */
export function listNodeRowWriters(repoRoot: string, srcDir: string): string[] {
  return collectTsFiles(srcDir)
    .flatMap((file) =>
      findNodeRowWriteScopes(fs.readFileSync(file, 'utf8')).map(
        (scope) => `${toPosixRelative(repoRoot, file)}::${scope}`,
      ),
    )
    .sort();
}
