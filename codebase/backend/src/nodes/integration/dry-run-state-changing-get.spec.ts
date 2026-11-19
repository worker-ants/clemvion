import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '../../common/__test-utils__/source-scan';

import {
  CAFE24_STATE_CHANGING_GET_OPERATION_IDS,
  isCafe24DryRunMocked,
  listAllCafe24Operations,
} from './cafe24/metadata/index.js';
import {
  MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS,
  isMakeshopDryRunMocked,
  listAllMakeshopOperations,
} from './makeshop/metadata/index.js';

/**
 * dry-run 재실행의 「상태를 바꾸는 GET」 예외 목록 가드.
 *
 * dry-run 은 GET operation 을 실제로 호출한다(CLE-EXEC-RERUN 「부수효과 판정」).
 * 메서드는 GET 인데 상점 상태를 바꾸는 operation 은 벤더별 예외 목록
 * (`CAFE24_STATE_CHANGING_GET_OPERATION_IDS` · `MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS`)
 * 에 올려 모의 응답을 받게 한다. 메타데이터는 OpenAPI 에서 다시 생성되므로, 그런
 * operation 이 새로 들어오면 여기서 막는다. 신호는 두 가지다.
 *
 * - `scopeType: 'write'` 인 GET 은 id · path 와 관계없이 예외 목록에 있어야 한다.
 * - id · path 조각에 쓰기를 뜻하는 영어 낱말이 있는 GET 은 예외 목록이나 아래
 *   「읽기로 확인한 GET」 중 하나에 있어야 한다.
 *
 * 두 신호 모두 휴리스틱이다. 지금 유일한 상태 변경 GET 인 MakeShop
 * `get-cart_free_config-update` 도 `scopeType` 은 `'read'` 라 두 번째 신호로만 걸린다.
 * 읽기 scope 이면서 id · path 에 낱말이 없는 상태 변경 GET(붙여 쓴 `autoupdate`, 설명에만
 * 드러나는 경우 등)은 둘 다 놓친다. 그래서 카탈로그를 다시 생성할 때 사람이 새 GET 을
 * 확인한다(`codebase/api-catalogs/README.md` 「카탈로그를 바꿀 때」).
 */
const WRITE_WORDS = new Set([
  'add',
  'apply',
  'approve',
  'cancel',
  'change',
  'confirm',
  'create',
  'delete',
  'edit',
  'give',
  'grant',
  'insert',
  'issue',
  'modify',
  'refund',
  'register',
  'remove',
  'reset',
  'restore',
  'save',
  'send',
  'set',
  'update',
  'write',
]);

/** 쓰기 낱말이 있지만 설명과 경로를 읽어 조회로 확인한 GET. 값은 확인 근거다. */
const VERIFIED_READ_GETS: Record<string, string> = {
  'cafe24:refunds_get': 'refund_code 로 환불 1건을 조회한다.',
  'cafe24:product_approve_get': '상품 승인 상태를 조회한다.',
  'makeshop:get-delete_product': '삭제된 상품 목록을 조회한다.',
  'makeshop:get-user_group_change_log': '회원 그룹 변경 내역을 조회한다.',
};

function wordsOf(operation: { id: string; path: string }): string[] {
  return `${operation.id}/${operation.path}`
    .toLowerCase()
    .split(/[/_\-{}]+/)
    .filter(Boolean);
}

interface GuardedOperation {
  id: string;
  method: string;
  path: string;
  scopeType: 'read' | 'write';
}

function suspiciousGets(
  vendor: string,
  operations: ReadonlyArray<GuardedOperation>,
): string[] {
  return operations
    .filter((op) => op.method === 'GET')
    .filter((op) => wordsOf(op).some((word) => WRITE_WORDS.has(word)))
    .map((op) => `${vendor}:${op.id}`);
}

function writeScopeGets(
  vendor: string,
  operations: ReadonlyArray<GuardedOperation>,
): string[] {
  return operations
    .filter((op) => op.method === 'GET' && op.scopeType === 'write')
    .map((op) => `${vendor}:${op.id}`);
}

