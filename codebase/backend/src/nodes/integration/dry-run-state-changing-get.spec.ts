import { listAllCafe24Operations } from './cafe24/metadata/index.js';
import {
  MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS,
  listAllMakeshopOperations,
} from './makeshop/metadata/index.js';

/**
 * dry-run 재실행의 「상태를 바꾸는 GET」 예외 목록 가드.
 *
 * dry-run 은 GET operation 을 실제로 호출한다(CLE-EXEC-RERUN 「부수효과 판정」).
 * 메서드는 GET 인데 상점 상태를 바꾸는 operation 은 예외 목록에 올려 모의 응답을
 * 받게 한다. 메타데이터는 OpenAPI 에서 다시 생성되므로, 그런 operation 이 새로
 * 들어오면 여기서 막는다. id · path 조각에 쓰기를 뜻하는 낱말이 있는 GET 은
 * 예외 목록이나 아래 「읽기로 확인한 GET」 중 하나에 있어야 한다.
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

function suspiciousGets(
  vendor: string,
  operations: ReadonlyArray<{ id: string; method: string; path: string }>,
): string[] {
  return operations
    .filter((op) => op.method === 'GET')
    .filter((op) => wordsOf(op).some((word) => WRITE_WORDS.has(word)))
    .map((op) => `${vendor}:${op.id}`);
}

describe('dry-run 상태를 바꾸는 GET 예외 목록', () => {
  const cafe24 = listAllCafe24Operations().map((entry) => entry.operation);
  const makeshop = listAllMakeshopOperations().map((entry) => entry.operation);

  it('MakeShop 예외 목록의 id 는 모두 존재하는 GET operation 이다', () => {
    for (const id of MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS) {
      const op = makeshop.find((candidate) => candidate.id === id);
      expect({ id, method: op?.method }).toEqual({ id, method: 'GET' });
    }
  });

  it('쓰기 낱말이 있는 GET 은 예외 목록이나 확인한 조회 목록에 있다', () => {
    const listed = new Set([
      ...[...MAKESHOP_STATE_CHANGING_GET_OPERATION_IDS].map(
        (id) => `makeshop:${id}`,
      ),
      ...Object.keys(VERIFIED_READ_GETS),
    ]);
    const unlisted = [
      ...suspiciousGets('cafe24', cafe24),
      ...suspiciousGets('makeshop', makeshop),
    ].filter((key) => !listed.has(key));

    // 새로 걸린 GET 이 상태를 바꾸면 그 vendor 의 예외 목록에 올리고,
    // 조회라면 VERIFIED_READ_GETS 에 근거와 함께 올린다.
    expect(unlisted).toEqual([]);
  });

  it('확인한 조회 목록에 없어진 operation 이 남아 있지 않다', () => {
    const current = new Set([
      ...suspiciousGets('cafe24', cafe24),
      ...suspiciousGets('makeshop', makeshop),
    ]);
    const stale = Object.keys(VERIFIED_READ_GETS).filter(
      (key) => !current.has(key),
    );
    expect(stale).toEqual([]);
  });
});
