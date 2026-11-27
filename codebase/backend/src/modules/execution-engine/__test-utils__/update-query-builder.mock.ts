/**
 * 조건부 UPDATE(`createQueryBuilder().update(…).set(…).where(…)…execute()`) 체인 mock.
 *
 * 실행 엔진 스펙들이 같은 체인 mock 을 테스트마다 손으로 다시 써 왔다
 * (`retry-turn.service.spec.ts` 의 `createQueryBuilder = jest.fn(…)` 재정의,
 * `execution-engine.service.spec.ts` 의 트랜잭션 헬퍼 쌍). 인자 순서가 반대인 쌍이
 * 함께 있어 복붙할 때 헷갈렸다(CLE-T-WKESFB). 이 파일 하나로 모은다.
 *
 * 체인은 늘 완전하게 만든다(`update` · `set` · `setParameter` · `where` · `andWhere` ·
 * `returning` · `execute`). 제품 코드가 체인 메서드를 하나 더 부를 때 불완전한 mock 은
 * TypeError 를 던지고, 그 호출이 try/catch 안이면 테스트가 조용히 vacuous 해진다
 * (#1171 에서 실제로 겪었다).
 */

/** 체인 메서드 이름. `execute` 는 따로 다룬다. */
const CHAIN_METHODS = [
  'update',
  'set',
  'setParameter',
  'where',
  'andWhere',
  'returning',
] as const;
type ChainMethod = (typeof CHAIN_METHODS)[number];

/**
 * 체인 메서드마다 붙일 관찰 함수. 받은 인자를 그대로 넘겨 부르고 반환값은 버린다
 * (체인은 늘 qb 를 돌려준다). 인자를 모으거나 `toHaveBeenCalledWith` 로 단언할 spy 를
 * 넣는다. 메서드 꼴로 선언해 `(v: Record<string, unknown>) => void` 같은 좁은 함수도
 * 받는다.
 */
export interface UpdateQbObservers {
  update?(...args: never[]): unknown;
  set?(...args: never[]): unknown;
  setParameter?(...args: never[]): unknown;
  where?(...args: never[]): unknown;
  andWhere?(...args: never[]): unknown;
  returning?(...args: never[]): unknown;
}

export interface UpdateQbOptions extends UpdateQbObservers {
  /** `execute()` 가 돌려줄 영향 행 수. 기본값 1. `execute` 를 주면 무시한다. */
  affected?: number;
  /**
   * `RETURNING` 결과. 영향 행이 있을 때만 `raw` 로 싣고 0행이면 빈 배열을 싣는다.
   * 주지 않으면 결과에 `raw` 키가 없다.
   */
  raw?: unknown[];
  /** `execute` 를 직접 준다. 호출 순서(`invocationCallOrder`)나 실패를 단언할 때 쓴다. */
  execute?: jest.Mock;
}

/** 체인 메서드가 모두 `jest.Mock` 인 qb. `target` 은 `update()` 에 넘긴 엔티티 이름이다. */
export type MockUpdateQb = Record<ChainMethod | 'execute', jest.Mock> & {
  target: string;
};

/**
 * 완전한 UPDATE 체인 qb 하나를 만든다.
 *
 * @param order 주면 `execute()` 때 `target`(엔티티 이름)을 넣는다. 잠금 순서를 단언할 때 쓴다.
 */
export function makeUpdateQb(
  options: UpdateQbOptions = {},
  order?: string[],
): MockUpdateQb {
  const qb = { target: '' } as MockUpdateQb;
  const observers = options as Record<
    ChainMethod,
    ((...args: unknown[]) => unknown) | undefined
  >;
  for (const method of CHAIN_METHODS) {
    qb[method] = jest.fn((...args: unknown[]) => {
      if (method === 'update') {
        const entity = args[0] as { name?: unknown } | undefined;
        qb.target = typeof entity?.name === 'string' ? entity.name : '';
      }
      observers[method]?.(...args);
      return qb;
    });
  }
  const affected = options.affected ?? 1;
  const result =
    options.raw === undefined
      ? { affected }
      : { affected, raw: affected > 0 ? options.raw : [] };
  const execute = options.execute ?? jest.fn(() => Promise.resolve(result));
  qb.execute = order
    ? jest.fn((...args: unknown[]) => {
        order.push(qb.target);
        return execute(...args) as unknown;
      })
    : execute;
  return qb;
}

/**
 * 레포지토리의 `createQueryBuilder` 자리에 넣을 mock 을 만든다. 부를 때마다 새 qb 를 준다.
 *
 * 옵션 대신 함수를 주면 몇 번째 호출인지(1부터)를 받아 그 qb 의 옵션을 정한다.
 * 첫 UPDATE 는 claim, 다음은 마감처럼 호출마다 결과가 다를 때 쓴다.
 */
