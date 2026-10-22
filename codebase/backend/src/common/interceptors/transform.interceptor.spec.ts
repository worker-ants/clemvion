import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const mockContext = { getType: () => 'http' } as any;
  const createHandler = (data: unknown) => ({
    handle: () => of(data),
  });

  it('should wrap plain objects in { data: ... }', (done) => {
    interceptor
      .intercept(mockContext, createHandler({ success: true }))
      .subscribe((result) => {
        expect(result).toEqual({ data: { success: true } });
        done();
      });
  });

  it('should wrap objects with error key consistently', (done) => {
    interceptor
      .intercept(
        mockContext,
        createHandler({ success: false, error: 'test error' }),
      )
      .subscribe((result) => {
        expect(result).toEqual({
          data: { success: false, error: 'test error' },
        });
        done();
      });
  });

  it('should pass through objects that already have data key', (done) => {
    const response = { data: [1, 2, 3], meta: { total: 3 } };
    interceptor
      .intercept(mockContext, createHandler(response))
      .subscribe((result) => {
        expect(result).toEqual(response);
        done();
      });
  });

  it('should wrap arrays in { data: ... }', (done) => {
    interceptor
      .intercept(mockContext, createHandler([1, 2, 3]))
      .subscribe((result) => {
        expect(result).toEqual({ data: [1, 2, 3] });
        done();
      });
  });

  it('should wrap null in { data: null }', (done) => {
    interceptor
      .intercept(mockContext, createHandler(null))
      .subscribe((result) => {
        expect(result).toEqual({ data: null });
        done();
      });
  });

  it('should wrap primitives in { data: ... }', (done) => {
    interceptor
      .intercept(mockContext, createHandler('hello'))
      .subscribe((result) => {
        expect(result).toEqual({ data: 'hello' });
        done();
      });
  });

  // NestJS 12 부터 APP_INTERCEPTOR 가 WebSocket 게이트웨이 핸들러에도 붙는다. ack 는 `{ event, data }` 라
  // `'data' in data` 분기로 우연히 통과했지만, `data` 키가 없는 값이나 void 는 `{ data }` 로 감싸져
  // wire 모양이 바뀐다. HTTP 가 아니면 감싸지 않는다.
  describe('HTTP 가 아닌 컨텍스트 (WebSocket)', () => {
    const wsContext = { getType: () => 'ws' } as any;

    it.each([
      ['data 키가 없는 객체', { ok: true }],
      ['void', undefined],
      ['null', null],
      ['원시값', 'pong'],
      ['{ event, data } ack', { event: 'subscribed', data: { success: true } }],
    ])('%s 는 감싸지 않고 그대로 돌려준다', async (_label, value) => {
      const result = await new Promise<unknown>((resolve) => {
        interceptor
          .intercept(wsContext, createHandler(value))
          .subscribe((v) => resolve(v));
      });
      expect(result).toBe(value);
    });
  });
});
