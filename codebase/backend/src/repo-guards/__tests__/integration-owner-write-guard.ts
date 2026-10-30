// 통합 행을 만들거나 개인으로 바꾸는 지점의 쓰기 잠금 가드 — 스캔 · 판정 순수 로직.
//
// 소비처는 형제 파일 `integration-owner-write.spec.ts`. 배경 · 근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';
import {
  collectTsFiles,
  enclosingScopeName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/**
 * 통합 행을 만들거나 공개 범위를 바꾸는 지점(`<저장소 루트 상대 경로>::<감싸는 함수>`)과 그 지점이 쓰기 잠금을 어떻게
 * 다루는지. 새 지점을 올릴 때는 {@link INTEGRATION_WRITE_LOCK_HELPERS} 를 부르거나, 부르지 않아도 되는 이유를
 * {@link UNLOCKED_INTEGRATION_OWNER_WRITES} 에 함께 적는다.
 */
export const INTEGRATION_OWNER_WRITES: Readonly<Record<string, string>> = {
  'codebase/backend/src/modules/integrations/integrations.service.ts::create':
    '통합 생성. 저장 트랜잭션의 첫 문장에서 lockForIntegrationWrite 로 잠근다',
  'codebase/backend/src/modules/integrations/integrations.service.ts::switchToPersonalLocked':
    '조직 → 개인 전환. lockForIntegrationWrite 로 만든 사람의 멤버십을 잠근 뒤 바꾼다(REQ-INTMGMT-067)',
  'codebase/backend/src/modules/integrations/integrations.service.ts::updateScope':
    '개인 → 조직 전환만 여기서 바꾼다. 조직 → 개인은 switchToPersonalLocked 로 보낸다',
  'codebase/backend/src/modules/integrations/integration-oauth.service.ts::writePrivatePending':
    'Cafe24 Private begin 의 설치 대기 행. 트랜잭션의 첫 문장에서 lockForPendingWrite 로 잠근다',
  'codebase/backend/src/modules/integrations/integration-oauth.service.ts::writeMakeshopPendingTx':
    'MakeShop begin 의 설치 대기 행. advisory lock 보다 먼저 lockForPendingWrite 로 잠근다',
};

/** 잠금 도우미를 부르지 않아도 되는 지점과 그 이유. {@link INTEGRATION_OWNER_WRITES} 의 부분집합이다. */
export const UNLOCKED_INTEGRATION_OWNER_WRITES: ReadonlySet<string> = new Set([
  'codebase/backend/src/modules/integrations/integrations.service.ts::updateScope',
]);

/**
 * 쓰기 잠금 도우미. `lockForPendingWrite` 는 `integration-oauth.service.ts` 안에서 `lockForIntegrationWrite` 를 감싼다.
 * 감싸는 도우미를 새로 만들면 여기에 더한다.
 */
export const INTEGRATION_WRITE_LOCK_HELPERS: ReadonlySet<string> = new Set([
  'lockForIntegrationWrite',
  'lockForPendingWrite',
]);

/** 통합 행을 넣는 원시 SQL. `integration_usage_log` 같은 다른 테이블은 걸리지 않는다. */
const RAW_INTEGRATION_INSERT = /\bINSERT\s+INTO\s+"?integration"?(?=[\s(]|$)/i;

function isIntegrationIdentifier(node: ts.Node | undefined): boolean {
  return (
    node !== undefined && ts.isIdentifier(node) && node.text === 'Integration'
  );
}

function isGetRepositoryOfIntegration(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'getRepository' &&
    isIntegrationIdentifier(node.arguments[0])
  );
}

function isIntegrationRepositoryType(
  type: ts.TypeNode | undefined,
  sf: ts.SourceFile,
): boolean {
  if (!type || !ts.isTypeReferenceNode(type)) return false;
  const [arg] = type.typeArguments ?? [];
  return (
    type.typeName.getText(sf) === 'Repository' &&
    arg !== undefined &&
    ts.isTypeReferenceNode(arg) &&
    arg.typeName.getText(sf) === 'Integration'
  );
}

/** `@InjectRepository(Integration)` · `Repository<Integration>` 형 · `getRepository(Integration)` 초기자로 통합 저장소가 된 이름들. */
function integrationRepositoryNames(sf: ts.SourceFile): Set<string> {
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
          isIntegrationIdentifier(d.expression.arguments[0]),
      );
      if (injected || isIntegrationRepositoryType(node.type, sf)) {
        names.add(node.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      ((node.initializer && isGetRepositoryOfIntegration(node.initializer)) ||
        isIntegrationRepositoryType(node.type, sf))
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

/** 두 번째 인자가 `scope` 키를 가진 객체 리터럴인가(`update(criteria, { scope })`). */
function setsScope(call: ts.CallExpression): boolean {
  const changes = call.arguments[1];
  return (
    changes !== undefined &&
    ts.isObjectLiteralExpression(changes) &&
    changes.properties.some(
      (p) =>
        (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
        ts.isIdentifier(p.name) &&
        p.name.text === 'scope',
    )
  );
}

/** 지점의 감싸는 함수 이름과 그 함수가 잠금 도우미를 부르는지. */
export interface IntegrationOwnerWrite {
  scope: string;
  locked: boolean;
}

/**
 * 소스 하나에서 통합 행을 만들거나 공개 범위를 바꾸는 지점을 모은다(감싸는 함수 이름순, 중복 없이).
 *
 * - 통합 저장소의 `create` · `insert` 와 `.into(Integration)` · `INSERT INTO integration` 원시 SQL. 엔티티를 만드는 것은
 *   새 행을 쓰려는 것이다.
 * - 통합 저장소의 `update` 중 바꿀 값에 `scope` 가 있는 것.
 *
 * `locked` 는 같은 함수(화살표 함수 콜백은 감싼 메서드로 센다) 안에 {@link INTEGRATION_WRITE_LOCK_HELPERS} 호출이 있는가다.
 * 호출 순서와 같은 트랜잭션인지는 보지 않는다. 그것은 각 경로의 단위 테스트가 본다. `save` 로 기존 엔티티의 `scope` 를
 * 바꾸는 쓰기와 쿼리 빌더의 `.update(Integration).set({ scope })` 는 잡지 않는다.
 */
export function findIntegrationOwnerWrites(
  source: string,
): IntegrationOwnerWrite[] {
  if (!/\bIntegration\b|\bintegration\b/.test(source)) return [];
  const sf = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const repos = integrationRepositoryNames(sf);
  const writers = new Set<string>();
  const lockers = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        INTEGRATION_WRITE_LOCK_HELPERS.has(node.expression.text)
      ) {
        lockers.add(enclosingScopeName(node, sf));
      }
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const receiver = node.expression.expression;
        const name = receiverName(receiver);
        const onIntegrationRepository =
          isGetRepositoryOfIntegration(receiver) ||
          (name !== null && repos.has(name));
        if (
          (onIntegrationRepository &&
            (method === 'create' ||
              method === 'insert' ||
              (method === 'update' && setsScope(node)))) ||
          (method === 'into' && isIntegrationIdentifier(node.arguments[0]))
        ) {
          writers.add(enclosingScopeName(node, sf));
        }
      }
    }
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node)) &&
      RAW_INTEGRATION_INSERT.test(node.text)
    ) {
      writers.add(enclosingScopeName(node, sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return [...writers]
    .sort()
    .map((scope) => ({ scope, locked: lockers.has(scope) }));
}

/** `srcDir` 아래 운영 코드(`.spec.ts` 제외)의 지점(`<경로>::<함수>` 이름순)과 잠금 여부. */
export function listIntegrationOwnerWrites(
  repoRoot: string,
  srcDir: string,
): Array<{ key: string; locked: boolean }> {
  return collectTsFiles(srcDir)
    .flatMap((file) =>
      findIntegrationOwnerWrites(fs.readFileSync(file, 'utf8')).map(
        ({ scope, locked }) => ({
          key: `${toPosixRelative(repoRoot, file)}::${scope}`,
          locked,
        }),
      ),
    )
    .sort((a, b) => a.key.localeCompare(b.key));
}
