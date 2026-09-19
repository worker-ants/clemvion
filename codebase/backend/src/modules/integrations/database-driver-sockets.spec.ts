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
    const client = new PgClient({ host: '127.0.0.1', port: 1 });
    const stream = (client as unknown as HasSocket).connection?.stream;
    expect(typeof stream?.destroy).toBe('function');
    (stream as { destroy: () => void }).destroy();
  });

  it('mysql2 promise Connection 은 connection.stream 에 소켓을 둔다', () => {
    // 포트 9(discard)로 만든 코어 연결 — 곧 실패하지만 구조만 본다.
    const core = mysqlCoreConnection({
      host: '127.0.0.1',
      port: 9,
      connectTimeout: 1_000,
    });
    core.on('error', () => {});
    const wrapped = new PromiseConnection(core);
    const stream = (wrapped as unknown as HasSocket).connection?.stream;
    expect(typeof stream?.destroy).toBe('function');
    (stream as { destroy: () => void }).destroy();
  });
});
