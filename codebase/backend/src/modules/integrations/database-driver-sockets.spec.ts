import { Client as PgClient } from 'pg';
import { createConnection as mysqlCoreConnection } from 'mysql2';

// `createConnection`(promise)이 돌려주는 래퍼 클래스 — 런타임은 내보내지만 타입 정의에는 없다.
const { PromiseConnection } = jest.requireActual<{
  PromiseConnection: new (core: unknown) => unknown;
}>('mysql2/promise');

/**
 * `database-connection-tester.ts` 의 `closeWithin` 은 닫기가 끝나지 않으면 드라이버 내부 소켓(`connection.stream`)을
 * 파괴한다 — 두 드라이버의 **공개되지 않은** 구조에 기댄다. 그 테스터의 spec 은 드라이버를 모킹하므로 이 가정을 보지
 * 못한다. 여기서는 모킹 없이 실제 드라이버 객체로 가정을 고정한다 — 드라이버를 올렸을 때 구조가 바뀌면 여기서 RED.
 * (바뀌어도 테스터는 결과를 바꾸지 않고 경고만 남기며 조용히 넘어간다 — 그래서 이 고정이 필요하다.)
 */
describe('DB 드라이버 소켓 위치 — closeWithin 이 기대는 구조', () => {
  type HasSocket = { connection?: { stream?: { destroy?: unknown } } };

  it('pg Client 는 connection.stream 에 소켓을 둔다', () => {
    // pg 는 생성만으로 연결하지 않는다 — connect() 전의 소켓 객체다.
    const client = new PgClient({ host: '127.0.0.1', port: 1 });
    const stream = (client as unknown as HasSocket).connection?.stream;
    try {
      expect(typeof stream?.destroy).toBe('function');
    } finally {
      (stream as { destroy?: () => void } | undefined)?.destroy?.();
    }
  });

  it('mysql2 promise Connection 은 connection.stream 에 소켓을 둔다', () => {
    // **unit 계층에서 예외적으로 실제 소켓을 연다** — mysql2 코어는 생성과 동시에 연결을 시작하므로 구조를 보려면 피할 수
    // 없다. 루프백 포트 9(discard)라 곧 실패하고, 단언이 실패해도 소켓이 남지 않게 finally 에서 닫는다.
    const core = mysqlCoreConnection({
      host: '127.0.0.1',
      port: 9,
      connectTimeout: 1_000,
    });
    core.on('error', () => {});
    const wrapped = new PromiseConnection(core);
    const stream = (wrapped as unknown as HasSocket).connection?.stream;
    try {
      expect(typeof stream?.destroy).toBe('function');
    } finally {
      (stream as { destroy?: () => void } | undefined)?.destroy?.();
    }
  });
});