/**
 * 벤더 등록표. 새 벤더를 더할 때 고칠 곳은 이 표 하나다. 예외 목록 가드와 판정 배선
 * 가드가 모두 이 표를 읽는다.
 *
 * - `predicate`: 벤더 메타데이터 모듈이 예외 목록을 묶어 내보내는 판정 함수 이름.
 * - `callSites`: 그 판정 함수를 부르는 파일(`nodes/` 기준). 노드 핸들러와 AI 에이전트의
 *   내부 MCP 브리지다. 판정 함수를 부르는 파일이 늘면 아래 「판정 배선」 이 막는다.
 */
const DRY_RUN_VENDORS = [
  {
    vendor: 'cafe24',
    predicate: 'isCafe24DryRunMocked',
    metadataModule: 'integration/cafe24/metadata/index.ts',
    exceptionIds: CAFE24_STATE_CHANGING_GET_OPERATION_IDS,
    operations: listAllCafe24Operations().map(
      (entry): GuardedOperation => entry.operation,
    ),
    callSites: [
      'integration/cafe24/cafe24.handler.ts',
      'ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts',
    ],
  },
  {
    vendor: 'makeshop',
    predicate: 'isMakeshopDryRunMocked',
    metadataModule: 'integration/makeshop/metadata/index.ts',
    exceptionIds: MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS,
    operations: listAllMakeshopOperations().map(
      (entry): GuardedOperation => entry.operation,
    ),
    callSites: [
      'integration/makeshop/makeshop.handler.ts',
      'ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts',
    ],
  },
] as const;

describe('dry-run 상태를 바꾸는 GET 예외 목록', () => {
  const vendors = DRY_RUN_VENDORS;

  const listedExceptions = new Set(
    vendors.flatMap(({ vendor, exceptionIds }) =>
      [...exceptionIds].map((id) => `${vendor}:${id}`),
    ),
  );

  it.each(vendors)(
    '$vendor 예외 목록의 id 는 모두 존재하는 GET operation 이다',
    ({ exceptionIds, operations }) => {
      for (const id of exceptionIds) {
        const op = operations.find((candidate) => candidate.id === id);
        expect({ id, method: op?.method }).toEqual({ id, method: 'GET' });
      }
    },
  );

  it.each(vendors)(
    '$vendor operation id 는 벤더 안에서 유일하다 (예외 목록이 id 하나를 키로 쓴다)',
    ({ operations }) => {
      const ids = operations.map((op) => op.id);
      expect(ids.length - new Set(ids).size).toBe(0);
    },
  );

  it('scopeType 이 write 인 GET 은 예외 목록에 있다', () => {
    const unlisted = vendors
      .flatMap(({ vendor, operations }) => writeScopeGets(vendor, operations))
      .filter((key) => !listedExceptions.has(key));

    // 새로 걸린 GET 이 쓰기 scope 를 요구하면 그 vendor 의 예외 목록에 올린다.
    expect(unlisted).toEqual([]);
  });

  it('쓰기 낱말이 있는 GET 은 예외 목록이나 확인한 조회 목록에 있다', () => {
    const listed = new Set([
      ...listedExceptions,
      ...Object.keys(VERIFIED_READ_GETS),
    ]);
    const unlisted = vendors
      .flatMap(({ vendor, operations }) => suspiciousGets(vendor, operations))
      .filter((key) => !listed.has(key));

    // 새로 걸린 GET 이 상태를 바꾸면 그 vendor 의 예외 목록에 올리고,
    // 조회라면 VERIFIED_READ_GETS 에 근거와 함께 올린다.
    expect(unlisted).toEqual([]);
  });

  it('확인한 조회 목록에 없어진 operation 이 남아 있지 않다', () => {
    const current = new Set(
      vendors.flatMap(({ vendor, operations }) =>
        suspiciousGets(vendor, operations),
      ),
    );
    const stale = Object.keys(VERIFIED_READ_GETS).filter(
      (key) => !current.has(key),
    );
    expect(stale).toEqual([]);
  });
});

describe('벤더 dry-run 판정 함수', () => {
  it('MakeShop 은 예외 목록의 GET 을 모의 처리하고 나머지 GET 은 통과시킨다', () => {
    expect(
      isMakeshopDryRunMocked({
        id: 'get-cart_free_config-update',
        method: 'GET',
      }),
    ).toBe(true);
    expect(
      isMakeshopDryRunMocked({ id: 'get-cart_free_config', method: 'GET' }),
    ).toBe(false);
    expect(isMakeshopDryRunMocked({ id: 'post-order', method: 'POST' })).toBe(
      true,
    );
  });

  it('Cafe24 는 GET 이 아니면 모의 처리하고 GET 은 통과시킨다', () => {
    expect(isCafe24DryRunMocked({ id: 'products_get', method: 'GET' })).toBe(
      false,
    );
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect(isCafe24DryRunMocked({ id: 'products_x', method })).toBe(true);
    }
  });
});