export function mockGuardedUpdateBuilder(
  options: UpdateQbOptions | ((build: number) => UpdateQbOptions) = {},
): jest.Mock<MockUpdateQb, []> {
  let build = 0;
  return jest.fn(() => {
    build += 1;
    return makeUpdateQb(
      typeof options === 'function' ? options(build) : options,
    );
  });
}

/**
 * 테이블마다 영향 행 수만 정하는 짧은 꼴. 테스트 파일의 설치 헬퍼가 받는다.
 * 이름으로 넘겨서 위치 인자 순서(exec · node / node · exec)를 헷갈릴 일이 없다.
 */
export interface TxAffected {
  /** Execution UPDATE 의 영향 행 수. */
  execution: number;
  /** NodeExecution UPDATE 의 영향 행 수. */
  nodeExecution: number;
}

/** {@link installTxUpdateBuilders} 의 옵션. 이름으로 테이블마다 결과를 정한다. */
export interface TxUpdateBuildersOptions {
  /** 트랜잭션 안 첫 UPDATE(Execution). */
  execution: UpdateQbOptions;
  /** 트랜잭션 안 둘째 UPDATE(NodeExecution). 기본값 `{ affected: 1 }`. */
  nodeExecution?: UpdateQbOptions;
}

export interface TxUpdateBuilders {
  /** Execution UPDATE qb. */
  execQb: MockUpdateQb;
  /** NodeExecution UPDATE qb. */
  nodeQb: MockUpdateQb;
  /** `dataSource.transaction` 자리에 넣은 mock. 콜백이 던지면 reject 한다. */
  tx: jest.Mock;
  /** 트랜잭션 manager 의 `createQueryBuilder`. */
  managerCqb: jest.Mock;
  /** `execute()` 된 엔티티 이름 순서. */
  order: string[];
  /** `update()` 에 넘긴 엔티티 이름으로 찾은 qb. */
  byEntity: Record<string, MockUpdateQb>;
}

/**
 * `service.dataSource.transaction` 을 mock 으로 바꾼다. 콜백은 바로 실행되고, manager 의
 * `createQueryBuilder()` 는 Execution qb · NodeExecution qb 를 이 순서로 준다
 * (형제 경로의 잠금 순서 Execution → NodeExecution, CLE-T-9JBVQK). 트랜잭션을 다시
 * 부르면 순서는 처음부터 다시 센다.
 *
 * qb 는 설치할 때 한 벌만 만들어 모든 트랜잭션이 함께 쓴다. 동시 claim 처럼 트랜잭션마다
 * 결과가 달라야 하면 `execute` 를 `mockResolvedValueOnce` 로 이어 준다.
 */
export function installTxUpdateBuilders(
  service: unknown,
  options: TxUpdateBuildersOptions,
): TxUpdateBuilders {
  const order: string[] = [];
  const byEntity: Record<string, MockUpdateQb> = {};
  const execQb = makeUpdateQb(options.execution, order);
  const nodeQb = makeUpdateQb(options.nodeExecution ?? { affected: 1 }, order);
  for (const qb of [execQb, nodeQb]) {
    const update = qb.update;
    qb.update = jest.fn((...args: unknown[]) => {
      update(...args);
      byEntity[qb.target] = qb;
      return qb;
    });
  }
  const qbs = [execQb, nodeQb];
  // 호출 수만 세는 spy. 순서 카운터는 트랜잭션마다 따로 둬야 동시 트랜잭션이 섞이지 않는다.
  const managerCqb = jest.fn();
  const tx = jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
    let i = 0;
    return cb({
      createQueryBuilder: (...args: unknown[]) => {
        managerCqb(...args);
        return qbs[i++];
      },
    });
  });
  (
    service as { dataSource: { transaction: jest.Mock } }
  ).dataSource.transaction = tx;
  return { execQb, nodeQb, tx, managerCqb, order, byEntity };
}

/**
 * {@link TxAffected} 와 선택적 `raw`(`RETURNING` 행)로 두 UPDATE 를 한 번에 설치하는 짧은 꼴.
 * `raw` 를 주면 두 테이블 모두에 싣는다. 스펙마다 같은 매핑 래퍼를 다시 쓰지 않게 모았다.
 */
export function installTxByAffected(
  service: unknown,
  affected: TxAffected,
  raw?: unknown[],
): TxUpdateBuilders {
  return installTxUpdateBuilders(service, {
    execution: { affected: affected.execution, raw },
    nodeExecution: { affected: affected.nodeExecution, raw },
  });
}
