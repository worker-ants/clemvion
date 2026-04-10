import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const mockContext = {} as any;
  const createHandler = (data: unknown) => ({
    handle: () => of(data),
  });

  it('should wrap plain objects in { data: ... }', (done) => {
    interceptor
      .intercept(mockContext, createHandler({ success: true }) as any)
      .subscribe((result) => {
        expect(result).toEqual({ data: { success: true } });
        done();
      });
  });

  it('should wrap objects with error key consistently', (done) => {
    interceptor
      .intercept(
        mockContext,
        createHandler({ success: false, error: 'test error' }) as any,
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
      .intercept(mockContext, createHandler(response) as any)
      .subscribe((result) => {
        expect(result).toEqual(response);
        done();
      });
  });

  it('should wrap arrays in { data: ... }', (done) => {
    interceptor
      .intercept(mockContext, createHandler([1, 2, 3]) as any)
      .subscribe((result) => {
        expect(result).toEqual({ data: [1, 2, 3] });
        done();
      });
  });

  it('should wrap null in { data: null }', (done) => {
    interceptor
      .intercept(mockContext, createHandler(null) as any)
      .subscribe((result) => {
        expect(result).toEqual({ data: null });
        done();
      });
  });

  it('should wrap primitives in { data: ... }', (done) => {
    interceptor
      .intercept(mockContext, createHandler('hello') as any)
      .subscribe((result) => {
        expect(result).toEqual({ data: 'hello' });
        done();
      });
  });
});
