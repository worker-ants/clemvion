import { isAbortErrorLike } from './abort-error.util.js';

describe('isAbortErrorLike', () => {
  it('is true for an Error named AbortError', () => {
    expect(
      isAbortErrorLike(Object.assign(new Error('x'), { name: 'AbortError' })),
    ).toBe(true);
  });

  it('is true for the DOMException a real aborted signal throws', () => {
    const controller = new AbortController();
    controller.abort();
    let thrown: unknown;
    try {
      controller.signal.throwIfAborted();
    } catch (err) {
      thrown = err;
    }
    expect(isAbortErrorLike(thrown)).toBe(true);
  });

  it('is true for an AbortError from another realm that is not an Error instance', () => {
    const foreign = { name: 'AbortError', message: 'aborted' };
    expect(foreign instanceof Error).toBe(false);
    expect(isAbortErrorLike(foreign)).toBe(true);
  });

  it('is false for other errors and for non-objects', () => {
    expect(isAbortErrorLike(new TypeError('fetch failed'))).toBe(false);
    expect(isAbortErrorLike('AbortError')).toBe(false);
    expect(isAbortErrorLike(null)).toBe(false);
    expect(isAbortErrorLike(undefined)).toBe(false);
  });
});
