import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
 *   「읽기로 확인한 GET」 중 하나에 있어야 한다. 낱말이 없는 상태 변경 GET 은 이 신호가
 *   놓치므로 첫 신호가 보완한다.
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

describe('dry-run 상태를 바꾸는 GET 예외 목록', () => {
  const vendors = [
    {
      vendor: 'cafe24',
      exceptionIds: CAFE24_STATE_CHANGING_GET_OPERATION_IDS,
      operations: listAllCafe24Operations().map(
        (entry): GuardedOperation => entry.operation,
      ),
    },
    {
      vendor: 'makeshop',
      exceptionIds: MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS,
      operations: listAllMakeshopOperations().map(
        (entry): GuardedOperation => entry.operation,
      ),
    },
  ] as const;

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
 * 호출 지점이 벤더 판정 함수를 거치는지 소스로 확인한다. 코어 판정
 * `isDryRunMockedOperation` 을 직접 부르면 벤더 예외 목록을 건너뛴다. 두 번째 인자는
 * 필수라 직접 부르려면 목록을 손으로 넘겨야 하고, 그러면 아래 테스트가 막는다.
 */
describe('dry-run 판정 배선', () => {
  const nodesDir = join(__dirname, '..');
  const call = [
    {
      source: 'integration/cafe24/cafe24.handler.ts',
      predicate: 'isCafe24DryRunMocked',
    },
    {
      source: 'ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts',
      predicate: 'isCafe24DryRunMocked',
    },
    {
      source: 'integration/makeshop/makeshop.handler.ts',
      predicate: 'isMakeshopDryRunMocked',
    },
    {
      source: 'ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts',
      predicate: 'isMakeshopDryRunMocked',
    },
  ];

  it.each(call)(
    '$source 는 $predicate 로 모의 여부를 정한다',
    ({ source, predicate }) => {
      const text = readFileSync(join(nodesDir, source), 'utf8');
      expect(text).toContain(`${predicate}(operation)`);
      expect(text).not.toContain('isDryRunMockedOperation');
    },
  );
});