/**
 * 호출 지점이 벤더 판정 함수를 실제 조건식에서 부르는지 소스로 확인한다. dry-run 판정
 * 배선은 이 describe 한 곳에서만 본다(AI 에이전트 provider 분류 가드는 `ctx.dryRun`
 * 분기와 모의 응답 빌더만 본다).
 *
 * 주석을 걷어 낸 뒤 `if (… <판정 함수>(<인자>))` 꼴을 요구한다. import 줄이나 주석에
 * 남은 이름만으로는 통과하지 않고, 인자 변수 이름은 따지지 않는다. 코어 판정
 * `isDryRunMockedOperation` 을 직접 부르면 벤더 예외 목록을 건너뛰므로 벤더 메타데이터
 * 모듈 밖에서는 부르지 못하게 한다.
 */
describe('dry-run 판정 배선', () => {
  const nodesDir = join(__dirname, '..');
  const codeOf = (rel: string): string =>
    stripComments(readFileSync(join(nodesDir, rel), 'utf8'));

  /** `if (` 조건식 안에서 `predicate(<인자 하나>)` 를 부르는 꼴. 블록 · 문장 경계는 넘지 않는다. */
  const guardedCall = (predicate: string): RegExp =>
    new RegExp(
      `\\bif\\s*\\([^{};]*\\b${predicate}\\s*\\(\\s*[^(),\\s]+\\s*\\)`,
    );

  /** 정의(`function x(`)를 빼고 이름 뒤에 `(` 가 오는 호출. */
  const anyCall = (name: string): RegExp =>
    new RegExp(`(?<!function\\s+)\\b${name}\\s*\\(`);

  const nodeSources = readdirSync(nodesDir, { recursive: true })
    .map(String)
    .filter((rel) => rel.endsWith('.ts') && !rel.endsWith('.spec.ts'))
    .map((rel) => rel.split('\\').join('/'));

  const callSites = DRY_RUN_VENDORS.flatMap(({ predicate, callSites: files }) =>
    files.map((source) => ({ source, predicate })),
  );

  it.each(callSites)(
    '$source 는 조건식에서 $predicate 로 모의 여부를 정한다',
    ({ source, predicate }) => {
      const code = codeOf(source);
      expect(code).toMatch(guardedCall(predicate));
      expect(code).not.toMatch(anyCall('isDryRunMockedOperation'));
    },
  );

  it.each(DRY_RUN_VENDORS)(
    '$predicate 를 부르는 파일은 등록표의 호출 지점뿐이다',
    ({ predicate, callSites: files }) => {
      const found = nodeSources.filter((rel) =>
        anyCall(predicate).test(codeOf(rel)),
      );
      expect(found.sort()).toEqual([...files].sort());
    },
  );

  it('코어 isDryRunMockedOperation 은 벤더 메타데이터 모듈만 부른다', () => {
    const found = nodeSources.filter(
      (rel) =>
        rel !== 'core/dry-run.util.ts' &&
        anyCall('isDryRunMockedOperation').test(codeOf(rel)),
    );
    expect(found.sort()).toEqual(
      DRY_RUN_VENDORS.map(({ metadataModule }) => metadataModule).sort(),
    );
  });

  it('[대조군] 조건식 정규식은 import · 주석만 있는 소스를 통과시키지 않는다', () => {
    const pattern = guardedCall('isCafe24DryRunMocked');
    expect(
      stripComments(
        [
          "import { isCafe24DryRunMocked } from './metadata';",
          '// if (isDryRun(ctx) && isCafe24DryRunMocked(operation)) {',
          '/* if (isCafe24DryRunMocked(operation)) { */',
          'if (isDryRun(ctx)) {',
        ].join('\n'),
      ),
    ).not.toMatch(pattern);
    expect('if (isDryRun(context) && isCafe24DryRunMocked(op)) {').toMatch(
      pattern,
    );
  });
});
